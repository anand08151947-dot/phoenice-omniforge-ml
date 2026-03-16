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


@router.get("/datasets", response_model=list[DatasetOut])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).order_by(Dataset.created_at.desc()))
    datasets = result.scalars().all()
    return datasets


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
