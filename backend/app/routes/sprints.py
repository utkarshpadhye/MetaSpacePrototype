import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Sprint, Task
from app.schemas import SprintCompleteRequest, SprintCreateRequest, SprintResponse, SprintUpdateRequest
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}/projects/{project_id}/sprints', tags=['sprints'])


def _to_response(sprint: Sprint) -> SprintResponse:
    return SprintResponse(
        id=sprint.id,
        workspace_id=sprint.workspace_id,
        project_id=sprint.project_id,
        name=sprint.name,
        goal=sprint.goal,
        status=sprint.status,
        start_date=sprint.start_date,
        end_date=sprint.end_date,
    )


def _ensure_single_active_sprint(db: Session, project_id: uuid.UUID, exclude_id: uuid.UUID | None = None) -> None:
    query = db.query(Sprint).filter(Sprint.project_id == project_id, Sprint.status == 'active')
    if exclude_id is not None:
        query = query.filter(Sprint.id != exclude_id)
    existing = query.first()
    if existing is not None:
        raise HTTPException(status_code=400, detail='Only one active sprint is allowed per project')


@router.get('', response_model=list[SprintResponse])
def list_sprints(
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[SprintResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.view'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.view')

    project_uuid = uuid.UUID(project_id)
    sprints = (
        db.query(Sprint)
        .filter(Sprint.workspace_id == context.workspace_id, Sprint.project_id == project_uuid)
        .order_by(Sprint.created_at.desc())
        .all()
    )
    return [_to_response(sprint) for sprint in sprints]


@router.post('', response_model=SprintResponse)
def create_sprint(
    payload: SprintCreateRequest,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> SprintResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.create'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.create')

    project_uuid = uuid.UUID(project_id)
    if payload.status == 'active':
        _ensure_single_active_sprint(db, project_uuid)

    sprint = Sprint(
        workspace_id=context.workspace_id,
        project_id=project_uuid,
        name=payload.name.strip(),
        goal=payload.goal,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_by=context.user_id,
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return _to_response(sprint)


@router.patch('/{sprint_id}', response_model=SprintResponse)
def update_sprint(
    sprint_id: str,
    payload: SprintUpdateRequest,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> SprintResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.manage')

    project_uuid = uuid.UUID(project_id)
    sprint_uuid = uuid.UUID(sprint_id)
    sprint = (
        db.query(Sprint)
        .filter(
            Sprint.id == sprint_uuid,
            Sprint.workspace_id == context.workspace_id,
            Sprint.project_id == project_uuid,
        )
        .first()
    )
    if sprint is None:
        raise HTTPException(status_code=404, detail='Sprint not found')

    if payload.status == 'active':
        _ensure_single_active_sprint(db, project_uuid, exclude_id=sprint.id)

    if payload.name is not None:
        sprint.name = payload.name.strip()
    if payload.goal is not None:
        sprint.goal = payload.goal
    if payload.status is not None:
        sprint.status = payload.status
        if payload.status == 'active' and sprint.start_date is None:
            sprint.start_date = datetime.now(timezone.utc)
    if payload.start_date is not None:
        sprint.start_date = payload.start_date
    if payload.end_date is not None:
        sprint.end_date = payload.end_date
    sprint.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(sprint)
    return _to_response(sprint)


@router.delete('/{sprint_id}')
def delete_sprint(
    sprint_id: str,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.delete')

    project_uuid = uuid.UUID(project_id)
    sprint_uuid = uuid.UUID(sprint_id)
    sprint = (
        db.query(Sprint)
        .filter(
            Sprint.id == sprint_uuid,
            Sprint.workspace_id == context.workspace_id,
            Sprint.project_id == project_uuid,
        )
        .first()
    )
    if sprint is None:
        raise HTTPException(status_code=404, detail='Sprint not found')

    db.delete(sprint)
    db.commit()
    return {'status': 'deleted'}


@router.post('/{sprint_id}/start', response_model=SprintResponse)
def start_sprint(
    sprint_id: str,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> SprintResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.manage')

    project_uuid = uuid.UUID(project_id)
    sprint = (
        db.query(Sprint)
        .filter(
            Sprint.id == uuid.UUID(sprint_id),
            Sprint.workspace_id == context.workspace_id,
            Sprint.project_id == project_uuid,
        )
        .first()
    )
    if sprint is None:
        raise HTTPException(status_code=404, detail='Sprint not found')

    _ensure_single_active_sprint(db, project_uuid, exclude_id=sprint.id)
    sprint.status = 'active'
    if sprint.start_date is None:
        sprint.start_date = datetime.now(timezone.utc)
    sprint.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sprint)
    return _to_response(sprint)


@router.post('/{sprint_id}/complete')
def complete_sprint(
    sprint_id: str,
    payload: SprintCompleteRequest,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.manage')

    project_uuid = uuid.UUID(project_id)
    sprint = (
        db.query(Sprint)
        .filter(
            Sprint.id == uuid.UUID(sprint_id),
            Sprint.workspace_id == context.workspace_id,
            Sprint.project_id == project_uuid,
        )
        .first()
    )
    if sprint is None:
        raise HTTPException(status_code=404, detail='Sprint not found')

    if sprint.status != 'active':
        raise HTTPException(status_code=400, detail='Only active sprint can be completed')

    moved = 0
    if payload.carry_over_task_ids:
        target_sprint_id = payload.target_sprint_id
        for task_id in payload.carry_over_task_ids:
            task = (
                db.query(Task)
                .filter(
                    Task.id == task_id,
                    Task.workspace_id == context.workspace_id,
                    Task.project_id == project_uuid,
                    Task.sprint_id == sprint.id,
                )
                .first()
            )
            if task is None:
                continue
            task.sprint_id = target_sprint_id
            task.updated_by = context.user_id
            task.updated_at = datetime.now(timezone.utc)
            moved += 1

    sprint.status = 'completed'
    if sprint.end_date is None:
        sprint.end_date = datetime.now(timezone.utc)
    sprint.updated_at = datetime.now(timezone.utc)

    db.commit()
    return {'status': 'completed', 'moved_tasks': moved}
