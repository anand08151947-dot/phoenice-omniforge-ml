"""Upload & dataset listing router."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import aiofiles
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...db.models.dataset import Dataset, DatasetStatus
from ...db.models.job import Job, JobStatus
from ...db.session import get_db
from ...storage.minio import get_minio_client

router = APIRouter()


class DatasetOut(BaseModel):
    id: str
    name: str
    file_size: int
    row_count: int | None
    col_count: int | None
    created_at: datetime
    status: str
    target_column: str | None
    task_type: str | None

    model_config = {"from_attributes": True}


class DatasetPatch(BaseModel):
    target_column: str | None = None
    task_type: str | None = None


@router.get("/datasets/{dataset_id}/smart-profile")
async def get_smart_profile(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Derive ML-expert insights from the stored profile_data."""
    from ...ml.analysis.smart_profile import compute_smart_profile

    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.status != DatasetStatus.ready or not dataset.profile_data:
        raise HTTPException(status_code=202, detail="Profiling not complete yet")

    return compute_smart_profile(
        profile_data=dataset.profile_data,
        target_col=dataset.target_column,
        task_type=dataset.task_type.value if dataset.task_type else None,
    )


@router.get("/datasets", response_model=list[DatasetOut])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).order_by(Dataset.created_at.desc()))
    datasets = result.scalars().all()
    return datasets


@router.patch("/datasets/{dataset_id}", response_model=DatasetOut)
async def patch_dataset(dataset_id: str, body: DatasetPatch, db: AsyncSession = Depends(get_db)):
    """Update target_column and/or task_type for a dataset."""
    from sqlalchemy import text as _text
    from ...db.models.dataset import TaskType

    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if body.target_column is not None:
        dataset.target_column = body.target_column
    if body.task_type is not None:
        try:
            dataset.task_type = TaskType(body.task_type)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid task_type: {body.task_type}")

    # Clear cached EDA so it gets recomputed with new target
    dataset.eda_report = None

    dataset.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(dataset)
    return dataset


@router.post("/upload", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    raw = await file.read()
    file_size = len(raw)
    dataset_id = str(uuid.uuid4())
    filename = file.filename or "upload.csv"
    minio_path = f"{dataset_id}/{filename}"

    # Upload to MinIO
    try:
        minio = get_minio_client()
        bucket = settings.MINIO_BUCKET_DATASETS
        if not minio.bucket_exists(bucket):
            minio.make_bucket(bucket)
        import io as _io
        minio.put_object(
            bucket_name=bucket,
            object_name=minio_path,
            data=_io.BytesIO(raw),
            length=file_size,
            content_type=file.content_type or "application/octet-stream",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        )

    # Create Dataset record
    dataset = Dataset(
        id=dataset_id,
        name=filename.rsplit(".", 1)[0],
        original_filename=filename,
        file_size=file_size,
        minio_path=minio_path,
        status=DatasetStatus.processing,
    )
    db.add(dataset)

    # Create Job record
    job = Job(
        id=str(uuid.uuid4()),
        dataset_id=dataset_id,
        job_type="profile",
        status=JobStatus.pending,
    )
    db.add(job)
    await db.flush()

    # Fire Celery task; fall back to background task profiling if worker unavailable
    celery_ok = False
    try:
        from ...tasks.profile import run_profile
        task = run_profile.delay(dataset_id)
        job.celery_task_id = task.id
        celery_ok = True
    except Exception:
        pass

    await db.commit()
    await db.refresh(dataset)

    if not celery_ok:
        from ...api.routers.profile import _run_profiling_inline
        import threading
        t = threading.Thread(
            target=_run_profiling_inline,
            args=(dataset_id, raw, filename),
            daemon=True,
        )
        t.start()

    return dataset
