import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import RequestContext, get_request_context
from app.models import CRMInteraction, Company, Contact, Deal, Notification, PipelineStage, Project
from app.schemas import (
    AvgDealCycleResponse,
    CRMInteractionCreateRequest,
    CRMInteractionResponse,
    CompanyCreateRequest,
    CompanyResponse,
    CompanyUpdateRequest,
    ContactCreateRequest,
    ContactResponse,
    ContactUpdateRequest,
    DealConversionResponse,
    DealCreateRequest,
    DealResponse,
    DealUpdateRequest,
    PipelineStageCreateRequest,
    PipelineStageResponse,
    PipelineStageUpdateRequest,
    PipelineSummaryRow,
    RevenueForecastResponse,
    WinRateResponse,
)
from app.security import check_permission


router = APIRouter(prefix='/api/v1/{workspace_id}/crm', tags=['crm'])

DEFAULT_PIPELINE_STAGES = [
    ('Lead', 0, 10, False),
    ('Qualified', 1, 30, False),
    ('Proposal', 2, 60, False),
    ('Negotiation', 3, 80, False),
    ('Closed Won', 4, 100, True),
    ('Closed Lost', 5, 0, True),
]


def _ensure_default_pipeline(db: Session, workspace_id: uuid.UUID, user_id: uuid.UUID) -> None:
    if db.query(PipelineStage).filter(PipelineStage.workspace_id == workspace_id).count() > 0:
        return

    for name, order_index, probability, is_closed in DEFAULT_PIPELINE_STAGES:
        db.add(
            PipelineStage(
                workspace_id=workspace_id,
                name=name,
                order_index=order_index,
                probability_percent=probability,
                is_closed=is_closed,
                created_by=user_id,
            )
        )
    db.flush()


def _csv_response(rows: list[dict[str, object]], columns: list[str]) -> PlainTextResponse:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow({column: row.get(column) for column in columns})
    return PlainTextResponse(content=output.getvalue(), media_type='text/csv')


