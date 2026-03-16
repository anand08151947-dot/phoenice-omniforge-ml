"""PII router."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


class PIIActionItem(BaseModel):
    column: str
    action: Literal["mask", "hash", "drop", "approve", "pseudonymize", "encrypt"]


class PIIApplyRequest(BaseModel):
    dataset_id: str
    actions: list[PIIActionItem]


def _run_pii_inline(dataset_id: str, minio_path: str, original_filename: str):
    """Run PII scan in-process using a sync DB session."""
    import io
    import pandas as pd
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker as _sm
    from ...core.config import settings as _settings
    from ...ml.pii.scanner import scan_dataframe
    from ...storage.minio import download_bytes

    sync_url = _settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://"
    ).replace("postgresql+aiosqlite:///", "sqlite:///")

    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = _sm(bind=engine)
    session = Session()
    try:
        raw = download_bytes(_settings.MINIO_BUCKET_DATASETS, minio_path)
        fname = original_filename.lower()
        if fname.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(raw))
        elif fname.endswith(".json"):
            df = pd.read_json(io.BytesIO(raw))
        else:
            df = pd.read_csv(io.BytesIO(raw))

        result = scan_dataframe(df)
        result["dataset_id"] = dataset_id

        session.execute(
            text("UPDATE datasets SET pii_report=:r, updated_at=:now WHERE id=:id"),
            {"id": dataset_id, "r": json.dumps(result), "now": datetime.now(timezone.utc)},
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


@router.get("/pii")
async def get_pii_report(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.pii_report:
        return {"dataset_id": dataset_id, "status": "not_scanned"}

    # If scanning is still in progress, return scanning status
    report = dataset.pii_report
    if isinstance(report, dict) and report.get("status") in ("scanning", "not_scanned"):
        return report

    # Full report available
    return report


@router.post("/pii/scan/{dataset_id}")
async def trigger_pii_scan(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Run PII scan synchronously (in thread pool) and return the full report."""
    import asyncio

    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"

    # Run scan in executor (non-blocking, ~4s for 25k rows)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_pii_inline, dataset_id, minio_path, original_filename)

    # Return the freshly written report
    await db.refresh(dataset)
    if dataset.pii_report and isinstance(dataset.pii_report, dict) and "pii_columns" in dataset.pii_report:
        return dataset.pii_report

    # Re-fetch in case ORM cache is stale
    await db.expire_all()
    result2 = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset2 = result2.scalar_one_or_none()
    return dataset2.pii_report or {"status": "error", "dataset_id": dataset_id}


@router.post("/pii/apply")
async def apply_pii_actions(
    body: PIIApplyRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.pii_report:
        raise HTTPException(status_code=422, detail="No PII report available for this dataset")

    import copy
    from sqlalchemy.orm.attributes import flag_modified

    report = copy.deepcopy(dataset.pii_report)   # deep copy so ORM sees a new object
    pii_columns: list[dict] = report.get("pii_columns", [])
    action_map = {a.column: a.action for a in body.actions}
    masked_count = 0

    for col in pii_columns:
        col_name = col["column"]
        if col_name in action_map:
            action = action_map[col_name]
            col["applied_action"] = action          # persist chosen action
            if action == "approve":
                col["status"] = "approved"
            elif action == "drop":
                col["status"] = "dropped"
                masked_count += 1
            else:
                col["status"] = "masked"
                masked_count += 1

    report["pii_columns"] = pii_columns
    dataset.pii_report = report
    flag_modified(dataset, "pii_report")           # force SQLAlchemy to detect the change
    await db.commit()

    return {"status": "applied", "masked_columns": masked_count}
