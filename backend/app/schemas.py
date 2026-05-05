import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    app: str


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    color: str = Field(default='#2563eb', min_length=4, max_length=12)


class ProjectResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str | None
    status: str
    color: str
    owner_id: uuid.UUID
    created_by: uuid.UUID


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    subdomain: str
    plan: str
    timezone: str
    owner_id: uuid.UUID


class WorkspaceUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    plan: str | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=100)


class RoleResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    color: str
    permissions: list[str]
    is_system: bool


class RoleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default='#64748b', min_length=4, max_length=12)
    permissions: list[str] = Field(default_factory=list)


class RoleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, min_length=4, max_length=12)
    permissions: list[str] | None = None


class RoleAssignRequest(BaseModel):
    user_id: uuid.UUID


class MemberResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID
    status: str


class MemberInviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    role_id: uuid.UUID | None = None


class PermissionOverrideRequest(BaseModel):
    user_id: uuid.UUID
    permission: str = Field(min_length=3, max_length=120)
    expires_at: datetime | None = None


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = None
    color: str | None = Field(default=None, min_length=4, max_length=12)
    owner_id: uuid.UUID | None = None


class SprintCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    goal: str | None = None
    status: str = 'planned'
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = None
    status: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintCompleteRequest(BaseModel):
    carry_over_task_ids: list[uuid.UUID] = Field(default_factory=list)
    target_sprint_id: uuid.UUID | None = None


class SprintResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    goal: str | None
    status: str
    start_date: datetime | None
    end_date: datetime | None


class MilestoneCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_at: datetime | None = None
    status: str = 'open'


class MilestoneUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    due_at: datetime | None = None
    status: str | None = None


class MilestoneResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str | None
    due_at: datetime | None
    status: str


class ProjectStatusColumnCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(default='#64748b', min_length=4, max_length=12)
    order_index: int = 0
    is_done: bool = False


class ProjectStatusColumnUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, min_length=4, max_length=12)
    order_index: int | None = None
    is_done: bool | None = None


class ProjectStatusColumnResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    color: str
    order_index: int
    is_done: bool


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: str = 'todo'
    priority: str = 'medium'
    order_index: float = 0
    estimate_minutes: int | None = None
    due_at: datetime | None = None
    assignee_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None
    parent_task_id: uuid.UUID | None = None
    status_column_id: uuid.UUID | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    order_index: float | None = None
    estimate_minutes: int | None = None
    due_at: datetime | None = None
    assignee_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None
    status_column_id: uuid.UUID | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID | None
    sprint_id: uuid.UUID | None
    parent_task_id: uuid.UUID | None
    status_column_id: uuid.UUID | None
    title: str
    description: str | None
    status: str
    priority: str
    order_index: float
    estimate_minutes: int | None
    due_at: datetime | None
    assignee_id: uuid.UUID | None
    created_by: uuid.UUID


class TaskReorderRequest(BaseModel):
    ordered_task_ids: list[uuid.UUID]


class TaskCommentCreateRequest(BaseModel):
    body: str = Field(min_length=1)


class TaskCommentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    body: str
    mentions: list[str]


class TimeLogCreateRequest(BaseModel):
    minutes: int = Field(gt=0, le=24 * 60)
    note: str | None = None


class TimeLogResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    minutes: int
    note: str | None


class TimeSummaryResponse(BaseModel):
    task_id: uuid.UUID
    total_minutes: int
    by_user: dict[uuid.UUID, int]


class AdminSignupRequest(BaseModel):
    workspace_name: str = Field(min_length=1, max_length=255)
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    workspace_name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'
    workspace_id: uuid.UUID
    workspace_name: str
    user_id: uuid.UUID
    user_name: str
    role_name: str
    permissions: list[str]
    must_reset_password: bool


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class PasswordResetRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AdminUserCreateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    username: str | None = Field(default=None, min_length=3, max_length=120)
    role_id: uuid.UUID | None = None
    permissions: list[str] = Field(default_factory=list)
    temporary_password: str = Field(min_length=8, max_length=128)


class AdminUserUpdateRequest(BaseModel):
    role_id: uuid.UUID | None = None
    status: str | None = None
    permissions: list[str] | None = None


class AdminPasswordResetRequest(BaseModel):
    temporary_password: str = Field(min_length=8, max_length=128)


class AdminUserResponse(BaseModel):
    user_id: uuid.UUID
    workspace_member_id: uuid.UUID
    username: str | None
    name: str
    email: str
    role_id: uuid.UUID
    role_name: str
    status: str
    must_reset_password: bool


