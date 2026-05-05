import uuid

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Role, User, Workspace, WorkspaceMember
from app.permissions import MEMBER_PERMISSIONS
from app.main import app


def _build_db() -> Session:
    engine = create_engine(
        'sqlite+pysqlite://',
        future=True,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, future=True)()


def test_project_create_requires_permission():
    db = _build_db()

    owner_id = uuid.uuid4()
    member_id = uuid.uuid4()
    workspace_id = uuid.uuid4()

    db.add(User(id=owner_id, email='owner3@test.dev', name='Owner'))
    db.add(User(id=member_id, email='member3@test.dev', name='Member'))
    db.add(Workspace(id=workspace_id, name='Gamma', subdomain='gamma', owner_id=owner_id))

    member_role = Role(
        workspace_id=workspace_id,
        name='Member',
        color='#22c55e',
        permissions=sorted(list(MEMBER_PERMISSIONS - {'project.create'})),
        is_system=True,
        created_by=owner_id,
    )
    db.add(member_role)
    db.flush()

    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=member_id,
            role_id=member_role.id,
            status='active',
        )
    )
    db.commit()

    def _get_db_override():
        yield db

    app.dependency_overrides[get_db] = _get_db_override

    client = TestClient(app)

    response = client.post(
        f'/api/v1/{workspace_id}/projects',
        headers={
            'X-User-Id': str(member_id),
            'X-Workspace-Id': str(workspace_id),
        },
        json={'name': 'Unauthorized Project'},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()['detail'] == 'Missing permission: project.create'
