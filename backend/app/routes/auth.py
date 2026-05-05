import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import (
    AuthError,
    generate_workspace_slug,
    generate_refresh_token,
    generate_username,
    hash_password,
    hash_refresh_token,
    issue_access_token,
    normalize_username,
    validate_password,
    verify_password,
)
from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.config import get_settings
from app.database import Base
from app.models import RefreshToken, Role, User, UserPermissionOverride, Workspace, WorkspaceMember
from app.schemas import (
    AdminSignupRequest,
    AdminUserCreateRequest,
    AdminUserResponse,
    AdminUserUpdateRequest,
    AdminPasswordResetRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetRequest,
    RefreshRequest,
    TokenResponse,
)
from app.security import check_permission
from app.seed import seed_system_roles


router = APIRouter(prefix='/api/v1/auth', tags=['auth'])


def _find_role(db: Session, workspace_id: uuid.UUID, role_id: uuid.UUID | None, fallback_name: str) -> Role:
    if role_id is not None:
        role = db.query(Role).filter(Role.id == role_id, Role.workspace_id == workspace_id).first()
        if role is None:
            raise HTTPException(status_code=404, detail='Role not found')
        return role

    role = db.query(Role).filter(Role.workspace_id == workspace_id, Role.name == fallback_name).first()
    if role is None:
        raise HTTPException(status_code=400, detail='Default role not found')
    return role


def _issue_tokens(db: Session, user: User, workspace: Workspace, role: Role) -> TokenResponse:
    refresh_token = generate_refresh_token()
    token_hash = hash_refresh_token(refresh_token)
    db.add(
        RefreshToken(
            workspace_id=workspace.id,
            user_id=user.id,
            token_hash=token_hash,
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    access_token = issue_access_token(str(user.id), str(workspace.id), role.name)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        user_id=user.id,
        user_name=user.name,
        role_name=role.name,
        permissions=role.permissions or [],
        must_reset_password=user.must_reset_password,
    )


@router.post('/admin-signup', response_model=TokenResponse)
def admin_signup(payload: AdminSignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    workspace_name = payload.workspace_name.strip()
    existing_workspace = (
        db.query(Workspace)
        .filter(func.lower(Workspace.name) == func.lower(workspace_name))
        .first()
    )
    if existing_workspace is not None:
        raise HTTPException(status_code=400, detail='Workspace name already exists')

    try:
        validate_password(payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail='Email already exists')

    workspace = Workspace(
        name=workspace_name,
        subdomain=generate_workspace_slug(workspace_name),
        owner_id=uuid.uuid4(),
    )
    user = User(
        id=workspace.owner_id,
        email=email,
        name=f'{payload.first_name.strip()} {payload.last_name.strip()}'.strip(),
        password_hash=hash_password(payload.password),
        must_reset_password=False,
        is_active=True,
    )
    db.add(user)
    db.add(workspace)
    db.flush()

    seed_system_roles(db, workspace.id, user.id)
    owner_role = _find_role(db, workspace.id, None, 'Owner')

    username_base = generate_username(payload.first_name, payload.last_name)
    username = username_base
    counter = 1
    while (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace.id, WorkspaceMember.username == username)
        .first()
        is not None
    ):
        counter += 1
        username = f'{username_base}{counter}'

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role_id=owner_role.id,
        username=username,
        status='active',
        invited_by=None,
    )
    db.add(member)
    db.commit()

    return _issue_tokens(db, user, workspace, owner_role)


@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    workspace_name = payload.workspace_name.strip()
    workspace = (
        db.query(Workspace)
        .filter(func.lower(Workspace.name) == func.lower(workspace_name))
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail='Workspace not found')

    username = normalize_username(payload.username)
    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace.id, WorkspaceMember.username == username)
        .first()
    )
    if member is None or member.status != 'active':
        raise HTTPException(status_code=403, detail='User is not active in workspace')

    user = db.query(User).filter(User.id == member.user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=403, detail='User is inactive')
    if not user.password_hash:
        raise HTTPException(status_code=403, detail='User has no password set')

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Invalid credentials')

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    role = db.query(Role).filter(Role.id == member.role_id, Role.workspace_id == workspace.id).first()
    if role is None:
        raise HTTPException(status_code=400, detail='Role not found')

    return _issue_tokens(db, user, workspace, role)


@router.post('/dev/reset')
def reset_dev_data(db: Session = Depends(get_db)) -> dict[str, str]:
    settings = get_settings()
    if settings.app_env != 'development':
        raise HTTPException(status_code=403, detail='Reset endpoint is only available in development')

    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    return {'status': 'reset'}


@router.post('/refresh', response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    token_hash = hash_refresh_token(payload.refresh_token)
    token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if token is None or token.revoked_at is not None:
        raise HTTPException(status_code=401, detail='Refresh token invalid')

    user = db.query(User).filter(User.id == token.user_id).first()
    workspace = db.query(Workspace).filter(Workspace.id == token.workspace_id).first()
    if user is None or workspace is None:
        raise HTTPException(status_code=401, detail='Refresh token invalid')

    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace.id, WorkspaceMember.user_id == user.id)
        .first()
    )
    if member is None or member.status != 'active':
        raise HTTPException(status_code=403, detail='User is not active in workspace')

    role = db.query(Role).filter(Role.id == member.role_id, Role.workspace_id == workspace.id).first()
    if role is None:
        raise HTTPException(status_code=400, detail='Role not found')

    token.last_used_at = datetime.now(timezone.utc)
    db.commit()

    return _issue_tokens(db, user, workspace, role)


@router.post('/logout')
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    token_hash = hash_refresh_token(payload.refresh_token)
    token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if token is None:
        return {'status': 'ok'}

    token.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {'status': 'ok'}


