import re
import uuid
from datetime import datetime, timedelta, timezone

import anyio
from fastapi import APIRouter, Depends, HTTPException, Path, WebSocket, WebSocketDisconnect
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Notification, Task, TaskActivity, TaskComment, TaskDependency, TimeLog, User, WorkspaceMember
from app.realtime import notification_hub
from app.schemas import (
    NotificationResponse,
    TaskDependencyCreateRequest,
    TaskDependencyResponse,
    TaskActivityResponse,
    TaskCommentCreateRequest,
    TaskCommentResponse,
    TaskCreateRequest,
    TaskReorderRequest,
    TaskResponse,
    TaskUpdateRequest,
    TimeLogCreateRequest,
    TimeLogResponse,
    TimeSummaryResponse,
)
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}', tags=['tasks'])

PERSONAL_TASK_STATUSES = {'todo', 'in_progress', 'done'}


def _task_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        project_id=task.project_id,
        sprint_id=task.sprint_id,
        parent_task_id=task.parent_task_id,
        status_column_id=task.status_column_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        order_index=task.order_index,
        estimate_minutes=task.estimate_minutes,
        due_at=task.due_at,
        assignee_id=task.assignee_id,
        created_by=task.created_by,
    )


def _add_activity(
    db: Session,
    workspace_id: uuid.UUID,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    db.add(
        TaskActivity(
            workspace_id=workspace_id,
            task_id=task_id,
            user_id=user_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
        )
    )


def _create_notification(
    db: Session,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str,
    body: str | None,
    related_task_id: uuid.UUID | None,
    priority: str = 'normal',
) -> Notification:
    notification = Notification(
        workspace_id=workspace_id,
        user_id=user_id,
        title=title,
        body=body,
        related_task_id=related_task_id,
        priority=priority,
    )
    db.add(notification)
    db.flush()
    try:
        anyio.from_thread.run(
            notification_hub.publish,
            workspace_id,
            user_id,
            {
                'type': 'notification.created',
                'notification': {
                    'id': str(notification.id),
                    'title': title,
                    'body': body,
                    'priority': priority,
                    'related_task_id': str(related_task_id) if related_task_id else None,
                },
            },
        )
    except RuntimeError:
        pass
    return notification


def _validate_personal_status(task: Task, next_status: str) -> None:
    if task.project_id is None and next_status not in PERSONAL_TASK_STATUSES:
        raise HTTPException(status_code=400, detail='Personal task status must be todo/in_progress/done')


def _has_dependency_cycle(edges: list[tuple[uuid.UUID, uuid.UUID]]) -> bool:
    adjacency: dict[uuid.UUID, list[uuid.UUID]] = {}
    for parent, child in edges:
        adjacency.setdefault(parent, []).append(child)

    visited: set[uuid.UUID] = set()
    stack: set[uuid.UUID] = set()

    def dfs(node: uuid.UUID) -> bool:
        if node in stack:
            return True
        if node in visited:
            return False
        visited.add(node)
        stack.add(node)
        for neighbor in adjacency.get(node, []):
            if dfs(neighbor):
                return True
        stack.remove(node)
        return False

    return any(dfs(node) for node in adjacency)


@router.post('/tasks', response_model=TaskResponse)
def create_personal_task(
    payload: TaskCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TaskResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.create_personal'):
        raise HTTPException(status_code=403, detail='Missing permission: task.create_personal')

    if payload.sprint_id is not None:
        raise HTTPException(status_code=400, detail='Personal task cannot have sprint')
    if payload.status not in PERSONAL_TASK_STATUSES:
        raise HTTPException(status_code=400, detail='Personal task status must be todo/in_progress/done')

    task = Task(
        workspace_id=context.workspace_id,
        project_id=None,
        sprint_id=None,
        parent_task_id=payload.parent_task_id,
        status_column_id=None,
        title=payload.title.strip(),
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        order_index=payload.order_index,
        estimate_minutes=payload.estimate_minutes,
        due_at=payload.due_at,
        assignee_id=payload.assignee_id or context.user_id,
        created_by=context.user_id,
        updated_by=context.user_id,
    )
    db.add(task)
    db.flush()

    _add_activity(db, context.workspace_id, task.id, context.user_id, 'created', None, task.title)
    db.commit()
    db.refresh(task)
    return _task_response(task)


@router.post('/projects/{project_id}/tasks', response_model=TaskResponse)
def create_project_task(
    project_id: str,
    payload: TaskCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TaskResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.create'):
        raise HTTPException(status_code=403, detail='Missing permission: task.create')

    if payload.parent_task_id is not None:
        parent = (
            db.query(Task)
            .filter(Task.id == payload.parent_task_id, Task.workspace_id == context.workspace_id)
            .first()
        )
        if parent is None:
            raise HTTPException(status_code=404, detail='Parent task not found')
        if parent.parent_task_id is not None:
            raise HTTPException(status_code=400, detail='Only one subtask nesting level is allowed')

    task = Task(
        workspace_id=context.workspace_id,
        project_id=uuid.UUID(project_id),
        sprint_id=payload.sprint_id,
        parent_task_id=payload.parent_task_id,
        status_column_id=payload.status_column_id,
        title=payload.title.strip(),
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        order_index=payload.order_index,
        estimate_minutes=payload.estimate_minutes,
        due_at=payload.due_at,
        assignee_id=payload.assignee_id,
        created_by=context.user_id,
        updated_by=context.user_id,
    )
    db.add(task)
    db.flush()

    _add_activity(db, context.workspace_id, task.id, context.user_id, 'created', None, task.title)
    db.commit()
    db.refresh(task)
    return _task_response(task)


@router.get('/projects/{project_id}/backlog', response_model=list[TaskResponse])
def get_backlog(
    project_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[TaskResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.view'):
        raise HTTPException(status_code=403, detail='Missing permission: task.view')

    tasks = (
        db.query(Task)
        .filter(
            Task.workspace_id == context.workspace_id,
            Task.project_id == uuid.UUID(project_id),
            Task.sprint_id.is_(None),
        )
        .order_by(Task.order_index.asc(), Task.created_at.asc())
        .all()
    )
    return [_task_response(task) for task in tasks]


@router.post('/projects/{project_id}/backlog/reorder')
def reorder_backlog(
    project_id: str,
    payload: TaskReorderRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.edit_any'):
        raise HTTPException(status_code=403, detail='Missing permission: task.edit_any')

    task_ids = payload.ordered_task_ids
    if not task_ids:
        return {'status': 'no-op'}

    existing = (
        db.query(Task)
        .filter(
            Task.workspace_id == context.workspace_id,
            Task.project_id == uuid.UUID(project_id),
            Task.id.in_(task_ids),
        )
        .all()
    )
    by_id = {task.id: task for task in existing}

    for index, task_id in enumerate(task_ids):
        task = by_id.get(task_id)
        if task is None:
            continue
        task.order_index = float(index)
        task.updated_by = context.user_id
        _add_activity(db, context.workspace_id, task.id, context.user_id, 'reordered', None, str(index))

    db.commit()
    return {'status': 'reordered'}


@router.patch('/tasks/{task_id}', response_model=TaskResponse)
def update_task(
    task_id: str,
    payload: TaskUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TaskResponse:
    workspace_uuid = uuid.UUID(workspace_id)

    task = db.query(Task).filter(Task.id == uuid.UUID(task_id), Task.workspace_id == context.workspace_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail='Task not found')

    can_edit_any = check_permission(db, context.user_id, workspace_uuid, 'task.edit_any')
    can_edit_own = check_permission(db, context.user_id, workspace_uuid, 'task.edit_own')
    if not can_edit_any and not (can_edit_own and task.assignee_id == context.user_id):
        raise HTTPException(status_code=403, detail='Missing permission: task.edit_own or task.edit_any')

    if payload.title is not None:
        _add_activity(db, context.workspace_id, task.id, context.user_id, 'title_changed', task.title, payload.title)
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        _validate_personal_status(task, payload.status)
        _add_activity(db, context.workspace_id, task.id, context.user_id, 'status_changed', task.status, payload.status)
        task.status = payload.status
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.order_index is not None:
        task.order_index = payload.order_index
    if payload.estimate_minutes is not None:
        task.estimate_minutes = payload.estimate_minutes
    if payload.due_at is not None:
        task.due_at = payload.due_at
    if payload.assignee_id is not None:
        _add_activity(db, context.workspace_id, task.id, context.user_id, 'assignee_changed', str(task.assignee_id), str(payload.assignee_id))
        task.assignee_id = payload.assignee_id
    if payload.sprint_id is not None:
        task.sprint_id = payload.sprint_id
    if payload.status_column_id is not None:
        task.status_column_id = payload.status_column_id

    task.updated_by = context.user_id
    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return _task_response(task)


@router.delete('/tasks/{task_id}')
def delete_task(
    task_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: task.delete')

    task = db.query(Task).filter(Task.id == uuid.UUID(task_id), Task.workspace_id == context.workspace_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail='Task not found')

    db.delete(task)
    db.commit()
    return {'status': 'deleted'}


@router.post('/tasks/{task_id}/comments', response_model=TaskCommentResponse)
def add_task_comment(
    task_id: str,
    payload: TaskCommentCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TaskCommentResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.view'):
        raise HTTPException(status_code=403, detail='Missing permission: task.view')

    task = db.query(Task).filter(Task.id == uuid.UUID(task_id), Task.workspace_id == context.workspace_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail='Task not found')

    mentions = sorted(set(re.findall(r'@([A-Za-z0-9_.-]+)', payload.body)))
    comment = TaskComment(
        workspace_id=context.workspace_id,
        task_id=task.id,
        user_id=context.user_id,
        body=payload.body,
        mentions=mentions,
    )
    db.add(comment)
    _add_activity(db, context.workspace_id, task.id, context.user_id, 'commented', None, payload.body)

    for mention in mentions:
        candidate = db.query(User).filter(func.lower(User.email).like(f'{mention.lower()}%')).first()
        if candidate is None:
            continue

        is_member = (
            db.query(WorkspaceMember)
            .filter(WorkspaceMember.workspace_id == context.workspace_id, WorkspaceMember.user_id == candidate.id)
            .first()
        )
        if is_member is None:
            continue

        _create_notification(
            db,
            context.workspace_id,
            candidate.id,
            'You were mentioned in a task comment',
            payload.body,
            task.id,
            priority='high',
        )

    db.commit()
    db.refresh(comment)
    return TaskCommentResponse(
        id=comment.id,
        workspace_id=comment.workspace_id,
        task_id=comment.task_id,
        user_id=comment.user_id,
        body=comment.body,
        mentions=comment.mentions or [],
    )


@router.post('/tasks/{task_id}/time-logs', response_model=TimeLogResponse)
def add_time_log(
    task_id: str,
    payload: TimeLogCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TimeLogResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.log_time'):
        raise HTTPException(status_code=403, detail='Missing permission: task.log_time')

    task = db.query(Task).filter(Task.id == uuid.UUID(task_id), Task.workspace_id == context.workspace_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail='Task not found')

    time_log = TimeLog(
        workspace_id=context.workspace_id,
        task_id=task.id,
        user_id=context.user_id,
        minutes=payload.minutes,
        note=payload.note,
    )
    db.add(time_log)
    _add_activity(db, context.workspace_id, task.id, context.user_id, 'time_logged', None, str(payload.minutes))
    db.commit()
    db.refresh(time_log)
    return TimeLogResponse(
        id=time_log.id,
        workspace_id=time_log.workspace_id,
        task_id=time_log.task_id,
        user_id=time_log.user_id,
        minutes=time_log.minutes,
        note=time_log.note,
    )


@router.get('/tasks/{task_id}/time-summary', response_model=TimeSummaryResponse)
def task_time_summary(
    task_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TimeSummaryResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.view'):
        raise HTTPException(status_code=403, detail='Missing permission: task.view')

    rows = (
        db.query(TimeLog.user_id, func.sum(TimeLog.minutes))
        .filter(TimeLog.workspace_id == context.workspace_id, TimeLog.task_id == uuid.UUID(task_id))
        .group_by(TimeLog.user_id)
        .all()
    )
    by_user = {row[0]: int(row[1] or 0) for row in rows}
    total = sum(by_user.values())
    return TimeSummaryResponse(task_id=uuid.UUID(task_id), total_minutes=total, by_user=by_user)


@router.get('/projects/{project_id}/dependencies', response_model=list[TaskDependencyResponse])
def list_dependencies(
    project_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[TaskDependencyResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.view'):
        raise HTTPException(status_code=403, detail='Missing permission: task.view')

    edges = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.workspace_id == context.workspace_id,
            TaskDependency.project_id == uuid.UUID(project_id),
        )
        .all()
    )
    return [
        TaskDependencyResponse(
            id=edge.id,
            workspace_id=edge.workspace_id,
            project_id=edge.project_id,
            predecessor_task_id=edge.predecessor_task_id,
            successor_task_id=edge.successor_task_id,
        )
        for edge in edges
    ]


@router.post('/projects/{project_id}/dependencies', response_model=TaskDependencyResponse)
def create_dependency(
    project_id: str,
    payload: TaskDependencyCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TaskDependencyResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.edit_any'):
        raise HTTPException(status_code=403, detail='Missing permission: task.edit_any')

    project_uuid = uuid.UUID(project_id)
    predecessor = (
        db.query(Task)
        .filter(
            Task.id == payload.predecessor_task_id,
            Task.workspace_id == context.workspace_id,
            Task.project_id == project_uuid,
        )
        .first()
    )
    successor = (
        db.query(Task)
        .filter(
            Task.id == payload.successor_task_id,
            Task.workspace_id == context.workspace_id,
            Task.project_id == project_uuid,
        )
        .first()
    )
    if predecessor is None or successor is None:
        raise HTTPException(status_code=404, detail='Tasks for dependency not found in project')

    existing_edges = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.workspace_id == context.workspace_id,
            TaskDependency.project_id == project_uuid,
        )
        .all()
    )
    edge_pairs = [(edge.predecessor_task_id, edge.successor_task_id) for edge in existing_edges]
    edge_pairs.append((payload.predecessor_task_id, payload.successor_task_id))
    if _has_dependency_cycle(edge_pairs):
        raise HTTPException(status_code=400, detail='Dependency cycle detected')

    dependency = TaskDependency(
        workspace_id=context.workspace_id,
        project_id=project_uuid,
        predecessor_task_id=payload.predecessor_task_id,
        successor_task_id=payload.successor_task_id,
        created_by=context.user_id,
    )
    db.add(dependency)
    db.commit()
    db.refresh(dependency)

    return TaskDependencyResponse(
        id=dependency.id,
        workspace_id=dependency.workspace_id,
        project_id=dependency.project_id,
        predecessor_task_id=dependency.predecessor_task_id,
        successor_task_id=dependency.successor_task_id,
    )


@router.delete('/projects/{project_id}/dependencies/{dependency_id}')
def delete_dependency(
    project_id: str,
    dependency_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.edit_any'):
        raise HTTPException(status_code=403, detail='Missing permission: task.edit_any')

    edge = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.id == uuid.UUID(dependency_id),
            TaskDependency.workspace_id == context.workspace_id,
            TaskDependency.project_id == uuid.UUID(project_id),
        )
        .first()
    )
    if edge is None:
        raise HTTPException(status_code=404, detail='Dependency not found')

    db.delete(edge)
    db.commit()
    return {'status': 'deleted'}


@router.get('/tasks/{task_id}/activities', response_model=list[TaskActivityResponse])
def list_task_activities(
    task_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[TaskActivityResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.view'):
        raise HTTPException(status_code=403, detail='Missing permission: task.view')

    activities = (
        db.query(TaskActivity)
        .filter(TaskActivity.workspace_id == context.workspace_id, TaskActivity.task_id == uuid.UUID(task_id))
        .order_by(TaskActivity.created_at.desc())
        .all()
    )
    return [
        TaskActivityResponse(
            id=activity.id,
            workspace_id=activity.workspace_id,
            task_id=activity.task_id,
            user_id=activity.user_id,
            action=activity.action,
            old_value=activity.old_value,
            new_value=activity.new_value,
            created_at=activity.created_at,
        )
        for activity in activities
    ]


@router.get('/my-work', response_model=dict[str, list[TaskResponse]])
def get_my_work(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, list[TaskResponse]]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.view'):
        raise HTTPException(status_code=403, detail='Missing permission: task.view')

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)

    mine = (
        db.query(Task)
        .filter(Task.workspace_id == context.workspace_id, Task.assignee_id == context.user_id)
        .all()
    )

    def normalize_due(task: Task) -> datetime | None:
        if task.due_at is None:
            return None
        return task.due_at if task.due_at.tzinfo is not None else task.due_at.replace(tzinfo=timezone.utc)

    def not_done(task: Task) -> bool:
        return task.status not in {'done', 'completed'}

    overdue = [task for task in mine if normalize_due(task) and normalize_due(task) < today_start and not_done(task)]
    due_today = [task for task in mine if normalize_due(task) and today_start <= normalize_due(task) < tomorrow_start and not_done(task)]
    this_week = [task for task in mine if normalize_due(task) and tomorrow_start <= normalize_due(task) < week_end and not_done(task)]
    upcoming = [task for task in mine if normalize_due(task) and normalize_due(task) >= week_end and not_done(task)]
    personal = [task for task in mine if task.project_id is None]
    watching = [task for task in mine if str(context.user_id) in (task.watchers or [])]

    return {
        'overdue': [_task_response(task) for task in overdue],
        'due_today': [_task_response(task) for task in due_today],
        'this_week': [_task_response(task) for task in this_week],
        'upcoming': [_task_response(task) for task in upcoming],
        'personal': [_task_response(task) for task in personal],
        'watching': [_task_response(task) for task in watching],
    }


@router.get('/notifications', response_model=list[NotificationResponse])
def list_notifications(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[NotificationResponse]:
    notifications = (
        db.query(Notification)
        .filter(Notification.workspace_id == context.workspace_id, Notification.user_id == context.user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [
        NotificationResponse(
            id=notification.id,
            workspace_id=notification.workspace_id,
            user_id=notification.user_id,
            title=notification.title,
            body=notification.body,
            priority=notification.priority,
            is_read=notification.is_read,
            related_task_id=notification.related_task_id,
            created_at=notification.created_at,
        )
        for notification in notifications
    ]


@router.post('/notifications/{notification_id}/read')
def mark_notification_read(
    notification_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == uuid.UUID(notification_id),
            Notification.workspace_id == context.workspace_id,
            Notification.user_id == context.user_id,
        )
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail='Notification not found')

    notification.is_read = True
    db.commit()
    return {'status': 'read'}


@router.post('/notifications/due-soon/run')
def run_due_soon_scheduler(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'notification.view_all'):
        raise HTTPException(status_code=403, detail='Missing permission: notification.view_all')

    now = datetime.now(timezone.utc)
    in_24h = now + timedelta(hours=24)
    in_1h = now + timedelta(hours=1)

    candidates = (
        db.query(Task)
        .filter(
            Task.workspace_id == context.workspace_id,
            Task.assignee_id.is_not(None),
            Task.due_at.is_not(None),
            Task.status.notin_(['done', 'completed']),
            Task.due_at <= in_24h,
        )
        .all()
    )

    created = 0
    for task in candidates:
        if task.assignee_id is None or task.due_at is None:
            continue

        due_at = task.due_at
        if due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=timezone.utc)

        window = '24h'
        if due_at <= in_1h:
            window = '1h'

        title = f'Task due in {window}: {task.title}'
        existing = (
            db.query(Notification)
            .filter(
                Notification.workspace_id == context.workspace_id,
                Notification.user_id == task.assignee_id,
                Notification.related_task_id == task.id,
                Notification.title == title,
            )
            .first()
        )
        if existing is not None:
            continue

        _create_notification(
            db,
            context.workspace_id,
            task.assignee_id,
            title,
            'Please review and update task status.',
            task.id,
            priority='high' if window == '1h' else 'normal',
        )
        created += 1

    db.commit()
    return {'created': created}


@router.websocket('/notifications/ws')
async def notifications_ws(websocket: WebSocket, workspace_id: str):
    user_id_raw = websocket.query_params.get('user_id') or websocket.headers.get('X-User-Id')
    workspace_header = websocket.query_params.get('workspace_id') or websocket.headers.get('X-Workspace-Id')
    if not user_id_raw or not workspace_header:
        await websocket.close(code=1008)
        return

    try:
        user_id = uuid.UUID(user_id_raw)
        header_workspace_id = uuid.UUID(workspace_header)
        route_workspace_id = uuid.UUID(workspace_id)
    except ValueError:
        await websocket.close(code=1008)
        return

    if header_workspace_id != route_workspace_id:
        await websocket.close(code=1008)
        return

    await notification_hub.connect(route_workspace_id, user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await notification_hub.disconnect(route_workspace_id, user_id, websocket)
