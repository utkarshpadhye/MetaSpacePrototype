# MetaSpace PM-First Implementation Tracker

Version: 1.0  
Date: 21 April 2026  
Source Spec: `crm-features.md` (implement full spec phase-by-phase, PM first)

## 1. Execution Decisions (Locked)

- Product direction: PM first
- Delivery speed: as fast as possible
- Architecture style: lightweight (single API service + single DB + existing frontend)
- Scope strategy: full spec, delivered phase-by-phase

## 2. Tracking Rules

- Use this file as the single execution tracker.
- Do not start a phase until previous phase exit criteria are met.
- Every task requires validation before marking complete.
- Server-side permission checks are mandatory for all mutations.
- Every query must be scoped by `workspace_id`.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## 3. Prerequisites and Setup (Start Here)

## 3.1 Environment Setup

### Core tools

- [x] Install Node.js 20+
- [x] Install npm 10+
- [x] Install Python 3.10+
- [x] Install PostgreSQL 15+
- [x] Install Git

### Verify tools

```bash
node -v
npm -v
python --version
psql --version
git --version
```

Validation:

- [x] All versions return successfully

## 3.2 Frontend Setup

```bash
cd app
npm install
npm run build
```

Validation:

- [x] `npm install` succeeds
- [x] `npm run build` succeeds without type errors

## 3.3 Local AI Service Setup (existing feature support)

```bash
cd /Users/utkarsh/Documents/code/MetaSpacePrototype
python -m venv .venv
source .venv/bin/activate
pip install -r local-ai/requirements.txt
python local-ai/stt_server.py
```

Validation:

- [x] STT service starts on `http://127.0.0.1:8765`

## 3.4 Lightweight Backend Bootstrap (new)

Decision: single backend service for API + auth/permissions + websocket events.

Recommended bootstrap (choose one and lock it):

- Option A: FastAPI + SQLAlchemy + Alembic + psycopg + websockets
- Option B: Express/Nest + Prisma/Drizzle + ws/socket.io

Locked choice for speed: **Option A (FastAPI)**.

To-do:

- [x] Create `backend/` service skeleton
- [x] Add env config (`DATABASE_URL`, `APP_ENV`, `JWT_SECRET`, `WS_ORIGIN`)
- [x] Add migration framework
- [x] Add health endpoint
- [x] Add shared error handling and request logging

Validation:

- [x] `GET /health` returns 200
- [x] DB migration command runs cleanly on fresh DB

## 3.5 Database and Migration Baseline

To-do:

- [x] Create initial database
- [x] Add baseline schema migration folder
- [x] Add seed runner for default roles and permission constants

Validation:

- [x] Fresh setup command provisions schema end-to-end
- [x] Seed command creates Owner/Admin/Manager/Member/Guest roles

## 3.6 CI Baseline

To-do:

- [x] Add frontend build check in CI
- [x] Add backend lint/test check in CI
- [x] Add migration check in CI

Validation:

- [x] CI passes on clean branch

Note: Validated via local CI-equivalent run (`npm ci && npm run build`, `alembic upgrade head`, `ruff check .`, `pytest -q`) on `main`; GitHub Actions run will execute after pushing workflow changes.

---

## 4. Phase 1 - Identity, Tenancy, Permissions

Goal: establish secure multi-tenant control plane.

## 4.1 Data and Access Control

- [x] Implement entities: `workspace`, `user`, `workspace_member`, `role`, `user_permission_override`, `project_member`
- [x] Seed default roles and default permission matrix from spec
- [x] Implement `checkPermission(userId, workspaceId, permission, projectId?)`
- [x] Enforce `workspace_id` middleware on every API request
- [x] Add hard block: Guest can never receive any `crm.*`

## 4.2 APIs and UI

- [x] Workspace settings API (view/edit)
- [x] Members API (invite/remove/list)
- [x] Roles API (create/edit/delete/assign; Owner protected)
- [x] User permission override API (grant/revoke/expiry)
- [x] UI: Roles manager panel
- [x] UI: Per-user permission override panel
- [x] UI: Role badges in world overlay
- [x] Room access checks for PM and CRM doors

## 4.3 Validation Tasks

