import argparse
import uuid

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Role, User, Workspace, WorkspaceMember
from app.seed import seed_system_roles


def bootstrap_workspace(
    db: Session,
    workspace_name: str,
    subdomain: str,
    owner_email: str,
    owner_name: str,
) -> tuple[uuid.UUID, uuid.UUID]:
    owner = db.query(User).filter(User.email == owner_email).first()
    if owner is None:
        owner = User(email=owner_email, name=owner_name)
        db.add(owner)
        db.flush()

    workspace = db.query(Workspace).filter(Workspace.subdomain == subdomain).first()
    if workspace is None:
        workspace = Workspace(name=workspace_name, subdomain=subdomain, owner_id=owner.id)
        db.add(workspace)
        db.flush()

    seed_system_roles(db, workspace.id, owner.id)

    owner_role = (
        db.query(Role)
        .filter(Role.workspace_id == workspace.id, Role.name == 'Owner')
        .first()
    )
    if owner_role is None:
        raise RuntimeError('Owner role missing after seed')

    existing_membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == owner.id,
        )
        .first()
    )
    if existing_membership is None:
        db.add(
            WorkspaceMember(
                workspace_id=workspace.id,
                user_id=owner.id,
                role_id=owner_role.id,
                status='active',
            )
        )

    db.commit()
    return workspace.id, owner.id


def main() -> None:
    parser = argparse.ArgumentParser(description='Bootstrap a workspace and seed system roles')
    parser.add_argument('--workspace-name', default='MetaSpace Dev Workspace')
    parser.add_argument('--subdomain', default='metaspace-dev')
    parser.add_argument('--owner-email', default='owner@metaspace.local')
    parser.add_argument('--owner-name', default='Workspace Owner')
    args = parser.parse_args()

    db = SessionLocal()
    try:
        workspace_id, owner_id = bootstrap_workspace(
            db,
            workspace_name=args.workspace_name,
            subdomain=args.subdomain,
            owner_email=args.owner_email,
            owner_name=args.owner_name,
        )
        print(f'BOOTSTRAP_OK workspace_id={workspace_id} owner_id={owner_id}')
    finally:
        db.close()


if __name__ == '__main__':
    main()
