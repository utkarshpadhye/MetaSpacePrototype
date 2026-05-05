import uuid

from sqlalchemy.orm import Session

from app.models import Role
from app.permissions import SYSTEM_ROLE_COLORS, SYSTEM_ROLE_PERMISSIONS


def seed_system_roles(db: Session, workspace_id: uuid.UUID, creator_id: uuid.UUID) -> None:
    for role_name, permissions in SYSTEM_ROLE_PERMISSIONS.items():
        existing = (
            db.query(Role)
            .filter(Role.workspace_id == workspace_id, Role.name == role_name)
            .first()
        )
        if existing:
            continue

        db.add(
            Role(
                workspace_id=workspace_id,
                name=role_name,
                color=SYSTEM_ROLE_COLORS[role_name],
                permissions=sorted(list(permissions)),
                is_system=True,
                created_by=creator_id,
            )
        )

    db.commit()
