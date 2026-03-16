"""Cleaning router."""
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


class CleaningApplyRequest(BaseModel):
    dataset_id: str
    strategies: dict[str, str]  # {action_id: strategy}


@router.get("/cleaning")
async def get_cleaning_plan(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.profile_data:
        raise HTTPException(status_code=422, detail="Dataset must be profiled first")

    if dataset.cleaning_plan:
        return dataset.cleaning_plan

    from ...ml.cleaning.cleaner import generate_cleaning_plan
    plan = generate_cleaning_plan(dataset.id, dataset.profile_data)

    await db.execute(
        text("UPDATE datasets SET cleaning_plan=:p, updated_at=:now WHERE id=:id"),
        {"id": dataset.id, "p": json.dumps(plan), "now": datetime.now(timezone.utc)}
    )
    await db.commit()
    return plan


def _apply_cleaning_inline(dataset_id: str, minio_path: str, original_filename: str, plan: dict, strategies: dict, target_column: str | None):
    """Apply cleaning strategies, upload result to MinIO, re-profile cleaned data. Returns stats dict."""
    from ...core.config import settings as _s
    from ...storage.minio import download_bytes, get_minio_client
    from ...ml.cleaning.cleaner import apply_cleaning_plan
    from ...ml.profiling.profiler import profile_dataframe
    from ...ml.eda.analyzer import analyze_dataframe
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker as _sm

    raw = download_bytes(_s.MINIO_BUCKET_DATASETS, minio_path)
    fname = original_filename.lower()
    if fname.endswith(".parquet"):
        df = pd.read_parquet(io.BytesIO(raw))
    elif fname.endswith(".json"):
        df = pd.read_json(io.BytesIO(raw))
    else:
        df = pd.read_csv(io.BytesIO(raw))

    original_shape = df.shape
    actions = plan.get("actions", [])
    df_clean = apply_cleaning_plan(df, actions, strategies)
    cleaned_shape = df_clean.shape

    clean_bytes = df_clean.to_csv(index=False).encode("utf-8")
    clean_filename = original_filename.replace(".csv", "_cleaned.csv").replace(".parquet", "_cleaned.csv")
    clean_path = f"{dataset_id}/cleaned/{clean_filename}"

    client = get_minio_client()
    client.put_object(
        _s.MINIO_BUCKET_DATASETS,
        clean_path,
        io.BytesIO(clean_bytes),
        length=len(clean_bytes),
        content_type="text/csv",
    )

    # Re-profile the cleaned dataset so downstream pages see accurate stats
    new_profile = profile_dataframe(dataset_id, df_clean)

    # Recompute EDA from cleaned profile + cleaned dataframe
    new_eda = analyze_dataframe(dataset_id, df_clean, new_profile, target_column)

    # Regenerate cleaning plan from new profile (will show 0 issues if clean)
    from ...ml.cleaning.cleaner import generate_cleaning_plan
    new_cleaning_plan = generate_cleaning_plan(dataset_id, new_profile)

    # Embed the audit trail so the UI can show "what was cleaned" persistently
    audit = {
        "original_rows": original_shape[0],
        "original_cols": original_shape[1],
        "cleaned_rows": cleaned_shape[0],
        "cleaned_cols": cleaned_shape[1],
        "rows_removed": original_shape[0] - cleaned_shape[0],
        "cols_removed": original_shape[1] - cleaned_shape[1],
        "cleaned_path": clean_path,
        "applied_strategies": strategies,
        "applied_at": datetime.now(timezone.utc).isoformat(),
    }
    new_cleaning_plan["audit"] = audit

    # Persist updated profile, eda, cleaning_plan and minio_path to DB
    sync_url = _s.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://"
    ).replace("postgresql+aiosqlite:///", "sqlite:///")
    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = _sm(bind=engine)
    session = Session()
    try:
        session.execute(
            text(
                """UPDATE datasets
                   SET profile_data=:p, eda_report=:e, cleaning_plan=:cp,
                       row_count=:r, col_count=:c, minio_path=:mp, updated_at=:now
                   WHERE id=:id"""
            ),
            {
                "id": dataset_id,
                "p": json.dumps(new_profile),
                "e": json.dumps(new_eda),
                "cp": json.dumps(new_cleaning_plan),
                "r": cleaned_shape[0],
                "c": cleaned_shape[1],
                "mp": clean_path,  # point dataset at the cleaned file going forward
                "now": datetime.now(timezone.utc),
            },
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()

    return audit


@router.post("/cleaning/apply")
async def apply_cleaning(body: CleaningApplyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.cleaning_plan:
        raise HTTPException(status_code=422, detail="Generate cleaning plan first via GET /api/cleaning")

    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"
    plan = dataset.cleaning_plan
    target_column = dataset.target_column

    loop = asyncio.get_event_loop()
    stats = await loop.run_in_executor(
        None, _apply_cleaning_inline, body.dataset_id, minio_path, original_filename, plan, body.strategies, target_column
    )

    return {"status": "applied", **stats}
