import uuid

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Role, User, WorkspaceMember
from app.schemas import MemberInviteRequest, MemberResponse
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}/members', tags=['members'])


@router.get('', response_model=list[MemberResponse])
def list_members(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[MemberResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.members.view'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.members.view')

    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == context.workspace_id).all()
    return [
        MemberResponse(
            id=member.id,
            workspace_id=member.workspace_id,
            user_id=member.user_id,
            role_id=member.role_id,
            status=member.status,
        )
        for member in members
    ]


@router.post('/invite', response_model=MemberResponse)
def invite_member(
    payload: MemberInviteRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> MemberResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.members.invite'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.members.invite')

    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user is None:
        user = User(email=payload.email.strip().lower(), name=payload.name.strip())
        db.add(user)
        db.flush()

    role_id = payload.role_id
    if role_id is None:
        default_role = (
            db.query(Role)
            .filter(Role.workspace_id == context.workspace_id, Role.name == 'Member')
            .first()
        )
        if default_role is None:
            raise HTTPException(status_code=400, detail='Default Member role not found')
        role_id = default_role.id
    else:
        role_exists = (
            db.query(Role)
            .filter(Role.id == role_id, Role.workspace_id == context.workspace_id)
            .first()
        )
        if role_exists is None:
            raise HTTPException(status_code=404, detail='Role not found')

    existing = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == context.workspace_id, WorkspaceMember.user_id == user.id)
        .first()
    )
    if existing is not None:
        existing.role_id = role_id
        existing.status = 'active'
        db.commit()
        db.refresh(existing)
        return MemberResponse(
            id=existing.id,
            workspace_id=existing.workspace_id,
            user_id=existing.user_id,
            role_id=existing.role_id,
            status=existing.status,
        )

    member = WorkspaceMember(
        workspace_id=context.workspace_id,
        user_id=user.id,
        role_id=role_id,
        status='invited',
        invited_by=context.user_id,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return MemberResponse(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role_id=member.role_id,
        status=member.status,
    )


@router.delete('/{user_id}')
def remove_member(
    user_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'workspace.members.remove'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.members.remove')

    user_uuid = uuid.UUID(user_id)
    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == context.workspace_id, WorkspaceMember.user_id == user_uuid)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=404, detail='Member not found')

    role = db.query(Role).filter(Role.id == member.role_id).first()
    if role and role.name == 'Owner':
        raise HTTPException(status_code=400, detail='Owner membership cannot be removed')

    db.delete(member)
    db.commit()
    return {'status': 'removed'}
