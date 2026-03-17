"""Evaluation router — Phase 8+9."""
from __future__ import annotations

import asyncio
import datetime as _dt
import io
import json
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


class EvaluationRunRequest(BaseModel):
    dataset_id: str


class PromoteRequest(BaseModel):
    dataset_id: str
    model_id: str
    stage: str = "production"


def _run_evaluation_inline(
    dataset_id: str,
    minio_path: str,
    original_filename: str,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
    training_results: dict,
) -> dict:
    from ...core.config import settings as _s
    from ...storage.minio import download_bytes
    from ...ml.evaluation.evaluator import run_evaluation

    raw = download_bytes(_s.MINIO_BUCKET_DATASETS, minio_path)
    from ...utils.dataframe_io import read_dataframe
    df = read_dataframe(raw, original_filename)

    return run_evaluation(
        dataset_id=dataset_id,
        df=df,
        target_column=target_column,
        task_type=task_type,
        selection_plan=selection_plan,
        sampling_config=sampling_config,
        training_results=training_results,
    )


@router.get("/evaluation")
async def get_evaluation(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.evaluation_results:
        eval_res = dict(dataset.evaluation_results)
        # Staleness check: if training happened after evaluation, flag it
        trained_at_str = (dataset.training_results or {}).get("trained_at")
        evaluated_at_str = eval_res.get("evaluated_at")
        if trained_at_str and evaluated_at_str:
            from datetime import datetime
            try:
                trained_at = datetime.fromisoformat(trained_at_str)
                evaluated_at = datetime.fromisoformat(evaluated_at_str)
                eval_res["stale"] = trained_at > evaluated_at
            except ValueError:
                pass
        elif trained_at_str and not evaluated_at_str:
            eval_res["stale"] = True
        return eval_res

    raise HTTPException(
        status_code=404,
        detail="No evaluation results yet. Complete training and run evaluation first.",
    )


@router.post("/evaluation/run")
async def run_evaluation_endpoint(
    body: EvaluationRunRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.training_results:
        raise HTTPException(
            status_code=422,
            detail="No training results found. Run training first.",
        )
    if not dataset.target_column:
        raise HTTPException(status_code=422, detail="Target column not set")
    if not dataset.minio_path:
        raise HTTPException(status_code=422, detail="No dataset file found")

    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"
    target_column = dataset.target_column
    task_type = dataset.task_type.value if dataset.task_type else "classification"

    loop = asyncio.get_event_loop()
    try:
        evaluation_results = await loop.run_in_executor(
            None,
            _run_evaluation_inline,
            body.dataset_id,
            minio_path,
            original_filename,
            target_column,
            task_type,
            dataset.selection_plan,
            dataset.sampling_config,
            dataset.training_results,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}") from exc

    await db.execute(
        text("UPDATE datasets SET evaluation_results=:r, updated_at=:now WHERE id=:id"),
        {
            "id": body.dataset_id,
            "r": json.dumps({**evaluation_results, "evaluated_at": datetime.now(timezone.utc).isoformat()}),
            "now": datetime.now(timezone.utc),
        },
    )
    await db.commit()
    return evaluation_results


@router.post("/evaluation/promote")
async def promote_model(body: PromoteRequest, db: AsyncSession = Depends(get_db)):
    """Promote a model to a new stage (staging/production/archived)."""
    result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    tr = dict(dataset.training_results or {})

    leaderboard = tr.get("leaderboard", [])
    promoted_model = None
    for entry in leaderboard:
        if entry.get("model_id") == body.model_id or entry.get("model_name") == body.model_id:
            entry["stage"] = body.stage
            promoted_model = entry
        elif body.stage == "production" and entry.get("stage") == "production":
            entry["stage"] = "staging"
    tr["leaderboard"] = leaderboard

    promotions = tr.get("promotions", [])
    promotions.append({
        "model_id": body.model_id,
        "stage": body.stage,
        "timestamp": _dt.datetime.utcnow().isoformat(),
    })
    tr["promotions"] = promotions

    await db.execute(
        update(Dataset).where(Dataset.id == body.dataset_id).values(training_results=tr)
    )
    await db.commit()

    return {
        "status": "promoted",
        "model_id": body.model_id,
        "stage": body.stage,
        "deployment_id": f"dep_{body.model_id[:8].lower()}_{body.stage[:4]}",
    }


@router.get("/evaluation/model-card")
async def get_model_card(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Return structured model card for the champion model."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    tr = dataset.training_results or {}
    best_model = tr.get("best_model", "Unknown")
    best_score = tr.get("best_cv_score", 0)

    return {
        "model_name": best_model,
        "task_type": dataset.task_type.value if dataset.task_type else "unknown",
        "target_column": dataset.target_column,
        "dataset_name": dataset.name,
        "n_rows": dataset.row_count,
        "n_features": dataset.col_count,
        "cv_score": best_score,
        "stage": tr.get("stage", "draft"),
        "promotions": tr.get("promotions", []),
        "leaderboard": tr.get("leaderboard", []),
        "training_config": tr.get("training_config", {}),
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
    }


@router.get("/evaluation/model-card/html")
async def get_model_card_html(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Return an HTML model card report."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    tr = dataset.training_results or {}
    ev = dataset.evaluation_results or {}
    best_model = tr.get("best_model", "Unknown")
    best_score = tr.get("best_cv_score", 0)
    task_type = dataset.task_type.value if dataset.task_type else "unknown"

    # Build leaderboard table rows
    leaderboard = tr.get("leaderboard", [])
    lb_rows = ""
    for entry in leaderboard[:10]:
        lb_rows += f"""
        <tr>
            <td>{entry.get('rank', '-')}</td>
            <td><strong>{entry.get('model_name', '-')}</strong></td>
            <td>{entry.get('cv_score', '-'):.4f if isinstance(entry.get('cv_score'), float) else '-'}</td>
            <td>{entry.get('f1', '-'):.4f if isinstance(entry.get('f1'), float) else '-'}</td>
            <td>{entry.get('status', 'challenger')}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head>
<title>Model Card — {best_model}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; color: #333; }}
  h1 {{ color: #1a237e; }} h2 {{ color: #283593; border-bottom: 2px solid #e8eaf6; padding-bottom: 8px; }}
  .metric {{ display: inline-block; background: #e8eaf6; border-radius: 8px; padding: 12px 24px; margin: 8px; text-align: center; }}
  .metric .value {{ font-size: 2em; font-weight: bold; color: #1a237e; }}
  .metric .label {{ font-size: 0.85em; color: #666; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ background: #e8eaf6; padding: 10px; text-align: left; }}
  td {{ padding: 8px 10px; border-bottom: 1px solid #eee; }}
  .badge {{ background: #4caf50; color: white; border-radius: 4px; padding: 2px 8px; font-size: 0.8em; }}
  footer {{ margin-top: 40px; color: #999; font-size: 0.85em; text-align: center; }}
</style>
</head>
<body>
<h1>🤖 Model Card: {best_model}</h1>
<p>Generated by <strong>OmniForge ML</strong> · Dataset: <strong>{dataset.name}</strong></p>

<h2>📊 Dataset Summary</h2>
<div>
  <div class="metric"><div class="value">{dataset.row_count or '-'}</div><div class="label">Rows</div></div>
  <div class="metric"><div class="value">{dataset.col_count or '-'}</div><div class="label">Features</div></div>
  <div class="metric"><div class="value">{task_type}</div><div class="label">Task Type</div></div>
  <div class="metric"><div class="value">{dataset.target_column or '-'}</div><div class="label">Target Column</div></div>
</div>

<h2>🏆 Champion Model Performance</h2>
<div>
  <div class="metric"><div class="value">{best_score:.4f}</div><div class="label">CV Score</div></div>
</div>

<h2>📋 Model Leaderboard</h2>
<table>
  <tr><th>Rank</th><th>Model</th><th>CV Score</th><th>F1</th><th>Status</th></tr>
  {lb_rows}
</table>

<h2>⚙️ Intended Use</h2>
<p>This model was trained for <strong>{task_type}</strong> on the dataset "{dataset.name}" with target column <strong>{dataset.target_column or 'N/A'}</strong>.</p>
<p>Use for exploratory and prototyping purposes. Validate on production data before deployment.</p>

<h2>⚠️ Limitations</h2>
<ul>
  <li>Model performance may degrade on out-of-distribution data.</li>
  <li>Feature distributions at inference time should match training data.</li>
  <li>Monitor for concept drift in production.</li>
</ul>

<footer>Generated by OmniForge ML · {__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</footer>
</body>
</html>"""

    return HTMLResponse(content=html, headers={"Content-Disposition": f'attachment; filename="model_card_{best_model.replace(" ", "_")}.html"'})