- [x] Unit tests: permission precedence (revoke > grant > role > deny)
- [x] Integration tests: tenant isolation with 2 workspaces
- [x] Security tests: deny unauthorized mutation endpoints
- [x] Regression: Owner permissions immutable, Owner role not deletable
- [x] UX validation: room lock tooltip and padlock behavior

## 4.4 Exit Criteria

- [x] All mutation routes enforce server-side permission checks
- [x] No cross-workspace leak paths in tests
- [x] Room access gating live and reliable

---

## 5. Phase 2 - Project Management (Scrum + Gantt)

Goal: operational PM loop inside MetaSpace.

## 5.1 Core PM Models and APIs

- [x] Implement `project` CRUD
- [x] Implement `milestone` CRUD
- [x] Implement `sprint` CRUD with one-active-sprint guard
- [x] Implement project status columns management
- [x] Implement backlog APIs (`sprint_id = null`) + reorder

## 5.2 Sprint Board and Backlog

- [x] Build sprint board Kanban with drag/drop status updates
- [x] Build backlog list with multi-select and add-to-sprint
- [x] Implement sprint start and complete flows
- [x] Implement carry-over modal for incomplete tasks

## 5.3 Gantt and Dependencies

- [x] Build timeline day/week/month scale
- [x] Render task bars and milestone diamonds
- [x] Add drag/resize interactions for task bars
- [x] Implement finish-to-start dependency model
- [x] Validate and reject dependency cycles
- [x] Conflict highlighting when successor starts too early

## 5.4 Reporting and Integration

- [x] Implement burndown snapshot model and scheduler
- [x] Implement burndown and velocity report APIs
- [x] Add topbar Projects panel with project cards
- [x] Add PM room objects: Sprint Board, Backlog, Timeline, Reports, New Sprint

## 5.5 Validation Tasks

- [x] DB test: only one active sprint per project
- [x] E2E: backlog -> sprint -> done -> sprint complete flow
- [x] Gantt test: drag/resize persists correctly
- [x] DAG test: dependency cycle prevention
- [x] Report tests: burndown and velocity numbers correct

## 5.6 Exit Criteria

- [x] Managers can run complete sprint lifecycle
- [x] Gantt and dependency behavior stable on realistic data
- [x] PM room + topbar Projects fully operational

---

## 6. Phase 3 - Task Lifecycle and Assignments

Goal: complete execution workflows and personal productivity.

## 6.1 Task System

- [x] Implement unified `task` model rules (project + personal)
- [x] Enforce constraint: if `project_id` is null then `sprint_id` is null
- [x] Implement custom status support for project tasks
- [x] Implement personal task statuses (`todo/in_progress/done`)

## 6.2 Activity, Comments, Subtasks, Time

- [x] Implement `task_activity` write-on-change pipeline
- [x] Implement `task_comment` with `@mention` parsing
- [x] Implement `time_log` and task time summary
- [x] Implement subtasks (single nesting level only)

## 6.3 My Work and Notifications

- [x] Build My Work dashboard sections (Overdue, Due Today, This Week, Upcoming, Personal, Watching)
- [x] Add quick-add personal task
- [x] Implement notification model and APIs
- [x] Implement websocket push + polling fallback
- [x] Implement avatar pulse + toast for high-priority notifications
- [x] Implement due-soon scheduler (24h and 1h)

## 6.4 Validation Tasks

- [x] Unit tests: subtask nesting guard
- [x] Unit tests: mention parser and notification fan-out
- [x] Integration tests: activity log entries for all mutation types
- [x] E2E: My Work auto-updates when statuses and due dates change
- [x] E2E: high-priority notifications show toast + pulse

## 6.5 Exit Criteria

- [x] Full task lifecycle works for personal and project contexts
- [x] Notification reliability acceptable in reconnect scenarios
- [x] My Work dashboard is accurate and performant

---

## 7. Phase 4 - Docs, Requirements, Knowledge Base

Goal: collaborative docs and requirements workflow linked to PM.

## 7.1 Realtime Docs Foundation

- [x] Add `doc` and `doc_version` models
- [x] Integrate Tiptap editor
- [x] Integrate Yjs + y-websocket + y-indexeddb
- [x] Implement doc snapshot persistence for search

