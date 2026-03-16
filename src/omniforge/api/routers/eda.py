"""EDA router."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


def _run_eda_inline(dataset_id: str, minio_path: str, original_filename: str, target_column: str | None):
    """Run EDA in a sync thread (uses its own DB session)."""
    import io
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker as _sm
    from ...core.config import settings as _s
    from ...storage.minio import download_bytes
    from ...ml.eda.analyzer import analyze_dataframe

    sync_url = _s.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://"
    ).replace("postgresql+aiosqlite:///", "sqlite:///")

    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = _sm(bind=engine)
    session = Session()
    try:
        ds = session.execute(
            text("SELECT profile_data, target_column FROM datasets WHERE id=:id"),
            {"id": dataset_id}
        ).fetchone()
        profile_raw = ds[0] if ds and ds[0] else {}
        profile = profile_raw if isinstance(profile_raw, dict) else json.loads(profile_raw)
        tgt_col = target_column or (ds[1] if ds else None)

        raw = download_bytes(_s.MINIO_BUCKET_DATASETS, minio_path)
        fname = original_filename.lower()
        if fname.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(raw))
        elif fname.endswith(".json"):
            df = pd.read_json(io.BytesIO(raw))
        else:
            df = pd.read_csv(io.BytesIO(raw))

        report = analyze_dataframe(dataset_id, df, profile, tgt_col)

        session.execute(
            text("UPDATE datasets SET eda_report=:r, updated_at=:now WHERE id=:id"),
            {"id": dataset_id, "r": json.dumps(report), "now": datetime.now(timezone.utc)},
        )
        session.commit()
        return report
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


@router.get("/eda")
async def get_eda(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.eda_report:
        return dataset.eda_report

    if not dataset.profile_data:
        raise HTTPException(status_code=422, detail="Dataset must be profiled before EDA can run. Profile it first.")

    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"
    target_column = dataset.target_column

    loop = asyncio.get_event_loop()
    report = await loop.run_in_executor(
        None, _run_eda_inline, dataset_id, minio_path, original_filename, target_column
    )
    return report


@router.post("/eda/recompute/{dataset_id}")
async def recompute_eda(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Force recompute EDA (useful after setting target column)."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    await db.execute(
        text("UPDATE datasets SET eda_report=NULL WHERE id=:id"),
        {"id": dataset_id}
    )
    await db.commit()

    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"
    target_column = dataset.target_column

    loop = asyncio.get_event_loop()
    report = await loop.run_in_executor(
        None, _run_eda_inline, dataset_id, minio_path, original_filename, target_column
    )
    return report
