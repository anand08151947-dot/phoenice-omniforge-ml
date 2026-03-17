"""Session router — returns the most recent dataset with derived phase status.

This powers the frontend's server-side hydration so that any browser
opening the app sees the same pipeline state as the database.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset, DatasetStatus
from ...db.session import get_db

router = APIRouter()


def _derive_phase_status(dataset: Dataset) -> dict[str, str]:
    """Map populated DB columns → phase completion status."""
    def done_if(condition: bool) -> str:
        return "done" if condition else "pending"

    return {
        "upload":     done_if(dataset.status == DatasetStatus.ready),
        "pii":        done_if(bool(dataset.pii_report)),
        "profile":    done_if(bool(dataset.profile_data)),
        "eda":        done_if(bool(dataset.eda_report)),
        "cleaning":   done_if(bool(dataset.cleaning_plan)),
        "sampling":   done_if(bool(dataset.sampling_config)),
        "features":   done_if(bool(dataset.feature_plan)),
        "selection":  done_if(bool(dataset.selection_plan)),
        "training":   done_if(bool(dataset.training_results)),
        "evaluation": done_if(bool(dataset.evaluation_results)),
        # explain is available once training is done (no separate persisted state needed)
        "explain":    done_if(bool(dataset.training_results)),
        # deploy is done once a deployment record exists in training_results
        "deploy":     done_if(
            bool(dataset.training_results)
            and bool((dataset.training_results or {}).get("deployments"))
        ),
        # chat is always available once a dataset is loaded
        "chat":       done_if(bool(dataset.status == DatasetStatus.ready)),
    }


class SessionOut(BaseModel):
    dataset_id: str
    dataset_name: str
    target_column: str | None
    task_type: str | None
    phase_status: dict[str, str]

    model_config = {"from_attributes": True}


@router.get("/session", response_model=SessionOut | None)
async def get_session(db: AsyncSession = Depends(get_db)):
    """Return the most recently updated ready dataset with derived phase status.

    Returns null if no ready dataset exists.
    """
    result = await db.execute(
        select(Dataset)
        .where(Dataset.status == DatasetStatus.ready)
        .order_by(Dataset.updated_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        return None

    return SessionOut(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        target_column=dataset.target_column,
        task_type=dataset.task_type.value if dataset.task_type else None,
        phase_status=_derive_phase_status(dataset),
    )
