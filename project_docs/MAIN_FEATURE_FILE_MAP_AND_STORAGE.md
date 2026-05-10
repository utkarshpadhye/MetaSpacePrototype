# Main Feature File Map and Storage Guide

Date: 11 May 2026

This document maps the main MetaSpace features to the files that implement them and explains where demo data is stored.

---

## 1. Main Feature to File Map

| Main feature | Primary files | What lives there |
|---|---|---|
| App shell, login, signup, demo session | `app/src/App.tsx` | Auth screen, persisted `metaspace-auth` session, route between login/dashboard/workspace, demo permission normalization for `abc`. |
| Workspace orchestration | `app/src/WorkspaceApp.tsx` | Opens/closes major overlays, wires chat, presence, voice, conference, calendar, Ana, docs, projects, CRM, settings, notifications, and avatar choice. |
| Spatial office canvas | `app/src/components/GameCanvas.tsx`, `app/src/canvas/world.ts` | Canvas renderer, baked floor-plan image, movement, pathfinding, collision map, sections, seats, interactive hotspots, camera bounds, avatar rendering. |
| Generated map and avatars | `app/public/assets/maps/cozy-startup-office-poc.png`, `app/public/assets/avatars/player-male.png`, `app/public/assets/avatars/player-female.png` | AI-generated visual office map and selectable player sprite sheets. |
| Character selection | `app/src/components/SettingsModal.tsx`, `app/src/WorkspaceApp.tsx`, `app/src/components/GameCanvas.tsx` | Settings UI, local persistence under `metaspace-avatar-choice`, selected sprite loading in canvas. |
| Reception/front desk | `app/src/components/InteractionModal.tsx`, `app/src/canvas/world.ts` | Reception hotspot and pixel-themed reception modal with welcome, directory, notices, and guest check-in surface. |
| Whiteboard | `app/src/components/LoungeWhiteboard.tsx`, `app/src/components/InteractionModal.tsx`, `app/src/canvas/world.ts` | Excalidraw whiteboard in the lounge hotspot, localStorage scene save, BroadcastChannel scene sync. |
| Library portal | `app/src/components/LibraryPortal.tsx`, `app/src/components/InteractionModal.tsx`, `app/public/assets/library/*` | Courses, books, news, company documents, role selector, static PDF links. |
| File converter | `app/src/components/FileConverter.tsx`, `app/src/components/InteractionModal.tsx` | Browser-side image/text/table conversion from the cafeteria hotspot. |
| Chat and speech bubbles | `app/src/WorkspaceApp.tsx`, `app/src/components/BottomBar.tsx`, `app/src/components/RightSidebar.tsx`, `app/src/components/GameCanvas.tsx` | Chat input, BroadcastChannel chat messages, sidebar message list, speech bubbles above avatar. |
| Presence and proximity | `app/src/hooks/useSessionPresence.ts`, `app/src/components/GameCanvas.tsx`, `app/src/components/RightSidebar.tsx` | Local peer identity, BroadcastChannel presence heartbeat, stale peer cleanup, participant list. |
| Proximity voice | `app/src/hooks/useProximityVoiceWebRTC.ts`, `app/src/components/ProximityVoiceOverlay.tsx`, `app/src/components/VideoOverlay.tsx` | WebRTC peer connections for nearby users and local overlay state. |
| Conference room | `app/src/hooks/useConferenceWebRTC.ts`, `app/src/components/ConferenceCallOverlay.tsx`, `app/src/hooks/useScreenShare.ts` | Conference WebRTC connections, microphone state, screen sharing, conference overlay UI. |
| Live captions | `app/src/hooks/useConferenceTranscription.ts`, `local-ai/stt_server.py` | Browser audio capture, WAV encoding, local STT POST requests, transcript filtering and sync. |
| Meeting summary | `app/src/hooks/useConferenceTranscription.ts`, `app/src/services/gemini.ts` | Transcript summarization using Gemini first, Ollama fallback, then local heuristic fallback. |
| Ana assistant | `app/src/hooks/useAnaAgent.ts`, `app/src/components/AnaOverlay.tsx`, `app/src/services/gemini.ts` | Gemini chat, local fallback answers, streamed assistant display, provider status. |
| Calendar | `app/src/hooks/useCalendarData.ts`, `app/src/components/CalendarOverlay.tsx` | Shared/personal events, localStorage persistence, BroadcastChannel sync, reminders. |
| Notifications | `app/src/hooks/useNotifications.ts`, `backend/app/routes/tasks.py`, `backend/app/realtime.py` | Backend notifications API/WebSocket, frontend polling/WebSocket consumption, high-priority pulses. |
| Admin dashboard | `app/src/components/AdminDashboard.tsx`, `backend/app/routes/auth.py`, `backend/app/routes/roles.py` | User creation, role assignment, password reset, workspace user management. |
| Backend auth | `backend/app/routes/auth.py`, `backend/app/auth.py`, `backend/app/dependencies.py` | Signup, login, refresh/logout, password reset, JWT issuing/decoding, request context validation. |
| Roles and permissions | `backend/app/permissions.py`, `backend/app/security.py`, `backend/app/routes/roles.py`, `backend/app/routes/overrides.py` | Permission constants, system role permission sets, checks, grants/revokes. |
| Project management backend | `backend/app/routes/projects.py`, `backend/app/routes/sprints.py`, `backend/app/routes/milestones.py`, `backend/app/routes/tasks.py`, `backend/app/models.py` | Projects, sprints, milestones, tasks, status columns, dependencies, reports, activities, time logs. |
| Project management UI | `app/src/components/ProjectManagementOverlay.tsx` | Demo PM room interface, permission-gated by `room.pm_access`. |
| Docs backend | `backend/app/routes/docs.py`, `backend/app/models.py` | Doc templates, docs, versions, approval, restore, promote doc story to task. |
| Docs UI | `app/src/components/DocsWorkspaceOverlay.tsx` | Tiptap/Yjs collaborative editor demo, IndexedDB persistence, doc tree, approval/reset/promote controls. |
| CRM backend | `backend/app/routes/crm.py`, `backend/app/models.py` | Pipeline stages, companies, contacts, deals, interactions, stale-contact scheduler, reports, deal conversion. |
| CRM UI | `app/src/components/CrmWorkspaceOverlay.tsx` | Demo CRM suite, permission-gated by `room.crm_access`. |
| Backend app setup | `backend/app/main.py`, `backend/app/config.py`, `backend/app/database.py`, `backend/app/rate_limit.py` | FastAPI app, CORS, middleware, route registration, environment settings, DB session, rate limiting. |

