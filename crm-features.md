# MetaSpace — Feature Implementation Specification
**Version:** 1.1 (Gap-fill update — requirements status workflow, doc template builder, CRM reporting)  
**Platform:** Multi-tenant 2D spatial virtual collaboration platform  
**Audience:** AI agent or developer implementing these features from scratch  
**Reading order:** Implement phases in order. Phase 1 is a hard prerequisite for all others.

---

## Table of Contents
1. [Platform Context](#1-platform-context)
2. [Data Architecture Overview](#2-data-architecture-overview)
3. [Phase 1 — Identity, Tenancy & Permissions](#3-phase-1--identity-tenancy--permissions)
4. [Phase 2 — Project Management (Scrum + Gantt)](#4-phase-2--project-management-scrum--gantt)
5. [Phase 3 — Task Lifecycle & Assignments](#5-phase-3--task-lifecycle--assignments)
6. [Phase 4 — Docs, Requirements & Knowledge Base](#6-phase-4--docs-requirements--knowledge-base)
7. [Phase 5 — CRM Tools](#7-phase-5--crm-tools)
8. [Spatial World Integration](#8-spatial-world-integration)
9. [Permission Matrix Reference](#9-permission-matrix-reference)
10. [Implementation Rules & Constraints](#10-implementation-rules--constraints)

---

## 1. Platform Context

MetaSpace is a **browser-based 2D top-down virtual office** (Gather.town-style) where users are represented as pixel-art avatars on a tile-based map. The existing platform has:

- A 2D canvas world with avatar movement (WASD/arrow keys)
- Proximity-based WebRTC audio/video (avatars near each other auto-connect)
- Interactive objects on the map (press X to interact)
- Rooms as sub-areas of the map with their own rules
- A React DOM overlay for all UI (topbar, sidebar, modals, chat)
- Real-time WebSocket connections per workspace

The new features described in this document are layered on top of this existing foundation. They are accessible via:
- **Topbar buttons** (visible from anywhere in the world)
- **A dedicated "Project Management" room** on the 2D map
- **Interactive map objects** that open specific panels

---

## 2. Data Architecture Overview

### 2.1 Hierarchy

```
Workspace (tenant root)
├── Members (users with roles)
├── Roles (custom permission sets)
├── Projects
│   ├── Project Members (with optional role overrides)
│   ├── Sprints
│   ├── Tasks (project-scoped)
│   ├── Milestones
│   └── Docs (project-scoped)
├── Tasks (personal, no project)
├── Docs (workspace-scoped)
├── CRM
│   ├── Contacts
│   ├── Companies
│   └── Deals
└── Notifications
```

### 2.2 Tenancy Rule

**Every single DB query must be scoped by `workspace_id`.** No exceptions. Data must never leak between workspaces. Apply this as a middleware check on every API route.

### 2.3 Core ID Convention

All entities use UUID v4 primary keys. Foreign keys are named `{entity}_id` (e.g. `project_id`, `user_id`).

---

## 3. Phase 1 — Identity, Tenancy & Permissions

> **This phase must be completed before any other phase begins.** Every feature in this spec gates against the permission system built here.

### 3.1 Workspace Entity

```
workspace {
  id: uuid PK
  name: string (e.g. "Acme Corp")
  subdomain: string UNIQUE (e.g. "acme" → acme.metaspace.io)
  owner_id: uuid FK → users
  plan: enum [free, pro, enterprise]
  settings: jsonb {
    timezone: string,
    branding: { logo_url, primary_color },
    feature_flags: { crm_enabled: bool, docs_enabled: bool }
  }
  created_at: timestamp
}
```

### 3.2 User Entity

```
user {
  id: uuid PK
  email: string UNIQUE
  name: string
  avatar_url: string
  created_at: timestamp
}
```

### 3.3 Workspace Membership

```
workspace_member {
  id: uuid PK
  workspace_id: uuid FK → workspace
  user_id: uuid FK → user
  role_id: uuid FK → role        ← primary workspace role
  status: enum [active, invited, suspended]
  invited_by: uuid FK → user
  joined_at: timestamp
}
```

### 3.4 Custom Role Entity

```
role {
  id: uuid PK
  workspace_id: uuid FK → workspace
  name: string (e.g. "Senior Manager", "QA Lead")
  color: string (hex, for avatar badge display)
  permissions: string[]          ← flat array of permission strings (see §9)
  is_system: bool                ← true for seeded default roles (cannot be deleted)
  created_by: uuid FK → user
  created_at: timestamp
}
```

### 3.5 Seeded Default Roles

These roles are automatically created when a workspace is provisioned. They cannot be deleted (`is_system: true`) but CAN be renamed and their permissions can be edited by workspace Owner.

| Role | Access Level | Notes |
|---|---|---|
| **Owner** | All permissions | One per workspace, auto-assigned to creator. Cannot be reassigned or deleted. |
| **Admin** | All permissions except `workspace.billing` and `workspace.delete` | Super access — can manage roles, members, all features. Can grant/revoke any permission to any non-Owner role. |
| **Manager** | Project, task, sprint, milestone, CRM, docs full access. Member management (invite/remove). Cannot edit roles. | CRM access included by default. |
| **Member** | Create/edit own tasks, view project boards, comment on docs, view (not edit) CRM if explicitly granted. | Standard team member. |
| **Guest** | Read-only on projects/tasks/docs they are explicitly added to. No CRM access ever. | External collaborators. |

### 3.6 Permission Grant Mechanism (Admin & Manager)

This is the core access-control UI. It works at two levels:

#### Level 1: Role-level permissions (Admin only)

Admins can edit which permissions any role (except Owner) has. UI: **Workspace Settings → Roles → [Role Name] → Permissions**.

- Shows a grouped list of all permissions (see §9)
- Each permission is a toggle (on/off)
- Changes apply to ALL members with that role immediately
- Admin cannot grant a permission they themselves don't have (cannot escalate beyond own access)
- Owner role permissions are read-only (all always enabled)

#### Level 2: Per-user permission grants (Admin + Manager)

Beyond the role's base permissions, an Admin or Manager can grant specific additional permissions to an individual user — or revoke specific permissions from them — without changing their role.

```
user_permission_override {
  id: uuid PK
  workspace_id: uuid FK → workspace
  user_id: uuid FK → user
  permission: string             ← single permission string
  type: enum [grant, revoke]     ← 'grant' adds beyond role; 'revoke' removes from role
  granted_by: uuid FK → user     ← must be Admin or Manager
  expires_at: timestamp nullable ← optional time-limited grants
  created_at: timestamp
}
```

**Resolution logic (in order):**
1. If user has a `revoke` override for permission → **DENY**
2. If user has a `grant` override for permission → **ALLOW**
3. If user's role includes permission → **ALLOW**
4. → **DENY**

#### Level 3: Project-level role override

A user can have a different role within a specific project than their workspace role. Example: a Member can be a Manager within Project X.

```
project_member {
  id: uuid PK
  project_id: uuid FK → project
  user_id: uuid FK → user
  role_id: uuid FK → role nullable   ← if set, overrides workspace role for this project
  added_by: uuid FK → user
  added_at: timestamp
}
```

Permission check for project-scoped actions:
1. Check project_member.role_id override (if exists) → use that role's permissions
2. Else fall back to workspace_member.role_id
3. Apply user_permission_override on top

#### Permission check utility

Implement this as a single reusable function called on every API endpoint and UI conditional:

```typescript
async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: string,
  projectId?: string   // optional — for project-scoped checks
): Promise<boolean>
```

**This function must be called server-side on every mutation endpoint.** Client-side checks are only for UI rendering (show/hide buttons). Never trust client-side permission checks for data mutations.

### 3.7 Permission Grant UI — Step by Step

**To grant a specific permission to a user (Admin or Manager doing this):**

1. Go to **Workspace Settings → Members → [User] → Permissions**
2. See the user's current role and its permissions (read-only, greyed out)
3. Below that: "Additional grants" section — search/select permission to add
4. Optionally set expiry date
5. Save — creates `user_permission_override` with `type: grant`

**To give a user CRM access (special case, since CRM is Manager+ only):**

1. User must be at least Member role
2. Admin or Manager goes to Member's profile → Permissions → grant `crm.view` and optionally `crm.edit`
3. Alternatively, promote user to Manager role

**CRM access rule:**
- `crm.view` and all `crm.*` permissions are NOT included in Member or Guest roles
- They CAN be individually granted to a Member via the override mechanism above
- Guest role can NEVER receive any `crm.*` permission — hard block in the permission check function

### 3.8 Spatial: Role Visibility in 2D World

- Avatar nameplates show a colored role badge below the username (use `role.color`)
- Badge text: role name, truncated to 12 characters
- Role-restricted rooms: "Project Management" room and "CRM" room have door objects that check `checkPermission(userId, workspaceId, 'room.pm_access')` and `room.crm_access` respectively
- Locked room door shows a padlock icon; on hover: tooltip "Requires [Role Name] access"

---

## 4. Phase 2 — Project Management (Scrum + Gantt)

### 4.1 Project Entity

```
project {
  id: uuid PK
  workspace_id: uuid FK → workspace
  name: string
  description: text
  status: enum [planning, active, on_hold, completed, archived]
  color: string (hex, for UI labeling)
  icon_emoji: string nullable
  start_date: date nullable
  end_date: date nullable
  owner_id: uuid FK → user
  created_by: uuid FK → user
  created_at: timestamp
  updated_at: timestamp
}
```

Required permissions: `project.create`, `project.view`, `project.edit`, `project.delete`, `project.archive`

### 4.2 Milestone Entity

```
milestone {
  id: uuid PK
  project_id: uuid FK → project
  workspace_id: uuid FK → workspace
  name: string
  description: text nullable
  due_date: date
  status: enum [upcoming, at_risk, achieved, missed]
  color: string (hex)
  created_by: uuid FK → user
}
```

Milestones appear as diamond markers on the Gantt timeline.

### 4.3 Sprint Entity

```
sprint {
  id: uuid PK
  project_id: uuid FK → project
  workspace_id: uuid FK → workspace
  name: string (e.g. "Sprint 4")
  goal: text nullable
  start_date: date
  end_date: date
  status: enum [planning, active, completed, cancelled]
  capacity_points: integer nullable
  completed_points: integer           ← computed from completed tasks
  created_by: uuid FK → user
}
```

**Sprint rules:**
- Only one sprint per project can have `status: active` at a time
- Tasks can only be in one sprint at a time (`task.sprint_id`)
- Completing a sprint does NOT auto-close its tasks — manager reviews and carries over incomplete tasks to next sprint manually
- `completed_points` is a computed/denormalised field updated whenever a task in the sprint is marked Done

### 4.4 Sprint Board (Kanban View)

- Columns map to task statuses for the active sprint
- Default columns: **Backlog | To Do | In Progress | In Review | Done**
- Columns are customisable per project (add/rename/reorder/delete, but must keep at least one terminal "done" column)
- Drag tasks between columns → updates `task.status`
- Each card shows: title, assignee avatar(s), priority badge, story points, due date if set
- "Start Sprint" button (Manager+ only): moves sprint from `planning` → `active`, sends in-world notification to all project members
- "Complete Sprint" button: opens a modal showing incomplete tasks with option to move them to backlog or next sprint

### 4.5 Backlog View

- List of all tasks in the project with `sprint_id: null` (not yet assigned to a sprint)
- Sorted by priority (Critical → High → Medium → Low) by default, draggable to reorder
- Each row: checkbox | priority | title | assignee | story points | labels
- Multi-select tasks → "Add to Sprint" dropdown
- "Create Task" button at top of backlog

### 4.6 Gantt / Timeline View

**Scope:** Finish-to-start dependencies only. No other dependency types.

#### Layout
- Horizontal scrollable view
- Left panel (fixed, 280px wide): task/milestone list tree (grouped by sprint)
- Right panel (scrollable): timeline bars
- Header row: date scale — switchable between Day / Week / Month views
- Today line: vertical red line at current date

#### Task bars
- Each task renders as a horizontal bar from `task.start_date` to `task.due_date`
- Bar color: assignee's avatar color, OR project color if unassigned
- Bar height: 28px, vertical gap between bars: 8px
- Draggable horizontally → updates `start_date` and `due_date` (preserves duration)
- Right-edge resizable → updates `due_date` only
- Click bar → opens task detail panel

#### Milestone markers
- Diamond shape (◆) at `milestone.due_date` on the timeline
- Color from `milestone.color`
- Hover tooltip: milestone name + status
- Click → opens milestone detail modal

#### Sprint bands
- Shaded background zones showing each sprint's date range
- Light fill (10% opacity of project color), labeled with sprint name at top of band
- Sprint bands do not block interaction with task bars underneath

#### Dependency arrows (finish-to-start only)
- A dependency means: Task B cannot start until Task A is finished
- Arrow drawn from the right edge of Task A's bar to the left edge of Task B's bar
- Arrow style: thin (1px), gray, with arrowhead
- If dependency creates a scheduling conflict (B's start_date < A's due_date), highlight both bars in amber and show warning tooltip
- No dependency cycles allowed — validate on save

```
task_dependency {
  id: uuid PK
  workspace_id: uuid FK → workspace
  predecessor_task_id: uuid FK → task    ← Task A (must finish first)
  successor_task_id: uuid FK → task      ← Task B (starts after)
  created_by: uuid FK → user
}
```

### 4.7 Burndown Chart

- X-axis: days in the sprint (start → end)
- Y-axis: remaining story points
- Ideal line: straight diagonal from total points on day 1 to 0 on last day
- Actual line: computed from daily snapshots of `completed_points`
- Rendered as SVG line chart in the "Reports" panel
- Store daily snapshots:

```
sprint_burndown_snapshot {
  id: uuid PK
  sprint_id: uuid FK → sprint
  date: date
  remaining_points: integer
  completed_points: integer
}
```

Take a snapshot once per day at midnight UTC via a scheduled job (or on-demand when a task is completed, update today's snapshot).

### 4.8 Velocity Chart

- Bar chart: one bar per completed sprint, height = `completed_points`
- Shows last 6 sprints by default
- Rendered in the "Reports" panel alongside burndown

### 4.9 Topbar Integration

Add a "Projects" button to the existing topbar. On click:
- Opens a right-side panel with list of projects the user is a member of
- Each project card: name, status badge, sprint progress bar (X/Y points), open task count
- "New Project" button (requires `project.create` permission)
- Click a project → navigate into the project (sprint board is the default view)

---

## 5. Phase 3 — Task Lifecycle & Assignments

### 5.1 Task Entity (Unified)

This single entity covers both project tasks and personal tasks.

```
task {
  id: uuid PK
  workspace_id: uuid FK → workspace
  project_id: uuid FK → project NULLABLE        ← null = personal task
  sprint_id: uuid FK → sprint NULLABLE          ← null = backlog or personal
  parent_task_id: uuid FK → task NULLABLE       ← for subtasks
  
  title: string
  description: jsonb                            ← rich text (Tiptap JSON format)
  type: enum [story, task, bug, subtask]
  status: string                                ← references project's custom status columns
  priority: enum [critical, high, medium, low, none]
  
  assignee_ids: uuid[]                          ← multiple assignees allowed
  reporter_id: uuid FK → user
  
  start_date: date nullable                     ← used for Gantt bars
  due_date: date nullable
  estimate_points: integer nullable             ← story points for Scrum
  
  tags: string[]
  attachments: jsonb[]                          ← [{ name, url, size, type, uploaded_by, uploaded_at }]
  
  created_by: uuid FK → user
  created_at: timestamp
  updated_at: timestamp
  completed_at: timestamp nullable
}
```

**Key constraint:** If `project_id` is null, `sprint_id` must also be null.

### 5.2 Task Status

- Personal tasks use a fixed status set: `todo | in_progress | done`
- Project tasks use the project's custom status columns (from §4.4)
- Status is stored as a string matching the column name, not an enum — this allows custom columns

### 5.3 Task Activity Log

Every change to a task is recorded:

```
task_activity {
  id: uuid PK
  task_id: uuid FK → task
  workspace_id: uuid FK → workspace
  user_id: uuid FK → user
  type: enum [created, status_changed, assigned, unassigned, comment, priority_changed, due_date_changed, sprint_changed, attachment_added, subtask_added]
  old_value: jsonb nullable
  new_value: jsonb nullable
  created_at: timestamp
}
```

Render the activity log in the task detail panel as a chronological feed, newest at bottom.

### 5.4 Task Comments

```
task_comment {
  id: uuid PK
  task_id: uuid FK → task
  workspace_id: uuid FK → workspace
  author_id: uuid FK → user
  content: text                               ← plain text with @mention parsing
  mentions: uuid[]                            ← user IDs extracted from @mentions
  created_at: timestamp
  updated_at: timestamp nullable
  deleted_at: timestamp nullable              ← soft delete
}
```

**@mention behavior:** When a comment is saved, parse `@username` patterns, resolve to user IDs, store in `mentions[]`, and create a notification for each mentioned user.

### 5.5 Time Tracking

```
time_log {
  id: uuid PK
  task_id: uuid FK → task
  workspace_id: uuid FK → workspace
  user_id: uuid FK → user
  hours: decimal
  description: string nullable
  logged_date: date
  created_at: timestamp
}
```

In the task detail panel: show "Time Tracked" section with total hours logged vs estimated. Button to "Log Time" opens a small form.

### 5.6 Subtasks

- A subtask is a task with `parent_task_id` set
- Subtasks inherit `project_id` and `sprint_id` from parent
- On the parent task card (in board/list views): show a progress indicator "3/5 subtasks done"
- Subtasks can have their own assignees, due dates, and status
- Subtasks cannot have their own subtasks (max one level of nesting)

### 5.7 "My Work" Dashboard

Accessible via topbar "My Work" button (visible to all roles). Shows everything assigned to the current user.

**Sections (in order):**
1. **Overdue** — tasks with `due_date < today` and status not done (red badge)
2. **Due Today** — tasks with `due_date = today`
3. **This Week** — tasks due within the next 7 days
4. **Upcoming** — tasks due after next 7 days
5. **Personal Tasks** — all personal tasks (project_id = null), grouped by status
6. **Watching** — tasks the user has commented on or explicitly followed but is not assigned to

Each item shows: project name (if applicable), task title, priority, due date, status.

Quick-add bar at top: "Add personal task" creates a task with project_id = null.

### 5.8 Notification System

```
notification {
  id: uuid PK
  workspace_id: uuid FK → workspace
  recipient_id: uuid FK → user
  type: enum [task_assigned, task_mentioned, task_due_soon, task_overdue, sprint_started, sprint_completed, comment_reply, project_added]
  entity_type: string (e.g. "task", "sprint", "project")
  entity_id: uuid
  message: string
  is_read: bool DEFAULT false
  created_at: timestamp
}
```

**In-world delivery:**
- Bell icon in topbar with unread count badge
- New notification → brief green pulse ring animation around the user's own avatar (same mechanic as proximity enter)
- Toast notification in bottom-right for high-priority notifications (task_assigned, sprint_started)
- Due-soon reminder: trigger at 24h and 1h before `due_date`

### 5.9 Required Permissions for Tasks

| Action | Permission |
|---|---|
| Create task in project | `task.create` |
| Create personal task | `task.create_personal` (all roles except Guest) |
| Edit own tasks | `task.edit_own` |
| Edit any task in project | `task.edit_any` |
| Assign tasks to others | `task.assign_others` |
| Delete tasks | `task.delete` |
| Log time on any task | `task.log_time` |
| View all tasks in project | `task.view` |

---

## 6. Phase 4 — Docs, Requirements & Knowledge Base

### 6.1 Technology Stack for Real-Time Editing

**Use these libraries. Do not build a custom CRDT or OT system.**

- **Tiptap** — rich text editor (React component, ProseMirror-based)
- **Yjs** — CRDT for real-time sync
- **y-websocket** — WebSocket provider for Yjs (run as a separate microservice or integrate into existing WS server)
- **y-indexeddb** — local persistence (offline resilience)

These are all open source, production-proven, and work together out of the box.

### 6.2 Doc Entity

```
doc {
  id: uuid PK
  workspace_id: uuid FK → workspace
  project_id: uuid FK → project NULLABLE      ← null = workspace-level doc
  parent_doc_id: uuid FK → doc NULLABLE       ← for nested docs (folder structure)
  
  title: string
  type: enum [wiki, meeting_note, requirements, sprint_retro, decision_record, runbook, general]
  content: jsonb                              ← Tiptap JSON snapshot (for search indexing)
  yjs_doc_name: string                        ← Yjs document room name (e.g. "doc:{id}")
  
  visibility: enum [private, project, workspace]
  created_by: uuid FK → user
  last_edited_by: uuid FK → user
  created_at: timestamp
  updated_at: timestamp
}
```

**Yjs integration:** The `content` jsonb field is a periodic snapshot for search. The live document lives in the Yjs provider. On doc open, the client connects to the Yjs WebSocket room `doc:{id}`. On disconnect, take a snapshot and write it to `content`.

### 6.3 Doc Version History

```
doc_version {
  id: uuid PK
  doc_id: uuid FK → doc
  workspace_id: uuid FK → workspace
  content_snapshot: jsonb
  snapshot_by: uuid FK → user
  created_at: timestamp
}
```

Take a snapshot: every 30 minutes while a doc is being actively edited, and when the last user disconnects from a doc. Keep last 50 versions. UI: "Version History" button in doc toolbar → timeline of snapshots → click to preview → "Restore" button.

### 6.4 Requirements Doc Template

When `doc.type = 'requirements'`, the Tiptap editor pre-populates with this template structure:

```
# [Project Name] — Requirements Document

## Problem Statement
> What problem are we solving? Who has this problem?

## Goals
> What does success look like?

## Non-Goals
> What are we explicitly NOT doing?

## User Personas
> Who are the users of this feature?

## User Stories
(Each story uses this format:)
As a [role], I want [action] so that [outcome].
  Acceptance Criteria:
  - [ ] criterion 1
  - [ ] criterion 2

## Technical Constraints
> Known technical limitations or requirements.

## Success Metrics
> How will we measure success?

## Out of Scope
> Explicitly excluded items.
```

**"Promote to Task" button:** On any User Story block, a button appears in the block's toolbar. Clicking it creates a new task in the linked project's backlog with:
- `title` = the user story text
- `description` = the acceptance criteria checklist
- `type` = story
- A back-link from the task to the requirements doc

### 6.5 Requirements Doc Status Workflow

Every doc with `type = 'requirements'` has an additional `status` field not present on other doc types. This tracks whether requirements are finalized before development begins.

```
doc (additional field for requirements type only)
  requirements_status: enum [draft, approved] DEFAULT 'draft'
  approved_by: uuid FK → user NULLABLE
  approved_at: timestamp NULLABLE
```

**Status behavior:**

| Status | Meaning | Who can set it | Editor behavior |
|---|---|---|---|
| `draft` | Work in progress, not finalized | Automatic on creation | Fully editable by anyone with `doc.edit` |
| `approved` | Signed off, ready for development | Manager+ only (`doc.approve`) | Editable, but any edit resets status to `draft` automatically |

**Status reset on edit:** If a requirements doc in `approved` status is edited, immediately reset `requirements_status` to `draft` and clear `approved_by` / `approved_at`. Show a warning banner: "This document was edited after approval. Status has been reset to Draft."

**UI implementation:**
- Requirements docs show a status badge in the doc header top-right: "Draft" (amber) or "Approved" (green)
- "Mark as Approved" button visible to Manager+ when status is `draft` — sets `requirements_status: approved`, records `approved_by` and `approved_at`
- Doc tree sidebar: requirements docs show their status badge inline next to the title
- Project overview card shows a "Requirements: Draft / Approved" indicator

**New permission required:**
```
doc.approve     ← Manager, Admin, Owner only
                   Allows marking a requirements doc as Approved
```

Add `doc.approve` to the Doc Permissions section of §9, and include it in Manager, Admin, and Owner default role grants.

---

### 6.6 Doc Template Builder

Workspace admins can create custom doc templates that appear as options when any user creates a new doc.

#### Template Entity

```
doc_template {
  id: uuid PK
  workspace_id: uuid FK → workspace
  name: string                          ← e.g. "Post-Mortem", "Sprint Planning Agenda"
  description: string nullable          ← shown in the "New Doc" picker
  type_hint: string nullable            ← suggested doc type for this template
  content: jsonb                        ← Tiptap JSON — the pre-filled content
  icon_emoji: string nullable
  is_system: bool                       ← true for built-in templates, cannot be deleted
  created_by: uuid FK → user
  created_at: timestamp
  updated_at: timestamp
}
```

#### Built-in Templates (seeded, `is_system: true`, always available)

| Template Name | Type Hint | Description |
|---|---|---|
| Requirements Doc | requirements | Problem statement, goals, user stories with acceptance criteria |
| Meeting Notes | meeting_note | Agenda, attendees, discussion, action items |
| Sprint Retrospective | sprint_retro | What went well, what didn't, action items |
| Architecture Decision Record | decision_record | Context, decision, consequences |
| Runbook | runbook | Prerequisites, steps, rollback procedure |
| General | general | Blank document |

#### Template Builder UI

Accessible via **Workspace Settings → Templates → "New Template"** (requires `doc.templates.manage` — Admin only).

**Creation flow:**
1. "New Template" button → form: name, description, emoji, type hint (optional)
2. Save metadata → full Tiptap editor opens to author template content
3. All standard block types are supported in the template body
4. "Save Template" → writes to `doc_template`, immediately available to all workspace members

**New Doc picker flow:**
- Click "New Doc" anywhere in the Docs panel → modal showing all templates as cards (icon + name + description)
- Search/filter bar at top of picker
- Click a template → new doc created with that template's content, title field focused
- "Blank Doc" option always appears first regardless of search

**Template management (Admin):**
- Template list in Settings: shows all system + custom templates
- Edit: reopens Tiptap editor with existing content
- Delete: only custom templates (`is_system: false`) can be deleted
- System templates can be hidden per-workspace by adding their id to `workspace.settings.hidden_template_ids[]`; they cannot be deleted globally

**New permissions required:**
```
doc.templates.manage    ← Admin only; create, edit, delete custom templates
doc.templates.view      ← all roles; see and use templates when creating docs
```

---

### 6.8 Knowledge Base Navigation

**Left sidebar (within the Docs panel):**

```
Docs
├── Workspace Docs
│   ├── Company Handbook
│   └── Engineering Standards
└── Projects
    ├── Project Alpha
    │   ├── Requirements
    │   ├── Sprint Retro — Sprint 3
    │   └── API Design Doc
    └── Project Beta
        └── ...
```

- Drag docs to reorder within a folder
- Right-click doc → rename, move, delete, duplicate, change visibility
- "New Doc" button: creates doc, immediately focuses title input

**Search:** Global `/` hotkey opens a search modal. Full-text search across all docs the user has permission to see. Powered by PostgreSQL `tsvector` on the `content` snapshot field.

### 6.9 Block Types Supported

| Block | Tiptap Extension |
|---|---|
| Paragraph | Built-in |
| Heading (H1–H3) | Built-in |
| Bullet list | Built-in |
| Numbered list | Built-in |
| Checklist / Todo | `@tiptap/extension-task-list` |
| Code block (syntax highlight) | `@tiptap/extension-code-block-lowlight` |
| Image (upload + embed) | `@tiptap/extension-image` |
| Table | `@tiptap/extension-table` |
| Callout / blockquote | Custom extension |
| Divider | `@tiptap/extension-horizontal-rule` |
| Task embed (inline link to a task) | Custom extension — renders a task chip with title + status |
| Doc link | Custom extension — renders a doc chip |

### 6.10 Presence in Docs

When multiple users are in the same doc:
- Show collaborator cursors in real-time (Yjs cursor awareness)
- Cursor: colored caret with user's name label floating above it
- Top-right of doc panel: show small avatar circles of everyone currently in the doc (same as "active collaborators" indicator in Notion/Google Docs)

### 6.11 Required Permissions for Docs

| Action | Permission |
|---|---|
| Create doc | `doc.create` |
| View doc (workspace-level) | `doc.view` |
| Edit doc | `doc.edit` |
| Delete doc | `doc.delete` |
| View private docs (others') | `doc.view_private` |
| Manage doc permissions | `doc.manage_access` |
| Mark requirements doc as Approved | `doc.approve` (Manager, Admin, Owner) |
| Create/edit/delete custom templates | `doc.templates.manage` (Admin, Owner) |
| Use templates when creating docs | `doc.templates.view` (all roles) |

---

## 7. Phase 5 — CRM Tools

> **Access rule:** All `crm.*` permissions are excluded from Member and Guest roles by default. They must be explicitly granted (see §3.6 Level 2). Guest role can NEVER receive any `crm.*` permission — enforce this as a hard block in `checkPermission()`.

### 7.1 Contact Entity

```
contact {
  id: uuid PK
  workspace_id: uuid FK → workspace
  company_id: uuid FK → company NULLABLE
  
  name: string
  email: string nullable
  phone: string nullable
  role_title: string nullable              ← their job title at their company
  type: enum [client, vendor, partner, lead, other]
  
  owner_id: uuid FK → user                ← internal user responsible for this contact
  tags: string[]
  notes: text nullable
  
  last_contacted_at: timestamp nullable
  created_by: uuid FK → user
  created_at: timestamp
  updated_at: timestamp
}
```

### 7.2 Company Entity

```
company {
  id: uuid PK
  workspace_id: uuid FK → workspace
  name: string
  industry: string nullable
  website: string nullable
  size: enum [1-10, 11-50, 51-200, 201-1000, 1000+] nullable
  primary_contact_id: uuid FK → contact NULLABLE
  associated_project_ids: uuid[]            ← linked MetaSpace projects
  tags: string[]
  created_by: uuid FK → user
  created_at: timestamp
}
```

### 7.3 Deal Entity

```
deal {
  id: uuid PK
  workspace_id: uuid FK → workspace
  contact_id: uuid FK → contact NULLABLE
  company_id: uuid FK → company NULLABLE
  
  title: string
  value: decimal nullable
  currency: string DEFAULT 'USD'
  stage: string                             ← references pipeline_stage.name
  probability: integer nullable             ← 0-100 percent
  expected_close_date: date nullable
  
  owner_id: uuid FK → user
  linked_project_id: uuid FK → project NULLABLE  ← set when deal converts to project
  
  created_by: uuid FK → user
  created_at: timestamp
  updated_at: timestamp
  closed_at: timestamp nullable
  closed_reason: enum [won, lost, cancelled] nullable
}
```

### 7.4 Pipeline Stages

Pipeline stages are customisable per workspace:

```
pipeline_stage {
  id: uuid PK
  workspace_id: uuid FK → workspace
  name: string
  order: integer
  color: string (hex)
  probability_default: integer   ← suggested win probability for deals in this stage
  is_terminal: bool              ← true for Won/Lost stages
  terminal_outcome: enum [won, lost] nullable
}
```

**Default stages (seeded on workspace creation):**

| Order | Name | Default Probability | Terminal |
|---|---|---|---|
| 1 | Lead | 10% | No |
| 2 | Qualified | 25% | No |
| 3 | Proposal | 50% | No |
| 4 | Negotiation | 75% | No |
| 5 | Closed Won | 100% | Yes (won) |
| 6 | Closed Lost | 0% | Yes (lost) |

### 7.5 CRM Interaction Log

Every touchpoint with a contact is recorded:

```
crm_interaction {
  id: uuid PK
  workspace_id: uuid FK → workspace
  contact_id: uuid FK → contact
  deal_id: uuid FK → deal NULLABLE
  
  type: enum [meeting, email, call, note, task, document_shared]
  title: string
  description: text nullable
  occurred_at: timestamp
  logged_by: uuid FK → user
  
  linked_task_id: uuid FK → task NULLABLE  ← follow-up task if created
}
```

**Spatial auto-capture:** When a WebRTC proximity session ends in MetaSpace involving a Guest user (external contact), prompt the internal user: "Log this meeting with [contact name]?" → pre-fills a `crm_interaction` with `type: meeting` and `occurred_at: now()`.

### 7.6 Pipeline Board UI

- Kanban-style board, one column per pipeline stage
- Each card: company/contact name, deal value, owner avatar, expected close date
- Column header: stage name + total deal value in that stage
- Drag card to new column → updates `deal.stage`, optionally updates `deal.probability` to stage default
- "New Deal" button in each column header
- Filter bar: filter by owner, company, tag, date range

### 7.7 Deal → Project Conversion

When a deal reaches "Closed Won":
- "Convert to Project" button appears on the deal detail panel
- Clicking it opens a "New Project" form pre-populated with:
  - `project.name` = deal title
  - `project.owner_id` = deal owner
  - Auto-adds contact's company to `project` linked companies
  - Auto-adds contact as a Guest member of the project
- Sets `deal.linked_project_id` to the new project
- In the project sidebar, shows a "CRM" tab with the linked deal and contact

### 7.8 Stale Contact Alert

If `contact.last_contacted_at` is older than a configurable threshold (default: 30 days), create a notification for `contact.owner_id` of type `task_due_soon` with message "No contact with [Name] in 30+ days."

### 7.9 CRM Reporting & Analytics

A dedicated "Reports" view inside the CRM panel. Accessible to anyone with `crm.view`. All metrics are scoped to the current workspace and respect any owner/team filters applied.

#### Report Views

**1. Pipeline Summary**
- Total pipeline value: sum of `deal.value` for all non-terminal stage deals
- Breakdown by stage: bar chart — each bar = one pipeline stage, height = total deal value in that stage
- Deal count per stage shown below each bar
- Filter by: owner, date range (expected close date), company

**2. Win Rate**
- Formula: `closed_won_count / (closed_won_count + closed_lost_count) × 100`
- Displayed as a large percentage with a trend arrow (vs previous period)
- Donut chart: Won vs Lost vs Cancelled proportions
- Filterable by: owner, time period (last 30 / 90 / 180 days / custom)

**3. Average Deal Cycle Time**
- Formula: average of `(deal.closed_at - deal.created_at)` in days, for all Closed Won deals
- Displayed as "X days avg to close"
- Histogram: distribution of deal cycle times in bucketed ranges (0–7d, 8–14d, 15–30d, 31–60d, 60d+)
- Filter by: time period, owner

**4. Revenue Forecast**
- Projects expected revenue for the next 30 / 60 / 90 days
- Formula: for each open deal, `deal.value × (deal.probability / 100)` summed by expected close date bucket
- Displayed as a stacked bar chart: one bar per month, stacked by pipeline stage
- Shows both weighted forecast (probability-adjusted) and best-case (sum of all open deal values)

#### Data Model for Reporting

All four reports are computed on-demand from existing `deal` table data. No separate reporting tables needed. Use database aggregation queries — do not cache in a separate table unless performance requires it.

For win rate and avg cycle time, filter on:
- `deal.closed_reason = 'won'` for won deals
- `deal.closed_reason IN ('lost', 'cancelled')` for lost deals
- `deal.closed_at IS NOT NULL` to exclude open deals from cycle time calculation

#### Report UI Placement

- "Reports" tab inside the CRM panel (alongside Contacts, Pipeline, Companies tabs)
- Each of the 4 report views is a sub-tab within Reports
- Charts are rendered as SVG using the same charting approach as the PM burndown/velocity charts (§4.7–4.8)
- "Export CSV" button on each report view — generates a flat CSV of the underlying data rows

**New permission required:**
```
crm.reports.view    ← view CRM analytics; granted to Manager, Admin, Owner by default
```

---

### 7.10 Required Permissions for CRM

| Action | Permission |
|---|---|
| View contacts & companies | `crm.view` |
| Create/edit contacts | `crm.edit` |
| Delete contacts | `crm.delete` |
| View deals pipeline | `crm.deals.view` |
| Create/edit deals | `crm.deals.edit` |
| Delete deals | `crm.deals.delete` |
| Convert deal to project | `crm.deals.convert` |
| Manage pipeline stages | `crm.pipeline.manage` |
| View interaction logs | `crm.interactions.view` |
| Create interaction logs | `crm.interactions.create` |
| View CRM reports & analytics | `crm.reports.view` (Manager, Admin, Owner) |

---

## 8. Spatial World Integration

### 8.1 Project Management Room

Add a dedicated room to the 2D world map named "Project Management". This room is accessible from the main map via a door/portal.

**Access control:** Door checks `checkPermission(userId, workspaceId, 'room.pm_access')`. Include `room.pm_access` in Manager and Admin roles by default. Members can be granted it.

**Interactive objects inside the room:**

| Object Name (on map) | Interaction (press X) | Opens |
|---|---|---|
| Sprint Board | `sprint.view` | Active sprint Kanban board |
| Backlog | `task.view` | Project backlog list |
| Timeline | `project.view` | Gantt timeline view |
| Reports | `project.view` | Burndown + velocity charts |
| New Sprint | `sprint.manage` | Create sprint modal |

Each object shows a label and a glowing interaction highlight (existing mechanic from the base platform).

### 8.2 CRM Room

Add a "CRM" room, accessible to Manager+ only (`room.crm_access` permission).

**Interactive objects:**

| Object Name | Interaction | Opens |
|---|---|---|
| Contacts | `crm.view` | Contact directory |
| Pipeline | `crm.deals.view` | Deal pipeline board |
| Companies | `crm.view` | Company directory |

### 8.3 Topbar Additions

Add these buttons to the existing topbar (left to right):

| Button | Icon | Permission | Action |
|---|---|---|---|
| Projects | folder icon | `project.view` | Opens project list panel |
| My Work | checkbox icon | always visible | Opens My Work dashboard |
| Docs | document icon | `doc.view` | Opens docs sidebar |
| CRM | contacts icon | `crm.view` | Opens CRM panel (hidden if no crm.* permission) |

**CRM button visibility:** Only render the CRM topbar button if `checkPermission(userId, workspaceId, 'crm.view')` returns true. Do not show a disabled/greyed CRM button to users without access — hide it entirely.

### 8.4 In-World Notification Delivery

When a notification is created for a user:
1. Send via WebSocket to their active connection
2. Increment the topbar bell badge count
3. If notification priority is HIGH (task_assigned, sprint_started, mention): show a toast in-world for 4 seconds
4. Animate a brief green pulse ring around the user's own avatar (same animation as proximity connect) — 300ms duration, only for HIGH priority

---

## 9. Permission Matrix Reference

Complete list of all permission strings. Implement these as constants in a shared module.

### Workspace Permissions
```
workspace.settings.view
workspace.settings.edit
workspace.billing
workspace.delete
workspace.members.invite
workspace.members.remove
workspace.members.view
workspace.roles.create
workspace.roles.edit
workspace.roles.delete
workspace.roles.assign
```

### Room Access Permissions
```
room.pm_access
room.crm_access
```

### Project Permissions
```
project.create
project.view
project.edit
project.delete
project.archive
project.members.add
project.members.remove
```

### Sprint Permissions
```
sprint.view
sprint.create
sprint.manage          ← start, complete, edit sprint
sprint.delete
```

### Task Permissions
```
task.create
task.create_personal
task.view
task.edit_own
task.edit_any
task.assign_others
task.delete
task.log_time
task.manage_status_columns
```

### Milestone Permissions
```
milestone.view
milestone.create
milestone.edit
milestone.delete
```

### Doc Permissions
```
doc.view
doc.create
doc.edit
doc.delete
doc.view_private
doc.manage_access
doc.approve               ← mark requirements doc as Approved (Manager, Admin, Owner)
doc.templates.view        ← use templates when creating docs (all roles)
doc.templates.manage      ← create/edit/delete custom templates (Admin, Owner)
```

### CRM Permissions
```
crm.view
crm.edit
crm.delete
crm.deals.view
crm.deals.edit
crm.deals.delete
crm.deals.convert
crm.pipeline.manage
crm.interactions.view
crm.interactions.create
crm.reports.view          ← view CRM analytics & reporting (Manager, Admin, Owner)
```

### Notification / Activity
```
notification.view_all       ← see all workspace notifications (Admin only)
```

### Default Role Permission Assignments

| Permission | Owner | Admin | Manager | Member | Guest |
|---|---|---|---|---|---|
| workspace.settings.* | ✓ | ✓ | — | — | — |
| workspace.billing | ✓ | — | — | — | — |
| workspace.delete | ✓ | — | — | — | — |
| workspace.members.invite | ✓ | ✓ | ✓ | — | — |
| workspace.members.remove | ✓ | ✓ | — | — | — |
| workspace.roles.* | ✓ | ✓ | — | — | — |
| room.pm_access | ✓ | ✓ | ✓ | — | — |
| room.crm_access | ✓ | ✓ | ✓ | — | — |
| project.* | ✓ | ✓ | ✓ | view+create tasks only | view only if added |
| sprint.* | ✓ | ✓ | ✓ | view only | — |
| task.create | ✓ | ✓ | ✓ | ✓ | — |
| task.create_personal | ✓ | ✓ | ✓ | ✓ | — |
| task.edit_own | ✓ | ✓ | ✓ | ✓ | — |
| task.edit_any | ✓ | ✓ | ✓ | — | — |
| task.assign_others | ✓ | ✓ | ✓ | — | — |
| task.delete | ✓ | ✓ | ✓ | own only | — |
| task.log_time | ✓ | ✓ | ✓ | ✓ | — |
| doc.* (base) | ✓ | ✓ | ✓ | create+edit | view only |
| doc.approve | ✓ | ✓ | ✓ | — | — |
| doc.templates.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| doc.templates.manage | ✓ | ✓ | — | — | — |
| crm.* | ✓ | ✓ | ✓ | **never by default** | **never** |
| crm.reports.view | ✓ | ✓ | ✓ | **never by default** | **never** |
| notification.view_all | ✓ | ✓ | — | — | — |

---

## 10. Implementation Rules & Constraints

### 10.1 General Rules

1. **Always scope queries by `workspace_id`** — treat this like a WHERE clause that must exist on every DB query.
2. **Server-side permission checks are mandatory** on every mutation endpoint. Client-side checks are only for UI (show/hide elements).
3. **The `checkPermission()` function** (§3.6) is the single source of truth for access control. Never inline permission logic.
4. **Guest role can never have any `crm.*` permission** — enforce this with a hard block inside `checkPermission()`, not just in the UI.
5. **Only one active sprint per project at a time** — enforce at DB level with a partial unique index.
6. **No subtask nesting beyond one level** — enforce at API level: if `parent_task_id` is set, check the parent has no parent.
7. **Task dependencies must not form cycles** — validate with a DAG cycle check before saving a new `task_dependency`.
8. **Gantt supports finish-to-start dependencies only** — reject any attempt to create other dependency types.

### 10.2 Real-Time Architecture

- All real-time features (task updates, doc co-editing, notifications) use the existing WebSocket infrastructure
- Docs require a Yjs WebSocket provider — run as a sidecar service on the same server or as a separate lightweight service
- Notification delivery is WebSocket push; fall back to polling every 30s if WS is disconnected

### 10.3 Multi-Tenant Data Isolation

- DB tables: add `workspace_id` column to every table listed in this spec
- Row-Level Security (RLS): if using PostgreSQL, enable RLS on all tables and set policies scoped to workspace_id
- API middleware: extract `workspace_id` from the authenticated session on every request and attach to `req.workspace`; reject requests where the requested resource's workspace_id doesn't match

### 10.4 Recommended Build Order Within Each Phase

**Phase 1:** Workspace → Users → Workspace Members → Roles → Permission matrix constants → checkPermission() utility → Role manager UI → Per-user grant UI → Spatial role badges

**Phase 2:** Project CRUD → Milestones → Sprint CRUD → Backlog view → Sprint board (Kanban) → Gantt timeline renderer → Task dependency model → Burndown/velocity charts → Topbar integration → Spatial PM room

**Phase 3:** Task entity + API → Task board integration (reuses Phase 2 Kanban) → Task detail panel → Subtasks → Comments + @mentions → Time tracking → My Work dashboard → Notification system → Spatial notification delivery

**Phase 4:** Yjs server setup → Doc entity + API → Tiptap editor integration → Real-time presence cursors → Doc tree navigation → Version history → Requirements template → Requirements status workflow (Draft/Approved) → "Promote to task" feature → Built-in template seeding → Template builder UI (Settings → Templates) → New Doc picker with template selection → Full-text search → Spatial whiteboard objects

**Phase 5:** Contact + Company CRUD → Deal entity + pipeline stages → Pipeline board (Kanban, reuses Phase 2 Kanban component) → Interaction log → Deal → Project conversion → Stale contact alerts → CRM Reports tab (pipeline summary → win rate → avg cycle time → revenue forecast) → Spatial CRM room

### 10.5 Shared UI Components (Build Once, Reuse Everywhere)

These components are used across multiple phases — build them generically:

| Component | Used In |
|---|---|
| `KanbanBoard` | Sprint board (Phase 2), Deal pipeline (Phase 5) |
| `TaskCard` | Sprint board, Backlog, My Work |
| `RichTextEditor` | Task descriptions, Doc editor, Comments |
| `UserAvatarGroup` | Task assignees, Doc collaborators, Sprint members |
| `DatePicker` | Task due dates, Sprint dates, Milestone dates, Deal close date |
| `PriorityBadge` | Task cards, My Work, Backlog |
| `PermissionGate` | Wrap any UI element: `<PermissionGate permission="crm.view">...</PermissionGate>` |
| `NotificationToast` | In-world notification delivery |
| `SlideInPanel` | Task detail, Doc view, CRM contact detail |

### 10.6 API Route Naming Convention

```
GET    /api/v1/{workspace_id}/projects
POST   /api/v1/{workspace_id}/projects
GET    /api/v1/{workspace_id}/projects/{project_id}
PATCH  /api/v1/{workspace_id}/projects/{project_id}
DELETE /api/v1/{workspace_id}/projects/{project_id}

GET    /api/v1/{workspace_id}/projects/{project_id}/sprints
POST   /api/v1/{workspace_id}/projects/{project_id}/sprints
PATCH  /api/v1/{workspace_id}/projects/{project_id}/sprints/{sprint_id}
POST   /api/v1/{workspace_id}/projects/{project_id}/sprints/{sprint_id}/start
POST   /api/v1/{workspace_id}/projects/{project_id}/sprints/{sprint_id}/complete

GET    /api/v1/{workspace_id}/tasks
POST   /api/v1/{workspace_id}/tasks
GET    /api/v1/{workspace_id}/tasks/{task_id}
PATCH  /api/v1/{workspace_id}/tasks/{task_id}
DELETE /api/v1/{workspace_id}/tasks/{task_id}
GET    /api/v1/{workspace_id}/tasks/my-work        ← personal dashboard

GET    /api/v1/{workspace_id}/docs
POST   /api/v1/{workspace_id}/docs
GET    /api/v1/{workspace_id}/docs/{doc_id}
PATCH  /api/v1/{workspace_id}/docs/{doc_id}
DELETE /api/v1/{workspace_id}/docs/{doc_id}
GET    /api/v1/{workspace_id}/docs/search?q={query}

GET    /api/v1/{workspace_id}/crm/contacts
POST   /api/v1/{workspace_id}/crm/contacts
GET    /api/v1/{workspace_id}/crm/deals
POST   /api/v1/{workspace_id}/crm/deals
POST   /api/v1/{workspace_id}/crm/deals/{deal_id}/convert

GET    /api/v1/{workspace_id}/roles
POST   /api/v1/{workspace_id}/roles
PATCH  /api/v1/{workspace_id}/roles/{role_id}
POST   /api/v1/{workspace_id}/members/{user_id}/permissions   ← grant/revoke override
GET    /api/v1/{workspace_id}/members/{user_id}/permissions
```

---

*End of MetaSpace Feature Implementation Specification v1.1*  
*v1.1 additions: Requirements status workflow (Draft/Approved), Doc Template Builder, CRM Reporting (pipeline summary, win rate, avg cycle time, revenue forecast). All new permissions added to §9 matrix and default role grants.*