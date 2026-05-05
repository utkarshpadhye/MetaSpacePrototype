import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Project, Role, User, Workspace, WorkspaceMember
from app.permissions import GUEST_PERMISSIONS, OWNER_PERMISSIONS


def _build_db() -> Session:
    engine = create_engine(
        'sqlite+pysqlite://',
        future=True,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, future=True)()


def _override_db(db: Session):
    def _get_db_override():
        yield db

    app.dependency_overrides[get_db] = _get_db_override


def _seed_owner_workspace(db: Session, suffix: str = 'p45') -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    owner_id = uuid.uuid4()
    workspace_id = uuid.uuid4()

    db.add(User(id=owner_id, email=f'owner-{suffix}@test.dev', name='Owner'))
    db.add(
        Workspace(
            id=workspace_id,
            name=f'Workspace {suffix}',
            subdomain=f'ws-{suffix}-{uuid.uuid4().hex[:6]}',
            owner_id=owner_id,
        )
    )

    owner_role = Role(
        workspace_id=workspace_id,
        name='Owner',
        color='#ef4444',
        permissions=sorted(list(OWNER_PERMISSIONS)),
        is_system=True,
        created_by=owner_id,
    )
    db.add(owner_role)
    db.flush()

    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=owner_id,
            role_id=owner_role.id,
            status='active',
        )
    )
    db.commit()
    return owner_id, workspace_id, owner_role.id


def test_requirements_approval_reset_and_restore_workflow():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'doc-approval')
    _override_db(db)

    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    created = client.post(
        f'/api/v1/{workspace_id}/docs',
        headers=headers,
        json={
            'title': 'Requirements Doc',
            'is_requirements_doc': True,
            'content_json': {'story': 'As a user, I want approvals.'},
        },
    )
    approved = client.post(f'/api/v1/{workspace_id}/docs/{created.json()["id"]}/approve', headers=headers)
    edited = client.patch(
        f'/api/v1/{workspace_id}/docs/{created.json()["id"]}',
        headers=headers,
        json={'content_json': {'story': 'Changed after approval'}},
    )
    versions = client.get(f'/api/v1/{workspace_id}/docs/{created.json()["id"]}/versions', headers=headers)
    restored = client.post(
        f'/api/v1/{workspace_id}/docs/{created.json()["id"]}/versions/{versions.json()[-1]["id"]}/restore',
        headers=headers,
    )

    app.dependency_overrides.clear()

    assert created.status_code == 200
    assert approved.status_code == 200
    assert approved.json()['status'] == 'approved'
    assert edited.status_code == 200
    assert edited.json()['status'] == 'draft'
    assert edited.json()['approved_by'] is None
    assert versions.status_code == 200
    assert len(versions.json()) >= 3
    assert restored.status_code == 200


def test_template_permissions_and_promote_to_task_mapping():
    db = _build_db()
    owner_id, workspace_id, owner_role_id = _seed_owner_workspace(db, 'template-promote')

    guest_id = uuid.uuid4()
    guest_role = Role(
        workspace_id=workspace_id,
        name='Guest',
        color='#6b7280',
        permissions=sorted(list(GUEST_PERMISSIONS)),
        is_system=True,
        created_by=owner_id,
    )
    db.add(guest_role)
    db.add(User(id=guest_id, email='guest@test.dev', name='Guest'))
    db.flush()
    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=guest_id,
            role_id=guest_role.id,
            status='active',
        )
    )

    project = Project(
        workspace_id=workspace_id,
        name='Promote Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
        updated_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    owner_headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}
    guest_headers = {'X-User-Id': str(guest_id), 'X-Workspace-Id': str(workspace_id)}

    owner_template = client.post(
        f'/api/v1/{workspace_id}/doc-templates',
        headers=owner_headers,
        json={'name': 'User Story', 'default_content': {'story': 'As a user...'}},
    )
    guest_template = client.post(
        f'/api/v1/{workspace_id}/doc-templates',
        headers=guest_headers,
        json={'name': 'Guest Managed Template'},
    )

    doc = client.post(
        f'/api/v1/{workspace_id}/docs',
        headers=owner_headers,
        json={
            'title': 'Story Source',
            'template_id': owner_template.json()['id'],
            'content_json': {'story': 'As a PM, I need convert-to-task.'},
        },
    )
    promoted = client.post(
        f'/api/v1/{workspace_id}/docs/{doc.json()["id"]}/promote-story',
        headers=owner_headers,
        json={
            'title': 'Implement story',
            'description': 'Mapped from requirements',
            'project_id': str(project.id),
        },
    )

    app.dependency_overrides.clear()

    assert owner_template.status_code == 200
    assert guest_template.status_code == 403
    assert guest_template.json()['detail'] == 'Missing permission: doc.templates.manage'
    assert doc.status_code == 200
    assert promoted.status_code == 200
    assert promoted.json()['title'] == 'Implement story'
    assert promoted.json()['project_id'] == str(project.id)


