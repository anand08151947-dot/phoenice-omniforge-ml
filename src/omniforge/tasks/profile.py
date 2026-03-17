"""Celery task: profile a dataset."""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import settings
from ..storage.minio import download_bytes
from ..tasks.celery_app import celery_app

# Build sync DB URL: swap asyncpg → psycopg2
_SYNC_DB_URL = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", "postgresql+psycopg2://"
).replace("postgresql+aiosqlite:///", "sqlite:///")

_engine = None
_SessionLocal = None


def _get_session() -> Session:
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(_SYNC_DB_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=_engine)
    return _SessionLocal()


@celery_app.task(bind=True, name="omniforge.tasks.run_profile")
def run_profile(self, dataset_id: str):
    from ..ml.profiling.profiler import profile_dataframe

    session = _get_session()
    try:
        # Mark as processing
        session.execute(
            text(
                "UPDATE datasets SET status='processing', updated_at=:now WHERE id=:id"
            ),
            {"id": dataset_id, "now": datetime.now(timezone.utc)},
        )
        session.commit()

        self.update_state(state="PROGRESS", meta={"progress": 10})

        # Fetch minio_path
        row = session.execute(
            text("SELECT minio_path, name FROM datasets WHERE id=:id"),
            {"id": dataset_id},
        ).fetchone()

        if row is None:
            raise ValueError(f"Dataset {dataset_id} not found")

        minio_path, name = row.minio_path, row.name

        self.update_state(state="PROGRESS", meta={"progress": 20})

        # Download from MinIO
        raw = download_bytes(settings.MINIO_BUCKET_DATASETS, minio_path)

        self.update_state(state="PROGRESS", meta={"progress": 30})

        # Load into pandas
        from omniforge.utils.dataframe_io import read_dataframe
        df = read_dataframe(raw, minio_path)

        self.update_state(state="PROGRESS", meta={"progress": 50})

        # Profile
        profile = profile_dataframe(dataset_id, df)

        self.update_state(state="PROGRESS", meta={"progress": 80})

        import json

        session.execute(
            text(
                """UPDATE datasets
                   SET status='ready',
                       profile_data=:profile,
                       row_count=:rows,
                       col_count=:cols,
                       updated_at=:now
                   WHERE id=:id"""
            ),
            {
                "id": dataset_id,
                "profile": json.dumps(profile),
                "rows": profile["row_count"],
                "cols": profile["col_count"],
                "now": datetime.now(timezone.utc),
            },
        )
        session.commit()

        # Also update the related job
        session.execute(
            text(
                """UPDATE jobs SET status='done', progress=100, updated_at=:now
                   WHERE dataset_id=:did AND job_type='profile'"""
            ),
            {"did": dataset_id, "now": datetime.now(timezone.utc)},
        )
        session.commit()

        self.update_state(state="PROGRESS", meta={"progress": 100})
        return {"status": "done", "dataset_id": dataset_id}

    except Exception as exc:
        session.execute(
            text(
                "UPDATE datasets SET status='error', updated_at=:now WHERE id=:id"
            ),
            {"id": dataset_id, "now": datetime.now(timezone.utc)},
        )
        session.execute(
            text(
                """UPDATE jobs SET status='failed', error=:err, updated_at=:now
                   WHERE dataset_id=:did AND job_type='profile'"""
            ),
            {"did": dataset_id, "err": str(exc)[:2000], "now": datetime.now(timezone.utc)},
        )
        session.commit()
        raise
    finally:
        session.close()
