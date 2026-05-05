import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Milestone
from app.schemas import MilestoneCreateRequest, MilestoneResponse, MilestoneUpdateRequest
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}/projects/{project_id}/milestones', tags=['milestones'])


def _to_response(milestone: Milestone) -> MilestoneResponse:
    return MilestoneResponse(
        id=milestone.id,
        workspace_id=milestone.workspace_id,
        project_id=milestone.project_id,
        name=milestone.name,
        description=milestone.description,
        due_at=milestone.due_at,
        status=milestone.status,
    )


@router.get('', response_model=list[MilestoneResponse])
def list_milestones(
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[MilestoneResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'milestone.view'):
        raise HTTPException(status_code=403, detail='Missing permission: milestone.view')

    project_uuid = uuid.UUID(project_id)
    milestones = (
        db.query(Milestone)
        .filter(Milestone.workspace_id == context.workspace_id, Milestone.project_id == project_uuid)
        .order_by(Milestone.created_at.desc())
        .all()
    )
    return [_to_response(milestone) for milestone in milestones]


@router.post('', response_model=MilestoneResponse)
def create_milestone(
    payload: MilestoneCreateRequest,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> MilestoneResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'milestone.create'):
        raise HTTPException(status_code=403, detail='Missing permission: milestone.create')

    milestone = Milestone(
        workspace_id=context.workspace_id,
        project_id=uuid.UUID(project_id),
        name=payload.name.strip(),
        description=payload.description,
        due_at=payload.due_at,
        status=payload.status,
        created_by=context.user_id,
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return _to_response(milestone)


@router.patch('/{milestone_id}', response_model=MilestoneResponse)
def update_milestone(
    milestone_id: str,
    payload: MilestoneUpdateRequest,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> MilestoneResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'milestone.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: milestone.edit')

    milestone = (
        db.query(Milestone)
        .filter(
            Milestone.id == uuid.UUID(milestone_id),
            Milestone.workspace_id == context.workspace_id,
            Milestone.project_id == uuid.UUID(project_id),
        )
        .first()
    )
    if milestone is None:
        raise HTTPException(status_code=404, detail='Milestone not found')

    if payload.name is not None:
        milestone.name = payload.name.strip()
    if payload.description is not None:
        milestone.description = payload.description
    if payload.due_at is not None:
        milestone.due_at = payload.due_at
    if payload.status is not None:
        milestone.status = payload.status
    milestone.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(milestone)
    return _to_response(milestone)


@router.delete('/{milestone_id}')
def delete_milestone(
    milestone_id: str,
    workspace_id: str = Path(...),
    project_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'milestone.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: milestone.delete')

    milestone = (
        db.query(Milestone)
        .filter(
            Milestone.id == uuid.UUID(milestone_id),
            Milestone.workspace_id == context.workspace_id,
            Milestone.project_id == uuid.UUID(project_id),
        )
        .first()
    )
    if milestone is None:
        raise HTTPException(status_code=404, detail='Milestone not found')

    db.delete(milestone)
    db.commit()
    return {'status': 'deleted'}
