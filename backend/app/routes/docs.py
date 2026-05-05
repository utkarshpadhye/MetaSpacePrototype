import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import Doc, DocTemplate, DocVersion, Task
from app.schemas import (
    DocCreateRequest,
    DocResponse,
    DocTemplateCreateRequest,
    DocTemplateResponse,
    DocTemplateUpdateRequest,
    DocUpdateRequest,
    DocVersionResponse,
    PromoteDocStoryRequest,
    TaskResponse,
)
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}', tags=['docs'])

SYSTEM_TEMPLATES = [
    {
        'name': 'PRD Template',
        'description': 'Product requirements document',
        'category': 'requirements',
        'default_content': {
            'sections': [
                'Context',
                'Goals',
                'User Stories',
                'Non-Goals',
                'Acceptance Criteria',
            ]
        },
    },
    {
        'name': 'Meeting Notes',
        'description': 'Structured meeting notes',
        'category': 'knowledge',
        'default_content': {'sections': ['Agenda', 'Decisions', 'Action Items']},
    },
]


def _content_to_text(value: object) -> str:
    if value is None:
        return ''
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return ' '.join(_content_to_text(item) for item in value)
    if isinstance(value, dict):
        return ' '.join(_content_to_text(item) for item in value.values())
    return str(value)


def _doc_response(doc: Doc) -> DocResponse:
    return DocResponse(
        id=doc.id,
        workspace_id=doc.workspace_id,
        project_id=doc.project_id,
        parent_id=doc.parent_id,
        template_id=doc.template_id,
        title=doc.title,
        content_json=doc.content_json or {},
        status=doc.status,
        is_private=doc.is_private,
        is_requirements_doc=doc.is_requirements_doc,
        approved_by=doc.approved_by,
        approved_at=doc.approved_at,
        created_by=doc.created_by,
        updated_by=doc.updated_by,
        updated_at=doc.updated_at,
    )


def _record_version(db: Session, doc: Doc, edited_by: uuid.UUID) -> None:
    next_version = (
        db.query(func.coalesce(func.max(DocVersion.version_number), 0))
        .filter(DocVersion.doc_id == doc.id)
        .scalar()
    )
    version = DocVersion(
        workspace_id=doc.workspace_id,
        doc_id=doc.id,
        version_number=int(next_version or 0) + 1,
        title=doc.title,
        content_json=doc.content_json or {},
        content_text=doc.content_text,
        edited_by=edited_by,
    )
    db.add(version)


def _ensure_system_templates(db: Session, workspace_id: uuid.UUID) -> None:
    existing = (
        db.query(DocTemplate)
        .filter(DocTemplate.workspace_id == workspace_id, DocTemplate.is_system.is_(True))
        .count()
    )
    if existing:
        return

    for template in SYSTEM_TEMPLATES:
        db.add(
            DocTemplate(
                workspace_id=workspace_id,
                name=template['name'],
                description=template['description'],
                category=template['category'],
                default_content=template['default_content'],
                is_system=True,
                created_by=None,
            )
        )
    db.flush()


@router.get('/doc-templates', response_model=list[DocTemplateResponse])
def list_doc_templates(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[DocTemplateResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.templates.view'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.templates.view')

    _ensure_system_templates(db, context.workspace_id)
    templates = (
        db.query(DocTemplate)
        .filter(DocTemplate.workspace_id == context.workspace_id)
        .order_by(DocTemplate.is_system.desc(), DocTemplate.name.asc())
        .all()
    )
    db.commit()
    return [
        DocTemplateResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            name=item.name,
            description=item.description,
            category=item.category,
            default_content=item.default_content or {},
            is_system=item.is_system,
        )
        for item in templates
    ]


