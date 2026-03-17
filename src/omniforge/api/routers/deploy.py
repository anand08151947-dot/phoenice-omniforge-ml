"""Deploy router — Phase 11: model deployment and monitoring."""
from __future__ import annotations

import json
import math
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DeployRequest(BaseModel):
    dataset_id: Optional[str] = None       # optional - will use most recent dataset if not provided
    endpoint_name: Optional[str] = None    # optional - auto-generated
    target: str = "rest_api"
    replicas: int = 1
    enable_monitoring: bool = True
    enable_logging: bool = True


class DriftMetric(BaseModel):
    feature: str
    psi: float
    ks_statistic: float
    status: str


class PredictionVolume(BaseModel):
    timestamp: str
    count: int


class MonitoringMetrics(BaseModel):
    deployment_id: str
    timestamp: str
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    requests_per_min: float
    error_rate: float
    drift_metrics: list[DriftMetric]
    prediction_volume: list[PredictionVolume]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_dataset_or_404(dataset_id: str, db: AsyncSession) -> Dataset:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


def _find_best_model(training_results: dict) -> dict[str, Any]:
    """Return the best candidate from training_results."""
    candidates = training_results.get("candidates", [])
    if not candidates:
        return {"model_name": training_results.get("best_model", "unknown"), "cv_score": 0.0}
    # Already sorted by cv_score descending from trainer
    return candidates[0]


def _seeded_gauss(seed_val: int, mean: float, std: float) -> float:
    """Gaussian random number seeded for stable results."""
    rng = random.Random(seed_val)
    return max(0.0, rng.gauss(mean, std))


def _build_monitoring_metrics(deployment_id: str, dataset: Dataset) -> MonitoringMetrics:
    """Generate stable simulated monitoring metrics seeded by deployment_id."""
    seed = abs(hash(deployment_id)) % (2 ** 31)
    rng = random.Random(seed)

    p50 = rng.gauss(42.0, 5.0)
    p95 = p50 + rng.gauss(30.0, 4.0)
    p99 = p95 + rng.gauss(20.0, 3.0)
    rpm = max(1.0, rng.gauss(120.0, 15.0))
    error_rate = max(0.0, min(1.0, rng.gauss(0.005, 0.002)))

    # Derive feature list from profile or eda data
    features: list[str] = []
    if dataset.profile_data:
        features = list(dataset.profile_data.get("columns", {}).keys())[:6]
    if not features:
        features = ["feature_0", "feature_1", "feature_2"]

    drift_metrics: list[DriftMetric] = []
    for i, feat in enumerate(features):
        feat_seed = seed + i
        feat_rng = random.Random(feat_seed)
        psi = max(0.0, feat_rng.gauss(0.05, 0.03))
        ks = max(0.0, feat_rng.gauss(0.08, 0.04))
        status = "stable" if psi < 0.1 else ("warning" if psi < 0.2 else "drift")
        drift_metrics.append(DriftMetric(feature=feat, psi=round(psi, 4), ks_statistic=round(ks, 4), status=status))

    # Last 12 hours of prediction volume (one point per hour)
    now_ts = datetime.now(timezone.utc)
    prediction_volume: list[PredictionVolume] = []
    for h in range(11, -1, -1):
        hour_seed = seed + h * 997
        hour_rng = random.Random(hour_seed)
        ts = now_ts.replace(minute=0, second=0, microsecond=0)
        ts = ts.replace(hour=(ts.hour - h) % 24)
        count = max(0, int(hour_rng.gauss(rpm * 60, rpm * 10)))
        prediction_volume.append(PredictionVolume(timestamp=ts.isoformat(), count=count))

    return MonitoringMetrics(
        deployment_id=deployment_id,
        timestamp=now_ts.isoformat(),
        p50_latency_ms=round(p50, 2),
        p95_latency_ms=round(p95, 2),
        p99_latency_ms=round(p99, 2),
        requests_per_min=round(rpm, 2),
        error_rate=round(error_rate, 6),
        drift_metrics=drift_metrics,
        prediction_volume=prediction_volume,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/deploy")
async def deploy_model(body: DeployRequest, db: AsyncSession = Depends(get_db)):
    # Resolve dataset_id: use provided or fall back to most recent ready dataset
    if body.dataset_id:
        dataset = await _get_dataset_or_404(body.dataset_id, db)
    else:
        result = await db.execute(
            select(Dataset)
            .where(Dataset.status == "ready")
            .order_by(Dataset.updated_at.desc())
        )
        dataset = result.scalars().first()
        if dataset is None:
            raise HTTPException(status_code=422, detail="No ready dataset found. Upload and train a dataset first.")
        if not dataset.training_results:
            raise HTTPException(status_code=422, detail="No training results found on the most recent dataset. Run training first.")

    if not dataset.training_results:
        raise HTTPException(status_code=422, detail="No training results found. Run training first.")

    best = _find_best_model(dataset.training_results)
    model_name = best.get("model_name", "unknown")
    deployment_id = str(uuid.uuid4())

    # Resolve endpoint_name
    endpoint_name = body.endpoint_name or f"endpoint-{model_name[:20].lower().replace('_', '-')}"
    endpoint_url = f"http://localhost:8080/predict/{endpoint_name}"

    deployment_record = {
        "deployment_id": deployment_id,
        "endpoint_name": endpoint_name,
        "model_name": model_name,
        "target": body.target,
        "replicas": body.replicas,
        "enable_monitoring": body.enable_monitoring,
        "enable_logging": body.enable_logging,
        "status": "deployed",
        "url": endpoint_url,
        "deployed_at": datetime.now(timezone.utc).isoformat(),
    }

    # Persist deployment into training_results["deployment"]
    updated_results = dict(dataset.training_results)
    deployments = updated_results.get("deployments", [])
    deployments.append(deployment_record)
    updated_results["deployments"] = deployments
    updated_results["deployment"] = deployment_record  # latest

    await db.execute(
        text("UPDATE datasets SET training_results=:r, updated_at=:now WHERE id=:id"),
        {
            "id": str(dataset.id),
            "r": json.dumps(updated_results),
            "now": datetime.now(timezone.utc),
        },
    )
    await db.commit()

    return {
        "deployment_id": deployment_id,
        "endpoint_name": endpoint_name,
        "model_name": model_name,
        "status": "deployed",
        "url": endpoint_url,
    }


@router.get("/deploy/monitoring", response_model=MonitoringMetrics)
async def get_monitoring(dataset_id: str | None = None, db: AsyncSession = Depends(get_db)):
    deployment_id = "default-deployment"
    dataset = None

    if dataset_id:
        result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
        dataset = result.scalar_one_or_none()
        if dataset and dataset.training_results:
            dep = dataset.training_results.get("deployment", {})
            deployment_id = dep.get("deployment_id", deployment_id)

    # Use a dummy dataset object if none found
    class _FakeDataset:
        profile_data = None

    return _build_monitoring_metrics(deployment_id, dataset or _FakeDataset())


@router.get("/deploy/list")
async def list_deployments(dataset_id: str | None = None, db: AsyncSession = Depends(get_db)):
    if not dataset_id:
        return {"deployments": []}

    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None or not dataset.training_results:
        return {"deployments": []}

    deployments = dataset.training_results.get("deployments", [])
    return {"deployments": deployments}
