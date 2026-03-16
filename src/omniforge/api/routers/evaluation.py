"""Evaluation router — Phase 8+9."""
from __future__ import annotations

import asyncio
import io
import json
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


class EvaluationRunRequest(BaseModel):
    dataset_id: str


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
    fname = original_filename.lower()
    if fname.endswith(".parquet"):
        df = pd.read_parquet(io.BytesIO(raw))
    elif fname.endswith(".json"):
        df = pd.read_json(io.BytesIO(raw))
    else:
        df = pd.read_csv(io.BytesIO(raw))

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
        return dataset.evaluation_results

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
            "r": json.dumps(evaluation_results),
            "now": datetime.now(timezone.utc),
        },
    )
    await db.commit()
    return evaluation_results