---

## 2. Why `abc` Opens Directly in the Workspace

The browser is already carrying a persisted auth session in localStorage:

```text
localStorage key: metaspace-auth
```

`app/src/App.tsx` reads this key on startup. If it exists and `mustResetPassword` is false, the app skips the login page and opens either the admin dashboard or workspace. The current demo session is for `abc`, so every new tab/window on the same browser profile and origin reuses that same localStorage value.

The latest implementation gives `abc` owner-like feature permissions while preserving direct workspace entry. That means `abc` can now open Projects, CRM, Docs, and other permission-gated demo tools without being redirected to the admin dashboard first.

---

## 3. How to Check Browser Local Storage

### 3.1 Chrome/Edge DevTools

1. Open `http://localhost:5173` or the Vite URL.
2. Right click the page and choose **Inspect**.
3. Open the **Application** tab.
4. In the left sidebar, open **Storage → Local storage**.
5. Select the current origin, usually:

```text
http://localhost:5173
http://127.0.0.1:5173
```

6. Inspect keys such as `metaspace-auth`, `metaspace-avatar-choice`, calendar keys, and whiteboard keys.

Important: `localhost` and `127.0.0.1` are different browser origins. Data saved under one will not automatically appear under the other.

### 3.2 Browser Console Commands

Open DevTools Console and run:

```js
localStorage.getItem('metaspace-auth')
```

Pretty-print the auth session:

```js
JSON.parse(localStorage.getItem('metaspace-auth'))
```

List all MetaSpace localStorage keys:

```js
Object.keys(localStorage).filter((key) => key.startsWith('metaspace'))
```

Clear only the auth session:

```js
localStorage.removeItem('metaspace-auth')
```

Clear all localStorage for the current origin:

```js
localStorage.clear()
```

### 3.3 Main Local Storage Keys

| Key | Owner file | Structure |
|---|---|---|
| `metaspace-auth` | `app/src/App.tsx` | JSON object with `accessToken`, `refreshToken`, `workspaceId`, `workspaceName`, `userId`, `userName`, `roleName`, `permissions`, `mustResetPassword`. |
| `metaspace-avatar-choice` | `app/src/WorkspaceApp.tsx` | String: `male` or `female`. |
| `metaspace-user-role` | `app/src/components/LibraryPortal.tsx` | String: `public`, `employee`, or `admin`, used by the library portal demo. |
| `metaspace-whiteboard-{sessionId}` | `app/src/components/LoungeWhiteboard.tsx` | JSON Excalidraw scene snapshot: elements, appState, files when present. |
| `metaspace-calendar-shared-{sessionId}` | `app/src/hooks/useCalendarData.ts` | JSON array of shared/global/team calendar events. |
| `metaspace-calendar-personal-{localPeerId}` | `app/src/hooks/useCalendarData.ts` | JSON array of personal calendar events for that peer. |

