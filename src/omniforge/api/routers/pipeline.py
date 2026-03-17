"""Pipeline Orchestration & Scheduled Retraining router — Phase 13."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.models.pipeline import PipelineRun, PipelineSchedule
from ...db.session import AsyncSessionLocal, get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ScheduleCreate(BaseModel):
    name: str
    dataset_id: str
    cron_expr: str
    description: str | None = None
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    name: str | None = None
    cron_expr: str | None = None
    description: str | None = None
    enabled: bool | None = None


class RunCreate(BaseModel):
    dataset_id: str
    trigger: str = "manual"
    schedule_id: int | None = None


# ---------------------------------------------------------------------------
# Cron parsing helper
# ---------------------------------------------------------------------------

def _cron_kwargs(cron_expr: str) -> dict[str, str]:
    """Parse a 5-field cron expression into APScheduler CronTrigger kwargs."""
    parts = cron_expr.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression (need 5 fields): {cron_expr!r}")
    keys = ("minute", "hour", "day", "month", "day_of_week")
    return dict(zip(keys, parts))


# ---------------------------------------------------------------------------
# Scheduler helpers (imported lazily to avoid import-time APScheduler dep)
# ---------------------------------------------------------------------------

def _get_scheduler():
    """Return the running APScheduler instance from main app state."""
    try:
        from ...api.scheduler import scheduler  # type: ignore[attr-defined]
        return scheduler
    except Exception:
        return None


def _add_schedule_job(schedule: PipelineSchedule) -> None:
    sched = _get_scheduler()
    if sched is None:
        return
    try:
        from apscheduler.triggers.cron import CronTrigger
        kwargs = _cron_kwargs(schedule.cron_expr)
        sched.add_job(
            _run_scheduled_pipeline,
            CronTrigger(**kwargs),
            id=f"schedule_{schedule.id}",
            args=[schedule.id, schedule.dataset_id],
            replace_existing=True,
        )
    except Exception:
        pass


def _remove_schedule_job(schedule_id: int) -> None:
    sched = _get_scheduler()
    if sched is None:
        return
    try:
        sched.remove_job(f"schedule_{schedule_id}")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Core training background logic
# ---------------------------------------------------------------------------

async def _execute_pipeline_run(run_id: int, dataset_id: str) -> None:
    """Run training for dataset_id and update PipelineRun record."""
    async with AsyncSessionLocal() as db:
        # Mark as running
        result = await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))
        run = result.scalar_one_or_none()
        if run is None:
            return
        run.status = "running"
        run.started_at = datetime.utcnow()
        await db.commit()

        # Load dataset
        ds_result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
        dataset = ds_result.scalar_one_or_none()
        if dataset is None:
            run.status = "failed"
            run.error = f"Dataset {dataset_id} not found"
            run.finished_at = datetime.utcnow()
            await db.commit()
            return

        task_type = dataset.task_type.value if dataset.task_type else "classification"
        minio_path = dataset.minio_path
        original_filename = dataset.original_filename or "upload.csv"
        target_column = dataset.target_column
        selection_plan = dataset.selection_plan
        sampling_config = dataset.sampling_config

        if not minio_path:
            run.status = "failed"
            run.error = "No dataset file found — run profiling first"
            run.finished_at = datetime.utcnow()
            await db.commit()
            return

        # Run training in executor to avoid blocking the event loop
        from ...api.routers.training import _run_training_inline  # noqa: PLC0415

        loop = asyncio.get_event_loop()
        try:
            training_results: dict[str, Any] = await loop.run_in_executor(
                None,
                _run_training_inline,
                dataset_id,
                minio_path,
                original_filename,
                target_column,
                task_type,
                selection_plan,
                sampling_config,
            )
            run.status = "completed"
            run.metrics = training_results
        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)

        run.finished_at = datetime.utcnow()
        await db.commit()

        # Update last_run_at on schedule if applicable
        if run.schedule_id is not None:
            sched_result = await db.execute(
                select(PipelineSchedule).where(PipelineSchedule.id == run.schedule_id)
            )
            schedule = sched_result.scalar_one_or_none()
            if schedule:
                schedule.last_run_at = run.finished_at
                await db.commit()


async def _run_scheduled_pipeline(schedule_id: int, dataset_id: str) -> None:
    """Entry point called by APScheduler cron jobs."""
    async with AsyncSessionLocal() as db:
        run = PipelineRun(
            schedule_id=schedule_id,
            dataset_id=dataset_id,
            trigger="scheduled",
            status="pending",
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        run_id = run.id

    await _execute_pipeline_run(run_id, dataset_id)


# ---------------------------------------------------------------------------
# Schedule CRUD endpoints
# ---------------------------------------------------------------------------

@router.post("/schedule", status_code=201)
async def create_schedule(body: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    try:
        _cron_kwargs(body.cron_expr)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    schedule = PipelineSchedule(
        name=body.name,
        dataset_id=body.dataset_id,
        cron_expr=body.cron_expr,
        description=body.description,
        enabled=body.enabled,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    if schedule.enabled:
        _add_schedule_job(schedule)

    return _schedule_dict(schedule)


@router.get("/schedules")
async def list_schedules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PipelineSchedule))
    return [_schedule_dict(s) for s in result.scalars().all()]


@router.get("/schedule/{schedule_id}")
async def get_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    schedule = await _get_schedule_or_404(schedule_id, db)
    return _schedule_dict(schedule)


@router.put("/schedule/{schedule_id}")
async def update_schedule(
    schedule_id: int, body: ScheduleUpdate, db: AsyncSession = Depends(get_db)
):
    schedule = await _get_schedule_or_404(schedule_id, db)

    if body.cron_expr is not None:
        try:
            _cron_kwargs(body.cron_expr)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        schedule.cron_expr = body.cron_expr

    if body.name is not None:
        schedule.name = body.name
    if body.description is not None:
        schedule.description = body.description
    if body.enabled is not None:
        schedule.enabled = body.enabled

    await db.commit()
    await db.refresh(schedule)

    # Sync scheduler state
    _remove_schedule_job(schedule_id)
    if schedule.enabled:
        _add_schedule_job(schedule)

    return _schedule_dict(schedule)


@router.delete("/schedule/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    schedule = await _get_schedule_or_404(schedule_id, db)
    _remove_schedule_job(schedule_id)
    await db.delete(schedule)
    await db.commit()


# ---------------------------------------------------------------------------
# Run endpoints
# ---------------------------------------------------------------------------

@router.get("/runs")
async def list_runs(
    schedule_id: int | None = None,
    dataset_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(PipelineRun)
    if schedule_id is not None:
        query = query.where(PipelineRun.schedule_id == schedule_id)
    if dataset_id is not None:
        query = query.where(PipelineRun.dataset_id == dataset_id)
    result = await db.execute(query.order_by(PipelineRun.id.desc()))
    return [_run_dict(r) for r in result.scalars().all()]


@router.post("/run", status_code=202)
async def trigger_run(
    body: RunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    run = PipelineRun(
        schedule_id=body.schedule_id,
        dataset_id=body.dataset_id,
        trigger=body.trigger,
        status="pending",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    background_tasks.add_task(_execute_pipeline_run, run.id, body.dataset_id)
    return _run_dict(run)


@router.get("/run/{run_id}")
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return _run_dict(run)


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def _schedule_dict(s: PipelineSchedule) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "dataset_id": s.dataset_id,
        "cron_expr": s.cron_expr,
        "description": s.description,
        "enabled": s.enabled,
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _run_dict(r: PipelineRun) -> dict:
    return {
        "id": r.id,
        "schedule_id": r.schedule_id,
        "dataset_id": r.dataset_id,
        "trigger": r.trigger,
        "status": r.status,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "metrics": r.metrics,
        "error": r.error,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


async def _get_schedule_or_404(schedule_id: int, db: AsyncSession) -> PipelineSchedule:
    result = await db.execute(
        select(PipelineSchedule).where(PipelineSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if schedule is None:
        raise HTTPException(status_code=404, detail="Pipeline schedule not found")
    return schedule