def _deal_response(item: Deal) -> DealResponse:
    return DealResponse(
        id=item.id,
        workspace_id=item.workspace_id,
        company_id=item.company_id,
        contact_id=item.contact_id,
        pipeline_stage_id=item.pipeline_stage_id,
        linked_project_id=item.linked_project_id,
        title=item.title,
        value=item.value,
        status=item.status,
        close_date=item.close_date,
        closed_at=item.closed_at,
        notes=item.notes,
    )


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.get('/pipeline-stages', response_model=list[PipelineStageResponse])
def list_pipeline_stages(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[PipelineStageResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.view')

    _ensure_default_pipeline(db, context.workspace_id, context.user_id)
    stages = (
        db.query(PipelineStage)
        .filter(PipelineStage.workspace_id == context.workspace_id)
        .order_by(PipelineStage.order_index.asc())
        .all()
    )
    db.commit()
    return [
        PipelineStageResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            name=item.name,
            order_index=item.order_index,
            probability_percent=item.probability_percent,
            is_closed=item.is_closed,
        )
        for item in stages
    ]


@router.post('/pipeline-stages', response_model=PipelineStageResponse)
def create_pipeline_stage(
    payload: PipelineStageCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> PipelineStageResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.pipeline.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.pipeline.manage')

    stage = PipelineStage(
        workspace_id=context.workspace_id,
        name=payload.name.strip(),
        order_index=payload.order_index,
        probability_percent=payload.probability_percent,
        is_closed=payload.is_closed,
        created_by=context.user_id,
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return PipelineStageResponse(
        id=stage.id,
        workspace_id=stage.workspace_id,
        name=stage.name,
        order_index=stage.order_index,
        probability_percent=stage.probability_percent,
        is_closed=stage.is_closed,
    )


@router.patch('/pipeline-stages/{stage_id}', response_model=PipelineStageResponse)
def update_pipeline_stage(
    stage_id: str,
    payload: PipelineStageUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> PipelineStageResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.pipeline.manage'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.pipeline.manage')

    stage = (
        db.query(PipelineStage)
        .filter(PipelineStage.id == uuid.UUID(stage_id), PipelineStage.workspace_id == context.workspace_id)
        .first()
    )
    if stage is None:
        raise HTTPException(status_code=404, detail='Pipeline stage not found')

    if payload.name is not None:
        stage.name = payload.name.strip()
    if payload.order_index is not None:
        stage.order_index = payload.order_index
    if payload.probability_percent is not None:
        stage.probability_percent = payload.probability_percent
    if payload.is_closed is not None:
        stage.is_closed = payload.is_closed

    db.commit()
    db.refresh(stage)
    return PipelineStageResponse(
        id=stage.id,
        workspace_id=stage.workspace_id,
        name=stage.name,
        order_index=stage.order_index,
        probability_percent=stage.probability_percent,
        is_closed=stage.is_closed,
    )


@router.post('/companies', response_model=CompanyResponse)
def create_company(
    payload: CompanyCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CompanyResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.edit')

    company = Company(
        workspace_id=context.workspace_id,
        name=payload.name.strip(),
        website=payload.website,
        industry=payload.industry,
        notes=payload.notes,
        created_by=context.user_id,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return CompanyResponse(
        id=company.id,
        workspace_id=company.workspace_id,
        name=company.name,
        website=company.website,
        industry=company.industry,
        notes=company.notes,
    )


@router.get('/companies', response_model=list[CompanyResponse])
def list_companies(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[CompanyResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.view')

    companies = db.query(Company).filter(Company.workspace_id == context.workspace_id).order_by(Company.name.asc()).all()
    return [
        CompanyResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            name=item.name,
            website=item.website,
            industry=item.industry,
            notes=item.notes,
        )
        for item in companies
    ]


@router.patch('/companies/{company_id}', response_model=CompanyResponse)
def update_company(
    company_id: str,
    payload: CompanyUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CompanyResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.edit')

    company = (
        db.query(Company)
        .filter(Company.id == uuid.UUID(company_id), Company.workspace_id == context.workspace_id)
        .first()
    )
    if company is None:
        raise HTTPException(status_code=404, detail='Company not found')

    if payload.name is not None:
        company.name = payload.name.strip()
    if payload.website is not None:
        company.website = payload.website
    if payload.industry is not None:
        company.industry = payload.industry
    if payload.notes is not None:
        company.notes = payload.notes

    db.commit()
    db.refresh(company)
    return CompanyResponse(
        id=company.id,
        workspace_id=company.workspace_id,
        name=company.name,
        website=company.website,
        industry=company.industry,
        notes=company.notes,
    )


@router.delete('/companies/{company_id}')
def delete_company(
    company_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.delete')

    company = (
        db.query(Company)
        .filter(Company.id == uuid.UUID(company_id), Company.workspace_id == context.workspace_id)
        .first()
    )
    if company is None:
        raise HTTPException(status_code=404, detail='Company not found')

    db.delete(company)
    db.commit()
    return {'status': 'deleted'}


@router.post('/contacts', response_model=ContactResponse)
def create_contact(
    payload: ContactCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> ContactResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.edit')

    contact = Contact(
        workspace_id=context.workspace_id,
        company_id=payload.company_id,
        name=payload.name.strip(),
        email=payload.email,
        phone=payload.phone,
        title=payload.title,
        notes=payload.notes,
        created_by=context.user_id,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return ContactResponse(
        id=contact.id,
        workspace_id=contact.workspace_id,
        company_id=contact.company_id,
        name=contact.name,
        email=contact.email,
        phone=contact.phone,
        title=contact.title,
        last_interaction_at=contact.last_interaction_at,
        notes=contact.notes,
    )


@router.get('/contacts', response_model=list[ContactResponse])
def list_contacts(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[ContactResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.view')

    contacts = db.query(Contact).filter(Contact.workspace_id == context.workspace_id).order_by(Contact.name.asc()).all()
    return [
        ContactResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            company_id=item.company_id,
            name=item.name,
            email=item.email,
            phone=item.phone,
            title=item.title,
            last_interaction_at=item.last_interaction_at,
            notes=item.notes,
        )
        for item in contacts
    ]


@router.patch('/contacts/{contact_id}', response_model=ContactResponse)
def update_contact(
    contact_id: str,
    payload: ContactUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> ContactResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.edit')

    contact = (
        db.query(Contact)
        .filter(Contact.id == uuid.UUID(contact_id), Contact.workspace_id == context.workspace_id)
        .first()
    )
    if contact is None:
        raise HTTPException(status_code=404, detail='Contact not found')

    if payload.name is not None:
        contact.name = payload.name.strip()
    if payload.company_id is not None:
        contact.company_id = payload.company_id
    if payload.email is not None:
        contact.email = payload.email
    if payload.phone is not None:
        contact.phone = payload.phone
    if payload.title is not None:
        contact.title = payload.title
    if payload.last_interaction_at is not None:
        contact.last_interaction_at = payload.last_interaction_at
    if payload.notes is not None:
        contact.notes = payload.notes

    db.commit()
    db.refresh(contact)
    return ContactResponse(
        id=contact.id,
        workspace_id=contact.workspace_id,
        company_id=contact.company_id,
        name=contact.name,
        email=contact.email,
        phone=contact.phone,
        title=contact.title,
        last_interaction_at=contact.last_interaction_at,
        notes=contact.notes,
    )


@router.delete('/contacts/{contact_id}')
def delete_contact(
    contact_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.delete')

    contact = (
        db.query(Contact)
        .filter(Contact.id == uuid.UUID(contact_id), Contact.workspace_id == context.workspace_id)
        .first()
    )
    if contact is None:
        raise HTTPException(status_code=404, detail='Contact not found')

    db.delete(contact)
    db.commit()
    return {'status': 'deleted'}


@router.post('/deals', response_model=DealResponse)
def create_deal(
    payload: DealCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DealResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.deals.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.deals.edit')

    stage = (
        db.query(PipelineStage)
        .filter(PipelineStage.id == payload.pipeline_stage_id, PipelineStage.workspace_id == context.workspace_id)
        .first()
    )
    if stage is None:
        raise HTTPException(status_code=404, detail='Pipeline stage not found')

    deal = Deal(
        workspace_id=context.workspace_id,
        company_id=payload.company_id,
        contact_id=payload.contact_id,
        pipeline_stage_id=payload.pipeline_stage_id,
        title=payload.title.strip(),
        value=payload.value,
        status=payload.status,
        close_date=payload.close_date,
        notes=payload.notes,
        created_by=context.user_id,
        updated_by=context.user_id,
    )
    if payload.status in {'closed_won', 'closed_lost'}:
        deal.closed_at = datetime.now(timezone.utc)
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return _deal_response(deal)


@router.get('/deals', response_model=list[DealResponse])
def list_deals(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[DealResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.deals.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.deals.view')

    deals = (
        db.query(Deal)
        .filter(Deal.workspace_id == context.workspace_id)
        .order_by(Deal.updated_at.desc())
        .all()
    )
    return [_deal_response(item) for item in deals]


@router.patch('/deals/{deal_id}', response_model=DealResponse)
def update_deal(
    deal_id: str,
    payload: DealUpdateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DealResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.deals.edit'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.deals.edit')

    deal = db.query(Deal).filter(Deal.id == uuid.UUID(deal_id), Deal.workspace_id == context.workspace_id).first()
    if deal is None:
        raise HTTPException(status_code=404, detail='Deal not found')

    if payload.title is not None:
        deal.title = payload.title.strip()
    if payload.company_id is not None:
        deal.company_id = payload.company_id
    if payload.contact_id is not None:
        deal.contact_id = payload.contact_id
    if payload.pipeline_stage_id is not None:
        deal.pipeline_stage_id = payload.pipeline_stage_id
    if payload.value is not None:
        deal.value = payload.value
    if payload.status is not None:
        deal.status = payload.status
        if payload.status in {'closed_won', 'closed_lost'} and deal.closed_at is None:
            deal.closed_at = datetime.now(timezone.utc)
    if payload.close_date is not None:
        deal.close_date = payload.close_date
    if payload.notes is not None:
        deal.notes = payload.notes
    deal.updated_by = context.user_id
    deal.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(deal)
    return _deal_response(deal)


@router.delete('/deals/{deal_id}')
def delete_deal(
    deal_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.deals.delete'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.deals.delete')

    deal = db.query(Deal).filter(Deal.id == uuid.UUID(deal_id), Deal.workspace_id == context.workspace_id).first()
    if deal is None:
        raise HTTPException(status_code=404, detail='Deal not found')

    db.delete(deal)
    db.commit()
    return {'status': 'deleted'}


@router.post('/deals/{deal_id}/convert-to-project', response_model=DealConversionResponse)
def convert_deal_to_project(
    deal_id: str,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DealConversionResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.deals.convert'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.deals.convert')

    deal = db.query(Deal).filter(Deal.id == uuid.UUID(deal_id), Deal.workspace_id == context.workspace_id).first()
    if deal is None:
        raise HTTPException(status_code=404, detail='Deal not found')

    if deal.linked_project_id is None:
        project = Project(
            workspace_id=context.workspace_id,
            name=f'{deal.title} Implementation',
            description=f'Auto-created from CRM deal {deal.title}',
            status='planning',
            color='#0ea5e9',
            owner_id=context.user_id,
            created_by=context.user_id,
        )
        db.add(project)
        db.flush()
        deal.linked_project_id = project.id
        deal.status = 'closed_won'
        if deal.closed_at is None:
            deal.closed_at = datetime.now(timezone.utc)

    db.commit()
    return DealConversionResponse(deal_id=deal.id, project_id=deal.linked_project_id)


@router.post('/interactions', response_model=CRMInteractionResponse)
def create_interaction(
    payload: CRMInteractionCreateRequest,
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CRMInteractionResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.interactions.create'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.interactions.create')

    interaction = CRMInteraction(
        workspace_id=context.workspace_id,
        contact_id=payload.contact_id,
        company_id=payload.company_id,
        deal_id=payload.deal_id,
        type=payload.type,
        summary=payload.summary,
        metadata_json=payload.metadata_json,
        created_by=context.user_id,
    )
    db.add(interaction)

    if payload.contact_id is not None:
        contact = (
            db.query(Contact)
            .filter(Contact.id == payload.contact_id, Contact.workspace_id == context.workspace_id)
            .first()
        )
        if contact is not None:
            contact.last_interaction_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(interaction)
    return CRMInteractionResponse(
        id=interaction.id,
        workspace_id=interaction.workspace_id,
        contact_id=interaction.contact_id,
        company_id=interaction.company_id,
        deal_id=interaction.deal_id,
        type=interaction.type,
        summary=interaction.summary,
        metadata_json=interaction.metadata_json or {},
        created_by=interaction.created_by,
        created_at=interaction.created_at,
    )


@router.get('/interactions', response_model=list[CRMInteractionResponse])
def list_interactions(
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[CRMInteractionResponse]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.interactions.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.interactions.view')

    rows = (
        db.query(CRMInteraction)
        .filter(CRMInteraction.workspace_id == context.workspace_id)
        .order_by(CRMInteraction.created_at.desc())
        .all()
    )
    return [
        CRMInteractionResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            contact_id=item.contact_id,
            company_id=item.company_id,
            deal_id=item.deal_id,
            type=item.type,
            summary=item.summary,
            metadata_json=item.metadata_json or {},
            created_by=item.created_by,
            created_at=item.created_at,
        )
        for item in rows
    ]


@router.post('/guest-sessions/auto-log', response_model=CRMInteractionResponse)
def auto_log_guest_session(
    guest_count: int = Query(ge=1),
    summary: str = Query(default='Guest session in spatial room'),
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CRMInteractionResponse:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.interactions.create'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.interactions.create')

    interaction = CRMInteraction(
        workspace_id=context.workspace_id,
        contact_id=None,
        company_id=None,
        deal_id=None,
        type='guest_session_prompt',
        summary=summary,
        metadata_json={'guest_count': guest_count, 'prompt': 'Please log CRM notes for this guest session.'},
        created_by=context.user_id,
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return CRMInteractionResponse(
        id=interaction.id,
        workspace_id=interaction.workspace_id,
        contact_id=interaction.contact_id,
        company_id=interaction.company_id,
        deal_id=interaction.deal_id,
        type=interaction.type,
        summary=interaction.summary,
        metadata_json=interaction.metadata_json or {},
        created_by=interaction.created_by,
        created_at=interaction.created_at,
    )


@router.post('/stale-contacts/run')
def run_stale_contact_scheduler(
    days: int = Query(default=30, ge=1, le=365),
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.interactions.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.interactions.view')

    threshold = datetime.now(timezone.utc) - timedelta(days=days)
    contacts = db.query(Contact).filter(Contact.workspace_id == context.workspace_id).all()

    created = 0
    for contact in contacts:
        last_touch = _as_utc(contact.last_interaction_at)
        stale = last_touch is None or last_touch < threshold
        if not stale:
            continue

        title = f'Stale contact follow-up: {contact.name}'
        exists = (
            db.query(Notification)
            .filter(
                Notification.workspace_id == context.workspace_id,
                Notification.user_id == context.user_id,
                Notification.title == title,
            )
            .first()
        )
        if exists is not None:
            continue

        db.add(
            Notification(
                workspace_id=context.workspace_id,
                user_id=context.user_id,
                title=title,
                body='No recent interaction logged for this contact.',
                priority='normal',
                related_task_id=None,
            )
        )
        created += 1

    db.commit()
    return {'created': created}


@router.get('/reports/pipeline-summary', response_model=list[PipelineSummaryRow])
def pipeline_summary_report(
    format: str | None = Query(default=None),
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
):
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.reports.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.reports.view')

    rows = (
        db.query(PipelineStage.id, PipelineStage.name, func.count(Deal.id), func.coalesce(func.sum(Deal.value), 0))
        .outerjoin(
            Deal,
            (Deal.pipeline_stage_id == PipelineStage.id)
            & (Deal.workspace_id == context.workspace_id)
            & (Deal.status == 'open'),
        )
        .filter(PipelineStage.workspace_id == context.workspace_id)
        .group_by(PipelineStage.id, PipelineStage.name)
        .order_by(PipelineStage.order_index.asc())
        .all()
    )

    data = [
        PipelineSummaryRow(
            stage_id=item[0],
            stage_name=item[1],
            deal_count=int(item[2] or 0),
            total_value=float(item[3] or 0),
        )
        for item in rows
    ]

    if format == 'csv':
        return _csv_response(
            [
                {
                    'stage_id': row.stage_id,
                    'stage_name': row.stage_name,
                    'deal_count': row.deal_count,
                    'total_value': row.total_value,
                }
                for row in data
            ],
            ['stage_id', 'stage_name', 'deal_count', 'total_value'],
        )
    return data


@router.get('/reports/win-rate', response_model=WinRateResponse)
def win_rate_report(
    format: str | None = Query(default=None),
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
):
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.reports.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.reports.view')

    won_count = (
        db.query(func.count(Deal.id))
        .filter(Deal.workspace_id == context.workspace_id, Deal.status == 'closed_won')
        .scalar()
    )
    lost_count = (
        db.query(func.count(Deal.id))
        .filter(Deal.workspace_id == context.workspace_id, Deal.status == 'closed_lost')
        .scalar()
    )
    won = int(won_count or 0)
    lost = int(lost_count or 0)
    total = won + lost
    win_rate = (won / total * 100.0) if total else 0.0

    payload = WinRateResponse(
        won_count=won,
        lost_count=lost,
        total_closed=total,
        win_rate_percent=round(win_rate, 2),
    )
    if format == 'csv':
        return _csv_response(
            [payload.model_dump()],
            ['won_count', 'lost_count', 'total_closed', 'win_rate_percent'],
        )
    return payload


@router.get('/reports/avg-cycle-time', response_model=AvgDealCycleResponse)
def avg_cycle_time_report(
    format: str | None = Query(default=None),
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
):
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.reports.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.reports.view')

    deals = (
        db.query(Deal)
        .filter(
            Deal.workspace_id == context.workspace_id,
            Deal.status.in_(['closed_won', 'closed_lost']),
            Deal.closed_at.is_not(None),
        )
        .all()
    )

    if not deals:
        payload = AvgDealCycleResponse(closed_deals=0, average_days=0)
    else:
        durations = []
        for deal in deals:
            closed_at = _as_utc(deal.closed_at)
            created_at = _as_utc(deal.created_at)
            if closed_at is None or created_at is None:
                continue
            durations.append((closed_at - created_at).total_seconds() / 86400)
        avg_days = sum(durations) / len(durations) if durations else 0
        payload = AvgDealCycleResponse(closed_deals=len(durations), average_days=round(avg_days, 2))

    if format == 'csv':
        return _csv_response([payload.model_dump()], ['closed_deals', 'average_days'])
    return payload


@router.get('/reports/revenue-forecast', response_model=RevenueForecastResponse)
def revenue_forecast_report(
    format: str | None = Query(default=None),
    workspace_id: str = Path(...),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
):
    workspace_uuid = uuid.UUID(workspace_id)
    if not check_permission(db, context.user_id, workspace_uuid, 'crm.reports.view'):
        raise HTTPException(status_code=403, detail='Missing permission: crm.reports.view')

    rows = (
        db.query(Deal.value, PipelineStage.probability_percent)
        .join(PipelineStage, PipelineStage.id == Deal.pipeline_stage_id)
        .filter(Deal.workspace_id == context.workspace_id, Deal.status == 'open')
        .all()
    )
    weighted = sum(float(value or 0) * (float(prob or 0) / 100.0) for value, prob in rows)
    payload = RevenueForecastResponse(weighted_open_value=round(weighted, 2))

    if format == 'csv':
        return _csv_response([payload.model_dump()], ['weighted_open_value'])
    return payload
