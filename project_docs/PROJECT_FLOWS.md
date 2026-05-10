# MetaSpace Prototype - Project Flows

This document describes the major end-to-end flows across the system. Each flow includes user steps, system behavior, and key file references.

## 1. Workspace Signup and Admin Onboarding

### User steps

1. Open the app and choose Signup.
2. Enter workspace name, admin profile, and password.
3. The app creates the workspace and lands in the admin dashboard.

### System flow

1. Frontend sends POST /api/v1/auth/admin-signup with workspace and admin details [app/src/App.tsx](app/src/App.tsx#L161-L186).
2. Backend validates payload and password rules, creates Workspace, User, Role, and WorkspaceMember [backend/app/routes/auth.py](backend/app/routes/auth.py#L84-L148).
3. Backend issues access and refresh tokens and returns them to the UI [backend/app/routes/auth.py](backend/app/routes/auth.py#L151-L187).
4. Frontend stores the session in localStorage and transitions to the dashboard [app/src/App.tsx](app/src/App.tsx#L74-L186).

### Key data writes

- Workspace, User, Role, WorkspaceMember, RefreshToken [backend/app/models.py](backend/app/models.py#L1-L176).

### Error states

- Duplicate workspace name or invalid password -> login/signup error toast [app/src/App.tsx](app/src/App.tsx#L174-L178).

## 2. Login, Session Restore, and Logout

### User steps

1. Return to the app with a previous session.
2. If session exists, auto-route to dashboard or workspace.
3. Logout clears local storage and invalidates refresh token.

### System flow

- On load, session is restored from localStorage [app/src/App.tsx](app/src/App.tsx#L41-L52).
- Login POST /api/v1/auth/login returns new tokens [app/src/App.tsx](app/src/App.tsx#L131-L159).
- Logout calls /api/v1/auth/logout and clears storage [app/src/App.tsx](app/src/App.tsx#L118-L129).

## 3. Entering the Workspace

### User steps

1. Click "Enter workspace" from admin dashboard.
2. The 2D office loads with the avatar, rooms, and overlays.

### System flow

- WorkspaceApp receives session data and initializes presence, WebRTC hooks, and overlays [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L80-L198).
- Avatar choice is pulled from localStorage with default fallback [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L95-L98).

## 4. Presence and Location Broadcasting

### User steps

1. Move avatar around the office.
2. See nearby users listed in the sidebar.

### System flow

- Movement updates presence state and is broadcast on BroadcastChannel [app/src/hooks/useSessionPresence.ts](app/src/hooks/useSessionPresence.ts#L48-L234).
- Remote peers are stored and rendered in the participants panel [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L100-L158).

### Important behavior

- Presence heartbeats throttle updates.
- Peers are marked stale and removed if they stop publishing.

## 5. Chat Messaging

### User steps

1. Open the chat panel.
2. Send a message to the room.
3. Chat appears for all active peers.

### System flow

- Chat messages are sent over BroadcastChannel in WorkspaceApp [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L238-L258).
- UI renders messages in RightSidebar [app/src/components/RightSidebar.tsx](app/src/components/RightSidebar.tsx).

### Important behavior

- Unread count increments when panel is closed.
- Local messages are optimistically added.

## 6. Proximity Voice Chat

### User steps

1. Approach another avatar.
2. Audio connects automatically for nearby users.

### System flow

- WorkspaceApp computes `proximityTargets` [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L181-L191).
- `useProximityVoiceWebRTC` creates peer connections and streams [app/src/hooks/useProximityVoiceWebRTC.ts](app/src/hooks/useProximityVoiceWebRTC.ts#L46-L250).

### Important behavior

- Audio is muted by default when user is muted in UI.
- Disconnects and resource cleanup happen when leaving proximity range.

## 7. Conference Room (Video + Audio)

### User steps

1. Enter conference room.
2. Enable camera/mic.
3. See remote video tiles.

### System flow

- `isConferenceRoom` toggles conference mode [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L166-L179).
- `useConferenceWebRTC` creates signaling channel and RTCPeerConnections [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L43-L209).
- Remote streams are managed in hook state and rendered by ConferenceCallOverlay [app/src/components/ConferenceCallOverlay.tsx](app/src/components/ConferenceCallOverlay.tsx).

### Important behavior

- A BroadcastChannel is used as the signaling bus; only peers in same origin/tab group can connect.
- STUN servers are configured but no TURN server is present.

## 8. Screen Share Flow

### User steps

1. Click "Share Screen" in conference overlay.
2. Select a screen or window.
3. Remote participants see the shared content.

### System flow

- `useScreenShare` grabs a video track from `getDisplayMedia` [app/src/hooks/useScreenShare.ts](app/src/hooks/useScreenShare.ts).
- `useConferenceWebRTC.setSharedVideoTrack` replaces the outbound video sender [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L211-L239).

## 9. Live Transcription and Summaries

### User steps

1. Enable captions in conference room.
2. Watch live transcripts appear.
3. View summary or export PDF.

### System flow

1. Audio is captured from conference stream and chunked in `useConferenceTranscription` [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L415-L488).
2. Chunks are sent to the local STT service (port 8765) [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L480-L498).
3. Transcripts are aggregated and cleaned using dedupe and confidence checks [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L340-L388).
4. Local rule-based summary is computed [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L268-L307).
5. Optional Gemini summary is generated if API key exists [app/src/services/gemini.ts](app/src/services/gemini.ts#L131-L162).

### Local STT service flow

- POST /transcribe receives a file chunk, decodes it via Whisper, and returns text + confidence [local-ai/stt_server.py](local-ai/stt_server.py#L82-L116).

## 10. Docs Collaboration Flow

### User steps

1. Open Docs Studio room.
2. Select a document template or open an existing doc.
3. Collaboratively edit with cursors.

### System flow

- Client uses TipTap + Yjs with y-websocket provider [app/src/components/DocsWorkspaceOverlay.tsx](app/src/components/DocsWorkspaceOverlay.tsx).
- Backend provides template and doc CRUD for server-managed docs [backend/app/routes/docs.py](backend/app/routes/docs.py#L127-L408).

### Important behavior

- Approvals are reset when content changes [backend/app/routes/docs.py](backend/app/routes/docs.py#L376-L406).
- Doc versions can be restored [backend/app/routes/docs.py](backend/app/routes/docs.py#L469-L508).

## 11. Project Management (PM Room)

### User steps

1. Open Project Management room.
2. Create a project, tasks, and sprints.
3. Reorder backlog and update task statuses.

### System flow

- Projects and status columns are created via `/projects` and `/status-columns` [backend/app/routes/projects.py](backend/app/routes/projects.py#L27-L240).
- Tasks can be reordered by backlog drag-and-drop [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L262-L299).
- Dependencies are created with cycle detection [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L123-L145).

### Important behavior

- Burndown snapshots are computed from tasks and sprint dates [backend/app/routes/projects.py](backend/app/routes/projects.py#L344-L401).

## 12. CRM Flow

### User steps

1. Open CRM room.
2. Create companies and contacts.
3. Manage deals across pipeline stages.
4. Convert a deal into a project.

### System flow

- CRM endpoints in [backend/app/routes/crm.py](backend/app/routes/crm.py#L102-L789).
- `convert-to-project` creates a PM project from a deal [backend/app/routes/crm.py](backend/app/routes/crm.py#L586-L619).
- Stale contacts job posts notifications [backend/app/routes/crm.py](backend/app/routes/crm.py#L742-L789).

## 13. Notifications

### User steps

1. Receive notifications for task mentions or due items.
2. Open notifications list.

### System flow

- Backend creates `Notification` on task events and due-soon runs [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L620-L716).
- WebSocket pushes `notification.created` messages [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L818-L843).
- Frontend uses WS and polling fallback [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L18-L103).

## 14. Calendar and Personal Tools

### User steps

1. Open Calendar room.
2. Create local events and reminders.
3. Export or share entries.

### System flow

- Calendar data stored in localStorage and synced via BroadcastChannel [app/src/hooks/useCalendarData.ts](app/src/hooks/useCalendarData.ts).
- UI rendered in CalendarOverlay [app/src/components/CalendarOverlay.tsx](app/src/components/CalendarOverlay.tsx).

## 15. Whiteboard and File Converter

- Whiteboard sessions synced via BroadcastChannel and localStorage [app/src/components/LoungeWhiteboard.tsx](app/src/components/LoungeWhiteboard.tsx).
- File converter supports JSON, CSV, and image conversion [app/src/components/FileConverter.tsx](app/src/components/FileConverter.tsx).

## 16. Error and Recovery Flows

- Failed login or signup shows toast and status message [app/src/App.tsx](app/src/App.tsx#L142-L178).
- WebRTC failures show overlay errors and cleanup resources [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L205-L208).
- STT service failures are handled by ignoring chunks and falling back to local summary [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L488-L505).

## 17. Admin User Management

- Admin can create or update users via the dashboard [backend/app/routes/auth.py](backend/app/routes/auth.py#L269-L458).
- User role assignment and resets happen through auth endpoints and WorkspaceMember updates.

## 18. Data Export Flow (Conference summary)

- `ConferenceCallOverlay` uses jsPDF to export transcript and summary [app/src/components/ConferenceCallOverlay.tsx](app/src/components/ConferenceCallOverlay.tsx).

## 19. Dev Auth Flow

- If no JWT is supplied, backend accepts `X-User-Id` and `X-Workspace-Id` headers to simplify demo testing [backend/app/dependencies.py](backend/app/dependencies.py#L18-L62).

## 20. System Startup and Local Dev

- Backend: `uvicorn app.main:app --reload --port 8787` [backend/README.md](backend/README.md).
- Frontend: `npm install` then `npm run dev` [app/README.md](app/README.md).
- Local STT: `python local-ai/stt_server.py` [local-ai/stt_server.py](local-ai/stt_server.py#L130-L133).
