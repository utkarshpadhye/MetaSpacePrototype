import uuid

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Workspace
from app.schemas import WorkspaceResponse, WorkspaceUpdateRequest
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}', tags=['workspaces'])


@router.get('', response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.settings.view'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.settings.view')

    workspace = db.query(Workspace).filter(Workspace.id == context.workspace_id).first()
    if workspace is None:
        raise HTTPException(status_code=404, detail='Workspace not found')

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        subdomain=workspace.subdomain,
        plan=workspace.plan,
        timezone=workspace.timezone,
        owner_id=workspace.owner_id,
    )


@router.patch('', response_model=WorkspaceResponse)
def update_workspace(
    payload: WorkspaceUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.settings.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.settings.edit')

    workspace = db.query(Workspace).filter(Workspace.id == context.workspace_id).first()
    if workspace is None:
        raise HTTPException(status_code=404, detail='Workspace not found')

    if payload.name is not None:
        workspace.name = payload.name.strip()
    if payload.plan is not None:
        workspace.plan = payload.plan
    if payload.timezone is not None:
        workspace.timezone = payload.timezone

    db.commit()
    db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        subdomain=workspace.subdomain,
        plan=workspace.plan,
        timezone=workspace.timezone,
        owner_id=workspace.owner_id,
    )
