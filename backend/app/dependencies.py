import uuid
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Path
from sqlalchemy.orm import Session

from app.auth import decode_token
from app.database import get_db
from app.models import WorkspaceMember


@dataclass
class RequestContext:
    user_id: uuid.UUID
    workspace_id: uuid.UUID


def get_request_context(
    workspace_id: str = Path(...),
    x_user_id: str | None = Header(default=None, alias='X-User-Id'),
    x_workspace_id: str | None = Header(default=None, alias='X-Workspace-Id'),
    authorization: str | None = Header(default=None, alias='Authorization'),
    db: Session = Depends(get_db),
) -> RequestContext:
    token_payload: dict | None = None
    if authorization and authorization.lower().startswith('bearer '):
        token = authorization.split(' ', 1)[1].strip()
        try:
            token_payload = decode_token(token)
        except Exception as exc:
            raise HTTPException(status_code=401, detail='Invalid token') from exc

    if token_payload is None and (not x_user_id or not x_workspace_id):
        raise HTTPException(status_code=401, detail='Missing auth headers')

    try:
        path_workspace_id = uuid.UUID(workspace_id)
        if token_payload is not None:
            user_id = uuid.UUID(token_payload.get('sub'))
            request_workspace_id = uuid.UUID(token_payload.get('workspace_id'))
        else:
            user_id = uuid.UUID(x_user_id)
            request_workspace_id = uuid.UUID(x_workspace_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='Invalid UUID in headers/path') from exc

    if request_workspace_id != path_workspace_id:
        raise HTTPException(status_code=403, detail='Workspace mismatch')

    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == path_workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == 'active',
        )
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=403, detail='User is not an active workspace member')

    return RequestContext(user_id=user_id, workspace_id=path_workspace_id)