@router.post('/{workspace_id}/reset-password')
def reset_password(
    payload: PasswordResetRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.query(User).filter(User.id == context.user_id).first()
    if user is None or not user.password_hash:
        raise HTTPException(status_code=404, detail='User not found')

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail='Invalid current password')

    try:
        validate_password(payload.new_password)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user.password_hash = hash_password(payload.new_password)
    user.must_reset_password = False
    db.commit()
    return {'status': 'updated'}


@router.get('/{workspace_id}/users', response_model=list[AdminUserResponse])
def list_users(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[AdminUserResponse]:
    if not check_permission(db, context.user_id, context.workspace_id, 'workspace.members.view'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.members.view')

    members = (
        db.query(WorkspaceMember, User, Role)
        .join(User, WorkspaceMember.user_id == User.id)
        .join(Role, WorkspaceMember.role_id == Role.id)
        .filter(WorkspaceMember.workspace_id == context.workspace_id)
        .all()
    )

    return [
        AdminUserResponse(
            user_id=user.id,
            workspace_member_id=member.id,
            username=member.username,
            name=user.name,
            email=user.email,
            role_id=role.id,
            role_name=role.name,
            status=member.status,
            must_reset_password=user.must_reset_password,
        )
        for member, user, role in members
    ]


@router.post('/{workspace_id}/users', response_model=AdminUserResponse)
def create_user(
    payload: AdminUserCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    if not check_permission(db, context.user_id, context.workspace_id, 'workspace.members.invite'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.members.invite')

    try:
        validate_password(payload.temporary_password)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            name=f'{payload.first_name.strip()} {payload.last_name.strip()}'.strip(),
            password_hash=hash_password(payload.temporary_password),
            must_reset_password=True,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        user.password_hash = hash_password(payload.temporary_password)
        user.must_reset_password = True

    role = _find_role(db, context.workspace_id, payload.role_id, 'Member')

    username = payload.username or generate_username(payload.first_name, payload.last_name)
    username = normalize_username(username)
    if (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == context.workspace_id, WorkspaceMember.username == username)
        .first()
        is not None
    ):
        raise HTTPException(status_code=400, detail='Username already taken')

    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == context.workspace_id, WorkspaceMember.user_id == user.id)
        .first()
    )
    if member is None:
        member = WorkspaceMember(
            workspace_id=context.workspace_id,
            user_id=user.id,
            role_id=role.id,
            username=username,
            status='active',
            invited_by=context.user_id,
        )
        db.add(member)
    else:
        member.role_id = role.id
        member.username = username
        member.status = 'active'

    if payload.permissions:
        for permission in payload.permissions:
            db.add(
                UserPermissionOverride(
                    workspace_id=context.workspace_id,
                    user_id=user.id,
                    permission=permission,
                    type='grant',
                    granted_by=context.user_id,
                )
            )

    db.commit()
    db.refresh(member)

    return AdminUserResponse(
        user_id=user.id,
        workspace_member_id=member.id,
        username=member.username,
        name=user.name,
        email=user.email,
        role_id=role.id,
        role_name=role.name,
        status=member.status,
        must_reset_password=user.must_reset_password,
    )


@router.patch('/{workspace_id}/users/{user_id}', response_model=AdminUserResponse)
def update_user(
    payload: AdminUserUpdateRequest,
    workspace_id: str = Path(...),
    user_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    if not check_permission(db, context.user_id, context.workspace_id, 'workspace.roles.assign'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.roles.assign')

    user_uuid = uuid.UUID(user_id)
    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == context.workspace_id, WorkspaceMember.user_id == user_uuid)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=404, detail='Member not found')

    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None:
        raise HTTPException(status_code=404, detail='User not found')

    if payload.role_id is not None:
        role = _find_role(db, context.workspace_id, payload.role_id, 'Member')
        member.role_id = role.id

    if payload.status is not None:
        if payload.status not in {'active', 'suspended', 'invited'}:
            raise HTTPException(status_code=400, detail='Invalid status')
        member.status = payload.status

    if payload.permissions is not None:
        db.query(UserPermissionOverride).filter(
            UserPermissionOverride.workspace_id == context.workspace_id,
            UserPermissionOverride.user_id == user.id,
        ).delete()
        for permission in payload.permissions:
            db.add(
                UserPermissionOverride(
                    workspace_id=context.workspace_id,
                    user_id=user.id,
                    permission=permission,
                    type='grant',
                    granted_by=context.user_id,
                )
            )

    db.commit()

    role = db.query(Role).filter(Role.id == member.role_id, Role.workspace_id == context.workspace_id).first()
    if role is None:
        raise HTTPException(status_code=400, detail='Role not found')

    return AdminUserResponse(
        user_id=user.id,
        workspace_member_id=member.id,
        username=member.username,
        name=user.name,
        email=user.email,
        role_id=role.id,
        role_name=role.name,
        status=member.status,
        must_reset_password=user.must_reset_password,
    )


@router.post('/{workspace_id}/users/{user_id}/reset-password')
def reset_user_password(
    payload: AdminPasswordResetRequest,
    workspace_id: str = Path(...),
    user_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not check_permission(db, context.user_id, context.workspace_id, 'workspace.members.invite'):
        raise HTTPException(status_code=403, detail='Missing permission: workspace.members.invite')

    user_uuid = uuid.UUID(user_id)
    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None:
        raise HTTPException(status_code=404, detail='User not found')

    try:
        validate_password(payload.temporary_password)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user.password_hash = hash_password(payload.temporary_password)
    user.must_reset_password = True
    db.commit()
    return {'status': 'reset'}
