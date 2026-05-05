import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import BurndownSnapshot, Project, ProjectStatusColumn, Sprint, Task
from app.schemas import (
    BurndownSnapshotResponse,
    ProjectCreateRequest,
    ProjectResponse,
    ProjectStatusColumnCreateRequest,
    ProjectStatusColumnResponse,
    ProjectStatusColumnUpdateRequest,
    ProjectUpdateRequest,
    VelocityPointResponse,
)
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}/projects', tags=['projects'])


@router.post('', response_model=ProjectResponse)
def create_project(
    payload: ProjectCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'project.create'):
        raise HTTPException(status_code=403, detail='Missing permission: project.create')

    project = Project(
        workspace_id=context.workspace_id,
        name=payload.name.strip(),
        description=payload.description,
        color=payload.color,
        owner_id=context.user_id,
        created_by=context.user_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        workspace_id=project.workspace_id,
        name=project.name,
        description=project.description,
        status=project.status,
        color=project.color,
        owner_id=project.owner_id,
        created_by=project.created_by,
    )


@router.get('', response_model=list[ProjectResponse])
def list_projects(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[ProjectResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'project.view'):
        raise HTTPException(status_code=403, detail='Missing permission: project.view')

    projects = db.query(Project).filter(Project.workspace_id == context.workspace_id).all()
    return [
        ProjectResponse(
            id=project.id,
            workspace_id=project.workspace_id,
            name=project.name,
            description=project.description,
            status=project.status,
            color=project.color,
            owner_id=project.owner_id,
            created_by=project.created_by,
        )
        for project in projects
    ]


@router.get('/{project_id}', response_model=ProjectResponse)
def get_project(
    project_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'project.view'):
        raise HTTPException(status_code=403, detail='Missing permission: project.view')

    project_uuid = uuid.UUID(project_id)
    project = (
        db.query(Project)
        .filter(Project.id == project_uuid, Project.workspace_id == context.workspace_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail='Project not found')

    return ProjectResponse(
        id=project.id,
        workspace_id=project.workspace_id,
        name=project.name,
        description=project.description,
        status=project.status,
        color=project.color,
        owner_id=project.owner_id,
        created_by=project.created_by,
    )


@router.patch('/{project_id}', response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'project.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: project.edit')

    project_uuid = uuid.UUID(project_id)
    project = (
        db.query(Project)
        .filter(Project.id == project_uuid, Project.workspace_id == context.workspace_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail='Project not found')

    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description
    if payload.status is not None:
        project.status = payload.status
    if payload.color is not None:
        project.color = payload.color
    if payload.owner_id is not None:
        project.owner_id = payload.owner_id
    project.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        workspace_id=project.workspace_id,
        name=project.name,
        description=project.description,
        status=project.status,
        color=project.color,
        owner_id=project.owner_id,
        created_by=project.created_by,
    )


@router.delete('/{project_id}')
def delete_project(
    project_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'project.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: project.delete')

    project_uuid = uuid.UUID(project_id)
    project = (
        db.query(Project)
        .filter(Project.id == project_uuid, Project.workspace_id == context.workspace_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail='Project not found')

    db.delete(project)
    db.commit()
    return {'status': 'deleted'}


@router.get('/{project_id}/status-columns', response_model=list[ProjectStatusColumnResponse])
def list_status_columns(
    project_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[ProjectStatusColumnResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.manage_status_columns'):
        raise HTTPException(status_code=403, detail='Missing permission: task.manage_status_columns')

    project_uuid = uuid.UUID(project_id)
    columns = (
        db.query(ProjectStatusColumn)
        .filter(
            ProjectStatusColumn.workspace_id == context.workspace_id,
            ProjectStatusColumn.project_id == project_uuid,
        )
        .order_by(ProjectStatusColumn.order_index.asc())
        .all()
    )
    return [
        ProjectStatusColumnResponse(
            id=column.id,
            workspace_id=column.workspace_id,
            project_id=column.project_id,
            name=column.name,
            color=column.color,
            order_index=column.order_index,
            is_done=column.is_done,
        )
        for column in columns
    ]


@router.post('/{project_id}/status-columns', response_model=ProjectStatusColumnResponse)
def create_status_column(
    project_id: str,
    payload: ProjectStatusColumnCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> ProjectStatusColumnResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.manage_status_columns'):
        raise HTTPException(status_code=403, detail='Missing permission: task.manage_status_columns')

    project_uuid = uuid.UUID(project_id)
    column = ProjectStatusColumn(
        workspace_id=context.workspace_id,
        project_id=project_uuid,
        name=payload.name.strip(),
        color=payload.color,
        order_index=payload.order_index,
        is_done=payload.is_done,
        created_by=context.user_id,
    )
    db.add(column)
    db.commit()
    db.refresh(column)
    return ProjectStatusColumnResponse(
        id=column.id,
        workspace_id=column.workspace_id,
        project_id=column.project_id,
        name=column.name,
        color=column.color,
        order_index=column.order_index,
        is_done=column.is_done,
    )


@router.patch('/{project_id}/status-columns/{column_id}', response_model=ProjectStatusColumnResponse)
def update_status_column(
    project_id: str,
    column_id: str,
    payload: ProjectStatusColumnUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> ProjectStatusColumnResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.manage_status_columns'):
        raise HTTPException(status_code=403, detail='Missing permission: task.manage_status_columns')

    project_uuid = uuid.UUID(project_id)
    column_uuid = uuid.UUID(column_id)
    column = (
        db.query(ProjectStatusColumn)
        .filter(
            ProjectStatusColumn.id == column_uuid,
            ProjectStatusColumn.project_id == project_uuid,
            ProjectStatusColumn.workspace_id == context.workspace_id,
        )
        .first()
    )
    if column is None:
        raise HTTPException(status_code=404, detail='Status column not found')

    if payload.name is not None:
        column.name = payload.name.strip()
    if payload.color is not None:
        column.color = payload.color
    if payload.order_index is not None:
        column.order_index = payload.order_index
    if payload.is_done is not None:
        column.is_done = payload.is_done

    db.commit()
    db.refresh(column)
    return ProjectStatusColumnResponse(
        id=column.id,
        workspace_id=column.workspace_id,
        project_id=column.project_id,
        name=column.name,
        color=column.color,
        order_index=column.order_index,
        is_done=column.is_done,
    )


@router.delete('/{project_id}/status-columns/{column_id}')
def delete_status_column(
    project_id: str,
    column_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'task.manage_status_columns'):
        raise HTTPException(status_code=403, detail='Missing permission: task.manage_status_columns')

    project_uuid = uuid.UUID(project_id)
    column_uuid = uuid.UUID(column_id)
    column = (
        db.query(ProjectStatusColumn)
        .filter(
            ProjectStatusColumn.id == column_uuid,
            ProjectStatusColumn.project_id == project_uuid,
            ProjectStatusColumn.workspace_id == context.workspace_id,
        )
        .first()
    )
    if column is None:
        raise HTTPException(status_code=404, detail='Status column not found')

    db.delete(column)
    db.commit()
    return {'status': 'deleted'}


@router.post('/{project_id}/reports/burndown/snapshot', response_model=BurndownSnapshotResponse)
def create_burndown_snapshot(
    project_id: str,
    sprint_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> BurndownSnapshotResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.view'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.view')

    sprint = (
        db.query(Sprint)
        .filter(
            Sprint.id == uuid.UUID(sprint_id),
            Sprint.workspace_id == context.workspace_id,
            Sprint.project_id == uuid.UUID(project_id),
        )
        .first()
    )
    if sprint is None:
        raise HTTPException(status_code=404, detail='Sprint not found')

    tasks = (
        db.query(Task)
        .filter(
            Task.workspace_id == context.workspace_id,
            Task.project_id == uuid.UUID(project_id),
            Task.sprint_id == sprint.id,
        )
        .all()
    )
    planned = len(tasks)
    completed = sum(1 for task in tasks if task.status in {'done', 'completed'})
    remaining = max(planned - completed, 0)

    snapshot = BurndownSnapshot(
        workspace_id=context.workspace_id,
        project_id=uuid.UUID(project_id),
        sprint_id=sprint.id,
        snapshot_date=datetime.now(timezone.utc),
        planned_points=planned,
        completed_points=completed,
        remaining_points=remaining,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return BurndownSnapshotResponse(
        id=snapshot.id,
        sprint_id=snapshot.sprint_id,
        snapshot_date=snapshot.snapshot_date,
        planned_points=snapshot.planned_points,
        completed_points=snapshot.completed_points,
        remaining_points=snapshot.remaining_points,
    )


@router.get('/{project_id}/reports/burndown', response_model=list[BurndownSnapshotResponse])
def list_burndown(
    project_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[BurndownSnapshotResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.view'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.view')

    snapshots = (
        db.query(BurndownSnapshot)
        .filter(
            BurndownSnapshot.workspace_id == context.workspace_id,
            BurndownSnapshot.project_id == uuid.UUID(project_id),
        )
        .order_by(BurndownSnapshot.snapshot_date.asc())
        .all()
    )
    return [
        BurndownSnapshotResponse(
            id=item.id,
            sprint_id=item.sprint_id,
            snapshot_date=item.snapshot_date,
            planned_points=item.planned_points,
            completed_points=item.completed_points,
            remaining_points=item.remaining_points,
        )
        for item in snapshots
    ]


@router.get('/{project_id}/reports/velocity', response_model=list[VelocityPointResponse])
def velocity_report(
    project_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[VelocityPointResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'sprint.view'):
        raise HTTPException(status_code=403, detail='Missing permission: sprint.view')

    rows = (
        db.query(Sprint.id, Sprint.name, func.count(Task.id))
        .outerjoin(
            Task,
            (Task.sprint_id == Sprint.id)
            & (Task.workspace_id == context.workspace_id)
            & (Task.status.in_(['done', 'completed'])),
        )
        .filter(
            Sprint.workspace_id == context.workspace_id,
            Sprint.project_id == uuid.UUID(project_id),
            Sprint.status == 'completed',
        )
        .group_by(Sprint.id, Sprint.name)
        .order_by(Sprint.created_at.asc())
        .all()
    )

    return [
        VelocityPointResponse(sprint_id=row[0], sprint_name=row[1], completed_points=int(row[2] or 0))
        for row in rows
    ]
