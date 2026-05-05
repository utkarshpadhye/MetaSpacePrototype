"""phase1 baseline

Revision ID: 0001_phase1_baseline
Revises: None
Create Date: 2026-04-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001_phase1_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )

    op.create_table(
        'workspace',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('subdomain', sa.String(length=120), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('plan', sa.Enum('free', 'pro', 'enterprise', name='workspace_plan'), nullable=False),
        sa.Column('timezone', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subdomain'),
    )

    op.create_table(
        'role',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('color', sa.String(length=12), nullable=False),
        sa.Column('permissions', sa.JSON(), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_role_workspace_name', 'role', ['workspace_id', 'name'], unique=True)

    op.create_table(
        'workspace_member',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.Enum('active', 'invited', 'suspended', name='workspace_member_status'), nullable=False),
        sa.Column('invited_by', sa.UUID(), nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['invited_by'], ['user.id']),
        sa.ForeignKeyConstraint(['role_id'], ['role.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_workspace_member_workspace_user', 'workspace_member', ['workspace_id', 'user_id'], unique=True)

    op.create_table(
        'user_permission_override',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('permission', sa.String(length=120), nullable=False),
        sa.Column('type', sa.Enum('grant', 'revoke', name='permission_override_type'), nullable=False),
        sa.Column('granted_by', sa.UUID(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['granted_by'], ['user.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_override_workspace_user_perm', 'user_permission_override', ['workspace_id', 'user_id', 'permission'])

    op.create_table(
        'project',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('planning', 'active', 'on_hold', 'completed', 'archived', name='project_status'), nullable=False),
        sa.Column('color', sa.String(length=12), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id']),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'project_member',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=True),
        sa.Column('added_by', sa.UUID(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['added_by'], ['user.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['role_id'], ['role.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_project_member_project_user', 'project_member', ['project_id', 'user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_project_member_project_user', table_name='project_member')
    op.drop_table('project_member')
    op.drop_table('project')

    op.drop_index('ix_override_workspace_user_perm', table_name='user_permission_override')
    op.drop_table('user_permission_override')

    op.drop_index('ix_workspace_member_workspace_user', table_name='workspace_member')
    op.drop_table('workspace_member')

    op.drop_index('ix_role_workspace_name', table_name='role')
    op.drop_table('role')

    op.drop_table('workspace')
    op.drop_table('user')

    op.execute('DROP TYPE IF EXISTS project_status')
    op.execute('DROP TYPE IF EXISTS permission_override_type')
    op.execute('DROP TYPE IF EXISTS workspace_member_status')
    op.execute('DROP TYPE IF EXISTS workspace_plan')
