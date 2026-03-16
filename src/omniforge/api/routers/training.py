"""AutoML Training router — Phase 7."""
from __future__ import annotations

import asyncio
import io
import json
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


class TrainingRunRequest(BaseModel):
    dataset_id: str


class RetrainSingleRequest(BaseModel):
    dataset_id: str
    model_id: str
    model_name: str
    hyperparams: dict[str, Any]


class AutotuneRequest(BaseModel):
    dataset_id: str
    model_id: str
    model_name: str
    n_trials: int = 30


def _load_df(minio_path: str, original_filename: str) -> pd.DataFrame:
    from ...core.config import settings as _s
    from ...storage.minio import download_bytes
    raw = download_bytes(_s.MINIO_BUCKET_DATASETS, minio_path)
    fname = original_filename.lower()
    if fname.endswith(".parquet"):
        return pd.read_parquet(io.BytesIO(raw))
    if fname.endswith(".json"):
        return pd.read_json(io.BytesIO(raw))
    return pd.read_csv(io.BytesIO(raw))


def _run_training_inline(
    dataset_id: str,
    minio_path: str,
    original_filename: str,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
) -> dict:
    from ...ml.training.trainer import run_training
    df = _load_df(minio_path, original_filename)
    return run_training(
        dataset_id=dataset_id,
        df=df,
        target_column=target_column,
        task_type=task_type,
        selection_plan=selection_plan,
        sampling_config=sampling_config,
    )


def _run_retrain_single(
    model_name: str,
    model_id: str,
    hyperparams: dict,
    minio_path: str,
    original_filename: str,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
) -> dict:
    from ...ml.training.trainer import retrain_single_model
    df = _load_df(minio_path, original_filename)
    return retrain_single_model(
        model_name=model_name,
        model_id=model_id,
        hyperparams=hyperparams,
        df=df,
        target_column=target_column,
        task_type=task_type,
        selection_plan=selection_plan,
        sampling_config=sampling_config,
    )


def _run_autotune(
    model_name: str,
    model_id: str,
    n_trials: int,
    minio_path: str,
    original_filename: str,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
) -> dict:
    from ...ml.training.trainer import autotune_model
    df = _load_df(minio_path, original_filename)
    return autotune_model(
        model_name=model_name,
        model_id=model_id,
        df=df,
        target_column=target_column,
        task_type=task_type,
        selection_plan=selection_plan,
        sampling_config=sampling_config,
        n_trials=n_trials,
    )


async def _get_dataset_or_404(dataset_id: str, db: AsyncSession) -> Dataset:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


async def _patch_candidate_in_db(
    dataset_id: str,
    updated_candidate: dict,
    db: AsyncSession,
) -> dict:
    """Replace one candidate in training_results by model_id, then persist."""
    dataset = await _get_dataset_or_404(dataset_id, db)
    results: dict = dataset.training_results or {}
    candidates: list = results.get("candidates", [])

    model_id = updated_candidate["id"]
    idx = next((i for i, c in enumerate(candidates) if c["id"] == model_id), None)
    if idx is not None:
        candidates[idx] = updated_candidate
    else:
        candidates.append(updated_candidate)

    # Re-sort by cv_score
    candidates.sort(key=lambda c: c.get("cv_score", 0), reverse=True)
    results["candidates"] = candidates
    results["best_model"] = candidates[0]["model_name"] if candidates else None
    results["best_cv_score"] = candidates[0].get("cv_score", 0) if candidates else 0

    await db.execute(
        text("UPDATE datasets SET training_results=:r, updated_at=:now WHERE id=:id"),
        {"id": dataset_id, "r": json.dumps(results), "now": datetime.now(timezone.utc)},
    )
    await db.commit()
    return results


@router.get("/training")
async def get_training(dataset_id: str, db: AsyncSession = Depends(get_db)):
    dataset = await _get_dataset_or_404(dataset_id, db)
    if dataset.training_results:
        return dataset.training_results
    raise HTTPException(status_code=404, detail="No training results yet. Run training first.")


@router.get("/training/hyperparameter-space")
async def get_hyperparameter_space(model_name: str):
    """Return the tunable hyperparameter space definition for a given model."""
    from ...ml.training.trainer import get_hyperparameter_space, get_fix_overfit_params
    return {
        "model_name": model_name,
        "space": get_hyperparameter_space(model_name),
        "fix_overfit_params": get_fix_overfit_params(model_name),
    }


@router.post("/training/run")
async def run_training_endpoint(body: TrainingRunRequest, db: AsyncSession = Depends(get_db)):
    dataset = await _get_dataset_or_404(body.dataset_id, db)
    if not dataset.target_column:
        raise HTTPException(status_code=422, detail="Target column not set")
    if not dataset.minio_path:
        raise HTTPException(status_code=422, detail="No dataset file found — run profiling first")

    task_type = dataset.task_type.value if dataset.task_type else "classification"
    loop = asyncio.get_event_loop()
    try:
        training_results = await loop.run_in_executor(
            None, _run_training_inline,
            body.dataset_id, dataset.minio_path,
            dataset.original_filename or "upload.csv",
            dataset.target_column, task_type,
            dataset.selection_plan, dataset.sampling_config,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Training failed: {exc}") from exc

    await db.execute(
        text("UPDATE datasets SET training_results=:r, updated_at=:now WHERE id=:id"),
        {"id": body.dataset_id, "r": json.dumps(training_results), "now": datetime.now(timezone.utc)},
    )
    await db.commit()
    return training_results


@router.post("/training/retrain-single")
async def retrain_single_endpoint(body: RetrainSingleRequest, db: AsyncSession = Depends(get_db)):
    """Retrain one model with user-supplied hyperparameters and patch training_results."""
    dataset = await _get_dataset_or_404(body.dataset_id, db)
    if not dataset.minio_path:
        raise HTTPException(status_code=422, detail="No dataset file found")

    task_type = dataset.task_type.value if dataset.task_type else "classification"
    loop = asyncio.get_event_loop()
    try:
        updated = await loop.run_in_executor(
            None, _run_retrain_single,
            body.model_name, body.model_id, body.hyperparams,
            dataset.minio_path, dataset.original_filename or "upload.csv",
            dataset.target_column, task_type,
            dataset.selection_plan, dataset.sampling_config,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Retrain failed: {exc}") from exc

    results = await _patch_candidate_in_db(body.dataset_id, updated, db)
    return results


@router.post("/training/autotune")
async def autotune_endpoint(body: AutotuneRequest, db: AsyncSession = Depends(get_db)):
    """Run Optuna hyperparameter search for one model, patch training_results with best result."""
    dataset = await _get_dataset_or_404(body.dataset_id, db)
    if not dataset.minio_path:
        raise HTTPException(status_code=422, detail="No dataset file found")

    n_trials = max(5, min(body.n_trials, 100))
    task_type = dataset.task_type.value if dataset.task_type else "classification"
    loop = asyncio.get_event_loop()
    try:
        updated = await loop.run_in_executor(
            None, _run_autotune,
            body.model_name, body.model_id, n_trials,
            dataset.minio_path, dataset.original_filename or "upload.csv",
            dataset.target_column, task_type,
            dataset.selection_plan, dataset.sampling_config,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AutoTune failed: {exc}") from exc

    results = await _patch_candidate_in_db(body.dataset_id, updated, db)
    return results
