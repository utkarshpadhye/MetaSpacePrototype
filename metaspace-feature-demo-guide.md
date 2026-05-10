# MetaSpace Feature and Demo Guide

Version: 1.0  
Date: 10 May 2026  
Purpose: Track the current implemented feature set, explain how each major feature works, and provide a practical demo script.

---

## 1. Current Product Snapshot

MetaSpace is a browser-based virtual office prototype with a cozy pixel-art workspace, spatial avatar movement, room-based collaboration tools, project management, docs, CRM, calendar, conferencing, captions, and an AI assistant.

The current implementation combines:

- React + TypeScript + Vite frontend
- Canvas-based spatial office renderer
- FastAPI backend with SQLAlchemy and Alembic migrations
- Browser-native realtime primitives such as `BroadcastChannel` and WebRTC
- Yjs/Tiptap for collaborative documents
- Local STT service for conference captions
- Gemini API for Ana and meeting summaries

---

## 2. Runbook

### 2.1 Frontend

```bash
cd app
npm install
npm run dev
```

Default local URL: `http://localhost:5173`.

### 2.2 Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8787
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

### 2.3 Local STT Service

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r local-ai/requirements.txt
python local-ai/stt_server.py
```

Default endpoint: `http://127.0.0.1:8765/transcribe`.

### 2.4 Gemini Setup

Create `app/.env`:

```bash
VITE_GEMINI_API_KEY=your_api_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash
```

Optional:

```bash
VITE_GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
```

Ana and meeting summaries fall back locally when the key is missing or Gemini is unavailable.

---

## 3. Implemented Features

### 3.1 Spatial Office

The office uses a generated baked floor-plan image at `app/public/assets/maps/cozy-startup-office-poc.png`. The visual map is separate from the interaction model.

Implemented sections:

- Conference room
- Top lounge with whiteboard
- Cafeteria with file converter
- Library with document/library portal
- Reception/front desk
- Central desk workspace
- PM workspace hotspot
- CRM workspace hotspot
- Hallways and private desk rooms

Implemented movement behavior:

- 32x32 tile-based movement
- Camera safe area that avoids topbar and bottombar overlap
- Reduced side padding by fitting the map into the available viewport
- Code-defined walkable rectangles
- Code-defined wall/furniture collision rectangles
- Room openings aligned to the generated map
- Click/path movement and keyboard movement

Why this method:

The baked image gives a fast, high-quality visual upgrade while collision and hotspots stay code-driven. This keeps the map easy to reason about and avoids baking logic into art.

### 3.2 Characters

Implemented:

- Male selectable avatar
- Female selectable avatar
- Four-direction movement
- Sprite sheet loading with metadata detection
- Local persistence of avatar selection
- Settings modal avatar picker

Why this method:

Characters remain separate sprite sheets because they animate and need to be selected independently from the floor plan.

### 3.3 Room Interactions

Implemented hotspots:

- Conference screen opens presentation/conference interaction
- Lounge whiteboard opens collaborative whiteboard
- Cafeteria converter opens file converter
- Library kiosk opens library portal
- Reception desk opens reception panel
- PM hotspot points users toward Projects
- CRM hotspot points users toward CRM

Why this method:

Hotspots are lightweight `WorldObject` entries. They are easier to reposition than baked UI and can enforce permissions or open different overlays.

### 3.4 Reception

Implemented:

- Pixel-themed reception modal
- Welcome/front desk panel
- Room directory
- Workspace notices
- Guest check-in command surface

Why this method:

Reception is a common area, so it uses a fixed themed interaction instead of admin customization.

### 3.5 Ana AI Assistant

Implemented:

- Gemini-powered responses through `app/src/services/gemini.ts`
- Conversation history conversion for Gemini `generateContent`
- Provider status in the Ana UI
- Local fallback for simple help, date/time, and calculations
- Removed local Ollama dependency from Ana

Why this method:

Gemini provides better general reasoning and removes the local model setup burden. A local fallback keeps the UI usable during demos without an API key.

### 3.6 Conference Calls

Implemented:

- Conference call overlay
- Mic mute/unmute
- Screen sharing
- Live captions from local STT service
- Shared transcript sync through `BroadcastChannel`
- Gemini meeting summary for key points, action items, and decisions
- Heuristic local summary fallback

Why this method:

Audio transcription is kept local for low-latency browser demos and privacy. Gemini is used only on transcript text to produce higher-quality meeting summaries.

### 3.7 Proximity Voice and Presence

Implemented:

