"""Profile router."""
from __future__ import annotations

import asyncio
import io
import json
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset, DatasetStatus
from ...db.models.job import Job, JobStatus
from ...db.session import get_db

router = APIRouter()


def _run_profiling_inline(dataset_id: str, raw: bytes, filename: str):
    """Run profiling in-process without Celery. Creates its own DB session."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker as _sm
    from ...core.config import settings
    from ...ml.profiling.profiler import profile_dataframe

    sync_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://"
    ).replace("postgresql+aiosqlite:///", "sqlite:///")

    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = _sm(bind=engine)
    session = Session()
    try:
        fname = filename.lower()
        if fname.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(raw))
        elif fname.endswith(".json"):
            df = pd.read_json(io.BytesIO(raw))
        else:
            df = pd.read_csv(io.BytesIO(raw))

        profile = profile_dataframe(dataset_id, df)

        session.execute(
            text(
                """UPDATE datasets
                   SET status='ready', profile_data=:p,
                       row_count=:r, col_count=:c, updated_at=:now
                   WHERE id=:id"""
            ),
            {
                "id": dataset_id,
                "p": json.dumps(profile),
                "r": profile["row_count"],
                "c": profile["col_count"],
                "now": datetime.now(timezone.utc),
            },
        )
        session.execute(
            text(
                "UPDATE jobs SET status='done', progress=100, updated_at=:now"
                " WHERE dataset_id=:did AND job_type='profile'"
            ),
            {"did": dataset_id, "now": datetime.now(timezone.utc)},
        )
        session.commit()
    except Exception as exc:
        session.rollback()
        session.execute(
            text("UPDATE datasets SET status='error', updated_at=:now WHERE id=:id"),
            {"id": dataset_id, "now": datetime.now(timezone.utc)},
        )
        session.execute(
            text(
                "UPDATE jobs SET status='failed', error=:err, updated_at=:now"
                " WHERE dataset_id=:did AND job_type='profile'"
            ),
            {"did": dataset_id, "err": str(exc)[:2000], "now": datetime.now(timezone.utc)},
        )
        session.commit()
        raise
    finally:
        session.close()
        engine.dispose()


@router.post("/profile/trigger/{dataset_id}", status_code=202)
async def trigger_profile(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Manually trigger profiling for a dataset (dev helper, uses MinIO)."""
    from ...storage.minio import download_bytes
    from ...core.config import settings

    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    raw = download_bytes(settings.MINIO_BUCKET_DATASETS, dataset.minio_path)
    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"

    import threading
    t = threading.Thread(
        target=_run_profiling_inline,
        args=(dataset_id, raw, original_filename),
        daemon=True,
    )
    t.start()
    return {"status": "profiling_started", "dataset_id": dataset_id}


@router.get("/profile")
async def get_profile(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.status == DatasetStatus.ready and dataset.profile_data:
        return dataset.profile_data

    if dataset.status == DatasetStatus.error:
        raise HTTPException(status_code=422, detail="Profiling failed for this dataset")

    # Still processing — find the job
    job_result = await db.execute(
        select(Job)
        .where(Job.dataset_id == dataset_id, Job.job_type == "profile")
        .order_by(Job.created_at.desc())
    )
    job = job_result.scalar_one_or_none()
    job_id = job.id if job else None

    return StreamingResponse(
        content=iter([json.dumps({"status": "processing", "job_id": job_id})]),
        status_code=202,
        media_type="application/json",
    )


@router.get("/profile/progress")
async def profile_progress(dataset_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """SSE stream of profiling progress."""

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break

            result = await db.execute(
                select(Job)
                .where(Job.dataset_id == dataset_id, Job.job_type == "profile")
                .order_by(Job.created_at.desc())
            )
            job = result.scalar_one_or_none()

            if job is None:
                data = json.dumps({"progress": 0, "status": "pending"})
            elif job.status == JobStatus.done:
                data = json.dumps({"progress": 100, "status": "done"})
                yield f"data: {data}\n\n"
                break
            elif job.status == JobStatus.failed:
                data = json.dumps({"progress": 0, "status": "failed", "error": job.error})
                yield f"data: {data}\n\n"
                break
            else:
                data = json.dumps({"progress": job.progress, "status": job.status.value})

            yield f"data: {data}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
