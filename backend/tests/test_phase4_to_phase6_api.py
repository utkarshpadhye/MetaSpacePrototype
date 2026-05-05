import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Project, Role, User, Workspace, WorkspaceMember
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


def _override_db(db: Session):
    def _get_db_override():
        yield db

    app.dependency_overrides[get_db] = _get_db_override


def _seed_owner_workspace(db: Session, suffix: str = 'a') -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
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


def test_owner_role_is_immutable_and_not_deletable():
    db = _build_db()
    owner_id, workspace_id, owner_role_id = _seed_owner_workspace(db, 'owner-guard')
    _override_db(db)

    client = TestClient(app)
    headers = {
        'X-User-Id': str(owner_id),
        'X-Workspace-Id': str(workspace_id),
    }

    patch_response = client.patch(
        f'/api/v1/{workspace_id}/roles/{owner_role_id}',
        headers=headers,
        json={'name': 'SuperOwner'},
    )
    delete_response = client.delete(
        f'/api/v1/{workspace_id}/roles/{owner_role_id}',
        headers=headers,
    )

    app.dependency_overrides.clear()

    assert patch_response.status_code == 400
    assert patch_response.json()['detail'] == 'Owner role is immutable'
    assert delete_response.status_code == 400
    assert delete_response.json()['detail'] == 'Owner role cannot be deleted'


def test_tenant_isolation_blocks_cross_workspace_access():
    db = _build_db()
    owner_a, workspace_a, _ = _seed_owner_workspace(db, 'tenant-a')
    _, workspace_b, _ = _seed_owner_workspace(db, 'tenant-b')
    _override_db(db)

    client = TestClient(app)

    response = client.get(
        f'/api/v1/{workspace_b}/projects',
        headers={
            'X-User-Id': str(owner_a),
            'X-Workspace-Id': str(workspace_a),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()['detail'] == 'Workspace mismatch'


def test_only_one_active_sprint_per_project():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'sprint-guard')

    project = Project(
        workspace_id=workspace_id,
        name='Guard Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    headers = {
        'X-User-Id': str(owner_id),
        'X-Workspace-Id': str(workspace_id),
    }

    first = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints',
        headers=headers,
        json={'name': 'Sprint 1', 'status': 'active'},
    )
    second = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints',
        headers=headers,
        json={'name': 'Sprint 2', 'status': 'active'},
    )

    app.dependency_overrides.clear()

    assert first.status_code == 200
    assert second.status_code == 400
    assert second.json()['detail'] == 'Only one active sprint is allowed per project'


def test_subtask_single_nesting_guard():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'subtask-guard')

    project = Project(
        workspace_id=workspace_id,
        name='Task Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    headers = {
        'X-User-Id': str(owner_id),
        'X-Workspace-Id': str(workspace_id),
    }

    parent = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=headers,
        json={'title': 'Parent Task'},
    )
    child = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=headers,
        json={
            'title': 'Child Task',
            'parent_task_id': parent.json()['id'],
        },
    )
    grandchild = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=headers,
        json={
            'title': 'Grandchild Task',
            'parent_task_id': child.json()['id'],
        },
    )

    app.dependency_overrides.clear()

    assert parent.status_code == 200
    assert child.status_code == 200
    assert grandchild.status_code == 400
    assert grandchild.json()['detail'] == 'Only one subtask nesting level is allowed'


def test_comment_mentions_create_notification_for_workspace_member():
    db = _build_db()
    owner_id, workspace_id, owner_role_id = _seed_owner_workspace(db, 'mention-fanout')

    mentioned_user_id = uuid.uuid4()
    db.add(User(id=mentioned_user_id, email='john.doe@test.dev', name='John Doe'))
    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=mentioned_user_id,
            role_id=owner_role_id,
            status='active',
        )
    )

    project = Project(
        workspace_id=workspace_id,
        name='Mentions Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    owner_headers = {
        'X-User-Id': str(owner_id),
        'X-Workspace-Id': str(workspace_id),
    }

    create_task = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=owner_headers,
        json={'title': 'Task With Mention'},
    )
    task_id = create_task.json()['id']

    comment_response = client.post(
        f'/api/v1/{workspace_id}/tasks/{task_id}/comments',
        headers=owner_headers,
        json={'body': 'Please review this @john.doe'},
    )

    mentioned_headers = {
        'X-User-Id': str(mentioned_user_id),
        'X-Workspace-Id': str(workspace_id),
    }
    notifications = client.get(
        f'/api/v1/{workspace_id}/notifications',
        headers=mentioned_headers,
    )

    app.dependency_overrides.clear()

    assert create_task.status_code == 200
    assert comment_response.status_code == 200
    assert notifications.status_code == 200
    payload = notifications.json()
    assert len(payload) == 1
    assert payload[0]['title'] == 'You were mentioned in a task comment'
    assert payload[0]['priority'] == 'high'
    assert payload[0]['related_task_id'] == task_id