- Spatial presence sync
- Nearby participant detection
- Proximity voice through WebRTC
- Mute/camera state in participant surfaces
- BroadcastChannel-based local signaling/sync for prototype use

Why this method:

WebRTC matches the target real-time collaboration behavior. BroadcastChannel keeps the prototype lightweight without requiring a signaling server yet.

### 3.8 Chat, Reactions, and UI

Implemented:

- Chat messaging
- Speech bubbles above avatars
- Emoji reactions
- Right sidebar participants/activity
- Topbar and bottombar controls
- Toast notifications

Why this method:

These features make the spatial office feel alive while keeping realtime state in browser-local channels for fast iteration.

### 3.9 Calendar

Implemented:

- Shared calendar state
- Personal calendar state
- BroadcastChannel calendar sync
- Reminders/notifications

Why this method:

Calendar data is collaborative but low-risk for the prototype, so local shared storage and channel sync are enough for demo behavior.

### 3.10 Project Management

Implemented:

- Project room overlay
- Projects, members, sprints, milestones, backlog, task board, dependencies, reports
- Permission-gated PM access through `room.pm_access`
- Backend APIs and Alembic migrations for project data

Why this method:

Project data benefits from durable backend storage, role checks, and workspace scoping, so it is implemented through FastAPI and SQLAlchemy rather than browser-only state.

### 3.11 Docs Workspace

Implemented:

- Docs workspace overlay
- Tiptap editor
- Yjs collaboration layer
- IndexedDB persistence support
- Document approval/reset flows
- Promote document content into tasks
- Backend docs endpoints

Why this method:

Tiptap gives a production-like editor experience and Yjs provides conflict-free collaboration semantics suitable for multi-user document editing.

### 3.12 CRM Workspace

Implemented:

- Companies
- Contacts
- Deals pipeline
- Deal stage movement
- Deal-to-project conversion
- Interaction logging
- Stale contact checks
- CRM reports
- Permission-gated CRM access through `room.crm_access`

Why this method:

CRM needs workspace-scoped durable data, permission checks, and reporting queries, so it is backend-backed.

### 3.13 Auth, Roles, and Permissions

Implemented:

- Login/signup flow
- Workspace-aware user context
- Role and permission management
- Admin dashboard
- Room permissions for PM and CRM
- Backend permission utility shared across protected APIs

Why this method:

Workspace scoping and permissions need backend enforcement so feature access is not only a frontend visual restriction.

### 3.14 File Converter

Implemented:

- Cafeteria file converter hotspot
- In-browser file conversion utility UI
- CSV/document/image-oriented conversion helpers depending on available browser libraries

Why this method:

The converter is a useful common-area utility and works well as a local browser tool without requiring backend processing for the current prototype.

### 3.15 Library Portal

Implemented:

- Library hotspot
- Books/company docs/archive surfaces
- Local static asset links under `app/public/assets/library`

Why this method:

The library is a common knowledge area, so static seeded resources are enough for the demo while leaving room for backend document indexing later.

---

## 4. Demo Script

### Step 1: Open MetaSpace

Start frontend and backend, then open the Vite URL. Explain that MetaSpace is a virtual office where the floor plan is both a visual workspace and a navigation surface for business tools.

### Step 2: Sign In and Explain Roles

Login or sign up. Open the admin/user area if available and show that roles and permissions control access to areas like Projects and CRM.

Demo message:

MetaSpace is tenant/workspace-aware. Backend APIs check workspace and permission context, so protected tools are not just hidden in the UI.

### Step 3: Walk the Office

Move the avatar using arrow keys/WASD or click-to-move. Walk around:

- Conference room
- Lounge
- Cafeteria
- Library
- Reception
- Desk areas

Point out that the generated map is a baked image, but movement is governed by code-defined collision and walkability.

### Step 4: Show Collision and Room Layout

Try walking into a wall or furniture. Then move through a door opening into a room.

Demo message:

The floor art and game logic are separate. This lets us use AI-generated maps while still keeping precise movement rules.

### Step 5: Change Character

Open Settings and switch between male and female avatars. Refresh to show persistence.

Demo message:

Avatars are independent sprite sheets, so we can add more characters without changing map logic.

### Step 6: Reception

Walk to the reception desk and interact. Show:

- Welcome panel
- Directory
- Notices
- Guest check-in surface

Demo message:

Reception acts as the office entry point and information hub.

### Step 7: Lounge Whiteboard

Walk to the top-middle sofa/lounge area and open the whiteboard.

