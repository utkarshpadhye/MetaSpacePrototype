"""phase2 reports and dependency edges

Revision ID: 0003_phase2_reports_dependencies
Revises: 0002_phase2_phase3_foundation
Create Date: 2026-05-02

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0003_phase2_reports_dependencies'
down_revision: Union[str, None] = '0002_phase2_phase3_foundation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'task_dependency',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('predecessor_task_id', sa.UUID(), nullable=False),
        sa.Column('successor_task_id', sa.UUID(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['predecessor_task_id'], ['task.id']),
        sa.ForeignKeyConstraint(['successor_task_id'], ['task.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('predecessor_task_id <> successor_task_id', name='ck_task_dependency_not_self'),
    )
    op.create_index('ix_task_dependency_project_successor', 'task_dependency', ['project_id', 'successor_task_id'])
    op.create_index(
        'ix_task_dependency_unique_edge',
        'task_dependency',
        ['workspace_id', 'predecessor_task_id', 'successor_task_id'],
        unique=True,
    )

    op.create_table(
        'burndown_snapshot',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('sprint_id', sa.UUID(), nullable=False),
        sa.Column('snapshot_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('planned_points', sa.Integer(), nullable=False),
        sa.Column('completed_points', sa.Integer(), nullable=False),
        sa.Column('remaining_points', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['sprint_id'], ['sprint.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_burndown_snapshot_sprint_date', 'burndown_snapshot', ['sprint_id', 'snapshot_date'])
    op.create_index('ix_burndown_snapshot_project_date', 'burndown_snapshot', ['project_id', 'snapshot_date'])


def downgrade() -> None:
    op.drop_index('ix_burndown_snapshot_project_date', table_name='burndown_snapshot')
    op.drop_index('ix_burndown_snapshot_sprint_date', table_name='burndown_snapshot')
    op.drop_table('burndown_snapshot')

    op.drop_index('ix_task_dependency_unique_edge', table_name='task_dependency')
    op.drop_index('ix_task_dependency_project_successor', table_name='task_dependency')
    op.drop_table('task_dependency')