---

## 4. IndexedDB Storage

The docs editor also uses IndexedDB through `y-indexeddb`.

Primary file:

```text
app/src/components/DocsWorkspaceOverlay.tsx
```

The editor creates Yjs documents and persists them through `IndexeddbPersistence`. To inspect:

1. Open DevTools.
2. Go to **Application → IndexedDB**.
3. Look for databases created by `y-indexeddb`.
4. Expand the database/object stores to inspect Yjs update records.

This is not the same as localStorage. localStorage stores simple strings per origin; IndexedDB stores structured browser-side data and is better for collaborative document updates.

---

## 5. Backend Database Storage

The backend uses SQLAlchemy models in:

```text
backend/app/models.py
```

Database configuration lives in:

```text
backend/app/config.py
backend/app/database.py
backend/.env.example
```

Default database URL:

```text
postgresql+psycopg://localhost:5432/metaspace
```

If the PostgreSQL driver is unavailable, `backend/app/database.py` falls back to:

```text
sqlite+pysqlite:///./metaspace_local.db
```

### 5.1 Main Tables

| Table/model | Purpose |
|---|---|
| `Workspace` / `workspace` | Tenant boundary for an organization/workspace. |
| `User` / `user` | Global user account identity and password hash. |
| `Role` / `role` | Per-workspace role with JSON `permissions`. |
| `WorkspaceMember` / `workspace_member` | Connects users to workspaces with role, username, and status. |
| `UserPermissionOverride` / `user_permission_override` | Per-user grant/revoke overrides for specific permissions. |
| `RefreshToken` / `refresh_token` | Hashed refresh token storage and revocation. |
| `Project` / `project` | Project management project. |
| `ProjectMember` / `project_member` | Project-level membership/role override. |
| `Sprint` / `sprint` | Sprint records per project. |
| `Milestone` / `milestone` | Milestone records per project. |
| `ProjectStatusColumn` / `project_status_column` | Custom task board columns. |
| `Task` / `task` | Personal or project tasks. |
| `TaskActivity` / `task_activity` | Audit/activity trail for task changes. |
| `TaskComment` / `task_comment` | Comments and mentions on tasks. |
| `TimeLog` / `time_log` | Time entries attached to tasks. |
| `Notification` / `notification` | Due soon/high-priority/user notifications. |
| `TaskDependency` / `task_dependency` | Directed dependency edges between project tasks. |
| `BurndownSnapshot` / `burndown_snapshot` | Sprint/project reporting snapshots. |
| `DocTemplate` / `doc_template` | Reusable document templates. |
| `Doc` / `doc` | Stored document content, status, privacy, parent/project links. |
| `DocVersion` / `doc_version` | Version history for documents. |
| `Company` / `company` | CRM company/account. |
| `Contact` / `contact` | CRM contact/person. |
| `PipelineStage` / `pipeline_stage` | CRM pipeline columns/stages. |
| `Deal` / `deal` | CRM opportunity/deal, optionally linked to a project. |
| `CRMInteraction` / `crm_interaction` | Notes/calls/emails/guest-session interactions. |

### 5.2 How to Inspect the Backend DB

For PostgreSQL:

```bash
psql postgresql://localhost:5432/metaspace
\dt
\d workspace
select id, name, subdomain from workspace;
select username, status, workspace_id from workspace_member;
select name, permissions from role;
```

For SQLite fallback:

```bash
sqlite3 backend/metaspace_local.db
.tables
.schema workspace_member
select username, status, workspace_id from workspace_member;
```

Run migrations:

```bash
cd backend
alembic upgrade head
```

See migration history:

```bash
cd backend
alembic history
```

---

## 6. Meeting Summary Behavior

Summary generation now has three layers:

1. Gemini, when `VITE_GEMINI_API_KEY` is configured.
2. Ollama, through `VITE_OLLAMA_ENDPOINT` / `VITE_OLLAMA_MODEL`, when Gemini is unavailable or absent.
3. Local heuristic fallback in `useConferenceTranscription.ts`.

Recommended local Ollama config in `app/.env`:

```bash
VITE_OLLAMA_MODEL=llama3.2
VITE_OLLAMA_ENDPOINT=http://127.0.0.1:11434/api/generate
```

The prompt now instructs the model to synthesize key points, only extract true post-meeting actions, and only list decisions when the transcript contains explicit agreement/finalization language.
