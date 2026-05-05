"""add auth fields and refresh tokens

Revision ID: 0006_auth_login
Revises: 0005_add_project_updated_by
Create Date: 2026-05-04

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0006_auth_login'
down_revision: Union[str, None] = '0005_add_project_updated_by'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('user', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('user', sa.Column('must_reset_password', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('user', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    op.alter_column('user', 'is_active', server_default=None)
    op.alter_column('user', 'must_reset_password', server_default=None)

    op.add_column('workspace_member', sa.Column('username', sa.String(length=120), nullable=True))
    op.create_index('ix_workspace_member_workspace_username', 'workspace_member', ['workspace_id', 'username'], unique=True)

    op.create_table(
        'refresh_token',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_refresh_token_user_workspace', 'refresh_token', ['workspace_id', 'user_id'])


def downgrade() -> None:
    op.drop_index('ix_refresh_token_user_workspace', table_name='refresh_token')
    op.drop_table('refresh_token')

    op.drop_index('ix_workspace_member_workspace_username', table_name='workspace_member')
    op.drop_column('workspace_member', 'username')

    op.drop_column('user', 'last_login_at')
    op.drop_column('user', 'must_reset_password')
    op.drop_column('user', 'is_active')
    op.drop_column('user', 'password_hash')
