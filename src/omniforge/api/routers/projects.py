"""Projects router — Enterprise Admin Dashboard (multi-project control plane)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset, DatasetStatus
from ...db.models.project import Project, AuditLog, ProjectStatus
from ...db.session import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _log_audit(
    db: AsyncSession,
    action: str,
    actor: str = "system",
    project_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
    detail: Optional[dict] = None,
) -> None:
    """Record an audit log entry (fire-and-forget, non-critical)."""
    try:
        log = AuditLog(
            id=str(uuid.uuid4()),
            project_id=project_id,
            dataset_id=dataset_id,
            actor=actor,
            action=action,
            detail=detail or {},
        )
        db.add(log)
        # Don't commit here — caller commits
    except Exception:
        pass  # Never block on audit failures


def _project_to_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "owner": p.owner,
        "team_members": p.team_members or [],
        "status": p.status.value if p.status else "active",
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: str = "Unknown"
    team_members: list[dict] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    team_members: Optional[list[dict]] = None
    status: Optional[str] = None


# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------

@router.post("/projects", status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """Create a new ML project."""
    project = Project(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        owner=body.owner,
        team_members=body.team_members,
        status=ProjectStatus.active,
    )
    db.add(project)
    await _log_audit(
        db, "project.create", actor=body.owner, project_id=project.id,
        detail={"name": body.name}
    )
    await db.commit()
    await db.refresh(project)
    return _project_to_dict(project)


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all projects with summary stats."""
    result = await db.execute(
        select(Project).order_by(Project.updated_at.desc())
    )
    projects = result.scalars().all()

    out = []
    for p in projects:
        # Count datasets in this project
        ds_result = await db.execute(
            select(func.count()).where(Dataset.project_id == p.id)
        )
        dataset_count = ds_result.scalar() or 0

        # Get last activity from audit_logs
        last_log_result = await db.execute(
            select(AuditLog)
            .where(AuditLog.project_id == p.id)
            .order_by(AuditLog.created_at.desc())
            .limit(1)
        )
        last_log = last_log_result.scalar_one_or_none()

        # Get best model score across all project datasets
        best_score: Optional[float] = None
        best_model: Optional[str] = None
        ds_all = await db.execute(
            select(Dataset)
            .where(Dataset.project_id == p.id)
            .where(Dataset.status == DatasetStatus.ready)
        )
        for ds in ds_all.scalars().all():
            tr = ds.training_results or {}
            score = tr.get("best_cv_score")
            if score is not None and (best_score is None or score > best_score):
                best_score = score
                best_model = tr.get("best_model")

        entry = _project_to_dict(p)
        entry["dataset_count"] = dataset_count
        entry["last_activity"] = last_log.created_at.isoformat() if last_log and last_log.created_at else None
        entry["best_cv_score"] = round(best_score, 4) if best_score is not None else None
        entry["best_model"] = best_model
        out.append(entry)

    return {"projects": out}


