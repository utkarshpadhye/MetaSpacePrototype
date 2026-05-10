# Docs, Projects, and CRM Demo Guide

Date: 11 May 2026

This guide explains the three main business-workspace features and gives a practical demo sequence for each.

---

## 1. Docs Workspace

### What This Feature Is

Docs is the knowledge and requirements workspace inside MetaSpace. It is meant to show how a team can create structured documents, collaborate on content, approve documents, restore previous versions, and convert useful document content into project tasks.

In the current prototype there are two layers:

- Frontend demo workspace: `app/src/components/DocsWorkspaceOverlay.tsx`
- Backend API/data model: `backend/app/routes/docs.py`, `backend/app/models.py`

The frontend uses Tiptap/Yjs-style collaborative editing behavior and browser persistence. The backend contains durable APIs for doc templates, docs, versions, approvals, restores, and promoting a doc story into a task.

### Key Things to Show

- Docs is permission-gated by `doc.view`.
- It contains a document tree/sidebar.
- It supports templates and structured document content.
- It demonstrates collaborative-document architecture through Yjs/IndexedDB.
- It connects documentation to execution by promoting content into tasks.

### Demo Steps

1. Start the app and enter the workspace as `abc`.
2. Click **Docs** in the top bar.
3. Explain: “This is the team knowledge and requirements area. It keeps documents close to the virtual office instead of sending users to a separate tool.”
4. Point out the document list/tree on the left.
5. Select a document and show the editor surface.
6. Edit some text in the editor.
7. Explain that the frontend file `DocsWorkspaceOverlay.tsx` uses collaborative document primitives and IndexedDB persistence for local demo durability.
8. Show the approval/reset/version-related controls if visible.
9. Explain the backend side: `backend/app/routes/docs.py` has routes for templates, docs, versions, approval, restore, and story promotion.
10. Mention the main database entities:
    - `DocTemplate`
    - `Doc`
    - `DocVersion`
11. If asked where the local demo editor data is stored, open browser DevTools:
    - Application → IndexedDB
    - Look for Yjs/y-indexeddb data.
12. Close Docs and show that the spatial office remains the central navigation layer.

### Suggested Demo Script

“Docs is not just a notes panel. It models a lightweight documentation lifecycle: templates, editable docs, approval, version history, and conversion into execution work. The prototype keeps the editing interaction fast in the browser while the backend schema shows how this would be persisted in a workspace-scoped production system.”

---

## 2. Projects Workspace

### What This Feature Is

Projects is the project-management room for planning and tracking team delivery. It covers project records, members, sprints, milestones, tasks, status columns, backlog, dependencies, time logs, activities, notifications, and reporting.

Primary files:

- Frontend demo overlay: `app/src/components/ProjectManagementOverlay.tsx`
- Backend project APIs: `backend/app/routes/projects.py`
- Sprint APIs: `backend/app/routes/sprints.py`
- Milestone APIs: `backend/app/routes/milestones.py`
- Task APIs: `backend/app/routes/tasks.py`
- Models: `backend/app/models.py`

Access is permission-gated by `room.pm_access`.

### Key Things to Show

- Project room is access-controlled.
- Tasks can move through statuses/columns.
- Sprints and milestones represent planning structure.
- Dependencies prevent invalid project planning.
- Reports convert task/sprint data into progress views.
- Notifications support operational follow-up.

### Demo Steps

1. Enter the workspace as `abc`.
2. Click **Projects** in the top bar.
3. Explain: “Projects is the delivery-management area. It represents the project manager’s workspace inside the virtual office.”
4. Show the dashboard/overview area first.
5. Show project/task cards.
6. Point out the sprint or task-board style layout.
7. Explain that the frontend overlay is currently a demo UI, while the backend contains the production-style API surface.
8. Explain important backend tables:
    - `Project`
    - `ProjectMember`
    - `Sprint`
    - `Milestone`
    - `ProjectStatusColumn`
    - `Task`
    - `TaskDependency`
    - `TaskActivity`
    - `TaskComment`
    - `TimeLog`
    - `Notification`
    - `BurndownSnapshot`
9. Describe the request flow for a real backend task:
    - Frontend calls an API such as `POST /api/v1/{workspace_id}/projects/{project_id}/tasks`.
    - `get_request_context` validates workspace/user context.
    - `check_permission` validates task/project permissions.
    - SQLAlchemy writes the task.
    - Activity/notification records may be created.
