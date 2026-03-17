"""Add pipeline_schedules and pipeline_runs tables.

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-18 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'pipeline_schedules',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('dataset_id', sa.String(36), nullable=False),
        sa.Column('cron_expr', sa.String(64), nullable=False),
        sa.Column('description', sa.String(256), nullable=True),
        sa.Column('enabled', sa.Boolean(), default=True, nullable=False),
        sa.Column('last_run_at', sa.DateTime(), nullable=True),
        sa.Column('next_run_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'pipeline_runs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('schedule_id', sa.Integer(), sa.ForeignKey('pipeline_schedules.id'), nullable=True),
        sa.Column('dataset_id', sa.String(36), nullable=False),
        sa.Column('trigger', sa.String(32), nullable=False, server_default='manual'),
        sa.Column('status', sa.String(32), nullable=False, server_default='pending'),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('metrics', sa.JSON(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('pipeline_runs')
    op.drop_table('pipeline_schedules')
