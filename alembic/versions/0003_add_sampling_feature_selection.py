"""Add sampling_config, feature_plan, selection_plan columns.

Revision ID: 0003
Revises: 0002
Create Date: 2024-01-03 00:00:00.000000
"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("datasets", sa.Column("sampling_config", sa.JSON(), nullable=True))
    op.add_column("datasets", sa.Column("feature_plan", sa.JSON(), nullable=True))
    op.add_column("datasets", sa.Column("selection_plan", sa.JSON(), nullable=True))

def downgrade() -> None:
    op.drop_column("datasets", "selection_plan")
    op.drop_column("datasets", "feature_plan")
    op.drop_column("datasets", "sampling_config")
