"""Feature engineering router."""
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


class FeaturesApplyRequest(BaseModel):
    dataset_id: str
    specs: list[dict]


@router.get("/features")
async def get_features(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.profile_data:
        raise HTTPException(status_code=422, detail="Profile the dataset first")

    # Return cached plan
    if dataset.feature_plan:
        return dataset.feature_plan

    from ...ml.features.engineer import generate_feature_plan
    plan = generate_feature_plan(
        dataset.id,
        dataset.profile_data,
        target_column=dataset.target_column,
        pii_report=dataset.pii_report,
    )

    await db.execute(
        text("UPDATE datasets SET feature_plan=:p, updated_at=:now WHERE id=:id"),
        {"id": dataset.id, "p": json.dumps(plan), "now": datetime.now(timezone.utc)}
    )
    await db.commit()
    return plan


def _apply_features_inline(dataset_id: str, minio_path: str, original_filename: str, specs: list, target_column: str | None):
    """Apply feature transforms to the dataset and save result to MinIO."""
    import numpy as np
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker as _sm
    from ...core.config import settings as _s
    from ...storage.minio import download_bytes, get_minio_client
    from ...ml.profiling.profiler import profile_dataframe

    raw = download_bytes(_s.MINIO_BUCKET_DATASETS, minio_path)
    fname = original_filename.lower()
    if fname.endswith(".parquet"):
        df = pd.read_parquet(io.BytesIO(raw))
    elif fname.endswith(".json"):
        df = pd.read_json(io.BytesIO(raw))
    else:
        df = pd.read_csv(io.BytesIO(raw))

    result_df = df.copy()
    # Keep target separate
    target_series = result_df.pop(target_column) if target_column and target_column in result_df.columns else None
    cols_to_keep = []

    for spec in specs:
        if not spec.get("enabled", True):
            continue
        src = spec["source_columns"]
        out_name = spec["output_name"]
        transform = spec.get("transform", "none")

        if not all(c in result_df.columns for c in src):
            continue

        col = result_df[src[0]]

        try:
            if transform == "log":
                min_val = col.min()
                shift = abs(min_val) + 1 if min_val <= 0 else 0
                result_df[out_name] = np.log1p(col.fillna(0) + shift)
                cols_to_keep.append(out_name)
            elif transform == "sqrt":
                min_val = col.min()
                shift = abs(min_val) if min_val < 0 else 0
                result_df[out_name] = np.sqrt(col.fillna(0) + shift)
                cols_to_keep.append(out_name)
            elif transform == "standard_scale":
                mean = col.mean()
                std = col.std()
                if std and std > 0:
                    result_df[out_name] = (col.fillna(mean) - mean) / std
                else:
                    result_df[out_name] = col.fillna(0)
                cols_to_keep.append(out_name)
            elif transform == "min_max_scale":
                mn, mx = col.min(), col.max()
                if mx > mn:
                    result_df[out_name] = (col.fillna(mn) - mn) / (mx - mn)
                else:
                    result_df[out_name] = col.fillna(0)
                cols_to_keep.append(out_name)
            elif transform == "one_hot_encode":
                dummies = pd.get_dummies(col.fillna("missing").astype(str), prefix=out_name, drop_first=False)
                for dc in dummies.columns:
                    result_df[dc] = dummies[dc].astype(int)
                    cols_to_keep.append(dc)
            elif transform == "label_encode":
                from sklearn.preprocessing import LabelEncoder
                le = LabelEncoder()
                result_df[out_name] = le.fit_transform(col.fillna("missing").astype(str))
                cols_to_keep.append(out_name)
            elif transform == "date_parts":
                dt = pd.to_datetime(col, errors="coerce")
                result_df[f"{out_name}_year"] = dt.dt.year.fillna(0).astype(int)
                result_df[f"{out_name}_month"] = dt.dt.month.fillna(0).astype(int)
                result_df[f"{out_name}_day"] = dt.dt.day.fillna(0).astype(int)
                result_df[f"{out_name}_dow"] = dt.dt.dayofweek.fillna(0).astype(int)
                cols_to_keep += [f"{out_name}_year", f"{out_name}_month", f"{out_name}_day", f"{out_name}_dow"]
            elif transform == "none":
                if out_name != src[0]:
                    result_df[out_name] = col
                cols_to_keep.append(out_name)
        except Exception:
            cols_to_keep.append(src[0])  # keep original on error

    # Build final dataframe with only the transformed cols + target
    existing_cols = [c for c in cols_to_keep if c in result_df.columns]
    final_df = result_df[existing_cols].copy()
    if target_series is not None:
        final_df[target_column] = target_series.values

    # Save to MinIO
    feat_bytes = final_df.to_csv(index=False).encode("utf-8")
    base = minio_path.rsplit("/", 1)[-1]
    feat_filename = base.replace(".csv", "_features.csv")
    feat_path = f"{dataset_id}/features/{feat_filename}"

    client = get_minio_client()
    client.put_object(
        _s.MINIO_BUCKET_DATASETS, feat_path,
        io.BytesIO(feat_bytes), length=len(feat_bytes), content_type="text/csv",
    )

    # Re-profile
    new_profile = profile_dataframe(dataset_id, final_df)

    # Persist
    sync_url = _s.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://"
    ).replace("postgresql+aiosqlite:///", "sqlite:///")
    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = _sm(bind=engine)
    session = Session()
    try:
        session.execute(
            text("""UPDATE datasets SET profile_data=:p, minio_path=:mp,
                      row_count=:r, col_count=:c,
                      eda_report=NULL, cleaning_plan=NULL, selection_plan=NULL,
                      updated_at=:now WHERE id=:id"""),
            {"id": dataset_id, "p": json.dumps(new_profile), "mp": feat_path,
             "r": final_df.shape[0], "c": final_df.shape[1],
             "now": datetime.now(timezone.utc)}
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()

    return {
        "original_cols": len(df.columns),
        "output_cols": len(final_df.columns),
        "output_rows": len(final_df),
        "feature_path": feat_path,
    }


@router.post("/features/apply")
async def apply_features(body: FeaturesApplyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    minio_path = dataset.minio_path
    original_filename = dataset.original_filename or "upload.csv"
    target_column = dataset.target_column

    # Save the user's spec choices to feature_plan
    import copy
    from sqlalchemy.orm.attributes import flag_modified
    plan = copy.deepcopy(dataset.feature_plan or {})
    plan["specs"] = body.specs
    plan["total_features_out"] = sum(1 for s in body.specs if s.get("enabled"))
    dataset.feature_plan = plan
    flag_modified(dataset, "feature_plan")
    await db.commit()

    loop = asyncio.get_event_loop()
    stats = await loop.run_in_executor(
        None, _apply_features_inline, body.dataset_id, minio_path, original_filename, body.specs, target_column
    )
    return {"status": "applied", **stats}
