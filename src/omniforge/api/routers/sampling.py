"""Sampling router — class imbalance detection and strategy config."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


class SamplingApplyRequest(BaseModel):
    dataset_id: str
    strategy: str
    target_ratio: float = 0.3
    random_seed: int = 42
    test_size: float = 0.2
    val_size: float = 0.1


@router.get("/sampling")
async def get_sampling(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.profile_data:
        raise HTTPException(status_code=422, detail="Profile the dataset first")

    target_column = dataset.target_column
    if not target_column:
        raise HTTPException(status_code=422, detail="Set a target column first (PATCH /api/datasets/{id})")

    # Return cached
    if dataset.sampling_config and "imbalance" in dataset.sampling_config:
        return dataset.sampling_config

    from ...ml.sampling.balancer import compute_imbalance
    imbalance = compute_imbalance(dataset.id, dataset.profile_data, target_column)

    # If class_distribution is empty (numeric target), download data to compute it
    if not imbalance["class_distribution"] and dataset.minio_path:
        import asyncio, io
        import pandas as pd

        def _compute_from_data():
            from ...core.config import settings as _s
            from ...storage.minio import download_bytes
            raw = download_bytes(_s.MINIO_BUCKET_DATASETS, dataset.minio_path)
            fname = (dataset.original_filename or "upload.csv").lower()
            if fname.endswith(".parquet"):
                df = pd.read_parquet(io.BytesIO(raw))
            elif fname.endswith(".json"):
                df = pd.read_json(io.BytesIO(raw))
            else:
                df = pd.read_csv(io.BytesIO(raw))
            if target_column in df.columns:
                vc = df[target_column].value_counts().sort_values(ascending=False)
                n = len(df)
                return [{"value": str(v), "count": int(c)} for v, c in vc.items()]
            return []

        loop = asyncio.get_event_loop()
        top_values = await loop.run_in_executor(None, _compute_from_data)
        if top_values:
            # Inject into profile and recompute
            import copy
            fake_profile = copy.deepcopy(dataset.profile_data)
            for col in fake_profile.get("columns", []):
                if col["name"] == target_column:
                    col["top_values"] = top_values
                    break
            imbalance = compute_imbalance(dataset.id, fake_profile, target_column)

    config = {
        "imbalance": imbalance,
        "config": {
            "strategy": imbalance["recommended_strategy"],
            "target_ratio": 0.3,
            "random_seed": 42,
            "test_size": 0.2,
            "val_size": 0.1,
        },
    }

    await db.execute(
        text("UPDATE datasets SET sampling_config=:c, updated_at=:now WHERE id=:id"),
        {"id": dataset.id, "c": json.dumps(config), "now": datetime.now(timezone.utc)}
    )
    await db.commit()
    return config


@router.post("/sampling/apply")
async def apply_sampling(body: SamplingApplyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    from sqlalchemy.orm.attributes import flag_modified
    import copy

    current = copy.deepcopy(dataset.sampling_config or {})
    current["config"] = {
        "strategy": body.strategy,
        "target_ratio": body.target_ratio,
        "random_seed": body.random_seed,
        "test_size": body.test_size,
        "val_size": body.val_size,
    }
    dataset.sampling_config = current
    flag_modified(dataset, "sampling_config")
    dataset.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "saved", "strategy": body.strategy}
