# Task 6.x Task Lifecycle and Notifications Log

## Scope

- Task create/update/delete flows (personal + project)
- Activity logging pipeline
- Comments with @mention parsing
- Time logs and My Work buckets
- Notification generation and read flow

## Problems Faced

- Maintaining consistent activity events across all mutation types.
- Mention parsing correctness vs false positives.
- Notification fan-out only to workspace members.
- Time tracking completeness (summary and aggregation expectations).

## What Failed First

- Validation lag: several lifecycle branches implemented before complete integration test coverage.
- Initial status in tracker reflected uncertainty around personal statuses/time summary completeness.

## How It Was Solved

- Enforced subtask depth guard and task relation constraints.
- Wired activity entries into create, update, reorder, comment, and time-log flows.
- Added mention extraction and member-checked notification fan-out.
- Added due-soon scheduler windows (24h and 1h) with dedupe logic.

## Best Practices That Worked

- Keep notification creation behind reusable helper to avoid route divergence.
- Add activity records at mutation sites immediately, not as post-hoc reconciliation.
- Use deterministic timestamps and IDs in tests where possible.

## Edit/Workflow Lessons

- Lifecycle features are safest when implemented with explicit action names and tested against those names.
- My Work bucketing logic remains easy to regress; tests should exercise date boundaries.

## Simpler Solutions Discovered Later

- High-value confidence came from testing a compact end-to-end mutation sequence and asserting activity/notification side effects.

## 2026-05-02 Completion Addendum

- Enforced personal task status guard (`todo/in_progress/done`) on create/update paths.
- Added task time summary endpoint with per-user aggregation.
- Added websocket notification channel and resilient polling fallback hook for frontend consumption.
- Wired high-priority notification toast/pulse behavior into the frontend session UI.
- Added integration tests for my-work due windows and high-priority notification generation.
