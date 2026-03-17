"""Deploy router — Phase 11: model deployment and monitoring."""
from __future__ import annotations

import json
import math
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.models.prediction_log import PredictionLog
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


@router.get("/deploy/export")
async def export_model(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Download the best trained model as a pickle file."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    tr = dataset.training_results or {}
    best_model = tr.get("best_model", "model")

    # Try to find model file in MinIO
    try:
        from ...storage.minio import get_minio_client
        from ...core.config import settings
        client = get_minio_client()

        # List objects in the models bucket for this dataset
        objects = list(client.list_objects(settings.MINIO_BUCKET_MODELS, prefix=str(dataset_id)))
        if not objects:
            raise HTTPException(status_code=404, detail="No trained model found. Please train a model first.")

        # Get the most recent model file
        model_obj = sorted(objects, key=lambda o: o.last_modified, reverse=True)[0]
        response_data = client.get_object(settings.MINIO_BUCKET_MODELS, model_obj.object_name)
        model_bytes = response_data.read()

        filename = f"{best_model.replace(' ', '_').lower()}_model.pkl"
        return Response(
            content=model_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export model: {str(e)}")


# ---------------------------------------------------------------------------
# Helpers for deployment lookup (deployments stored in training_results JSON)
# ---------------------------------------------------------------------------

async def _find_deployment(deployment_id: str, db: AsyncSession):
    """Return (dataset, deployment_record) or raise 404."""
    result = await db.execute(select(Dataset))
    datasets = result.scalars().all()
    for ds in datasets:
        if not ds.training_results:
            continue
        for dep in ds.training_results.get("deployments", []):
            if dep.get("deployment_id") == deployment_id:
                return ds, dep
    raise HTTPException(status_code=404, detail=f"Deployment {deployment_id!r} not found")


async def _update_deployment_status(
    deployment_id: str, new_status: str, db: AsyncSession
) -> dict:
    """Update status of a deployment record stored in training_results JSON."""
    dataset, _ = await _find_deployment(deployment_id, db)
    updated = dict(dataset.training_results)
    deployments = updated.get("deployments", [])
    target = None
    for dep in deployments:
        if dep.get("deployment_id") == deployment_id:
            dep["status"] = new_status
            dep["status_updated_at"] = datetime.now(timezone.utc).isoformat()
            target = dep
    # Keep "deployment" (latest) in sync if it matches
    if updated.get("deployment", {}).get("deployment_id") == deployment_id:
        updated["deployment"]["status"] = new_status
    await db.execute(
        text("UPDATE datasets SET training_results=:r, updated_at=:now WHERE id=:id"),
        {"id": str(dataset.id), "r": json.dumps(updated), "now": datetime.now(timezone.utc)},
    )
    await db.commit()
    return target


# ---------------------------------------------------------------------------
# PSI helpers for drift detection
# ---------------------------------------------------------------------------

def _compute_psi(baseline: list[float], current: list[float], buckets: int = 10) -> float:
    """Population Stability Index between baseline and current distributions."""
    import math
    if not baseline or not current:
        return 0.0
    min_val = min(min(baseline), min(current))
    max_val = max(max(baseline), max(current))
    if max_val == min_val:
        return 0.0
    step = (max_val - min_val) / buckets
    eps = 1e-6

    def bucket_fracs(vals: list[float]) -> list[float]:
        counts = [0] * buckets
        for v in vals:
            idx = min(int((v - min_val) / step), buckets - 1)
            counts[idx] += 1
        total = len(vals)
        return [(c + eps) / total for c in counts]

    base_f = bucket_fracs(baseline)
    curr_f = bucket_fracs(current)
    return sum((c - b) * math.log(c / b) for b, c in zip(base_f, curr_f))


def _drift_level(psi: float) -> str:
    if psi < 0.1:
        return "stable"
    if psi < 0.25:
        return "warning"
    return "critical"


# ---------------------------------------------------------------------------
# Drift Detection
# ---------------------------------------------------------------------------

@router.get("/deploy/{deployment_id}/drift")
async def get_drift(
    deployment_id: str,
    n: int = 500,
    db: AsyncSession = Depends(get_db),
):
    """Compute PSI-based feature drift for the last N predictions."""
    # 1. Find dataset for this deployment to get baseline profile
    dataset, _ = await _find_deployment(deployment_id, db)

    # 2. Load last N prediction logs
    logs_result = await db.execute(
        select(PredictionLog)
        .where(PredictionLog.deployment_id == deployment_id)
        .order_by(PredictionLog.created_at.desc())
        .limit(n)
    )
    logs = logs_result.scalars().all()
    total = len(logs)

    if total == 0:
        return {
            "features": [],
            "overall_drift": 0.0,
            "total_predictions": 0,
            "message": "No prediction logs found for this deployment yet.",
        }

    # 3. Derive baseline feature distributions from profile_data
    profile = dataset.profile_data or {}
    columns_info = profile.get("columns", {})

    # 4. Compute PSI per feature from input_features of logs
    feature_results = []
    psi_values = []

    # Collect all feature values from logs
    feature_values: dict[str, list] = {}
    for log in logs:
        for feat, val in (log.input_features or {}).items():
            feature_values.setdefault(feat, []).append(val)

    for feat_name, current_vals in feature_values.items():
        col_info = columns_info.get(feat_name, {})
        dtype = col_info.get("dtype", "")

        # Try numeric PSI
        try:
            current_nums = [float(v) for v in current_vals if v is not None]
        except (TypeError, ValueError):
            current_nums = []

        if current_nums and ("float" in str(dtype) or "int" in str(dtype)):
            # Baseline: reconstruct from profile stats (mean ± std approximation)
            mean = col_info.get("mean", 0.0)
            std = col_info.get("std", 1.0) or 1.0
            # Generate representative baseline from profile stats
            import random as _rng
            seed_val = abs(hash(feat_name + str(dataset.id))) % (2 ** 31)
            r = _rng.Random(seed_val)
            baseline_nums = [r.gauss(mean, std) for _ in range(len(current_nums))]
            psi = _compute_psi(baseline_nums, current_nums)
        else:
            # Categorical: chi-square-like score based on frequency deviation
            from collections import Counter
            curr_counter = Counter(str(v) for v in current_vals)
            baseline_dist = col_info.get("value_counts", {})
            if baseline_dist:
                total_base = sum(baseline_dist.values()) or 1
                total_curr = sum(curr_counter.values()) or 1
                all_cats = set(baseline_dist) | set(curr_counter)
                eps = 1e-6
                psi = 0.0
                for cat in all_cats:
                    b = (baseline_dist.get(cat, 0) + eps) / total_base
                    c = (curr_counter.get(cat, 0) + eps) / total_curr
                    psi += (c - b) * math.log(c / b)
            else:
                psi = 0.0

        level = _drift_level(psi)
        psi_values.append(psi)
        feature_results.append({"name": feat_name, "psi": round(psi, 4), "drift_level": level})

    overall = round(sum(psi_values) / len(psi_values), 4) if psi_values else 0.0

    return {
        "features": feature_results,
        "overall_drift": overall,
        "total_predictions": total,
    }


# ---------------------------------------------------------------------------
# Approval Gate
# ---------------------------------------------------------------------------

@router.post("/deploy/{deployment_id}/approve")
async def approve_deployment(deployment_id: str, db: AsyncSession = Depends(get_db)):
    """Promote a deployment to production status."""
    dep = await _update_deployment_status(deployment_id, "production", db)
    return {"deployment_id": deployment_id, "status": "production", "approved_at": dep.get("status_updated_at")}


@router.post("/deploy/{deployment_id}/rollback")
async def rollback_deployment(deployment_id: str, db: AsyncSession = Depends(get_db)):
    """Roll back a deployment and restore the previous production deployment if any."""
    dataset, _ = await _find_deployment(deployment_id, db)
    updated = dict(dataset.training_results)
    deployments = updated.get("deployments", [])

    rolled_back_at = datetime.now(timezone.utc).isoformat()
    previous_production = None

    for dep in deployments:
        if dep.get("deployment_id") == deployment_id:
            dep["status"] = "rolled_back"
            dep["status_updated_at"] = rolled_back_at
        elif dep.get("status") == "production" and dep.get("deployment_id") != deployment_id:
            previous_production = dep  # already in production

    # If no existing production, find the most recent other deployment and promote it
    if previous_production is None:
        others = [d for d in deployments if d.get("deployment_id") != deployment_id]
        if others:
            candidate = others[-1]  # most recently added before current
            candidate["status"] = "production"
            candidate["status_updated_at"] = rolled_back_at
            previous_production = candidate

    # Sync "deployment" (latest pointer) to previous production
    if previous_production:
        updated["deployment"] = previous_production
    elif updated.get("deployment", {}).get("deployment_id") == deployment_id:
        updated["deployment"]["status"] = "rolled_back"

    await db.execute(
        text("UPDATE datasets SET training_results=:r, updated_at=:now WHERE id=:id"),
        {"id": str(dataset.id), "r": json.dumps(updated), "now": datetime.now(timezone.utc)},
    )
    await db.commit()

    return {
        "deployment_id": deployment_id,
        "status": "rolled_back",
        "rolled_back_at": rolled_back_at,
        "restored_deployment_id": previous_production.get("deployment_id") if previous_production else None,
    }


@router.get("/deploy/{deployment_id}/status")
async def get_deployment_status(deployment_id: str, db: AsyncSession = Depends(get_db)):
    """Return deployment status and approval history."""
    dataset, dep = await _find_deployment(deployment_id, db)
    # Build approval history from all deployments on same dataset
    all_deps = dataset.training_results.get("deployments", [])
    history = [
        {
            "deployment_id": d.get("deployment_id"),
            "status": d.get("status", "deployed"),
            "deployed_at": d.get("deployed_at"),
            "status_updated_at": d.get("status_updated_at"),
            "model_name": d.get("model_name"),
        }
        for d in all_deps
    ]
    return {
        "deployment_id": deployment_id,
        "status": dep.get("status", "deployed"),
        "model_name": dep.get("model_name"),
        "endpoint_name": dep.get("endpoint_name"),
        "url": dep.get("url"),
        "deployed_at": dep.get("deployed_at"),
        "status_updated_at": dep.get("status_updated_at"),
        "approval_history": history,
    }