@router.post('/doc-templates', response_model=DocTemplateResponse)
def create_doc_template(
    payload: DocTemplateCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DocTemplateResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.templates.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.templates.manage')

    template = DocTemplate(
        workspace_id=context.workspace_id,
        name=payload.name.strip(),
        description=payload.description,
        category=payload.category.strip(),
        default_content=payload.default_content,
        is_system=False,
        created_by=context.user_id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    return DocTemplateResponse(
        id=template.id,
        workspace_id=template.workspace_id,
        name=template.name,
        description=template.description,
        category=template.category,
        default_content=template.default_content or {},
        is_system=template.is_system,
    )


@router.patch('/doc-templates/{template_id}', response_model=DocTemplateResponse)
def update_doc_template(
    template_id: str,
    payload: DocTemplateUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DocTemplateResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.templates.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.templates.manage')

    template = (
        db.query(DocTemplate)
        .filter(DocTemplate.id == uuid.UUID(template_id), DocTemplate.workspace_id == context.workspace_id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail='Template not found')

    if payload.name is not None:
        template.name = payload.name.strip()
    if payload.description is not None:
        template.description = payload.description
    if payload.category is not None:
        template.category = payload.category.strip()
    if payload.default_content is not None:
        template.default_content = payload.default_content

    db.commit()
    db.refresh(template)
    return DocTemplateResponse(
        id=template.id,
        workspace_id=template.workspace_id,
        name=template.name,
        description=template.description,
        category=template.category,
        default_content=template.default_content or {},
        is_system=template.is_system,
    )


@router.delete('/doc-templates/{template_id}')
def delete_doc_template(
    template_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.templates.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.templates.manage')

    template = (
        db.query(DocTemplate)
        .filter(DocTemplate.id == uuid.UUID(template_id), DocTemplate.workspace_id == context.workspace_id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail='Template not found')
    if template.is_system:
        raise HTTPException(status_code=400, detail='System template cannot be deleted')

    db.delete(template)
    db.commit()
    return {'status': 'deleted'}


@router.post('/docs', response_model=DocResponse)
def create_doc(
    payload: DocCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DocResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.create'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.create')

    content_json = payload.content_json
    if payload.template_id is not None:
        template = (
            db.query(DocTemplate)
            .filter(DocTemplate.id == payload.template_id, DocTemplate.workspace_id == context.workspace_id)
            .first()
        )
        if template is None:
            raise HTTPException(status_code=404, detail='Template not found')
        if not content_json:
            content_json = template.default_content or {}

    doc = Doc(
        workspace_id=context.workspace_id,
        project_id=payload.project_id,
        parent_id=payload.parent_id,
        template_id=payload.template_id,
        title=payload.title.strip(),
        content_json=content_json,
        content_text=_content_to_text(content_json),
        status='draft',
        is_private=payload.is_private,
        is_requirements_doc=payload.is_requirements_doc,
        created_by=context.user_id,
        updated_by=context.user_id,
    )
    db.add(doc)
    db.flush()
    _record_version(db, doc, context.user_id)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.get('/docs', response_model=list[DocResponse])
def list_docs(
    workspace_id: str = Path(...),
    query: str | None = Query(default=None),
    parent_id: str | None = Query(default=None),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[DocResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.view'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.view')

    can_view_private = check_permission(db, context.user_id, workspace_uuid, 'doc.view_private')
    docs_query = db.query(Doc).filter(Doc.workspace_id == context.workspace_id)
    if not can_view_private:
        docs_query = docs_query.filter(or_(Doc.is_private.is_(False), Doc.created_by == context.user_id))
    if parent_id is not None:
        if parent_id == 'root':
            docs_query = docs_query.filter(Doc.parent_id.is_(None))
        else:
            docs_query = docs_query.filter(Doc.parent_id == uuid.UUID(parent_id))
    if query:
        needle = f'%{query.lower()}%'
        docs_query = docs_query.filter(
            or_(func.lower(Doc.title).like(needle), func.lower(Doc.content_text).like(needle))
        )

    docs = docs_query.order_by(Doc.updated_at.desc()).all()
    return [_doc_response(doc) for doc in docs]


@router.get('/docs/{doc_id}', response_model=DocResponse)
def get_doc(
    doc_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DocResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.view'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.view')

    doc = db.query(Doc).filter(Doc.id == uuid.UUID(doc_id), Doc.workspace_id == context.workspace_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail='Doc not found')

    if doc.is_private and doc.created_by != context.user_id:
        if not check_permission(db, context.user_id, workspace_uuid, 'doc.view_private'):
            raise HTTPException(status_code=403, detail='Missing permission: doc.view_private')

    return _doc_response(doc)


@router.patch('/docs/{doc_id}', response_model=DocResponse)
def update_doc(
    doc_id: str,
    payload: DocUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DocResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.edit')

    doc = db.query(Doc).filter(Doc.id == uuid.UUID(doc_id), Doc.workspace_id == context.workspace_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail='Doc not found')

    approved_before = doc.status == 'approved'
    approval_reset = False

    if payload.title is not None:
        new_title = payload.title.strip()
        if new_title != doc.title:
            doc.title = new_title
            approval_reset = True
    if payload.content_json is not None:
        doc.content_json = payload.content_json
        doc.content_text = _content_to_text(payload.content_json)
        approval_reset = True
    if payload.parent_id is not None:
        doc.parent_id = payload.parent_id
        approval_reset = True
    if payload.project_id is not None:
        doc.project_id = payload.project_id
        approval_reset = True
    if payload.is_private is not None:
        doc.is_private = payload.is_private
        approval_reset = True

    if approved_before and approval_reset:
        doc.status = 'draft'
        doc.approved_by = None
        doc.approved_at = None

    doc.updated_by = context.user_id
    doc.updated_at = datetime.now(timezone.utc)
    _record_version(db, doc, context.user_id)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.post('/docs/{doc_id}/approve', response_model=DocResponse)
def approve_doc(
    doc_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DocResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.approve'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.approve')

    doc = db.query(Doc).filter(Doc.id == uuid.UUID(doc_id), Doc.workspace_id == context.workspace_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail='Doc not found')

    doc.status = 'approved'
    doc.approved_by = context.user_id
    doc.approved_at = datetime.now(timezone.utc)
    doc.updated_by = context.user_id
    doc.updated_at = datetime.now(timezone.utc)
    _record_version(db, doc, context.user_id)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.get('/docs/{doc_id}/versions', response_model=list[DocVersionResponse])
def list_doc_versions(
    doc_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[DocVersionResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.view'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.view')

    versions = (
        db.query(DocVersion)
        .filter(DocVersion.workspace_id == context.workspace_id, DocVersion.doc_id == uuid.UUID(doc_id))
        .order_by(DocVersion.version_number.desc())
        .all()
    )
    return [
        DocVersionResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            doc_id=item.doc_id,
            version_number=item.version_number,
            title=item.title,
            content_json=item.content_json or {},
            edited_by=item.edited_by,
            created_at=item.created_at,
        )
        for item in versions
    ]


@router.post('/docs/{doc_id}/versions/{version_id}/restore', response_model=DocResponse)
def restore_doc_version(
    doc_id: str,
    version_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DocResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.edit')

    doc = db.query(Doc).filter(Doc.id == uuid.UUID(doc_id), Doc.workspace_id == context.workspace_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail='Doc not found')

    version = (
        db.query(DocVersion)
        .filter(
            DocVersion.id == uuid.UUID(version_id),
            DocVersion.doc_id == doc.id,
            DocVersion.workspace_id == context.workspace_id,
        )
        .first()
    )
    if version is None:
        raise HTTPException(status_code=404, detail='Version not found')

    doc.title = version.title
    doc.content_json = version.content_json or {}
    doc.content_text = version.content_text
    doc.status = 'draft'
    doc.approved_by = None
    doc.approved_at = None
    doc.updated_by = context.user_id
    doc.updated_at = datetime.now(timezone.utc)
    _record_version(db, doc, context.user_id)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.post('/docs/{doc_id}/promote-story', response_model=TaskResponse)
def promote_doc_story_to_task(
    doc_id: str,
    payload: PromoteDocStoryRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> TaskResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'doc.view'):
        raise HTTPException(status_code=403, detail='Missing permission: doc.view')
    if not check_permission(db, context.user_id, workspace_uuid, 'task.create'):
        raise HTTPException(status_code=403, detail='Missing permission: task.create')

    doc = db.query(Doc).filter(Doc.id == uuid.UUID(doc_id), Doc.workspace_id == context.workspace_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail='Doc not found')

    task = Task(
        workspace_id=context.workspace_id,
        project_id=payload.project_id,
        sprint_id=None,
        parent_task_id=None,
        status_column_id=None,
        title=payload.title.strip(),
        description=payload.description,
        status='todo',
        priority='medium',
        order_index=0,
        estimate_minutes=None,
        due_at=None,
        assignee_id=payload.assignee_id,
        watchers=[str(context.user_id)],
        created_by=context.user_id,
        updated_by=context.user_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        project_id=task.project_id,
        sprint_id=task.sprint_id,
        parent_task_id=task.parent_task_id,
        status_column_id=task.status_column_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        order_index=task.order_index,
        estimate_minutes=task.estimate_minutes,
        due_at=task.due_at,
        assignee_id=task.assignee_id,
        created_by=task.created_by,
    )
