"""Celery task: PII scan a dataset."""
from __future__ import annotations

import io
import json
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import settings
from ..storage.minio import download_bytes
from ..tasks.celery_app import celery_app

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


@celery_app.task(bind=True, name="omniforge.tasks.run_pii_scan")
def run_pii_scan(self, dataset_id: str):
    from ..ml.pii.scanner import scan_dataframe

    session = _get_session()
    try:
        self.update_state(state="PROGRESS", meta={"progress": 10})

        row = session.execute(
            text("SELECT minio_path FROM datasets WHERE id=:id"),
            {"id": dataset_id},
        ).fetchone()

        if row is None:
            raise ValueError(f"Dataset {dataset_id} not found")

        minio_path = row.minio_path

        raw = download_bytes(settings.MINIO_BUCKET_DATASETS, minio_path)

        self.update_state(state="PROGRESS", meta={"progress": 30})

        fname = minio_path.lower()
        if fname.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(raw))
        elif fname.endswith(".json"):
            df = pd.read_json(io.BytesIO(raw))
        else:
            df = pd.read_csv(io.BytesIO(raw))

        self.update_state(state="PROGRESS", meta={"progress": 60})

        report = scan_dataframe(df)
        report["dataset_id"] = dataset_id

        session.execute(
            text(
                "UPDATE datasets SET pii_report=:report, updated_at=:now WHERE id=:id"
            ),
            {
                "id": dataset_id,
                "report": json.dumps(report),
                "now": datetime.now(timezone.utc),
            },
        )
        session.commit()

        self.update_state(state="PROGRESS", meta={"progress": 100})
        return {"status": "done", "dataset_id": dataset_id}

    except Exception as exc:
        session.commit()
        raise
    finally:
        session.close()
