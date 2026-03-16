"""Feature selection router."""
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


class SelectionApplyRequest(BaseModel):
    dataset_id: str
    features: list[dict]  # list of {feature, keep, ...}


def _run_selection_inline(dataset_id: str, minio_path: str, original_filename: str, target_column: str, feature_overrides: dict | None = None) -> dict:
    from ...core.config import settings as _s
    from ...storage.minio import download_bytes
    from ...ml.selection.selector import compute_selection

    raw = download_bytes(_s.MINIO_BUCKET_DATASETS, minio_path)
    fname = original_filename.lower()
    if fname.endswith(".parquet"):
        df = pd.read_parquet(io.BytesIO(raw))
    elif fname.endswith(".json"):
        df = pd.read_json(io.BytesIO(raw))
    else:
        df = pd.read_csv(io.BytesIO(raw))

    plan = compute_selection(dataset_id, df, target_column)

    # Apply user overrides from EDA phase
    if feature_overrides:
        for imp in plan.get("importances", []):
            feat = imp["feature"]
            override = feature_overrides.get(feat, "auto")
            if override == "include":
                imp["keep"] = True
                imp["override"] = "pinned"
            elif override == "exclude":
                imp["keep"] = False
                imp["override"] = "excluded"
            else:
                imp["override"] = "auto"
        plan["selected_count"] = sum(1 for f in plan["importances"] if f.get("keep"))
        plan["dropped_count"] = sum(1 for f in plan["importances"] if not f.get("keep"))

    return plan


@router.get("/selection")
async def get_selection(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.profile_data:
        raise HTTPException(status_code=422, detail="Profile the dataset first")

    target_column = dataset.target_column
    if not target_column:
        raise HTTPException(status_code=422, detail="Set a target column first")

    # Return cached
    if dataset.selection_plan:
        return dataset.selection_plan

    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"
    feature_overrides = (dataset.eda_report or {}).get("feature_overrides", {})

    loop = asyncio.get_event_loop()
    plan = await loop.run_in_executor(
        None, _run_selection_inline, dataset_id, minio_path, original_filename, target_column, feature_overrides
    )

    await db.execute(
        text("UPDATE datasets SET selection_plan=:p, updated_at=:now WHERE id=:id"),
        {"id": dataset_id, "p": json.dumps(plan), "now": datetime.now(timezone.utc)}
    )
    await db.commit()
    return plan


@router.post("/selection/apply")
async def apply_selection(body: SelectionApplyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    import copy
    from sqlalchemy.orm.attributes import flag_modified

    plan = copy.deepcopy(dataset.selection_plan or {})
    plan["importances"] = body.features
    plan["selected_count"] = sum(1 for f in body.features if f.get("keep"))
    plan["dropped_count"] = sum(1 for f in body.features if not f.get("keep"))
    dataset.selection_plan = plan
    flag_modified(dataset, "selection_plan")
    dataset.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "status": "saved",
        "selected_count": plan["selected_count"],
        "dropped_count": plan["dropped_count"],
    }