Show drawing/collaboration behavior if multiple tabs are open.

Demo message:

Common room tools are placed where users expect them. The lounge now owns whiteboarding.

### Step 8: Cafeteria File Converter

Move to cafeteria and open File Converter.

Demo message:

The cafeteria includes utility tools, making common areas functional instead of decorative.

### Step 9: Library

Move to library and open the Library Portal.

Show books, company docs, and archived materials.

Demo message:

The library groups knowledge-management features in a single physical section.

### Step 10: Conference Room

Enter the conference room, open conference controls, and show:

- Mic controls
- Screen sharing
- Captions toggle
- Transcript area
- Meeting summary

Demo message:

Captions come from local STT. Summaries use Gemini when configured and fall back to local heuristics when not.

### Step 11: Ana Assistant

Open Ana and ask a workspace question, for example:

```text
Summarize what I can demo in the project room.
```

Demo message:

Ana now uses Gemini through the frontend service layer. If the key is absent, Ana still has a small local fallback.

### Step 12: Projects

Open Projects from the topbar or PM hotspot. Show:

- Project list
- Members
- Sprints
- Backlog
- Task board
- Dependencies
- Reports

Demo message:

Project management is backend-backed because tasks, sprints, and permissions need durable state and API enforcement.

### Step 13: Docs

Open Docs. Show:

- Editor
- Collaboration behavior
- Approval/reset flows
- Promote content to task

Demo message:

Docs use Tiptap and Yjs so multi-user editing can be conflict-free.

### Step 14: CRM

Open CRM. Show:

- Companies
- Contacts
- Deals pipeline
- Reports
- Deal conversion to project
- Stale contact checks

Demo message:

CRM links sales work to project execution, turning a deal into delivery work.

### Step 15: Calendar and Notifications

Open Calendar, create or inspect events, and show reminders/toasts.

Demo message:

Calendar brings lightweight planning into the same workspace so the office is not only spatial chat.

### Step 16: Multi-Tab Realtime Demo

Open a second browser tab with another user/session if available. Show:

- Presence
- Movement sync
- Chat bubbles
- Emoji reactions
- Calendar/whiteboard sync
- Proximity voice behavior

Demo message:

For the prototype, local browser channels simulate realtime collaboration quickly. The architecture leaves room for a server signaling layer later.

---

## 5. Implementation Notes by Area

### Spatial Renderer

Key files:

- `app/src/components/GameCanvas.tsx`
- `app/src/canvas/world.ts`
- `app/public/assets/maps/cozy-startup-office-poc.png`

Implementation:

- Canvas draws the generated floor plan first.
- Player, peers, labels, reactions, highlights, and overlays are drawn on top.
- `world.ts` defines walkable rectangles, blocked rectangles, sections, seats, and hotspots.
- Collision returns true only for approved walkable, non-wall tiles.

### Gemini

Key files:

- `app/src/services/gemini.ts`
- `app/src/hooks/useAnaAgent.ts`
- `app/src/hooks/useConferenceTranscription.ts`
- `app/.env.example`

Implementation:

- `askGemini` handles Ana chat.
- `summarizeMeetingWithGemini` requests strict JSON for meeting summaries.
- Missing API key results in local fallback behavior.

### Backend

Key files:

- `backend/app/main.py`
- `backend/app/routes/*.py`
- `backend/app/models.py`
- `backend/alembic/versions/*.py`

Implementation:

- FastAPI routes expose workspace-scoped APIs.
- SQLAlchemy models hold durable product data.
- Alembic migrations track schema changes.
- Permission checks centralize access control.

### Collaboration

Key files:

- `app/src/hooks/useConferenceWebRTC.ts`
- `app/src/hooks/useProximityVoiceWebRTC.ts`
- `app/src/hooks/useSessionPresence.ts`
- `app/src/hooks/useCalendarData.ts`
- `app/src/components/LoungeWhiteboard.tsx`

Implementation:

- WebRTC handles voice/video-style peer media.
- BroadcastChannel handles local prototype signaling and cross-tab state sync.
- Whiteboard and calendar use local persistence plus channel updates.

---

## 6. Current Validation

Latest validation:

```bash
cd app
npm run build
```

Result: passed.

Known follow-up:

- Run a manual room-by-room browser QA pass after the next visual review.
- Replace prototype BroadcastChannel signaling with backend/WebSocket signaling when moving beyond local demos.
- Future iteration: admin-customizable desk occupancy/layout for desk areas only; common areas should remain fixed.