class TaskDependencyCreateRequest(BaseModel):
    predecessor_task_id: uuid.UUID
    successor_task_id: uuid.UUID


class TaskDependencyResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID
    predecessor_task_id: uuid.UUID
    successor_task_id: uuid.UUID


class BurndownSnapshotResponse(BaseModel):
    id: uuid.UUID
    sprint_id: uuid.UUID
    snapshot_date: datetime
    planned_points: int
    completed_points: int
    remaining_points: int


class VelocityPointResponse(BaseModel):
    sprint_id: uuid.UUID
    sprint_name: str
    completed_points: int


class TaskActivityResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    action: str
    old_value: str | None
    new_value: str | None
    created_at: datetime


class NotificationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str | None
    priority: str
    is_read: bool
    related_task_id: uuid.UUID | None
    created_at: datetime


class DocTemplateCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    category: str = Field(default='general', min_length=1, max_length=80)
    default_content: dict = Field(default_factory=dict)


class DocTemplateUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=80)
    default_content: dict | None = None


class DocTemplateResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str | None
    category: str
    default_content: dict
    is_system: bool


class DocCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content_json: dict = Field(default_factory=dict)
    parent_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    is_private: bool = False
    is_requirements_doc: bool = False


class DocUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content_json: dict | None = None
    parent_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    is_private: bool | None = None


class DocResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    template_id: uuid.UUID | None
    title: str
    content_json: dict
    status: str
    is_private: bool
    is_requirements_doc: bool
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    created_by: uuid.UUID
    updated_by: uuid.UUID
    updated_at: datetime


class DocVersionResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    doc_id: uuid.UUID
    version_number: int
    title: str
    content_json: dict
    edited_by: uuid.UUID
    created_at: datetime


class PromoteDocStoryRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    project_id: uuid.UUID
    assignee_id: uuid.UUID | None = None


class CompanyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class CompanyUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class CompanyResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    website: str | None
    industry: str | None
    notes: str | None


class ContactCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    company_id: uuid.UUID | None = None
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=60)
    title: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class ContactUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    company_id: uuid.UUID | None = None
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=60)
    title: str | None = Field(default=None, max_length=120)
    last_interaction_at: datetime | None = None
    notes: str | None = None


class ContactResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    company_id: uuid.UUID | None
    name: str
    email: str | None
    phone: str | None
    title: str | None
    last_interaction_at: datetime | None
    notes: str | None


class PipelineStageCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    order_index: int = 0
    probability_percent: int = Field(default=0, ge=0, le=100)
    is_closed: bool = False


class PipelineStageUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    order_index: int | None = None
    probability_percent: int | None = Field(default=None, ge=0, le=100)
    is_closed: bool | None = None


class PipelineStageResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    order_index: int
    probability_percent: int
    is_closed: bool


class DealCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    pipeline_stage_id: uuid.UUID
    value: float = Field(default=0, ge=0)
    status: str = 'open'
    close_date: datetime | None = None
    notes: str | None = None


class DealUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    pipeline_stage_id: uuid.UUID | None = None
    value: float | None = Field(default=None, ge=0)
    status: str | None = None
    close_date: datetime | None = None
    notes: str | None = None


class DealResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    company_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    pipeline_stage_id: uuid.UUID
    linked_project_id: uuid.UUID | None
    title: str
    value: float
    status: str
    close_date: datetime | None
    closed_at: datetime | None
    notes: str | None


class CRMInteractionCreateRequest(BaseModel):
    contact_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    type: str = Field(default='note', min_length=1, max_length=64)
    summary: str = Field(min_length=1)
    metadata_json: dict = Field(default_factory=dict)


class CRMInteractionResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    contact_id: uuid.UUID | None
    company_id: uuid.UUID | None
    deal_id: uuid.UUID | None
    type: str
    summary: str
    metadata_json: dict
    created_by: uuid.UUID
    created_at: datetime


class DealConversionResponse(BaseModel):
    deal_id: uuid.UUID
    project_id: uuid.UUID


class PipelineSummaryRow(BaseModel):
    stage_id: uuid.UUID
    stage_name: str
    deal_count: int
    total_value: float


class WinRateResponse(BaseModel):
    won_count: int
    lost_count: int
    total_closed: int
    win_rate_percent: float


class AvgDealCycleResponse(BaseModel):
    closed_deals: int
    average_days: float


class RevenueForecastResponse(BaseModel):
    weighted_open_value: float
