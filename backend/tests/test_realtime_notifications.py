import uuid

import anyio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Role, User, Workspace, WorkspaceMember
from app.permissions import OWNER_PERMISSIONS
from app.realtime import notification_hub


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


def _seed_owner_workspace(db: Session) -> tuple[uuid.UUID, uuid.UUID]:
    owner_id = uuid.uuid4()
    workspace_id = uuid.uuid4()

    db.add(User(id=owner_id, email='owner-realtime@test.dev', name='Owner'))
    db.add(
        Workspace(
            id=workspace_id,
            name='Realtime Workspace',
            subdomain=f'rt-{uuid.uuid4().hex[:6]}',
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


def test_notifications_websocket_receives_payload():
    db = _build_db()
    owner_id, workspace_id = _seed_owner_workspace(db)
    _override_db(db)

    client = TestClient(app)

    with client.websocket_connect(
        f'/api/v1/{workspace_id}/notifications/ws?user_id={owner_id}&workspace_id={workspace_id}'
    ) as websocket:
        anyio.run(
            notification_hub.publish,
            workspace_id,
            owner_id,
            {'type': 'notification', 'title': 'Realtime ping'},
        )
        payload = websocket.receive_json()

    app.dependency_overrides.clear()

    assert payload['type'] == 'notification'
    assert payload['title'] == 'Realtime ping'