10. Show permission logic: `abc` now has `room.pm_access`, so the PM overlay opens.
11. Mention reports:
    - Burndown snapshot
    - Burndown list
    - Velocity report
12. Close Projects and explain that project work is reachable both through the top bar and the PM hotspot in the map.

### Suggested Demo Script

“Projects turns the virtual office into an operational workspace. Instead of only talking inside a room, users can plan sprints, manage backlog, track work, and generate project reports. The backend is workspace-scoped and permission-checked, which is why project management is not just local browser state.”

---

## 3. CRM Workspace

### What This Feature Is

CRM is the customer and sales pipeline workspace inside MetaSpace. It manages companies, contacts, pipeline stages, deals, interactions, stale-contact checks, reports, and deal-to-project conversion.

Primary files:

- Frontend demo overlay: `app/src/components/CrmWorkspaceOverlay.tsx`
- Backend API: `backend/app/routes/crm.py`
- Models: `backend/app/models.py`

Access is permission-gated by `room.crm_access`.

### Key Things to Show

- CRM has a pipeline view for deals.
- Companies and contacts are separate entities.
- Interactions can be logged against contacts/companies/deals.
- Stale contacts can be detected.
- Reports summarize pipeline value, win rate, average cycle, and forecast.
- A won/qualified deal can be converted into a project.

### Demo Steps

1. Enter the workspace as `abc`.
2. Click **CRM** in the top bar.
3. Explain: “CRM represents the business/customer side of the workspace. It connects sales context with project execution.”
4. Show the company/contact sections.
5. Show the deals pipeline.
6. Move attention to stages and deal status.
7. Explain the backend creates a default pipeline if none exists through `_ensure_default_pipeline` in `backend/app/routes/crm.py`.
8. Show reports if visible in the UI.
9. Explain the report endpoints:
    - `GET /api/v1/{workspace_id}/crm/reports/pipeline-summary`
    - `GET /api/v1/{workspace_id}/crm/reports/win-rate`
    - `GET /api/v1/{workspace_id}/crm/reports/avg-cycle-time`
    - `GET /api/v1/{workspace_id}/crm/reports/revenue-forecast`
10. Explain deal conversion:
    - Backend route: `POST /api/v1/{workspace_id}/crm/deals/{deal_id}/convert-to-project`
    - If the deal has no linked project, it creates a `Project`.
    - It stores the created project id on `Deal.linked_project_id`.
11. Explain key CRM database tables:
    - `Company`
    - `Contact`
    - `PipelineStage`
    - `Deal`
    - `CRMInteraction`
12. Close CRM and point out the CRM hotspot on the map.

### Suggested Demo Script

“CRM completes the business loop. A team can track customers and deals, record interactions, review pipeline reports, and convert a deal into a project. That means the system connects pre-sales work to delivery management inside the same spatial workspace.”

---

## 4. Recommended Demo Order

1. Start in the spatial workspace and explain that rooms are not decorative; they open real work tools.
2. Open **Docs** first to show knowledge capture.
3. Open **Projects** second to show execution planning.
4. Open **CRM** third to show business pipeline and deal-to-project conversion.
5. Close by saying:

“The core idea is that MetaSpace is not only a virtual office. It is a spatial operating system for small teams: knowledge in Docs, execution in Projects, customer pipeline in CRM, and collaboration through avatar presence, chat, voice, meetings, Ana, and room interactions.”

---

## 5. Demo Troubleshooting

### Projects or CRM Says Permission Missing

Check localStorage:

```js
JSON.parse(localStorage.getItem('metaspace-auth')).permissions
```

The `abc` demo user is now normalized on app startup to include:

```text
room.pm_access
room.crm_access
doc.view
```

Refresh the page if the old localStorage object was already loaded before the fix.

### Docs Looks Empty

Docs demo data may be browser-local. Check:

- DevTools → Application → IndexedDB
- DevTools → Application → Local storage

### Backend Data Not Showing

Confirm backend is running:

```bash
cd backend
uvicorn app.main:app --reload --port 8787
```

Then check:

```bash
curl http://127.0.0.1:8787/health
```