def test_multi_user_doc_edit_consistency_and_search():
    db = _build_db()
    owner_id, workspace_id, owner_role_id = _seed_owner_workspace(db, 'doc-multi')

    teammate_id = uuid.uuid4()
    db.add(User(id=teammate_id, email='teammate-doc@test.dev', name='Teammate'))
    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=teammate_id,
            role_id=owner_role_id,
            status='active',
        )
    )
    db.commit()

    _override_db(db)
    client = TestClient(app)
    owner_headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}
    teammate_headers = {'X-User-Id': str(teammate_id), 'X-Workspace-Id': str(workspace_id)}

    created = client.post(
        f'/api/v1/{workspace_id}/docs',
        headers=owner_headers,
        json={'title': 'Realtime Notes', 'content_json': {'body': 'first edit'}},
    )
    teammate_edit = client.patch(
        f'/api/v1/{workspace_id}/docs/{created.json()["id"]}',
        headers=teammate_headers,
        json={'content_json': {'body': 'second edit by teammate'}},
    )
    owner_edit = client.patch(
        f'/api/v1/{workspace_id}/docs/{created.json()["id"]}',
        headers=owner_headers,
        json={'content_json': {'body': 'third edit by owner'}},
    )
    versions = client.get(f'/api/v1/{workspace_id}/docs/{created.json()["id"]}/versions', headers=owner_headers)
    search = client.get(f'/api/v1/{workspace_id}/docs', headers=owner_headers, params={'query': 'third edit'})

    app.dependency_overrides.clear()

    assert created.status_code == 200
    assert teammate_edit.status_code == 200
    assert owner_edit.status_code == 200
    assert owner_edit.json()['content_json']['body'] == 'third edit by owner'
    assert versions.status_code == 200
    assert len(versions.json()) >= 3
    assert search.status_code == 200
    assert len(search.json()) >= 1


def test_crm_reports_formulas_and_csv_exports():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'crm-reports')
    _override_db(db)

    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    stages = client.get(f'/api/v1/{workspace_id}/crm/pipeline-stages', headers=headers)
    stage_by_name = {stage['name']: stage['id'] for stage in stages.json()}

    company = client.post(f'/api/v1/{workspace_id}/crm/companies', headers=headers, json={'name': 'Acme'})
    contact = client.post(
        f'/api/v1/{workspace_id}/crm/contacts',
        headers=headers,
        json={'name': 'Jane Buyer', 'company_id': company.json()['id']},
    )

    open_deal = client.post(
        f'/api/v1/{workspace_id}/crm/deals',
        headers=headers,
        json={
            'title': 'Open Opportunity',
            'company_id': company.json()['id'],
            'contact_id': contact.json()['id'],
            'pipeline_stage_id': stage_by_name['Proposal'],
            'value': 1000,
            'status': 'open',
        },
    )
    won_deal = client.post(
        f'/api/v1/{workspace_id}/crm/deals',
        headers=headers,
        json={
            'title': 'Won Opportunity',
            'company_id': company.json()['id'],
            'contact_id': contact.json()['id'],
            'pipeline_stage_id': stage_by_name['Closed Won'],
            'value': 500,
            'status': 'closed_won',
        },
    )
    lost_deal = client.post(
        f'/api/v1/{workspace_id}/crm/deals',
        headers=headers,
        json={
            'title': 'Lost Opportunity',
            'company_id': company.json()['id'],
            'contact_id': contact.json()['id'],
            'pipeline_stage_id': stage_by_name['Closed Lost'],
            'value': 250,
            'status': 'closed_lost',
        },
    )

    summary = client.get(f'/api/v1/{workspace_id}/crm/reports/pipeline-summary', headers=headers)
    win_rate = client.get(f'/api/v1/{workspace_id}/crm/reports/win-rate', headers=headers)
    avg_cycle = client.get(f'/api/v1/{workspace_id}/crm/reports/avg-cycle-time', headers=headers)
    forecast = client.get(f'/api/v1/{workspace_id}/crm/reports/revenue-forecast', headers=headers)

    summary_csv = client.get(
        f'/api/v1/{workspace_id}/crm/reports/pipeline-summary',
        headers=headers,
        params={'format': 'csv'},
    )
    forecast_csv = client.get(
        f'/api/v1/{workspace_id}/crm/reports/revenue-forecast',
        headers=headers,
        params={'format': 'csv'},
    )

    app.dependency_overrides.clear()

    assert stages.status_code == 200
    assert open_deal.status_code == 200
    assert won_deal.status_code == 200
    assert lost_deal.status_code == 200

    summary_rows = {row['stage_name']: row for row in summary.json()}
    assert summary_rows['Proposal']['deal_count'] == 1
    assert summary_rows['Proposal']['total_value'] == 1000

    assert win_rate.status_code == 200
    assert win_rate.json()['won_count'] == 1
    assert win_rate.json()['lost_count'] == 1
    assert win_rate.json()['win_rate_percent'] == 50.0

    assert avg_cycle.status_code == 200
    assert avg_cycle.json()['closed_deals'] >= 2
    assert forecast.status_code == 200
    assert forecast.json()['weighted_open_value'] == 600.0

    assert summary_csv.status_code == 200
    assert 'stage_name' in summary_csv.text
    assert forecast_csv.status_code == 200
    assert 'weighted_open_value' in forecast_csv.text


