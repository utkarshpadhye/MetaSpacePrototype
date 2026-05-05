"""phase4 docs and phase5 crm foundation

Revision ID: 0004_phase4_phase5_docs_crm
Revises: 0003_phase2_reports_dependencies
Create Date: 2026-05-02

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0004_phase4_phase5_docs_crm'
down_revision: Union[str, None] = '0003_phase2_reports_dependencies'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'doc_template',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=160), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=80), nullable=False),
        sa.Column('default_content', sa.JSON(), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_doc_template_workspace_name', 'doc_template', ['workspace_id', 'name'])

    op.create_table(
        'doc',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('parent_id', sa.UUID(), nullable=True),
        sa.Column('template_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content_json', sa.JSON(), nullable=False),
        sa.Column('content_text', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('draft', 'approved', name='doc_status'), nullable=False),
        sa.Column('is_private', sa.Boolean(), nullable=False),
        sa.Column('is_requirements_doc', sa.Boolean(), nullable=False),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['doc.id']),
        sa.ForeignKeyConstraint(['template_id'], ['doc_template.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['user.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_doc_workspace_parent', 'doc', ['workspace_id', 'parent_id'])
    op.create_index('ix_doc_workspace_project', 'doc', ['workspace_id', 'project_id'])
    op.create_index('ix_doc_workspace_status', 'doc', ['workspace_id', 'status'])

    op.create_table(
        'doc_version',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('doc_id', sa.UUID(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content_json', sa.JSON(), nullable=False),
        sa.Column('content_text', sa.Text(), nullable=False),
        sa.Column('edited_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['doc_id'], ['doc.id']),
        sa.ForeignKeyConstraint(['edited_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_doc_version_doc_number', 'doc_version', ['doc_id', 'version_number'], unique=True)

    op.create_table(
        'company',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('industry', sa.String(length=120), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_company_workspace_name', 'company', ['workspace_id', 'name'])

    op.create_table(
        'contact',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=60), nullable=True),
        sa.Column('title', sa.String(length=120), nullable=True),
        sa.Column('last_interaction_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['company_id'], ['company.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_contact_workspace_email', 'contact', ['workspace_id', 'email'])

    op.create_table(
        'pipeline_stage',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('probability_percent', sa.Integer(), nullable=False),
        sa.Column('is_closed', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pipeline_stage_workspace_order', 'pipeline_stage', ['workspace_id', 'order_index'])

    op.create_table(
        'deal',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=True),
        sa.Column('contact_id', sa.UUID(), nullable=True),
        sa.Column('pipeline_stage_id', sa.UUID(), nullable=False),
        sa.Column('linked_project_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('status', sa.Enum('open', 'closed_won', 'closed_lost', name='deal_status'), nullable=False),
        sa.Column('close_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['company_id'], ['company.id']),
        sa.ForeignKeyConstraint(['contact_id'], ['contact.id']),
        sa.ForeignKeyConstraint(['pipeline_stage_id'], ['pipeline_stage.id']),
        sa.ForeignKeyConstraint(['linked_project_id'], ['project.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_deal_workspace_stage_status', 'deal', ['workspace_id', 'pipeline_stage_id', 'status'])

    op.create_table(
        'crm_interaction',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('contact_id', sa.UUID(), nullable=True),
        sa.Column('company_id', sa.UUID(), nullable=True),
        sa.Column('deal_id', sa.UUID(), nullable=True),
        sa.Column('type', sa.String(length=64), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspace.id']),
        sa.ForeignKeyConstraint(['contact_id'], ['contact.id']),
        sa.ForeignKeyConstraint(['company_id'], ['company.id']),
        sa.ForeignKeyConstraint(['deal_id'], ['deal.id']),
        sa.ForeignKeyConstraint(['created_by'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_crm_interaction_workspace_created', 'crm_interaction', ['workspace_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_crm_interaction_workspace_created', table_name='crm_interaction')
    op.drop_table('crm_interaction')

    op.drop_index('ix_deal_workspace_stage_status', table_name='deal')
    op.drop_table('deal')

    op.drop_index('ix_pipeline_stage_workspace_order', table_name='pipeline_stage')
    op.drop_table('pipeline_stage')

    op.drop_index('ix_contact_workspace_email', table_name='contact')
    op.drop_table('contact')

    op.drop_index('ix_company_workspace_name', table_name='company')
    op.drop_table('company')

    op.drop_index('ix_doc_version_doc_number', table_name='doc_version')
    op.drop_table('doc_version')

    op.drop_index('ix_doc_workspace_status', table_name='doc')
    op.drop_index('ix_doc_workspace_project', table_name='doc')
    op.drop_index('ix_doc_workspace_parent', table_name='doc')
    op.drop_table('doc')

    op.drop_index('ix_doc_template_workspace_name', table_name='doc_template')
    op.drop_table('doc_template')

    op.execute('DROP TYPE IF EXISTS deal_status')
    op.execute('DROP TYPE IF EXISTS doc_status')
