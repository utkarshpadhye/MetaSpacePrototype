import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Role, User, UserPermissionOverride, Workspace, WorkspaceMember
from app.security import check_permission


def _session():
    engine = create_engine(
        'sqlite+pysqlite://',
        future=True,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, future=True)()


def test_permission_resolution_order_revoke_overrides_grant_and_role():
    db = _session()

    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    db.add(User(id=owner_id, email='owner@test.dev', name='Owner'))
    db.add(User(id=user_id, email='member@test.dev', name='Member'))
    db.add(Workspace(id=workspace_id, name='Acme', subdomain='acme', owner_id=owner_id))

    role = Role(
        workspace_id=workspace_id,
        name='Member',
        color='#22c55e',
        permissions=['project.create'],
        is_system=True,
        created_by=owner_id,
    )
    db.add(role)
    db.flush()

    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=user_id,
            role_id=role.id,
            status='active',
        )
    )

    db.add(
        UserPermissionOverride(
            workspace_id=workspace_id,
            user_id=user_id,
            permission='project.create',
            type='grant',
            granted_by=owner_id,
        )
    )
    db.add(
        UserPermissionOverride(
            workspace_id=workspace_id,
            user_id=user_id,
            permission='project.create',
            type='revoke',
            granted_by=owner_id,
        )
    )
    db.commit()

    assert check_permission(db, user_id, workspace_id, 'project.create') is False


def test_guest_hard_block_for_crm_permission():
    db = _session()

    workspace_id = uuid.uuid4()
    guest_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    db.add(User(id=owner_id, email='owner2@test.dev', name='Owner'))
    db.add(User(id=guest_id, email='guest@test.dev', name='Guest'))
    db.add(Workspace(id=workspace_id, name='Beta', subdomain='beta', owner_id=owner_id))

    role = Role(
        workspace_id=workspace_id,
        name='Guest',
        color='#6b7280',
        permissions=['crm.view'],
        is_system=True,
        created_by=owner_id,
    )
    db.add(role)
    db.flush()

    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=guest_id,
            role_id=role.id,
            status='active',
        )
    )
    db.commit()

    assert check_permission(db, guest_id, workspace_id, 'crm.view') is False
