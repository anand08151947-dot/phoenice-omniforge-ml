"""Add training_results column to datasets.

Revision ID: 0005
Revises: 0004
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('datasets', sa.Column('training_results', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('datasets', 'training_results')
