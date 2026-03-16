"""Extend tasktype enum with anomaly_detection and forecasting.

Revision ID: 0004
Revises: 0003
Create Date: 2024-01-04 00:00:00.000000
"""
from __future__ import annotations

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires adding enum values with ALTER TYPE
    op.execute("ALTER TYPE tasktype ADD VALUE IF NOT EXISTS 'anomaly_detection'")
    op.execute("ALTER TYPE tasktype ADD VALUE IF NOT EXISTS 'forecasting'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values easily; this is intentionally a no-op.
    pass