def test_activity_log_captures_core_task_mutations():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'activity-log')

    project = Project(
        workspace_id=workspace_id,
        name='Activity Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    headers = {
        'X-User-Id': str(owner_id),
        'X-Workspace-Id': str(workspace_id),
    }

    created = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=headers,
        json={'title': 'Lifecycle Task'},
    )
    task_id = created.json()['id']

    updated = client.patch(
        f'/api/v1/{workspace_id}/tasks/{task_id}',
        headers=headers,
        json={'title': 'Lifecycle Task Updated', 'status': 'in_progress'},
    )

    reordered = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/backlog/reorder',
        headers=headers,
        json={'ordered_task_ids': [task_id]},
    )

    commented = client.post(
        f'/api/v1/{workspace_id}/tasks/{task_id}/comments',
        headers=headers,
        json={'body': 'Logging mutation coverage'},
    )

    timed = client.post(
        f'/api/v1/{workspace_id}/tasks/{task_id}/time-logs',
        headers=headers,
        json={'minutes': 30, 'note': 'Focused work'},
    )

    activities = client.get(
        f'/api/v1/{workspace_id}/tasks/{task_id}/activities',
        headers=headers,
    )

    app.dependency_overrides.clear()

    assert created.status_code == 200
    assert updated.status_code == 200
    assert reordered.status_code == 200
    assert commented.status_code == 200
    assert timed.status_code == 200
    assert activities.status_code == 200

    actions = {entry['action'] for entry in activities.json()}
    assert 'created' in actions
    assert 'title_changed' in actions
    assert 'status_changed' in actions
    assert 'reordered' in actions
    assert 'commented' in actions
    assert 'time_logged' in actions


def test_unauthorized_member_cannot_hit_protected_mutation_endpoints():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'unauthorized-mutations')

    member_id = uuid.uuid4()
    db.add(User(id=member_id, email='limited@test.dev', name='Limited Member'))
    limited_role = Role(
        workspace_id=workspace_id,
        name='LimitedMember',
        color='#64748b',
        permissions=['task.view'],
        is_system=False,
        created_by=owner_id,
    )
    db.add(limited_role)
    db.flush()
    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=member_id,
            role_id=limited_role.id,
            status='active',
        )
    )

    project = Project(
        workspace_id=workspace_id,
        name='Protected Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    limited_headers = {
        'X-User-Id': str(member_id),
        'X-Workspace-Id': str(workspace_id),
    }

    project_create = client.post(
        f'/api/v1/{workspace_id}/projects',
        headers=limited_headers,
        json={'name': 'Should Fail'},
    )
    sprint_create = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints',
        headers=limited_headers,
        json={'name': 'Should Fail Sprint'},
    )

    app.dependency_overrides.clear()

    assert project_create.status_code == 403
    assert project_create.json()['detail'] == 'Missing permission: project.create'
    assert sprint_create.status_code == 403
    assert sprint_create.json()['detail'] == 'Missing permission: sprint.create'


def test_sprint_start_complete_and_carry_over_flow():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'sprint-flow')

    project = Project(
        workspace_id=workspace_id,
        name='Sprint Flow Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    sprint_1 = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints',
        headers=headers,
        json={'name': 'Sprint 1', 'status': 'planned'},
    )
    sprint_2 = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints',
        headers=headers,
        json={'name': 'Sprint 2', 'status': 'planned'},
    )

    start = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints/{sprint_1.json()["id"]}/start',
        headers=headers,
    )

    task = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=headers,
        json={'title': 'Carry me', 'sprint_id': sprint_1.json()['id']},
    )

    complete = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints/{sprint_1.json()["id"]}/complete',
        headers=headers,
        json={'carry_over_task_ids': [task.json()['id']], 'target_sprint_id': sprint_2.json()['id']},
    )

    app.dependency_overrides.clear()

    assert start.status_code == 200
    assert task.status_code == 200
    assert complete.status_code == 200
    assert complete.json()['moved_tasks'] == 1


def test_dependency_cycle_prevention():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'dep-cycle')

    project = Project(
        workspace_id=workspace_id,
        name='Dependencies Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    t1 = client.post(f'/api/v1/{workspace_id}/projects/{project.id}/tasks', headers=headers, json={'title': 'A'})
    t2 = client.post(f'/api/v1/{workspace_id}/projects/{project.id}/tasks', headers=headers, json={'title': 'B'})
    t3 = client.post(f'/api/v1/{workspace_id}/projects/{project.id}/tasks', headers=headers, json={'title': 'C'})

    edge_1 = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/dependencies',
        headers=headers,
        json={'predecessor_task_id': t1.json()['id'], 'successor_task_id': t2.json()['id']},
    )
    edge_2 = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/dependencies',
        headers=headers,
        json={'predecessor_task_id': t2.json()['id'], 'successor_task_id': t3.json()['id']},
    )
    cycle = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/dependencies',
        headers=headers,
        json={'predecessor_task_id': t3.json()['id'], 'successor_task_id': t1.json()['id']},
    )

    app.dependency_overrides.clear()

    assert edge_1.status_code == 200
    assert edge_2.status_code == 200
    assert cycle.status_code == 400
    assert cycle.json()['detail'] == 'Dependency cycle detected'


