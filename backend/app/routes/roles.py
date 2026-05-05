import uuid

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Role, WorkspaceMember
from app.schemas import RoleAssignRequest, RoleCreateRequest, RoleResponse, RoleUpdateRequest
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}/roles', tags=['roles'])


def _as_response(role: Role) -> RoleResponse:
    return RoleResponse(
        id=role.id,
        workspace_id=role.workspace_id,
        name=role.name,
        color=role.color,
        permissions=role.permissions or [],
        is_system=role.is_system,
    )


@router.get('', response_model=list[RoleResponse])
def list_roles(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[RoleResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.members.view'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.members.view')

    roles = db.query(Role).filter(Role.workspace_id == context.workspace_id).all()
    return [_as_response(role) for role in roles]


@router.post('', response_model=RoleResponse)
def create_role(
    payload: RoleCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> RoleResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.roles.create'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.roles.create')

    existing = (
        db.query(Role)
        .filter(Role.workspace_id == context.workspace_id, Role.name == payload.name.strip())
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail='Role name already exists')

    role = Role(
        workspace_id=context.workspace_id,
        name=payload.name.strip(),
        color=payload.color,
        permissions=sorted(list(set(payload.permissions))),
        is_system=False,
        created_by=context.user_id,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return _as_response(role)


@router.patch('/{role_id}', response_model=RoleResponse)
def update_role(
    role_id: str,
    payload: RoleUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> RoleResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.roles.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.roles.edit')

    role_uuid = uuid.UUID(role_id)
    role = db.query(Role).filter(Role.id == role_uuid, Role.workspace_id == context.workspace_id).first()
    if role is None:
        raise HTTPException(status_code=404, detail='Role not found')

    if role.name == 'Owner':
        raise HTTPException(status_code=400, detail='Owner role is immutable')

    if payload.name is not None:
        role.name = payload.name.strip()
    if payload.color is not None:
        role.color = payload.color
    if payload.permissions is not None:
        role.permissions = sorted(list(set(payload.permissions)))

    db.commit()
    db.refresh(role)
    return _as_response(role)


@router.delete('/{role_id}')
def delete_role(
    role_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.roles.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.roles.delete')

    role_uuid = uuid.UUID(role_id)
    role = db.query(Role).filter(Role.id == role_uuid, Role.workspace_id == context.workspace_id).first()
    if role is None:
        raise HTTPException(status_code=404, detail='Role not found')

    if role.name == 'Owner':
        raise HTTPException(status_code=400, detail='Owner role cannot be deleted')

    attached_member = db.query(WorkspaceMember).filter(WorkspaceMember.role_id == role.id).first()
    if attached_member is not None:
        raise HTTPException(status_code=400, detail='Role is assigned to members')

    db.delete(role)
    db.commit()
    return {'status': 'deleted'}


@router.post('/{role_id}/assign', response_model=RoleResponse)
def assign_role(
    role_id: str,
    payload: RoleAssignRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> RoleResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.roles.assign'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.roles.assign')

    role_uuid = uuid.UUID(role_id)
    role = db.query(Role).filter(Role.id == role_uuid, Role.workspace_id == context.workspace_id).first()
    if role is None:
        raise HTTPException(status_code=404, detail='Role not found')

    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == context.workspace_id, WorkspaceMember.user_id == payload.user_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=404, detail='Member not found')

    current_role = db.query(Role).filter(Role.id == member.role_id).first()
    if current_role and current_role.name == 'Owner' and role.name != 'Owner':
        raise HTTPException(status_code=400, detail='Owner role assignment cannot be changed')

    member.role_id = role.id
    db.commit()
    return _as_response(role)
