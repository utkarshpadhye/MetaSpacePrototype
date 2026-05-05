import time
from pathlib import Path
import sys
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.database import Base, get_db
from app.main import app
from app.models import Company, Contact, Deal, PipelineStage, Role, User, Workspace, WorkspaceMember
from app.permissions import OWNER_PERMISSIONS


def _build_db() -> Session:
    engine = create_engine(
        'sqlite+pysqlite://',
        future=True,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, future=True)()


def _seed_owner_workspace(db: Session) -> tuple[uuid.UUID, uuid.UUID]:
    owner_id = uuid.uuid4()
    workspace_id = uuid.uuid4()

    db.add(User(id=owner_id, email='perf-owner@test.dev', name='Owner'))
    db.add(
        Workspace(
            id=workspace_id,
            name='Perf Workspace',
            subdomain=f'perf-{uuid.uuid4().hex[:6]}',
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
    return owner_id, workspace_id


def _override_db(db: Session):
    def _get_db_override():
        yield db

    app.dependency_overrides[get_db] = _get_db_override


def _time_call(label: str, fn):
    start = time.perf_counter()
    response = fn()
    elapsed = (time.perf_counter() - start) * 1000
    print(f"{label}: {elapsed:.2f}ms (status {response.status_code})")
    return response


def main() -> None:
    db = _build_db()
    owner_id, workspace_id = _seed_owner_workspace(db)
    _override_db(db)

    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    stage_definitions = [
        ('Lead', 0, 10, False),
        ('Qualified', 1, 30, False),
        ('Proposal', 2, 60, False),
        ('Negotiation', 3, 80, False),
        ('Closed Won', 4, 100, True),
        ('Closed Lost', 5, 0, True),
    ]
    stages: dict[str, uuid.UUID] = {}
    for name, order_index, probability, is_closed in stage_definitions:
        stage = PipelineStage(
            workspace_id=workspace_id,
            name=name,
            order_index=order_index,
            probability_percent=probability,
            is_closed=is_closed,
            created_by=owner_id,
        )
        db.add(stage)
        db.flush()
        stages[name] = stage.id

    company = Company(
        workspace_id=workspace_id,
        name='Baseline Co',
        website='baseline.example',
        industry='SaaS',
        notes='Perf baseline seed',
        created_by=owner_id,
    )
    db.add(company)
    db.flush()

    contact = Contact(
        workspace_id=workspace_id,
        company_id=company.id,
        name='Baseline Buyer',
        email='buyer@baseline.example',
        phone='555-0100',
        title='VP Ops',
        last_interaction_at=datetime.now(timezone.utc) - timedelta(days=14),
        notes='Perf baseline contact',
        created_by=owner_id,
    )
    db.add(contact)
    db.flush()

    for index in range(120):
        stage = stages['Proposal'] if index % 3 == 0 else stages['Negotiation']
        status = 'open'
        if index % 10 == 0:
            stage = stages['Closed Won']
            status = 'closed_won'
        elif index % 11 == 0:
            stage = stages['Closed Lost']
            status = 'closed_lost'

        db.add(
            Deal(
                workspace_id=workspace_id,
                company_id=company.id,
                contact_id=contact.id,
                pipeline_stage_id=stage,
                linked_project_id=None,
                title=f'Deal {index}',
                value=1000 + index * 50,
                status=status,
                close_date=datetime.now(timezone.utc) + timedelta(days=14),
                closed_at=datetime.now(timezone.utc) if status != 'open' else None,
                notes='Perf baseline deal',
                created_by=owner_id,
                updated_by=owner_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )

    db.commit()

    client.post(
        f'/api/v1/{workspace_id}/docs',
        headers=headers,
        json={
            'title': 'Perf Doc',
            'content_json': {'summary': 'Performance baseline doc content'},
        },
    )

    print('--- CRM Report Baselines ---')
    _time_call('Pipeline summary', lambda: client.get(f'/api/v1/{workspace_id}/crm/reports/pipeline-summary', headers=headers))
    _time_call('Win rate', lambda: client.get(f'/api/v1/{workspace_id}/crm/reports/win-rate', headers=headers))
    _time_call('Avg cycle time', lambda: client.get(f'/api/v1/{workspace_id}/crm/reports/avg-cycle-time', headers=headers))
    _time_call('Revenue forecast', lambda: client.get(f'/api/v1/{workspace_id}/crm/reports/revenue-forecast', headers=headers))

    print('--- Docs Search Baseline ---')
    _time_call('Doc search', lambda: client.get(f'/api/v1/{workspace_id}/docs', headers=headers, params={'query': 'Performance'}))

    app.dependency_overrides.clear()


if __name__ == '__main__':
    main()
