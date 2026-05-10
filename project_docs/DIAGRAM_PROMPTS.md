# MetaSpace Prototype - Diagram Prompts

Use these prompts to create consistent diagrams (Mermaid or draw.io). Each prompt includes the expected nodes, edges, and file references.

## 1) High-Level Architecture (C4 Container)

Prompt:
Create a container diagram with three boxes: Frontend SPA (Vite + React), Backend API (FastAPI + SQLAlchemy), Local STT Service (FastAPI + faster-whisper). Draw arrows: Frontend -> Backend (REST + WebSocket), Frontend -> Local STT (POST /transcribe), Backend -> DB (Postgres). Label Frontend entrypoint [app/src/App.tsx](app/src/App.tsx#L1-L260), Backend entrypoint [backend/app/main.py](backend/app/main.py#L1-L96), STT server [local-ai/stt_server.py](local-ai/stt_server.py#L1-L133).

## 2) Auth and Session Flow

Prompt:
Draw a sequence diagram showing: User -> Frontend App -> Backend Auth routes. Steps: POST /auth/login, receive tokens, localStorage save, route to dashboard/workspace. Use references [app/src/App.tsx](app/src/App.tsx#L131-L186) and [backend/app/routes/auth.py](backend/app/routes/auth.py#L151-L229).

## 3) Permission Check Pipeline

Prompt:
Flowchart: API request -> `get_request_context` -> `check_permission` -> route handler -> DB. Include branch for dev headers vs bearer token. Use [backend/app/dependencies.py](backend/app/dependencies.py#L18-L62) and [backend/app/security.py](backend/app/security.py#L9-L72).

## 4) Presence and Chat Broadcast

Prompt:
Sequence diagram with 2 clients: Client A publishes presence/chat to BroadcastChannel -> Client B receives and updates UI. Include `useSessionPresence` and chat channel in WorkspaceApp. Use [app/src/hooks/useSessionPresence.ts](app/src/hooks/useSessionPresence.ts#L48-L234) and [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L238-L258).

## 5) Conference WebRTC Signaling

Prompt:
Diagram with 3 peers: peer A, peer B, peer C. Show BroadcastChannel signaling messages (join, offer, answer, candidate). Show RTCPeerConnection and media streams. Use [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L10-L209).

## 6) Proximity Voice WebRTC

Prompt:
Diagram showing proximity detection -> targets list -> WebRTC connections -> remote audio streams. Use [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L181-L191) and [app/src/hooks/useProximityVoiceWebRTC.ts](app/src/hooks/useProximityVoiceWebRTC.ts#L46-L223).

## 7) Live Transcription Pipeline

Prompt:
Flowchart: Conference audio -> ScriptProcessor -> downsample -> WAV encode -> POST /transcribe -> STT response -> transcript merge -> summary. Include confidence filtering and dedupe. Use [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L415-L505) and [local-ai/stt_server.py](local-ai/stt_server.py#L31-L116).

## 8) Gemini Summarization Flow

Prompt:
Sequence diagram: Frontend (summarizeMeetingWithGemini) -> Gemini API -> parse JSON -> update UI. Add condition: if API key missing, throw error and fall back to local summary. Use [app/src/services/gemini.ts](app/src/services/gemini.ts#L33-L162).

## 9) Docs Approval and Versioning

Prompt:
State diagram: Draft -> Approved -> Updated -> Approval reset -> Version created -> Approved. Include endpoints for approve and version restore. Use [backend/app/routes/docs.py](backend/app/routes/docs.py#L376-L485).

## 10) CRM Deal to Project Conversion

Prompt:
Sequence diagram: UI -> POST /crm/deals/{id}/convert-to-project -> create Project -> update Deal -> return project. Use [backend/app/routes/crm.py](backend/app/routes/crm.py#L586-L619) and [backend/app/models.py](backend/app/models.py#L401-L486).

## 11) Notifications Realtime Flow

Prompt:
Diagram: Backend creates notification -> NotificationHub publishes -> WebSocket sends to client -> client ingests, UI pulse. Include fallback polling. Use [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L620-L843) and [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L35-L103).

## 12) Database Schema Overview

Prompt:
Entity relationship diagram with entities: Workspace, User, Role, WorkspaceMember, Project, Sprint, Milestone, Task, TaskComment, TaskActivity, Notification, Doc, DocVersion, Company, Contact, Deal, PipelineStage, CRMInteraction. Show key foreign keys (workspace_id, project_id, task_id). Use [backend/app/models.py](backend/app/models.py#L1-L486).
