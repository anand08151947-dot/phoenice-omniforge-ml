"""Add prediction_logs table.

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-17 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'prediction_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('dataset_id', sa.String(36), nullable=True, index=True),
        sa.Column('deployment_id', sa.String(64), nullable=True, index=True),
        sa.Column('prediction_id', sa.String(64), unique=True, nullable=False),
        sa.Column('input_features', sa.JSON(), nullable=False),
        sa.Column('prediction', sa.JSON(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('ground_truth', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_prediction_logs_prediction_id', 'prediction_logs', ['prediction_id'], unique=True)
    op.create_index('ix_prediction_logs_deployment_id', 'prediction_logs', ['deployment_id'])
    op.create_index('ix_prediction_logs_dataset_id', 'prediction_logs', ['dataset_id'])


def downgrade() -> None:
    op.drop_index('ix_prediction_logs_dataset_id', table_name='prediction_logs')
    op.drop_index('ix_prediction_logs_deployment_id', table_name='prediction_logs')
    op.drop_index('ix_prediction_logs_prediction_id', table_name='prediction_logs')
    op.drop_table('prediction_logs')
