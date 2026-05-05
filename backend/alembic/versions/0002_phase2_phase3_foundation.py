"""phase2 and phase3 foundation

Revision ID: 0002_phase2_phase3_foundation
Revises: 0001_phase1_baseline
Create Date: 2026-04-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0002_phase2_phase3_foundation'
down_revision: Union[str, None] = '0001_phase1_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sprint',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('goal', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('planned','active','completed')", name='ck_sprint_status_valid'),
    )
    op.create_index('ix_sprint_project_status', 'sprint', ['project_id', 'status'])

    op.create_table(
        'milestone',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('open','done')", name='ck_milestone_status_valid'),
    )

    op.create_table(
        'project_status_column',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('color', sa.String(length=12), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('is_done', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_status_column_project_order', 'project_status_column', ['project_id', 'order_index'])

    op.create_table(
        'task',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('sprint_id', sa.UUID(), nullable=True),
        sa.Column('parent_task_id', sa.UUID(), nullable=True),
        sa.Column('status_column_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=64), nullable=False),
        sa.Column('priority', sa.String(length=32), nullable=False),
        sa.Column('order_index', sa.Float(), nullable=False),
        sa.Column('estimate_minutes', sa.Integer(), nullable=True),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('assignee_id', sa.UUID(), nullable=True),
        sa.Column('watchers', sa.JSON(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['sprint_id'], ['sprint.id']),
        sa.ForeignKeyConstraint(['parent_task_id'], ['task.id']),
        sa.ForeignKeyConstraint(['status_column_id'], ['project_status_column.id']),
        sa.ForeignKeyConstraint(['assignee_id'], ['user.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('project_id IS NOT NULL OR sprint_id IS NULL', name='ck_task_personal_has_no_sprint'),
        sa.CheckConstraint('parent_task_id IS NULL OR parent_task_id <> id', name='ck_task_parent_not_self'),
        sa.CheckConstraint("priority IN ('low','medium','high','urgent')", name='ck_task_priority_valid'),
    )
    op.create_index('ix_task_workspace_assignee_due', 'task', ['workspace_id', 'assignee_id', 'due_at'])
    op.create_index('ix_task_project_sprint', 'task', ['project_id', 'sprint_id'])

    op.create_table(
        'task_activity',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['task_id'], ['task.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_task_activity_task_created', 'task_activity', ['task_id', 'created_at'])

    op.create_table(
        'task_comment',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('mentions', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['task_id'], ['task.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'time_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('minutes', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['task_id'], ['task.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_time_log_task_user_created', 'time_log', ['task_id', 'user_id', 'created_at'])

    op.create_table(
        'notification',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(length=16), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('related_task_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['related_task_id'], ['task.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("priority IN ('normal','high')", name='ck_notification_priority_valid'),
    )
    op.create_index('ix_notification_user_created', 'notification', ['user_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_notification_user_created', table_name='notification')
    op.drop_table('notification')

    op.drop_index('ix_time_log_task_user_created', table_name='time_log')
    op.drop_table('time_log')

    op.drop_table('task_comment')

    op.drop_index('ix_task_activity_task_created', table_name='task_activity')
    op.drop_table('task_activity')

    op.drop_index('ix_task_project_sprint', table_name='task')
    op.drop_index('ix_task_workspace_assignee_due', table_name='task')
    op.drop_table('task')

    op.drop_index('ix_status_column_project_order', table_name='project_status_column')
    op.drop_table('project_status_column')

    op.drop_table('milestone')

    op.drop_index('ix_sprint_project_status', table_name='sprint')
    op.drop_table('sprint')