def test_crm_deal_conversion_and_stale_contact_scheduler():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'crm-convert')
    _override_db(db)

    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    stages = client.get(f'/api/v1/{workspace_id}/crm/pipeline-stages', headers=headers)
    stage_by_name = {stage['name']: stage['id'] for stage in stages.json()}

    company = client.post(f'/api/v1/{workspace_id}/crm/companies', headers=headers, json={'name': 'Globex'})
    contact = client.post(
        f'/api/v1/{workspace_id}/crm/contacts',
        headers=headers,
        json={'name': 'Stale Contact', 'company_id': company.json()['id']},
    )

    interaction = client.post(
        f'/api/v1/{workspace_id}/crm/interactions',
        headers=headers,
        json={
            'contact_id': contact.json()['id'],
            'type': 'call',
            'summary': 'Kickoff call',
            'metadata_json': {'minutes': 20},
        },
    )

    stale_update = client.patch(
        f'/api/v1/{workspace_id}/crm/contacts/{contact.json()["id"]}',
        headers=headers,
        json={'last_interaction_at': (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()},
    )

    stale_run = client.post(f'/api/v1/{workspace_id}/crm/stale-contacts/run', headers=headers)

    deal = client.post(
        f'/api/v1/{workspace_id}/crm/deals',
        headers=headers,
        json={
            'title': 'Conversion Deal',
            'company_id': company.json()['id'],
            'contact_id': contact.json()['id'],
            'pipeline_stage_id': stage_by_name['Negotiation'],
            'value': 2000,
            'status': 'open',
        },
    )
    converted = client.post(f'/api/v1/{workspace_id}/crm/deals/{deal.json()["id"]}/convert-to-project', headers=headers)

    app.dependency_overrides.clear()

    assert interaction.status_code == 200
    assert stale_update.status_code == 200
    assert stale_run.status_code == 200
    assert stale_run.json()['created'] >= 1
    assert deal.status_code == 200
    assert converted.status_code == 200
    assert converted.json()['deal_id'] == deal.json()['id']
    assert converted.json()['project_id']


def test_guest_is_hard_blocked_from_all_crm_access_paths():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'crm-guest-block')

    guest_id = uuid.uuid4()
    guest_role = Role(
        workspace_id=workspace_id,
        name='Guest',
        color='#6b7280',
        permissions=sorted(list(GUEST_PERMISSIONS | {'crm.view', 'crm.reports.view'})),
        is_system=False,
        created_by=owner_id,
    )
    db.add(guest_role)
    db.add(User(id=guest_id, email='guest-crm@test.dev', name='Guest CRM'))
    db.flush()
    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=guest_id,
            role_id=guest_role.id,
            status='active',
        )
    )
    db.commit()

    _override_db(db)
    client = TestClient(app)
    headers = {'X-User-Id': str(guest_id), 'X-Workspace-Id': str(workspace_id)}

    view_stages = client.get(f'/api/v1/{workspace_id}/crm/pipeline-stages', headers=headers)
    create_company = client.post(f'/api/v1/{workspace_id}/crm/companies', headers=headers, json={'name': 'Nope'})
    reports = client.get(f'/api/v1/{workspace_id}/crm/reports/win-rate', headers=headers)

    app.dependency_overrides.clear()

    assert view_stages.status_code == 403
    assert view_stages.json()['detail'] == 'Missing permission: crm.view'
    assert create_company.status_code == 403
    assert create_company.json()['detail'] == 'Missing permission: crm.edit'
    assert reports.status_code == 403
    assert reports.json()['detail'] == 'Missing permission: crm.reports.view'
