import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import ProjectMember, Role, UserPermissionOverride, WorkspaceMember


def check_permission(
    db: Session,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
    permission: str,
    project_id: uuid.UUID | None = None,
) -> bool:
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == 'active',
        )
        .first()
    )
    if membership is None:
        return False

    role_id = membership.role_id

    if project_id is not None:
        project_member = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
            .first()
        )
        if project_member and project_member.role_id:
            role_id = project_member.role_id

    role = db.query(Role).filter(Role.id == role_id, Role.workspace_id == workspace_id).first()
    if role is None:
        return False

    # Guest role can never have CRM permissions, regardless of grants.
    if role.name.strip().lower() == 'guest' and permission.startswith('crm.'):
        return False

    now = datetime.now(timezone.utc)
    overrides = (
        db.query(UserPermissionOverride)
        .filter(
            UserPermissionOverride.workspace_id == workspace_id,
            UserPermissionOverride.user_id == user_id,
            UserPermissionOverride.permission == permission,
        )
        .all()
    )

    has_revoke = any(
        override.type == 'revoke' and (override.expires_at is None or override.expires_at >= now)
        for override in overrides
    )
    if has_revoke:
        return False

    has_grant = any(
        override.type == 'grant' and (override.expires_at is None or override.expires_at >= now)
        for override in overrides
    )
    if has_grant:
        return True

    return permission in (role.permissions or [])
