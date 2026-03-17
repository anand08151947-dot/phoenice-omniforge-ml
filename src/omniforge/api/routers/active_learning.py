"""Active Learning router — Phase 12: human-in-the-loop annotation and uncertainty sampling."""
from __future__ import annotations

import math
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.prediction_log import PredictionLog
from ...db.session import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GroundTruthRequest(BaseModel):
    prediction_id: str
    ground_truth: Any


class UncertainSample(BaseModel):
    prediction_id: str
    input_features: dict
    prediction: dict
    confidence: Optional[float]
    uncertainty_score: float


class UncertainResponse(BaseModel):
    samples: List[UncertainSample]
    total_unlabeled: int


class StatsResponse(BaseModel):
    total_predictions: int
    labeled: int
    unlabeled: int
    label_distribution: dict
    avg_confidence: Optional[float]
    review_rate: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _entropy_score(probabilities: list[float]) -> float:
    """Shannon entropy normalised to [0, 1]."""
    n = len(probabilities)
    if n <= 1:
        return 0.0
    entropy = -sum(p * math.log(p + 1e-12) for p in probabilities)
    return entropy / math.log(n)


def _uncertainty_score(row: PredictionLog, strategy: str) -> float:
    probs: list[float] | None = None
    if isinstance(row.prediction, dict):
        probs = row.prediction.get("probabilities")

    if strategy == "entropy" and probs:
        return _entropy_score(probs)

    if strategy == "margin" and probs and len(probs) >= 2:
        sorted_p = sorted(probs, reverse=True)
        return 1.0 - (sorted_p[0] - sorted_p[1])

    # Default / fallback: confidence strategy (lower confidence = higher uncertainty)
    conf = row.confidence if row.confidence is not None else 1.0
    return 1.0 - conf


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/ground-truth")
async def record_ground_truth(
    body: GroundTruthRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PredictionLog).where(PredictionLog.prediction_id == body.prediction_id)
    )
    log = result.scalar_one_or_none()
    if log is None:
        raise HTTPException(status_code=404, detail="Prediction not found")

    log.ground_truth = body.ground_truth
    await db.commit()
    return {"prediction_id": body.prediction_id, "status": "recorded"}


@router.get("/uncertain", response_model=UncertainResponse)
async def get_uncertain_samples(
    deployment_id: Optional[str] = Query(None),
    n: int = Query(20, ge=1, le=500),
    strategy: str = Query("confidence", pattern="^(confidence|entropy|margin)$"),
    db: AsyncSession = Depends(get_db),
):
    # Base query: unlabeled only
    q = select(PredictionLog).where(PredictionLog.ground_truth.is_(None))
    if deployment_id:
        q = q.where(PredictionLog.deployment_id == deployment_id)

    # Count total unlabeled
    count_q = select(func.count()).select_from(
        select(PredictionLog).where(PredictionLog.ground_truth.is_(None))
        .where(
            PredictionLog.deployment_id == deployment_id
            if deployment_id
            else PredictionLog.deployment_id.isnot(None) | PredictionLog.deployment_id.is_(None)
        )
        .subquery()
    )
    total_unlabeled = (await db.execute(count_q)).scalar_one()

    # Fetch all unlabeled (bounded to reasonable limit for in-memory scoring)
    rows = (await db.execute(q.limit(10_000))).scalars().all()

    # Score and sort
    scored = sorted(rows, key=lambda r: _uncertainty_score(r, strategy), reverse=True)
    top = scored[:n]

    samples = [
        UncertainSample(
            prediction_id=r.prediction_id,
            input_features=r.input_features,
            prediction=r.prediction,
            confidence=r.confidence,
            uncertainty_score=_uncertainty_score(r, strategy),
        )
        for r in top
    ]

    return UncertainResponse(samples=samples, total_unlabeled=total_unlabeled)


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    deployment_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    base_q = select(PredictionLog)
    if deployment_id:
        base_q = base_q.where(PredictionLog.deployment_id == deployment_id)

    rows = (await db.execute(base_q)).scalars().all()

    total = len(rows)
    labeled_rows = [r for r in rows if r.ground_truth is not None]
    labeled = len(labeled_rows)
    unlabeled = total - labeled

    # Label distribution from ground_truth values
    label_dist: dict[str, int] = {}
    for r in labeled_rows:
        label = str(r.ground_truth) if not isinstance(r.ground_truth, dict) else str(r.ground_truth.get("label", r.ground_truth))
        label_dist[label] = label_dist.get(label, 0) + 1

    confidences = [r.confidence for r in rows if r.confidence is not None]
    avg_confidence = sum(confidences) / len(confidences) if confidences else None

    review_rate = labeled / total if total > 0 else 0.0

    return StatsResponse(
        total_predictions=total,
        labeled=labeled,
        unlabeled=unlabeled,
        label_distribution=label_dist,
        avg_confidence=avg_confidence,
        review_rate=review_rate,
    )
