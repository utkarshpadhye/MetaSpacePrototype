import uuid

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Role, UserPermissionOverride, WorkspaceMember
from app.schemas import PermissionOverrideRequest
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}/permission-overrides', tags=['permission-overrides'])


def _require_owner(db: Session, workspace_id: uuid.UUID, user_id: uuid.UUID) -> None:
    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=403, detail='Owner access required')

    role = db.query(Role).filter(Role.id == member.role_id).first()
    if role is None or role.name != 'Owner':
        raise HTTPException(status_code=403, detail='Owner access required')


@router.post('/grant')
def grant_override(
    payload: PermissionOverrideRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.roles.assign'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.roles.assign')
    _require_owner(db, context.workspace_id, context.user_id)

    override = UserPermissionOverride(
        workspace_id=context.workspace_id,
        user_id=payload.user_id,
        permission=payload.permission.strip(),
        type='grant',
        granted_by=context.user_id,
        expires_at=payload.expires_at,
    )
    db.add(override)
    db.commit()
    return {'status': 'granted'}


@router.post('/revoke')
def revoke_override(
    payload: PermissionOverrideRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.roles.assign'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.roles.assign')
    _require_owner(db, context.workspace_id, context.user_id)

    override = UserPermissionOverride(
        workspace_id=context.workspace_id,
        user_id=payload.user_id,
        permission=payload.permission.strip(),
        type='revoke',
        granted_by=context.user_id,
        expires_at=payload.expires_at,
    )
    db.add(override)
    db.commit()
    return {'status': 'revoked'}
