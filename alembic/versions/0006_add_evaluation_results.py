"""Add evaluation_results column to datasets.

Revision ID: 0006
Revises: 0005
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('datasets', sa.Column('evaluation_results', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('datasets', 'evaluation_results')
