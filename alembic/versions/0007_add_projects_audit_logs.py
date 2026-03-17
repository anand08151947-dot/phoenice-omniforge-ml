"""Add projects, audit_logs tables and project_id/created_by to datasets.

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-17 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner', sa.String(255), nullable=False, server_default='Unknown'),
        sa.Column('team_members', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(32), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), nullable=True),
        sa.Column('dataset_id', sa.String(36), nullable=True),
        sa.Column('actor', sa.String(255), nullable=False, server_default='system'),
        sa.Column('action', sa.String(128), nullable=False),
        sa.Column('detail', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Add project_id and created_by to datasets (nullable for backward compat)
    op.add_column('datasets', sa.Column('project_id', sa.String(36), nullable=True))
    op.add_column('datasets', sa.Column('created_by', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('datasets', 'created_by')
    op.drop_column('datasets', 'project_id')
    op.drop_table('audit_logs')
    op.drop_table('projects')
