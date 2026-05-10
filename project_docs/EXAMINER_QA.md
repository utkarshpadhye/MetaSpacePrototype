# MetaSpace Prototype - Examiner Q and A (100)

1. Q: How does the frontend decide whether to show the admin dashboard or the workspace after login?
   A: It uses `session.roleName` and `session.mustResetPassword` in App state; Owner/Admin route to dashboard, others to workspace, with reset taking precedence [app/src/App.tsx](app/src/App.tsx#L45-L158).

2. Q: Where is the session persisted, and what key is used?
   A: Local storage under `metaspace-auth` in App [app/src/App.tsx](app/src/App.tsx#L37-L77).

3. Q: What backend mechanism prevents cross-workspace access?
   A: `get_request_context` validates `workspace_id` and rejects mismatches for user/workspace [backend/app/dependencies.py](backend/app/dependencies.py#L18-L62).

4. Q: Which function explicitly blocks Guests from CRM access even with grants?
   A: `check_permission` returns false for Guests when permission starts with `crm.` [backend/app/security.py](backend/app/security.py#L43-L45).

5. Q: How are refresh tokens stored and invalidated?
   A: A hashed `RefreshToken` row is stored and checked; logout deletes the stored refresh token [backend/app/routes/auth.py](backend/app/routes/auth.py#L202-L241).

6. Q: What is the API base URL used by the frontend for auth calls?
   A: `http://127.0.0.1:8787` in App [app/src/App.tsx](app/src/App.tsx#L37-L39).

7. Q: Which middleware logs requests and durations?
   A: `log_requests` middleware in main [backend/app/main.py](backend/app/main.py#L57-L69).

8. Q: How is rate limiting enforced and where is it configured?
   A: Rate limit middleware checks `rate_limiter` per request; configured in main [backend/app/main.py](backend/app/main.py#L41-L54).

9. Q: Where are permission sets and role defaults defined?
   A: `permissions.py` defines `ROLE_PERMISSIONS` and color labels [backend/app/permissions.py](backend/app/permissions.py#L1-L149).

10. Q: Which endpoint creates a workspace and its owner?
    A: POST `/api/v1/auth/admin-signup` in [backend/app/routes/auth.py](backend/app/routes/auth.py#L84-L148).

11. Q: What validates password complexity for signup?
    A: Password validation is in `auth.py` (length and complexity checks) [backend/app/auth.py](backend/app/auth.py#L12-L52).

12. Q: How does the frontend handle failed login response?
    A: It reads response text, sets `loginStatus`, and shows a toast [app/src/App.tsx](app/src/App.tsx#L142-L146).

13. Q: Which WebSocket endpoint does the frontend use for notifications?
    A: `/api/v1/{workspace_id}/notifications/ws` [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L66-L83).

14. Q: What is the fallback if WebSocket connection fails for notifications?
    A: Polling every 15 seconds via REST [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L48-L94).

15. Q: How are high-priority notifications surfaced to the UI?
    A: The hook increments `highPriorityPulse` when unseen items have `priority === 'high'` [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L35-L44).

16. Q: Where does the backend broadcast notification events?
    A: In tasks routes via `notification_hub` and `publish_notification` [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L78-L115).

17. Q: Which endpoint returns user notifications?
    A: GET `/api/v1/{workspace_id}/notifications` [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L698-L723).

18. Q: How does the frontend decide whether it is in conference room mode?
    A: It checks whether `voiceLabel` includes `Conference Room` [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L165-L179).

19. Q: What signaling mechanism is used for conference WebRTC?
    A: BroadcastChannel with prefix `metaspace-conference-webrtc` [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L32-L88).

20. Q: How are RTCPeerConnections cleaned up for conference rooms?
    A: `cleanupPeer` closes and removes connections and streams [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L94-L107).

21. Q: How is an outbound shared video track injected into WebRTC?
    A: `setSharedVideoTrack` replaces the sender track or adds a new one [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L211-L239).

22. Q: How does proximity voice audio get captured?
    A: `getUserMedia` is called for audio in `useProximityVoiceWebRTC` [app/src/hooks/useProximityVoiceWebRTC.ts](app/src/hooks/useProximityVoiceWebRTC.ts#L103-L123).

23. Q: What happens when proximity voice becomes inactive?
    A: Peers are hung up, tracks stopped, state cleared, and channel closed [app/src/hooks/useProximityVoiceWebRTC.ts](app/src/hooks/useProximityVoiceWebRTC.ts#L223-L244).

24. Q: How are transcript lines de-duplicated?
    A: `appendTranscriptLine` merges near-duplicates and keeps a max of 250 lines [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L340-L388).

25. Q: What method is used to summarize transcripts locally?
    A: `summarizeTranscript` extracts unique sentences and action/decision patterns [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L268-L307).

26. Q: What is the default STT endpoint used by the frontend?
    A: `http://127.0.0.1:8765/transcribe` [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L49-L52).

27. Q: How does the frontend determine if transcription is supported?
    A: It checks for window, AudioContext, and `navigator.mediaDevices` [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L334-L338).

28. Q: What payload does the local STT server return?
    A: `text`, `language`, `ignored`, `avg_logprob`, `no_speech_prob` [local-ai/stt_server.py](local-ai/stt_server.py#L82-L116).

29. Q: How does the STT server decide which file suffix to use?
    A: `_pick_suffix` infers from filename or content type [local-ai/stt_server.py](local-ai/stt_server.py#L54-L69).

30. Q: What Whisper model settings are used for STT?
    A: `beam_size=3`, `temperature=0.0`, and thresholds in `_transcribe_text` [local-ai/stt_server.py](local-ai/stt_server.py#L31-L42).

31. Q: How does Gemini get invoked, and when is it blocked?
    A: `requestGemini` throws if `VITE_GEMINI_API_KEY` is missing [app/src/services/gemini.ts](app/src/services/gemini.ts#L45-L48).

32. Q: How is Gemini instructed to return JSON for summaries?
    A: `summarizeMeetingWithGemini` embeds a JSON schema prompt and parses the response [app/src/services/gemini.ts](app/src/services/gemini.ts#L131-L162).

33. Q: How does the frontend mark a user as muted for proximity voice?
    A: `muted` flag is passed to `useProximityVoiceWebRTC` and applied to local tracks [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L184-L191) and [app/src/hooks/useProximityVoiceWebRTC.ts](app/src/hooks/useProximityVoiceWebRTC.ts#L107-L115).

34. Q: Where is the avatar choice stored?
    A: Local storage under `metaspace-avatar-choice` [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L74-L98).

35. Q: How are meeting notes exported to PDF?
    A: Conference overlay uses jsPDF for export [app/src/components/ConferenceCallOverlay.tsx](app/src/components/ConferenceCallOverlay.tsx).

36. Q: Where are docs templates created and listed?
    A: Doc templates endpoints in docs routes [backend/app/routes/docs.py](backend/app/routes/docs.py#L127-L156).

37. Q: What happens when a doc is updated after being approved?
    A: Approvals are cleared and version is created [backend/app/routes/docs.py](backend/app/routes/docs.py#L376-L406).

38. Q: Which endpoint promotes a doc into a task story?
    A: POST `/docs/{doc_id}/promote-story` [backend/app/routes/docs.py](backend/app/routes/docs.py#L495-L511).

39. Q: Which endpoint runs the due-soon notification job?
    A: POST `/notifications/due-soon/run` [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L750-L815).

40. Q: How are task dependencies protected against cycles?
    A: `assert_dependency_is_acyclic` checks before insert [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L123-L145).

41. Q: What fields define a `Task` in the data model?
    A: `Task` in models includes status, priority, assignee, and sprint references [backend/app/models.py](backend/app/models.py#L220-L316).

42. Q: Where are CRM pipeline stages defined?
    A: `PipelineStage` model and CRUD in crm routes [backend/app/models.py](backend/app/models.py#L401-L486) and [backend/app/routes/crm.py](backend/app/routes/crm.py#L102-L236).

43. Q: How is a CRM deal converted into a project?
    A: Endpoint creates a Project and marks deal as converted [backend/app/routes/crm.py](backend/app/routes/crm.py#L586-L619).

44. Q: Which endpoint auto-logs guest interactions?
    A: POST `/crm/guest-sessions/auto-log` [backend/app/routes/crm.py](backend/app/routes/crm.py#L703-L739).

45. Q: How is the burndown snapshot generated?
    A: Endpoint aggregates remaining points from sprint tasks [backend/app/routes/projects.py](backend/app/routes/projects.py#L344-L401).

46. Q: Which components provide overlay UIs for rooms?
    A: `ProjectManagementOverlay`, `DocsWorkspaceOverlay`, `CrmWorkspaceOverlay`, `ConferenceCallOverlay` [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L6-L18).

47. Q: How is local summary computed if Gemini is unavailable?
    A: `summarizeTranscript` builds a summary from the last 120 lines [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L268-L307).

48. Q: What is the default Gemini model and endpoint?
    A: Model defaults to `gemini-2.5-flash` and endpoint uses `generateContent` [app/src/services/gemini.ts](app/src/services/gemini.ts#L27-L31).

49. Q: How are admin users listed and managed?
    A: Auth routes list users and create/update user profiles [backend/app/routes/auth.py](backend/app/routes/auth.py#L269-L458).

50. Q: How is the API base URL used for notifications in WorkspaceApp?
    A: `useNotifications` is called with `apiBaseUrl` and `workspaceId` [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L192-L197).

51. Q: Where is the in-memory notification hub implemented?
    A: `NotificationHub` in [backend/app/realtime.py](backend/app/realtime.py).

52. Q: How are local errors exposed during WebRTC setup?
    A: Hook `setError` sets human-readable errors for UI [app/src/hooks/useConferenceWebRTC.ts](app/src/hooks/useConferenceWebRTC.ts#L205-L208).

53. Q: What protects unauthorized access to API routes?
    A: Dependencies resolve auth context and `check_permission` guards routes [backend/app/dependencies.py](backend/app/dependencies.py#L18-L62) and [backend/app/security.py](backend/app/security.py#L9-L72).

54. Q: How do you identify in code when a workspace member is removed?
    A: Member delete route removes WorkspaceMember (see members routes in backend) [backend/app/routes/members.py](backend/app/routes/members.py).

55. Q: How are task mentions converted into notifications?
    A: Task comment handler parses mentions and creates notifications [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L372-L431).

56. Q: Which object fields are required for notifications?
    A: `Notification` has title, body, priority, read status [backend/app/models.py](backend/app/models.py#L318-L340).

57. Q: Where is the default room voice label defined?
    A: `Voice: Main Room (auto)` in WorkspaceApp state [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L83-L86).

58. Q: How does the app decide which participants are "nearby"?
    A: `participants` array contains `nearby` and `distance` which are computed in presence hook [app/src/hooks/useSessionPresence.ts](app/src/hooks/useSessionPresence.ts#L130-L234).

59. Q: What file defines the map sections and interaction objects?
    A: World data in [app/src/canvas/world.ts](app/src/canvas/world.ts).

60. Q: How is audio downsampled for STT?
    A: `downsampleTo16k` in `useConferenceTranscription` [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L84-L110).

61. Q: What are the filters used to reject low-confidence STT text?
    A: `shouldAcceptTranscriptText` uses `avgLogprob` and `noSpeechProb` thresholds [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L227-L247).

62. Q: How is malformed Gemini output handled?
    A: `parseJsonObject` extracts and validates JSON; invalid results throw [app/src/services/gemini.ts](app/src/services/gemini.ts#L103-L156).

63. Q: What is the fallback label when Gemini is unavailable?
    A: `Local fallback (Gemini key missing)` [app/src/services/gemini.ts](app/src/services/gemini.ts#L37-L38).

64. Q: How is sprint completion handled?
    A: `complete_sprint` updates sprint status and moves carry-over tasks [backend/app/routes/sprints.py](backend/app/routes/sprints.py#L207-L262).

65. Q: Which task endpoint returns the "my work" list?
    A: GET `/api/v1/{workspace_id}/my-work` [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L652-L695).

66. Q: How are project status columns ordered?
    A: Ordered by `position` field on `ProjectStatusColumn` [backend/app/models.py](backend/app/models.py#L178-L216).

67. Q: Where is the token refresh endpoint implemented?
    A: POST `/api/v1/auth/refresh` [backend/app/routes/auth.py](backend/app/routes/auth.py#L202-L229).

68. Q: How does the frontend clear a session when a user logs out?
    A: `clearSession` posts logout, removes local storage, and switches view [app/src/App.tsx](app/src/App.tsx#L118-L129).

69. Q: Where is `workspace_id` encoded into API calls in the frontend?
    A: In `useNotifications` fetch and WS URL [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L48-L83).

70. Q: How are room transitions reflected in the UI?
    A: `roomTransition` state in WorkspaceApp controls overlay transitions [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L87-L89).

71. Q: How does the app handle banner messages after login?
    A: `pushBanner` sets a message that clears after a timeout [app/src/App.tsx](app/src/App.tsx#L92-L95).

72. Q: Which endpoint returns sprint lists for a project?
    A: GET `/projects/{project_id}/sprints` [backend/app/routes/sprints.py](backend/app/routes/sprints.py#L39-L57).

73. Q: Which endpoint creates task comments?
    A: POST `/tasks/{task_id}/comments` [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L372-L431).

74. Q: How is task reorder logic implemented?
    A: Backlog reorder updates `backlog_order` fields [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L262-L299).

75. Q: How are time logs summarized?
    A: `sum(TimeLog.duration_minutes)` query returns total for task [backend/app/routes/tasks.py](backend/app/routes/tasks.py#L471-L488).

76. Q: How are CRM reports generated?
    A: Pipeline summary aggregates deals by stage [backend/app/routes/crm.py](backend/app/routes/crm.py#L792-L840).

77. Q: What is the local STT CORS policy?
    A: Allows localhost and 127.0.0.1 Vite origins [local-ai/stt_server.py](local-ai/stt_server.py#L17-L25).

78. Q: How does `get_request_context` support dev testing?
    A: It accepts `X-User-Id` and `X-Workspace-Id` headers when no bearer token is provided [backend/app/dependencies.py](backend/app/dependencies.py#L18-L62).

79. Q: How does the app avoid adding duplicate transcript lines?
    A: `seenIdsRef` filters by line ID [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L340-L347).

80. Q: What is the maximum transcript line count stored?
    A: 250 lines (MAX_TRANSCRIPT_LINES) [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L49-L50).

81. Q: How is user avatar gender selected on first run?
    A: default fallback is `male` when storage is missing [app/src/WorkspaceApp.tsx](app/src/WorkspaceApp.tsx#L95-L98).

82. Q: Where are role colors defined?
    A: `ROLE_COLORS` in permissions [backend/app/permissions.py](backend/app/permissions.py#L115-L149).

83. Q: How are user permissions stored in the session on the frontend?
    A: `permissions` array is stored in the `AuthSession` state [app/src/App.tsx](app/src/App.tsx#L7-L16).

84. Q: How does the app detect if it should reset the password?
    A: `mustResetPassword` on session is used to route to reset view [app/src/App.tsx](app/src/App.tsx#L49-L52).

85. Q: How is the API URL derived for WebSocket notifications?
    A: Replaces `http` with `ws` in `apiBaseUrl` [app/src/hooks/useNotifications.ts](app/src/hooks/useNotifications.ts#L66-L71).

86. Q: Which endpoint creates CRM contacts?
    A: POST `/crm/contacts` [backend/app/routes/crm.py](backend/app/routes/crm.py#L320-L399).

87. Q: Where is the Alembic migration path defined?
    A: `alembic` script location in [backend/alembic.ini](backend/alembic.ini).

88. Q: How does Alembic import app models without errors?
    A: It inserts the backend root into `sys.path` [backend/alembic/env.py](backend/alembic/env.py#L8-L14).

89. Q: Which module defines the database engine and Session?
    A: `database.py` [backend/app/database.py](backend/app/database.py).

90. Q: What is the expected database URL default in Alembic config?
    A: `postgresql+psycopg://postgres:postgres@localhost:5432/metaspace` [backend/alembic.ini](backend/alembic.ini).

91. Q: How does the system handle invalid STT chunks?
    A: It returns `ignored: true` for invalid audio or empty content [local-ai/stt_server.py](local-ai/stt_server.py#L86-L125).

92. Q: What is the default Gemini temperature and max tokens?
    A: `temperature: 0.3`, `maxOutputTokens: 700` [app/src/services/gemini.ts](app/src/services/gemini.ts#L72-L75).

93. Q: Where are the STT server host and port configured?
    A: `uvicorn.run` in `stt_server.py` uses host 127.0.0.1 and port 8765 [local-ai/stt_server.py](local-ai/stt_server.py#L130-L133).

94. Q: How does the app decide if a meeting transcript line is a decision?
    A: It matches `decisionPattern` in `summarizeTranscript` [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L56-L58) and [app/src/hooks/useConferenceTranscription.ts](app/src/hooks/useConferenceTranscription.ts#L281-L286).

95. Q: Which file defines the user permission override model?
    A: `UserPermissionOverride` in [backend/app/models.py](backend/app/models.py#L120-L150).

96. Q: Where are project members defined?
    A: `ProjectMember` model in [backend/app/models.py](backend/app/models.py#L176-L216).

97. Q: How are refresh tokens hashed?
    A: `hash_refresh_token` in `auth.py` [backend/app/auth.py](backend/app/auth.py#L59-L66).

98. Q: Which endpoints manage doc approvals?
    A: POST `/docs/{doc_id}/approve` [backend/app/routes/docs.py](backend/app/routes/docs.py#L411-L434).

99. Q: What functionality is provided by `NotificationToast`?
    A: UI component for ephemeral toasts in login and workspace [app/src/App.tsx](app/src/App.tsx#L4-L90) and [app/src/components/NotificationToast.tsx](app/src/components/NotificationToast.tsx).

100. Q: Where is the local STT service described for setup?
     A: Top-level README references the local STT server [README.md](README.md).