def test_burndown_and_velocity_reports_have_expected_numbers():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'reports')

    project = Project(
        workspace_id=workspace_id,
        name='Reporting Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    sprint = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/sprints',
        headers=headers,
        json={'name': 'Sprint 1', 'status': 'completed'},
    )

    task_done = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=headers,
        json={'title': 'Done', 'sprint_id': sprint.json()['id'], 'status': 'done'},
    )
    task_todo = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=headers,
        json={'title': 'Todo', 'sprint_id': sprint.json()['id'], 'status': 'todo'},
    )

    snapshot = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/reports/burndown/snapshot',
        headers=headers,
        params={'sprint_id': sprint.json()['id']},
    )
    burndown = client.get(f'/api/v1/{workspace_id}/projects/{project.id}/reports/burndown', headers=headers)
    velocity = client.get(f'/api/v1/{workspace_id}/projects/{project.id}/reports/velocity', headers=headers)

    app.dependency_overrides.clear()

    assert sprint.status_code == 200
    assert task_done.status_code == 200
    assert task_todo.status_code == 200
    assert snapshot.status_code == 200
    assert snapshot.json()['planned_points'] == 2
    assert snapshot.json()['completed_points'] == 1
    assert burndown.status_code == 200
    assert len(burndown.json()) >= 1
    assert velocity.status_code == 200
    assert velocity.json()[0]['completed_points'] == 1


def test_personal_task_status_guard_and_time_summary():
    db = _build_db()
    owner_id, workspace_id, _ = _seed_owner_workspace(db, 'personal-status')
    _override_db(db)
    client = TestClient(app)
    headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}

    invalid = client.post(
        f'/api/v1/{workspace_id}/tasks',
        headers=headers,
        json={'title': 'Personal Invalid', 'status': 'blocked'},
    )
    valid = client.post(
        f'/api/v1/{workspace_id}/tasks',
        headers=headers,
        json={'title': 'Personal Valid', 'status': 'todo'},
    )
    log_1 = client.post(
        f'/api/v1/{workspace_id}/tasks/{valid.json()["id"]}/time-logs',
        headers=headers,
        json={'minutes': 40, 'note': 'first'},
    )
    log_2 = client.post(
        f'/api/v1/{workspace_id}/tasks/{valid.json()["id"]}/time-logs',
        headers=headers,
        json={'minutes': 20, 'note': 'second'},
    )
    summary = client.get(
        f'/api/v1/{workspace_id}/tasks/{valid.json()["id"]}/time-summary',
        headers=headers,
    )

    app.dependency_overrides.clear()

    assert invalid.status_code == 400
    assert valid.status_code == 200
    assert log_1.status_code == 200
    assert log_2.status_code == 200
    assert summary.status_code == 200
    assert summary.json()['total_minutes'] == 60


def test_my_work_updates_with_due_date_boundaries_and_high_priority_toast_payload():
    db = _build_db()
    owner_id, workspace_id, owner_role_id = _seed_owner_workspace(db, 'my-work')

    teammate_id = uuid.uuid4()
    db.add(User(id=teammate_id, email='teammate@test.dev', name='Teammate'))
    db.add(
        WorkspaceMember(
            workspace_id=workspace_id,
            user_id=teammate_id,
            role_id=owner_role_id,
            status='active',
        )
    )

    project = Project(
        workspace_id=workspace_id,
        name='MyWork Project',
        description='test',
        status='active',
        color='#2563eb',
        owner_id=owner_id,
        created_by=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    _override_db(db)
    client = TestClient(app)
    owner_headers = {'X-User-Id': str(owner_id), 'X-Workspace-Id': str(workspace_id)}
    teammate_headers = {'X-User-Id': str(teammate_id), 'X-Workspace-Id': str(workspace_id)}

    due_soon = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    task = client.post(
        f'/api/v1/{workspace_id}/projects/{project.id}/tasks',
        headers=owner_headers,
        json={'title': 'Due soon', 'assignee_id': str(teammate_id), 'due_at': due_soon},
    )
    scheduler = client.post(f'/api/v1/{workspace_id}/notifications/due-soon/run', headers=owner_headers)
    my_work = client.get(f'/api/v1/{workspace_id}/my-work', headers=teammate_headers)
    notifications = client.get(f'/api/v1/{workspace_id}/notifications', headers=teammate_headers)

    app.dependency_overrides.clear()

    assert task.status_code == 200
    assert scheduler.status_code == 200
    assert my_work.status_code == 200
    assert notifications.status_code == 200
    assert any(item['priority'] == 'high' for item in notifications.json())
