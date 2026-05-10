# MetaSpace Prototype - Project Deep Dive

## 1. Project Overview

MetaSpacePrototype is a spatial, collaborative workspace that blends a 2D isometric office map with real-time collaboration tools (voice, conferencing, chat, docs, CRM, and PM overlays). The front-end renders an interactive "virtual office" where users move a pixel-style avatar between rooms, while a backend API handles multi-tenant project management, CRM, docs, roles, and notifications. The core runtime entrypoints are the React app in [app/src/App.tsx](app/src/App.tsx#L1-L260) and the FastAPI app in [backend/app/main.py](backend/app/main.py#L1-L96).

- Problem solved: create a single, spatial UX that unifies PM, CRM, documentation, and meetings into one navigable interface rather than a collection of separate tools.
- Target users: product teams and internal ops staff who need a lightweight, demo-ready workspace; admins and owners manage roles, members, and workspace setup through the admin dashboard and API.
- Core value proposition: a single canvas-based office metaphor with embedded collaboration workflows, real-time presence, and lightweight, multi-tenant backend services.
- Motivation: the repository history and README emphasize a prototype intended to be fast to run, with local speech-to-text, optional Gemini summaries, and in-browser collaboration features [README.md](README.md).

## 2. Tech Stack (Complete)

Below is every technology, library, tool, and service visible in the codebase, with role, rationale (from code context), alternatives, and trade-offs.

### Frontend platform

1. React (19.x)

- Role: UI framework for the entire SPA; all UI components and overlays are React components and hooks [app/src/App.tsx](app/src/App.tsx#L1-L260).
- Why chosen: the codebase is UI-heavy with stateful overlays and hooks; React provides component composition and hooks for audio, presence, and overlays.
- Alternatives: Vue, Svelte, Solid.
- Trade-offs: strong ecosystem and tooling vs. runtime overhead and the need to manage hook lifecycles carefully.

2. TypeScript

- Role: type safety across UI components, hooks, and API payloads (tsconfig and TS usage across src).
- Why chosen: the UI relies on many structured objects (presence messages, CRM entities, docs) where types reduce regression.
- Alternatives: JavaScript (ESNext), Flow, ReasonML.
- Trade-offs: safer refactors and documentation vs. compilation overhead and type maintenance.

3. Vite

- Role: dev server and build tool, plus proxy to the Ana LLM endpoint [app/vite.config.ts](app/vite.config.ts#L1-L17).
- Why chosen: fast HMR and minimal configuration suitable for a prototype.
- Alternatives: Webpack, Parcel, Next.js (dev server), Turbopack.
- Trade-offs: speed and simplicity vs. fewer batteries-included production features compared to full frameworks.

4. Tailwind CSS

- Role: utility-first CSS classes for UI styling; used alongside custom CSS [app/src/index.css](app/src/index.css#L1-L220).
- Why chosen: rapid UI styling for prototype components.
- Alternatives: CSS Modules, styled-components, Chakra UI.
- Trade-offs: fast iteration and consistency vs. class-heavy markup and dependency on utility conventions.

5. PostCSS + Autoprefixer

- Role: CSS processing pipeline behind Tailwind [app/postcss.config.js](app/postcss.config.js#L1-L6).
- Why chosen: standard Tailwind requirement and cross-browser CSS prefixing.
- Alternatives: Sass, Lightning CSS.
- Trade-offs: stable tooling vs. extra build steps and config.

6. ESLint + typescript-eslint + react-hooks + react-refresh

- Role: linting and hook rules [app/eslint.config.js](app/eslint.config.js#L1-L28).
- Why chosen: enforce hook correctness and React best practices.
- Alternatives: Biome, TSLint (deprecated), StandardJS.
- Trade-offs: improved code quality vs. lint config overhead.

7. Playwright

- Role: E2E testing for the UI [app/playwright.config.ts](app/playwright.config.ts#L1-L17).
- Why chosen: browser automation with minimal config for Vite apps.
- Alternatives: Cypress, Selenium, TestCafe.
- Trade-offs: strong browser coverage vs. heavier test infra and slower test runs.

### Frontend libraries

8. Excalidraw

- Role: embedded whiteboard in lounge [app/src/components/LoungeWhiteboard.tsx](app/src/components/LoungeWhiteboard.tsx).
- Why chosen: instant, battle-tested whiteboard component.
- Alternatives: tldraw, Fabric.js, custom canvas.
- Trade-offs: quick feature depth vs. bundle size and limited styling control.

9. Tiptap (StarterKit, Collaboration, CollaborationCursor)

- Role: docs editor with collaborative cursors [app/src/components/DocsWorkspaceOverlay.tsx](app/src/components/DocsWorkspaceOverlay.tsx).
- Why chosen: rich text editor with collaboration support.
- Alternatives: Slate, ProseMirror directly, Quill.
- Trade-offs: rich feature set vs. heavier dependency footprint and complex editor state.

10. Yjs

- Role: CRDT for collaborative docs, with WebSocket provider and IndexedDB persistence [app/src/components/DocsWorkspaceOverlay.tsx](app/src/components/DocsWorkspaceOverlay.tsx).
- Why chosen: robust CRDT syncing and offline-first persistence (IndexedDB).
- Alternatives: Automerge, ShareDB, custom OT.
- Trade-offs: strong collaboration model vs. additional complexity and server requirements for production.

11. y-websocket

- Role: WebSocket syncing for Yjs docs [app/src/components/DocsWorkspaceOverlay.tsx](app/src/components/DocsWorkspaceOverlay.tsx).
- Why chosen: quick way to sync Yjs docs using a public demo server.
- Alternatives: custom Yjs server, y-webrtc.
- Trade-offs: fast setup vs. reliance on external demo server for collaboration.

12. y-indexeddb

- Role: local persistence for docs editing [app/src/components/DocsWorkspaceOverlay.tsx](app/src/components/DocsWorkspaceOverlay.tsx).
- Why chosen: offline persistence without a backend.
- Alternatives: localStorage, Service Worker caches.
- Trade-offs: better offline support vs. more complex persistence state.

13. zustand

- Role: included dependency, but not used in the current code.
- Why chosen: likely prepared for shared UI state.
- Alternatives: Redux Toolkit, Jotai, Recoil.
- Trade-offs: lightweight state management vs. another dependency not yet used.

14. jsPDF

- Role: meeting transcript + summary export to PDF [app/src/components/ConferenceCallOverlay.tsx](app/src/components/ConferenceCallOverlay.tsx).
- Why chosen: easy client-side PDF generation.
- Alternatives: pdf-lib, server-side PDF rendering.
- Trade-offs: no server dependency vs. limited styling and performance for large documents.

15. PapaParse

- Role: CSV/JSON conversion in file converter overlay [app/src/components/FileConverter.tsx](app/src/components/FileConverter.tsx).
- Why chosen: robust CSV parsing and generation.
- Alternatives: csv-parse, fast-csv.
- Trade-offs: mature CSV support vs. extra bundle size.

16. BroadcastChannel API

- Role: local multi-tab/session sync for chat, presence, whiteboard, and conference transcription [app/src/hooks/useSessionPresence.ts](app/src/hooks/useSessionPresence.ts#L48-L234).
- Why chosen: simple local demo realtime without server.
- Alternatives: WebSocket server, WebRTC data channels.
- Trade-offs: zero backend complexity vs. only works within same browser origin.

17. WebRTC + MediaDevices

- Role: conference video/audio and proximity voice chat [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L43-L240), [app/src/hooks/useProximityVoiceWebRTC.ts](app/src/hooks/useProximityVoiceWebRTC.ts#L46-L250).
- Why chosen: real-time media without server-side media relay in a prototype.
- Alternatives: Twilio, Daily, Jitsi.
- Trade-offs: no vendor dependency vs. more browser complexity and limited NAT traversal without TURN.

18. WebSocket (browser)

- Role: notifications feed via backend WS [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L18-L103).
- Why chosen: real-time notification pushes.
- Alternatives: SSE, long polling.
- Trade-offs: real-time push vs. persistent connection handling.

19. Gemini API (optional)

- Role: optional meeting summary and Ana assistant responses [app/src/services/gemini.ts](app/src/services/gemini.ts#L1-L162).
- Why chosen: external LLM for summaries and chat when API key is provided.
- Alternatives: OpenAI, Anthropic, Azure OpenAI, local LLMs.
- Trade-offs: strong LLM responses vs. network dependency and API key requirement.

### Backend platform

20. FastAPI

- Role: backend API framework for auth, projects, CRM, docs, etc. [backend/app/main.py](backend/app/main.py#L1-L96).
- Why chosen: fast development, type hints, automatic validation.
- Alternatives: Flask, Django, Starlette.
- Trade-offs: async support and speed vs. less batteries-included than Django.

21. Uvicorn

- Role: ASGI server for FastAPI [backend/README.md](backend/README.md).
- Why chosen: standard ASGI server for FastAPI.
- Alternatives: Hypercorn, Gunicorn + Uvicorn workers.
- Trade-offs: fast dev server vs. additional production hardening needed.

22. SQLAlchemy 2.x

- Role: ORM for all domain models and queries [backend/app/models.py](backend/app/models.py#L1-L486).
- Why chosen: explicit schema definition and query composition.
- Alternatives: SQLModel, Django ORM, peewee.
- Trade-offs: flexibility vs. verbosity and learning curve.

23. Alembic

- Role: schema migrations [backend/alembic/env.py](backend/alembic/env.py).
- Why chosen: standard migration tool for SQLAlchemy.
- Alternatives: Django migrations, Flyway, Liquibase.
- Trade-offs: SQLAlchemy alignment vs. more manual migration setup.

24. PostgreSQL (via psycopg)

- Role: primary database target (config default) [backend/app/config.py](backend/app/config.py).
- Why chosen: transactional DB for multi-tenant data and JSON fields.
- Alternatives: MySQL, SQLite, MongoDB.
- Trade-offs: robust relational model vs. setup overhead for local dev.

25. psycopg (binary)

- Role: Postgres driver [backend/requirements.txt](backend/requirements.txt).
- Why chosen: modern driver with good performance.
- Alternatives: asyncpg, psycopg2.
- Trade-offs: compatibility and performance vs. binary package size.

26. Pydantic Settings

- Role: settings via env vars [backend/app/config.py](backend/app/config.py).
- Why chosen: structured config with env file support.
- Alternatives: dynaconf, python-decouple.
- Trade-offs: typed settings vs. additional dependency.

27. python-dotenv

- Role: read .env for config [backend/requirements.txt](backend/requirements.txt).
- Why chosen: local dev convenience.
- Alternatives: dotenv-linter, custom env loading.
- Trade-offs: simple config vs. another dependency.

28. PyJWT

- Role: JWT encode/decode for access tokens [backend/app/auth.py](backend/app/auth.py#L59-L73).
- Why chosen: simple JWT support.
- Alternatives: jose, authlib.
- Trade-offs: lightweight vs. minimal helpers for token management.

29. Passlib

- Role: password hashing and verification [backend/app/auth.py](backend/app/auth.py#L12-L28).
- Why chosen: standard secure password hashing.
- Alternatives: bcrypt directly, argon2-cffi.
- Trade-offs: convenience vs. dependency footprint.

30. anyio

- Role: run notification publishes from sync context [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L78-L115).
- Why chosen: anyio provides async bridging.
- Alternatives: asyncio.run, background tasks.
- Trade-offs: simple async bridging vs. limited control over event loops.

31. WebSockets (FastAPI)

- Role: realtime notification channel [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L818-L843).
- Why chosen: push notifications to clients.
- Alternatives: SSE, push polling.
- Trade-offs: live updates vs. connection management in prod.

32. pytest + httpx

- Role: API test suite [backend/tests/test_projects_api.py](backend/tests/test_projects_api.py).
- Why chosen: fast unit/integration testing for FastAPI.
- Alternatives: unittest, nose2.
- Trade-offs: strong testing ecosystem vs. additional setup.

33. ruff

- Role: Python linting (tooling) [backend/requirements.txt](backend/requirements.txt).
- Why chosen: fast linting.
- Alternatives: flake8, pylint.
- Trade-offs: speed vs. less mature rule customization.

### Local AI service

34. faster-whisper

- Role: local speech-to-text model for meeting captions [local-ai/stt_server.py](local-ai/stt_server.py#L10-L116).
- Why chosen: fast Whisper inference on CPU.
- Alternatives: OpenAI Whisper API, Vosk, SpeechBrain.
- Trade-offs: local privacy and low latency vs. CPU load and model setup.

35. PyAV (av)

- Role: audio decoding of media chunks [local-ai/stt_server.py](local-ai/stt_server.py#L7-L119).
- Why chosen: robust audio decoding for various MediaRecorder formats.
- Alternatives: ffmpeg CLI, soundfile.
- Trade-offs: flexibility vs. native bindings complexity.

36. python-multipart

- Role: upload parsing for STT endpoint [local-ai/requirements.txt](local-ai/requirements.txt).
- Why chosen: required by FastAPI for multipart uploads.
- Alternatives: custom upload handling.
- Trade-offs: standard approach vs. added dependency.

37. Uvicorn (STT server)

- Role: runs local STT service [local-ai/stt_server.py](local-ai/stt_server.py#L130-L133).
- Why chosen: same ASGI server used in backend.
- Alternatives: Hypercorn.
- Trade-offs: simplicity vs. production-grade deployment needs.

## 3. Project Architecture

### High-level structure

- Frontend SPA: Vite + React renders the virtual office and overlays [app/src/App.tsx](app/src/App.tsx#L1-L260).
- Backend API: FastAPI monolith for auth, PM, CRM, docs, roles, notifications [backend/app/main.py](backend/app/main.py#L1-L96).
- Local STT service: separate FastAPI app for transcription [local-ai/stt_server.py](local-ai/stt_server.py#L1-L133).

### Major modules and communication

- Frontend UI: game canvas + overlays (docs, CRM, PM, calendar, Ana) in [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L1-L219).
- Presence and realtime: BroadcastChannel for presence/chat/whiteboard; backend WebSocket for notifications [app/src/hooks/useSessionPresence.ts](app/src/hooks/useSessionPresence.ts#L48-L234) and [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L818-L843).
- Backend layers: routes (controllers), SQLAlchemy models, auth/permission utilities. No explicit service layer; the route handlers contain the domain logic.
- Architectural pattern: a layered monolith in the backend (routes + ORM + config) and a component-and-hook-based SPA in the frontend. The system overall is not microservices; the STT service is the only standalone companion process.

### Key architectural decisions

- Tenant isolation: every route is scoped by `workspace_id` and enforced by `get_request_context` [backend/app/dependencies.py](backend/app/dependencies.py#L18-L62).
- Role/permission checks on every protected endpoint via `check_permission` [backend/app/security.py](backend/app/security.py#L9-L72).
- Minimal realtime backend: notifications use an in-memory hub [backend/app/realtime.py](backend/app/realtime.py) with a WebSocket gateway [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L818-L843).
- Frontend-first collaboration: core real-time UX (presence, chat, whiteboard) is client-side BroadcastChannel with no server dependency.

## 4. Features — Complete List with Technical Implementation

Below is a feature-by-feature inventory, with file locations and internal flow.

### 4.1 Workspace signup, login, and admin dashboard

- User-facing: admin signup creates a workspace and owner; login authenticates and routes to dashboard or workspace.
- Key backend: `admin_signup`, `login`, `refresh_token`, `logout`, `reset_password`, and admin user management in [backend/app/routes/auth.py](backend/app/routes/auth.py#L84-L461).
- Key frontend: login/signup/reset flows in [app/src/App.tsx](app/src/App.tsx#L40-L245) and admin UI in [app/src/components/AdminDashboard.tsx](app/src/components/AdminDashboard.tsx).
- Flow: user submits form -> POST /api/v1/auth/admin-signup or /login -> token issued -> stored in localStorage -> view switches to dashboard/workspace.
- Data flow: auth payload -> validation -> Workspace/User/WorkspaceMember creation -> JWT issued -> stored in client.
- Dependencies: JWT (`PyJWT`), password hashing (`Passlib`), and DB models [backend/app/auth.py](backend/app/auth.py#L12-L81).
- Edge cases: workspace/user uniqueness checks; password policy enforcement; reset flow requires current password.

### 4.2 Role and permission enforcement

- User-facing: role-based access to PM/CRM/docs rooms and API endpoints.
- Backend: `check_permission` evaluates role permissions and overrides [backend/app/security.py](backend/app/security.py#L9-L72), permission sets defined in [backend/app/permissions.py](backend/app/permissions.py#L1-L149).
- Frontend: room access toggles in WorkspaceApp and TopBar [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L80-L190).
- Flow: request -> `get_request_context` resolves user/workspace -> permission check -> allow or 403.
- Edge cases: Guest role cannot access CRM regardless of grants [backend/app/security.py](backend/app/security.py#L43-L45).

### 4.3 Spatial office map and avatar movement

- User-facing: move avatar on pixel map and interact with hotspots.
- Frontend: map state, collision, and interactions in [app/src/components/GameCanvas.tsx](app/src/components/GameCanvas.tsx) and map data in [app/src/canvas/world.ts](app/src/canvas/world.ts).
- Flow: keyboard inputs -> game loop updates player state -> interaction hints -> modal overlay.
- Data flow: local avatar position and map data; BroadcastChannel updates for presence.
- Dependencies: canvas rendering and custom assets.
- Edge cases: collision grid, room transitions, locked rooms by permission (objects include `requiredPermission`).

### 4.4 Presence and proximity

- User-facing: see nearby users and participants list.
- Frontend: presence uses BroadcastChannel [app/src/hooks/useSessionPresence.ts](app/src/hooks/useSessionPresence.ts#L48-L234).
- Flow: user movement -> `publishPresence` sends state -> other clients update their peer list -> UI updates.
- Edge cases: stale peer removal after timeout; heartbeat throttling.

### 4.5 Chat and emoji reactions

- User-facing: local chat panel and emoji reactions.
- Frontend: chat uses BroadcastChannel `metaspace-chat-{sessionId}` in [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L238-L258) and UI in [app/src/components/RightSidebar.tsx](app/src/components/RightSidebar.tsx).
- Flow: message -> broadcast -> received by others -> appended to chat.
- Edge cases: dedupe by ID and unread badge logic.

### 4.6 Conference room video calls

- User-facing: join conference room, video tiles, screen share.
- Frontend: WebRTC hook [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L43-L240) and UI in [app/src/components/ConferenceCallOverlay.tsx](app/src/components/ConferenceCallOverlay.tsx).
- Flow: entering conference area toggles `isConferenceRoom` -> WebRTC hook creates local stream -> BroadcastChannel signaling -> peer connections -> video tiles.
- External dependencies: WebRTC, STUN (Google), MediaDevices API.
- Edge cases: media permission errors, peer connection failures.

### 4.7 Proximity voice chat

- User-facing: voice automatically connects to nearby peers.
- Frontend: `useProximityVoiceWebRTC` [app/src/hooks/useProximityVoiceWebRTC.ts](app/src/hooks/useProximityVoiceWebRTC.ts#L46-L250) and overlay [app/src/components/ProximityVoiceOverlay.tsx](app/src/components/ProximityVoiceOverlay.tsx).
- Flow: nearby peers computed in WorkspaceApp -> WebRTC connections created -> audio streams play.
- Edge cases: permission denial or disconnect cleanup.

### 4.8 Screen sharing

- User-facing: share screen in conference room.
- Frontend: `useScreenShare` hook [app/src/hooks/useScreenShare.ts](app/src/hooks/useScreenShare.ts) and conference overlay button [app/src/components/ConferenceCallOverlay.tsx](app/src/components/ConferenceCallOverlay.tsx).
- Flow: click share -> getDisplayMedia -> share video track -> WebRTC replaces video sender.
- Edge cases: browser support checks and onended cleanup.

### 4.9 Live captions and meeting summary

- User-facing: live captions and summary in conference room.
- Frontend: `useConferenceTranscription` for capture and local summarization [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L310-L488) and Gemini summaries [app/src/services/gemini.ts](app/src/services/gemini.ts#L131-L162).
- Backend: local STT service [local-ai/stt_server.py](local-ai/stt_server.py#L1-L133).
- Flow: audio captured -> WAV chunks -> POST to STT endpoint -> transcript lines -> summary in UI -> optional Gemini summarization if API key exists.
- Edge cases: handling silence/no speech, filtering low-confidence text, and fallback to local summary when Gemini is unavailable.

### 4.10 Docs Studio (collaborative docs)

- User-facing: doc tree, editing, approvals, templates.
- Backend: docs endpoints for templates, docs, versions, approvals, promote-to-task [backend/app/routes/docs.py](backend/app/routes/docs.py#L1-L511).
- Frontend: collaborative editor overlay in [app/src/components/DocsWorkspaceOverlay.tsx](app/src/components/DocsWorkspaceOverlay.tsx).
- Flow: list docs -> open doc -> TipTap editor with Yjs + WebSocket provider -> updates reflected in editor and in-memory state.
- Data flow: on backend, content_json stored with searchable `content_text` [backend/app/routes/docs.py](backend/app/routes/docs.py#L285-L305).
- Edge cases: approval reset when content changes [backend/app/routes/docs.py](backend/app/routes/docs.py#L376-L406).

### 4.11 Project management (PM room)

- User-facing: kanban board, backlog, sprint lifecycle, reports, dependencies.
- Backend: projects, status columns, tasks, dependencies, reports [backend/app/routes/projects.py](backend/app/routes/projects.py#L1-L401) and [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L147-L843). Sprints are handled in [backend/app/routes/sprints.py](backend/app/routes/sprints.py#L39-L262).
- Frontend: PM overlay uses local state (demo) [app/src/components/ProjectManagementOverlay.tsx](app/src/components/ProjectManagementOverlay.tsx).
- Flow (backend): create project -> tasks -> sprint management -> burndown snapshots -> dependency graph.
- Edge cases: single active sprint constraint and dependency cycle detection [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L123-L145).

### 4.12 CRM suite

- User-facing: pipeline, companies, contacts, deals, reports, stale contact alerts.
- Backend: CRM routes in [backend/app/routes/crm.py](backend/app/routes/crm.py#L1-L789).
- Frontend: CRM overlay uses local demo data [app/src/components/CrmWorkspaceOverlay.tsx](app/src/components/CrmWorkspaceOverlay.tsx).
- Flow: create/update companies/contacts/deals; convert deal to project; generate reports; scheduler for stale contacts.
- Edge cases: pipeline defaults seeded, stale contact scheduler avoids duplicate notifications.

### 4.13 Notifications

- User-facing: notifications list and live updates.
- Backend: notification creation in tasks routes and WebSocket feed [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L78-L843).
- Frontend: `useNotifications` with polling fallback and websocket [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L18-L103).
- Edge cases: WebSocket fallback to polling and high-priority pulse tracking.

### 4.14 Calendar

- User-facing: calendar overlay with events and reminders.
- Frontend: `useCalendarData` and `CalendarOverlay` [app/src/hooks/useCalendarData.ts](app/src/hooks/useCalendarData.ts) and [app/src/components/CalendarOverlay.tsx](app/src/components/CalendarOverlay.tsx).
- Flow: events stored in localStorage; shared events synced via BroadcastChannel; reminders triggered in hook.
- Edge cases: event parsing validation and reminder de-duplication.

### 4.15 Whiteboard, library, and file converter

- Whiteboard: Excalidraw + BroadcastChannel + localStorage [app/src/components/LoungeWhiteboard.tsx](app/src/components/LoungeWhiteboard.tsx).
- Library: curated learning resources and company docs [app/src/components/LibraryPortal.tsx](app/src/components/LibraryPortal.tsx).
- File converter: local image/text/CSV/JSON conversion in-browser [app/src/components/FileConverter.tsx](app/src/components/FileConverter.tsx).

## 5. Data Model & Storage

Primary data entities (SQLAlchemy models) in [backend/app/models.py](backend/app/models.py#L1-L486):

- Workspace: tenant root with plan and timezone.
- User: global user identity; linked to Workspace via WorkspaceMember.
- Role: per-workspace role with permissions.
- WorkspaceMember: user membership + role + status.
- UserPermissionOverride: explicit grants/revokes with optional expiry.
- Project: project metadata and ownership.
- ProjectMember: optional per-project role override.
- Sprint, Milestone: project planning.
- ProjectStatusColumn: kanban columns.
- Task: core work item with status, priority, assignee, sprint, and hierarchy.
- TaskActivity: audit log for changes.
- TaskComment: threaded comments with mentions.
- TimeLog: time tracking per task.
- Notification: user notifications.
- RefreshToken: hashed refresh token storage.
- TaskDependency: task dependency edges.
- BurndownSnapshot: sprint progress snapshot.
- DocTemplate, Doc, DocVersion: documentation system.
- Company, Contact, PipelineStage, Deal, CRMInteraction: CRM system.

Relationships (examples):

- Workspace -> Role, WorkspaceMember, Project, Task, Doc, CRM entities (workspace_id foreign keys).
- Project -> Sprint, Milestone, Task, StatusColumn.
- Task -> TaskActivity, TaskComment, TimeLog, TaskDependency.
- Doc -> DocVersion (versions) and hierarchical parent_id.

Storage:

- Primary DB: PostgreSQL (config default), fallback to SQLite for local workflows [backend/app/database.py](backend/app/database.py).
- Local browser storage: whiteboard, calendar, and docs overlay use localStorage and IndexedDB.

Queries and access patterns:

- Workspace-scoped filters everywhere (e.g., list projects, tasks, docs).
- Time summary aggregates via SQL `sum` for TimeLog [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L471-L488).
- CRM reports aggregate deals by pipeline stage [backend/app/routes/crm.py](backend/app/routes/crm.py#L792-L840).

## 6. API / Interface Layer

All API endpoints are under `/api/v1` and require either bearer JWT or dev headers. Below is the full list grouped by domain (see routes in backend/app/routes).

### Auth

- POST /api/v1/auth/admin-signup -> create workspace + owner, returns tokens [backend/app/routes/auth.py](backend/app/routes/auth.py#L84-L148)
- POST /api/v1/auth/login -> login, returns tokens [backend/app/routes/auth.py](backend/app/routes/auth.py#L151-L187)
- POST /api/v1/auth/refresh -> refresh access token [backend/app/routes/auth.py](backend/app/routes/auth.py#L202-L229)
- POST /api/v1/auth/logout -> revoke refresh token [backend/app/routes/auth.py](backend/app/routes/auth.py#L232-L241)
- POST /api/v1/auth/{workspace_id}/reset-password -> reset own password [backend/app/routes/auth.py](backend/app/routes/auth.py#L244-L266)
- GET /api/v1/auth/{workspace_id}/users -> list users [backend/app/routes/auth.py](backend/app/routes/auth.py#L269-L299)
- POST /api/v1/auth/{workspace_id}/users -> create user [backend/app/routes/auth.py](backend/app/routes/auth.py#L302-L391)
- PATCH /api/v1/auth/{workspace_id}/users/{user_id} -> update user [backend/app/routes/auth.py](backend/app/routes/auth.py#L393-L458)
- POST /api/v1/auth/{workspace_id}/users/{user_id}/reset-password -> reset user password [backend/app/routes/auth.py](backend/app/routes/auth.py#L461-L480)

### Workspaces

- GET /api/v1/{workspace_id} -> get workspace
- PATCH /api/v1/{workspace_id} -> update workspace

### Members and Roles

- GET /api/v1/{workspace_id}/members
- POST /api/v1/{workspace_id}/members/invite
- DELETE /api/v1/{workspace_id}/members/{user_id}
- GET /api/v1/{workspace_id}/roles
- POST /api/v1/{workspace_id}/roles
- PATCH /api/v1/{workspace_id}/roles/{role_id}
- DELETE /api/v1/{workspace_id}/roles/{role_id}
- POST /api/v1/{workspace_id}/roles/{role_id}/assign

### Permission Overrides

- POST /api/v1/{workspace_id}/permission-overrides/grant
- POST /api/v1/{workspace_id}/permission-overrides/revoke

### Projects and Status Columns

- POST /api/v1/{workspace_id}/projects
- GET /api/v1/{workspace_id}/projects
- GET /api/v1/{workspace_id}/projects/{project_id}
- PATCH /api/v1/{workspace_id}/projects/{project_id}
- DELETE /api/v1/{workspace_id}/projects/{project_id}
- GET /api/v1/{workspace_id}/projects/{project_id}/status-columns
- POST /api/v1/{workspace_id}/projects/{project_id}/status-columns
- PATCH /api/v1/{workspace_id}/projects/{project_id}/status-columns/{column_id}
- DELETE /api/v1/{workspace_id}/projects/{project_id}/status-columns/{column_id}
- POST /api/v1/{workspace_id}/projects/{project_id}/reports/burndown/snapshot

### Sprints

- GET /api/v1/{workspace_id}/projects/{project_id}/sprints
- POST /api/v1/{workspace_id}/projects/{project_id}/sprints
- PATCH /api/v1/{workspace_id}/projects/{project_id}/sprints/{sprint_id}
- DELETE /api/v1/{workspace_id}/projects/{project_id}/sprints/{sprint_id}
- POST /api/v1/{workspace_id}/projects/{project_id}/sprints/{sprint_id}/start
- POST /api/v1/{workspace_id}/projects/{project_id}/sprints/{sprint_id}/complete

### Milestones

- GET /api/v1/{workspace_id}/projects/{project_id}/milestones
- POST /api/v1/{workspace_id}/projects/{project_id}/milestones
- PATCH /api/v1/{workspace_id}/projects/{project_id}/milestones/{milestone_id}
- DELETE /api/v1/{workspace_id}/projects/{project_id}/milestones/{milestone_id}

### Tasks, Comments, Time, Dependencies

- POST /api/v1/{workspace_id}/tasks (personal)
- POST /api/v1/{workspace_id}/projects/{project_id}/tasks
- GET /api/v1/{workspace_id}/projects/{project_id}/backlog
- POST /api/v1/{workspace_id}/projects/{project_id}/backlog/reorder [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L262-L299)
- PATCH /api/v1/{workspace_id}/tasks/{task_id} [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L301-L349)
- DELETE /api/v1/{workspace_id}/tasks/{task_id}
- POST /api/v1/{workspace_id}/tasks/{task_id}/comments [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L372-L431)
- POST /api/v1/{workspace_id}/tasks/{task_id}/time-logs [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L434-L468)
- GET /api/v1/{workspace_id}/tasks/{task_id}/time-summary [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L471-L488)
- GET /api/v1/{workspace_id}/projects/{project_id}/dependencies
- POST /api/v1/{workspace_id}/projects/{project_id}/dependencies
- DELETE /api/v1/{workspace_id}/projects/{project_id}/dependencies/{dependency_id}
- GET /api/v1/{workspace_id}/tasks/{task_id}/activities
- GET /api/v1/{workspace_id}/my-work [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L652-L695)

### Notifications

- GET /api/v1/{workspace_id}/notifications [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L698-L723)
- POST /api/v1/{workspace_id}/notifications/{notification_id}/read
- POST /api/v1/{workspace_id}/notifications/due-soon/run
- WS /api/v1/{workspace_id}/notifications/ws [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L818-L843)

### Docs

- GET /api/v1/{workspace_id}/doc-templates [backend/app/routes/docs.py](backend/app/routes/docs.py#L127-L156)
- POST /api/v1/{workspace_id}/doc-templates
- PATCH /api/v1/{workspace_id}/doc-templates/{template_id}
- DELETE /api/v1/{workspace_id}/doc-templates/{template_id}
- POST /api/v1/{workspace_id}/docs
- GET /api/v1/{workspace_id}/docs [backend/app/routes/docs.py](backend/app/routes/docs.py#L307-L335)
- GET /api/v1/{workspace_id}/docs/{doc_id}
- PATCH /api/v1/{workspace_id}/docs/{doc_id}
- POST /api/v1/{workspace_id}/docs/{doc_id}/approve [backend/app/routes/docs.py](backend/app/routes/docs.py#L411-L434)
- GET /api/v1/{workspace_id}/docs/{doc_id}/versions
- POST /api/v1/{workspace_id}/docs/{doc_id}/versions/{version_id}/restore
- POST /api/v1/{workspace_id}/docs/{doc_id}/promote-story

### CRM

- GET/POST/PATCH/DELETE /api/v1/{workspace_id}/crm/pipeline-stages
- GET/POST/PATCH/DELETE /api/v1/{workspace_id}/crm/companies
- GET/POST/PATCH/DELETE /api/v1/{workspace_id}/crm/contacts
- GET/POST/PATCH/DELETE /api/v1/{workspace_id}/crm/deals
- POST /api/v1/{workspace_id}/crm/deals/{deal_id}/convert-to-project [backend/app/routes/crm.py](backend/app/routes/crm.py#L586-L619)
- GET/POST /api/v1/{workspace_id}/crm/interactions [backend/app/routes/crm.py](backend/app/routes/crm.py#L622-L699)
- POST /api/v1/{workspace_id}/crm/guest-sessions/auto-log [backend/app/routes/crm.py](backend/app/routes/crm.py#L703-L739)
- POST /api/v1/{workspace_id}/crm/stale-contacts/run [backend/app/routes/crm.py](backend/app/routes/crm.py#L742-L789)
- GET /api/v1/{workspace_id}/crm/reports/pipeline-summary
- GET /api/v1/{workspace_id}/crm/reports/win-rate
- GET /api/v1/{workspace_id}/crm/reports/avg-cycle-time
- GET /api/v1/{workspace_id}/crm/reports/revenue-forecast

## 7. Authentication & Security

- JWT access tokens issued in auth routes; refresh tokens stored hashed in `refresh_token` table [backend/app/routes/auth.py](backend/app/routes/auth.py#L57-L81).
- Dev headers (`X-User-Id`, `X-Workspace-Id`) are accepted for local use [backend/app/dependencies.py](backend/app/dependencies.py#L18-L62).
- Authorization is permission-based with role overrides [backend/app/security.py](backend/app/security.py#L9-L72).
- Rate limiting middleware with a sliding window (in-memory) [backend/app/main.py](backend/app/main.py#L41-L54).

Potential vulnerabilities/limitations:

- In-memory rate limiter and notification hub are not distributed; multi-instance deployments would need shared state.
- JWT secret default is `change-me-in-local-env` [backend/app/config.py](backend/app/config.py).

## 8. Configuration & Environment

- Backend env vars: `APP_ENV`, `DATABASE_URL`, `CORS_ORIGINS`, `JWT_SECRET`, `WS_ORIGIN`, rate limit settings [backend/app/config.py](backend/app/config.py).
- Local STT env vars: `METASPACE_STT_MODEL`, `METASPACE_STT_DEVICE`, `METASPACE_STT_COMPUTE_TYPE` [local-ai/stt_server.py](local-ai/stt_server.py#L12-L14).
- Frontend env vars: `VITE_GEMINI_API_KEY`, `VITE_GEMINI_MODEL`, `VITE_GEMINI_ENDPOINT` [app/src/services/gemini.ts](app/src/services/gemini.ts#L27-L31).
- Development vs production: dev allows /auth/dev/reset and dev header auth; production should use bearer JWT only.

## 9. Third-party Integrations

- Gemini LLM: meeting summaries and Ana assistant [app/src/services/gemini.ts](app/src/services/gemini.ts#L96-L162). Without it, local fallback responses are used.
- Yjs demo server: collaborative docs use `wss://demos.yjs.dev` by default [app/src/components/DocsWorkspaceOverlay.tsx](app/src/components/DocsWorkspaceOverlay.tsx).
- WebRTC STUN: Google STUN server in WebRTC hooks [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L118-L120).

If removed:

- Gemini removal: summaries and Ana fall back to local rules; app still works but no LLM summaries.
- Yjs server removal: docs collaboration becomes single-user/offline only.
- STUN removal: peer connections fail across NAT.

## 10. Error Handling & Logging

- Backend: global exception handler logs and returns 500 [backend/app/main.py](backend/app/main.py#L72-L78).
- Request logging middleware logs method, path, status, timing [backend/app/main.py](backend/app/main.py#L57-L69).
- Frontend: `debugLog` helper logs to console and keeps an in-memory log buffer [app/src/utils/debugLog.ts](app/src/utils/debugLog.ts).
- STT: errors return `ignored: true` when chunks are invalid [local-ai/stt_server.py](local-ai/stt_server.py#L82-L125).

## 11. Testing

- Backend tests: pytest-based API tests and security tests [backend/tests/test_projects_api.py](backend/tests/test_projects_api.py) and [backend/tests/test_security.py](backend/tests/test_security.py).
- WebSocket tests: notification hub test [backend/tests/test_realtime_notifications.py](backend/tests/test_realtime_notifications.py).
- Frontend tests: Playwright E2E config [app/playwright.config.ts](app/playwright.config.ts#L1-L17).

## 12. Build, Deployment & DevOps

- Frontend build: `npm run build` -> Vite + TypeScript build [app/package.json](app/package.json).
- Backend run: `uvicorn app.main:app --reload --port 8787` [backend/README.md](backend/README.md).
- Migrations: Alembic via `alembic upgrade head` [backend/README.md](backend/README.md).
- Local STT: `python local-ai/stt_server.py` [README.md](README.md).
- No Dockerfiles or CI configs are present; deployment appears manual.

## 13. Known Limitations & Technical Debt

- Frontend PM, CRM, and Docs overlays store demo data client-side; no live API integration in those overlays.
- BroadcastChannel-based realtime only works within the same browser origin and tab group.
- WebRTC signaling uses BroadcastChannel, so cross-machine conferencing is not supported without a server.
- In-memory rate limiter and notification hub will not scale across multiple backend instances.
- Missing production auth hardening (e.g., refresh token rotation, revocation lists by user).
- Alembic config default hardcodes a local Postgres URL in alembic.ini; must rely on env to avoid credentials.

## 14. Glossary of Project-Specific Terms

- Ana: the in-app assistant UI that uses Gemini when configured.
- Workspace: tenant boundary for all data and permissions.
- Project: PM container with tasks, sprints, milestones.
- Sprint: time-boxed iteration for tasks.
- Status Column: kanban stage within a project.
- Doc Template: predefined structure for docs (PRD, meeting notes).
- Doc Version: immutable snapshot for docs history.
- CRM Pipeline Stage: sales stage with probability.
- Deal Conversion: creating a project from a CRM deal.
- Presence: live location and state of users on the map.
- Proximity Voice: auto-connecting voice chat for nearby avatars.
- Conference Room: special area where full video conferencing is enabled.
- STT: speech-to-text; local service at port 8765.