@router.get("/projects/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get project detail with datasets, recent activity, and team."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Datasets in this project
    ds_result = await db.execute(
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.updated_at.desc())
    )
    datasets = ds_result.scalars().all()

    ds_out = []
    for ds in datasets:
        tr = ds.training_results or {}
        phase_done = []
        if ds.pii_report: phase_done.append("pii")
        if ds.profile_data: phase_done.append("profile")
        if ds.eda_report: phase_done.append("eda")
        if ds.cleaning_plan: phase_done.append("cleaning")
        if ds.training_results: phase_done.append("training")
        if ds.evaluation_results: phase_done.append("evaluation")
        ds_out.append({
            "id": ds.id,
            "name": ds.name,
            "status": ds.status.value if ds.status else "unknown",
            "task_type": ds.task_type.value if ds.task_type else "unknown",
            "row_count": ds.row_count,
            "col_count": ds.col_count,
            "created_by": ds.created_by,
            "created_at": ds.created_at.isoformat() if ds.created_at else None,
            "updated_at": ds.updated_at.isoformat() if ds.updated_at else None,
            "best_model": tr.get("best_model"),
            "best_cv_score": tr.get("best_cv_score"),
            "phases_done": phase_done,
            "phases_total": 13,
        })

    # Recent activity for this project
    log_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.project_id == project_id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )
    logs = log_result.scalars().all()
    activity = [
        {
            "id": l.id,
            "actor": l.actor,
            "action": l.action,
            "dataset_id": l.dataset_id,
            "detail": l.detail,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]

    out = _project_to_dict(project)
    out["datasets"] = ds_out
    out["activity"] = activity
    return out


@router.patch("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    """Update project metadata."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.owner is not None:
        project.owner = body.owner
    if body.team_members is not None:
        project.team_members = body.team_members
    if body.status is not None:
        project.status = ProjectStatus(body.status)

    await db.commit()
    await db.refresh(project)
    return _project_to_dict(project)


@router.delete("/projects/{project_id}")
async def archive_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Soft-archive a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = ProjectStatus.archived
    await db.commit()
    return {"status": "archived", "project_id": project_id}


# ---------------------------------------------------------------------------
# Admin Overview
# ---------------------------------------------------------------------------

@router.get("/admin/overview")
async def admin_overview(db: AsyncSession = Depends(get_db)):
    """Platform-wide stats for the admin dashboard."""
    # Total projects
    proj_count_result = await db.execute(select(func.count()).select_from(Project))
    total_projects = proj_count_result.scalar() or 0

    active_proj_result = await db.execute(
        select(func.count()).where(Project.status == ProjectStatus.active)
    )
    active_projects = active_proj_result.scalar() or 0

    # Total datasets
    ds_count_result = await db.execute(select(func.count()).select_from(Dataset))
    total_datasets = ds_count_result.scalar() or 0

    ready_ds_result = await db.execute(
        select(func.count()).where(Dataset.status == DatasetStatus.ready)
    )
    ready_datasets = ready_ds_result.scalar() or 0

    # Datasets with training results
    trained_result = await db.execute(
        select(func.count()).where(Dataset.training_results.isnot(None))
    )
    models_trained = trained_result.scalar() or 0

    # Datasets with deployments
    deployed_result = await db.execute(
        select(func.count()).where(Dataset.training_results.isnot(None))
    )
    # Count actual deployments
    all_ds_result = await db.execute(
        select(Dataset.training_results).where(Dataset.training_results.isnot(None))
    )
    deployed_count = sum(
        1 for (tr,) in all_ds_result.all()
        if isinstance(tr, dict) and tr.get("deployments")
    )

    # Unique engineers (actors from audit_logs)
    actors_result = await db.execute(
        select(AuditLog.actor).distinct()
    )
    engineers = [r[0] for r in actors_result.all() if r[0] and r[0] != "system"]

    # Recent activity (last 10)
    recent_result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
    )
    recent_activity = [
        {
            "id": l.id,
            "actor": l.actor,
            "action": l.action,
            "project_id": l.project_id,
            "dataset_id": l.dataset_id,
            "detail": l.detail,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in recent_result.scalars().all()
    ]

    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "total_datasets": total_datasets,
        "ready_datasets": ready_datasets,
        "models_trained": models_trained,
        "deployed_count": deployed_count,
        "engineer_count": len(engineers),
        "engineers": engineers,
        "recent_activity": recent_activity,
    }


@router.get("/admin/activity")
async def admin_activity(
    limit: int = Query(50, le=200),
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Cross-project activity feed."""
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if project_id:
        q = q.where(AuditLog.project_id == project_id)
    result = await db.execute(q)
    logs = result.scalars().all()

    return {
        "activity": [
            {
                "id": l.id,
                "actor": l.actor,
                "action": l.action,
                "project_id": l.project_id,
                "dataset_id": l.dataset_id,
                "detail": l.detail,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ]
    }


# ---------------------------------------------------------------------------
# Public helper for other routers to call audit logging
# ---------------------------------------------------------------------------

async def log_audit(
    db: AsyncSession,
    action: str,
    actor: str = "system",
    project_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
    detail: Optional[dict] = None,
) -> None:
    """Public audit logging helper — import from other routers."""
    await _log_audit(db, action, actor, project_id, dataset_id, detail)
