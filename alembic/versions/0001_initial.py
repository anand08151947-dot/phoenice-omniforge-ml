"""Initial migration: create datasets and jobs tables.

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("minio_path", sa.String(512), nullable=True),
        sa.Column("row_count", sa.BigInteger(), nullable=True),
        sa.Column("col_count", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("uploading", "processing", "ready", "error", name="datasetstatus"),
            nullable=False,
            server_default="uploading",
        ),
        sa.Column(
            "task_type",
            sa.Enum("classification", "regression", "clustering", "unknown", name="tasktype"),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("target_column", sa.String(255), nullable=True),
        sa.Column("profile_data", sa.JSON(), nullable=True),
        sa.Column("pii_report", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("dataset_id", sa.String(36), nullable=False),
        sa.Column("job_type", sa.String(64), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "running", "done", "failed", name="jobstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("progress", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.String(2048), nullable=True),
        sa.Column("celery_task_id", sa.String(36), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("jobs")
    op.drop_table("datasets")
    op.execute("DROP TYPE IF EXISTS jobstatus")
    op.execute("DROP TYPE IF EXISTS datasetstatus")
    op.execute("DROP TYPE IF EXISTS tasktype")
