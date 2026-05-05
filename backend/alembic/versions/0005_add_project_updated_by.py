"""add updated_by to project

Revision ID: 0005_add_project_updated_by
Revises: 0004_phase4_phase5_docs_crm
Create Date: 2026-05-02

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0005_add_project_updated_by'
down_revision: Union[str, None] = '0004_phase4_phase5_docs_crm'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('project', sa.Column('updated_by', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_project_updated_by_user', 'project', 'user', ['updated_by'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_project_updated_by_user', 'project', type_='foreignkey')
    op.drop_column('project', 'updated_by')
