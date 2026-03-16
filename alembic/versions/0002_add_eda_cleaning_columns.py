"""Add eda_report and cleaning_plan columns to datasets.

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("datasets", sa.Column("eda_report", sa.JSON(), nullable=True))
    op.add_column("datasets", sa.Column("cleaning_plan", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("datasets", "cleaning_plan")
    op.drop_column("datasets", "eda_report")