## 7.2 Requirements Workflow

- [x] Implement requirements template prefill
- [x] Implement `requirements_status` (`draft/approved`)
- [x] Implement `doc.approve` permission gates
- [x] Implement reset-to-draft on any approved doc edit
- [x] Implement warning banner and approval metadata fields
- [x] Implement Promote-to-Task from user story blocks

## 7.3 Template Builder and Knowledge Base

- [x] Implement `doc_template` model
- [x] Seed built-in system templates
- [x] Build Template Management UI (Admin/Owner)
- [x] Build New Doc template picker with search
- [x] Build nested doc tree + actions (rename/move/delete/duplicate)
- [x] Implement full-text doc search

## 7.4 Validation Tasks

- [x] Multi-user edit consistency tests (conflict-free)
- [x] Version history snapshot + restore tests
- [x] Requirements approval/reset behavior tests
- [x] Promote-to-task mapping tests
- [x] Template permission tests (`doc.templates.view/manage`)

## 7.5 Exit Criteria

- [x] Real-time co-editing stable under concurrent usage
- [x] Requirements governance flow complete
- [x] Template-driven doc creation and search operational

---

## 8. Phase 5 - CRM Tools

Goal: CRM module after PM core maturity.

## 8.1 CRM Core

- [x] Implement `contact`, `company`, `deal`, `pipeline_stage`, `crm_interaction`
- [x] Seed default pipeline stages
- [x] Build contacts and companies directories
- [x] Build pipeline board with drag/drop stages

## 8.2 CRM Integrations and Automation

- [x] Implement deal -> project conversion
- [x] Implement stale contact alert scheduler
- [x] Implement spatial meeting auto-log prompt for guest sessions

## 8.3 CRM Reports

- [x] Build Pipeline Summary report
- [x] Build Win Rate report
- [x] Build Average Deal Cycle Time report
- [x] Build Revenue Forecast report
- [x] Add CSV export for each report

## 8.4 Validation Tasks

- [x] Permission tests for all `crm.*` and `crm.reports.view`
- [x] Formula correctness tests for all report metrics
- [x] E2E: deal conversion creates linked project relationships correctly
- [x] Security tests: Guest hard-block for all CRM access paths

## 8.5 Exit Criteria

- [x] CRM lifecycle from lead to closed-won-to-project works
- [x] Analytics match raw deal aggregates
- [x] CRM room and topbar gating behave correctly

---

## 9. Shared Validation Matrix (All Phases)

## 9.1 Required Test Suites

- [x] Unit tests (permission logic, validators, calculations)
- [x] API integration tests (auth, permission, tenant scope)
- [x] E2E tests (core user journeys)
- [x] Realtime tests (websocket events and reconnection)
- [x] Security tests (tenant isolation and privilege escalation)

## 9.2 Performance Baselines

- [x] Sprint board interaction smooth at 300+ cards
- [x] Gantt usable with 200+ tasks
- [x] Docs collaboration responsive with 5+ concurrent editors
- [x] Reports under acceptable latency with realistic data volume

---

## 10. Weekly Progress Tracker

## 10.1 Current Sprint Snapshot

- Phase in progress:
- Target completion date:
- Blockers:
- Risks:
- Mitigation:

## 10.2 Completed This Week

- [ ]
- [ ]
- [ ]

## 10.3 Next Week Plan

- [ ]
- [ ]
- [ ]

---

## 11. Immediate Next Actions (Day 0 to Day 2)

- [x] Lock backend stack decision (FastAPI)
- [x] Scaffold `backend/` + migration tooling
- [~] Implement Phase 1 schema and seed permissions
- [x] Implement `checkPermission()` and middleware tenant scoping
- [x] Add first protected mutation endpoint + tests
- [ ] Add Role/Members settings shell UI with placeholder data

Validation checkpoint:

- [~] Can create workspace, seed roles, and deny unauthorized mutation in tests

---

## 12. Definition of Done (DoD) per Phase

A phase is Done only when all are true:

- [ ] Phase to-do checklist complete
- [ ] Phase validation tasks complete
- [ ] Exit criteria complete
- [ ] No P0/P1 security or permission bugs open
- [ ] Demo walkthrough recorded for the phase
