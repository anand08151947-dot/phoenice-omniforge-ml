"""Chat router — Phase 12: LM Studio-backed AI assistant with rule-based fallback."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

try:
    import httpx
    _HTTPX_AVAILABLE = True
except ImportError:  # pragma: no cover
    _HTTPX_AVAILABLE = False

router = APIRouter()

LM_STUDIO_URL = "http://localhost:1234/v1"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    dataset_id: str | None = None


class ChatResponse(BaseModel):
    content: str
    id: str
    timestamp: str
    sources: list[str] = []
    lm_studio_used: bool = False


# ---------------------------------------------------------------------------
# LM Studio helpers
# ---------------------------------------------------------------------------

async def _check_lm_studio() -> tuple[bool, str | None]:
    """Return (available, model_name)."""
    if not _HTTPX_AVAILABLE:
        return False, None
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{LM_STUDIO_URL}/models")
            if resp.status_code == 200:
                data = resp.json()
                models = data.get("data", [])
                model_name = models[0]["id"] if models else "local-model"
                return True, model_name
    except Exception:
        pass
    return False, None


async def _call_lm_studio(messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{LM_STUDIO_URL}/chat/completions",
            json={
                "model": "local-model",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 512,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Dataset context builder
# ---------------------------------------------------------------------------

def _build_dataset_context(dataset: Dataset) -> str:
    """Summarise key dataset facts for the system prompt."""
    parts: list[str] = []
    parts.append(f"Dataset: {dataset.name}")
    if dataset.task_type:
        parts.append(f"Task type: {dataset.task_type.value}")
    if dataset.row_count:
        parts.append(f"Rows: {dataset.row_count}")
    if dataset.col_count:
        parts.append(f"Columns: {dataset.col_count}")
    if dataset.target_column:
        parts.append(f"Target column: {dataset.target_column}")
    if dataset.training_results:
        tr = dataset.training_results
        best = tr.get("best_model")
        score = tr.get("best_cv_score")
        if best:
            parts.append(f"Best model: {best}")
        if score is not None:
            parts.append(f"CV score: {score:.4f}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------

def _rule_based_response(message: str, dataset: Dataset | None) -> str:
    msg_lower = message.lower()

    ctx = ""
    if dataset and dataset.training_results:
        tr = dataset.training_results
        best = tr.get("best_model", "the best model")
        score = tr.get("best_cv_score")
        score_str = f" with CV score {score:.4f}" if score is not None else ""
        ctx = f" Based on your dataset, **{best}**{score_str} was selected."

    if "explain" in msg_lower:
        return (
            "I can explain how your model makes predictions using SHAP values and feature importance. "
            "The Explain tab shows the top features driving each prediction, along with SHAP summary plots "
            "and individual prediction breakdowns." + ctx
        )

    if any(k in msg_lower for k in ("accuracy", "performance", "score", "metric")):
        return (
            "Model performance is measured via cross-validation on a hold-out split." + ctx +
            " You can compare all trained models in the Training and Evaluation tabs."
        )

    if any(k in msg_lower for k in ("clean", "missing", "null", "impute")):
        return (
            "Data quality is critical for good model performance. OmniForge automatically detects "
            "missing values, outliers, and inconsistent types. The Cleaning tab shows the suggested "
            "cleaning plan and lets you approve or customise each transformation."
        )

    if "feature" in msg_lower:
        return (
            "Feature engineering can significantly improve model accuracy. OmniForge suggests "
            "polynomial features, interaction terms, date decomposition, and target encoding "
            "depending on your task type. See the Features tab for the full plan."
        )

    if any(k in msg_lower for k in ("deploy", "endpoint", "serve")):
        return (
            "You can deploy your best model as a REST endpoint from the Deploy tab. "
            "OmniForge records the deployment and provides monitoring metrics including "
            "latency, request volume, and feature drift." + ctx
        )

    return (
        "I'm OmniForge's AI assistant. I can help you understand your data, interpret model results, "
        "advise on feature engineering, explain predictions, and guide you through the AutoML pipeline. "
        "Try asking about model performance, data cleaning, feature importance, or deployment."
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    dataset: Dataset | None = None
    if body.dataset_id:
        result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
        dataset = result.scalar_one_or_none()

    # Build system prompt
    system_parts = [
        "You are OmniForge AI, an expert AutoML assistant. "
        "Help the user understand their data, model results, and pipeline decisions. "
        "Be concise, practical, and data-driven."
    ]
    if dataset:
        system_parts.append("\n\nDataset context:\n" + _build_dataset_context(dataset))

    system_prompt = "\n".join(system_parts)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": body.message},
    ]

    # Try LM Studio first
    if _HTTPX_AVAILABLE:
        available, _ = await _check_lm_studio()
        if available:
            try:
                reply = await _call_lm_studio(messages)
                return ChatResponse(
                    content=reply,
                    id=str(uuid.uuid4()),
                    timestamp=datetime.utcnow().isoformat(),
                    sources=["LM Studio"],
                    lm_studio_used=True,
                )
            except Exception:
                pass  # Fall through to rule-based

    # Rule-based fallback
    reply = _rule_based_response(body.message, dataset)
    return ChatResponse(
        content=reply,
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow().isoformat(),
        sources=["OmniForge rule-based assistant"],
        lm_studio_used=False,
    )


@router.get("/chat/status")
async def chat_status():
    available, model = await _check_lm_studio()
    return {"lm_studio_available": available, "model": model}
