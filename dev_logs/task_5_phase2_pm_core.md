# Task 5.x PM Core (Scrum Foundations) Log

## Scope

- Project CRUD
- Milestones CRUD
- Sprints CRUD with single active sprint invariant
- Status columns and backlog reorder APIs

## Problems Faced

- Ensuring sprint lifecycle constraints at DB/API levels.
- Keeping route behavior consistent across create/update/delete variants.
- Balancing delivery speed with validation depth.

## What Failed First

- Initial reliance on API-level assumptions for sprint constraints without enough dedicated tests.
- Partial verification of route guards created residual uncertainty.

## How It Was Solved

- Added explicit sprint guard logic for one active sprint per project.
- Added test coverage for active sprint collision.
- Used deterministic seeded fixtures to test permission-scoped PM operations.

## Best Practices That Worked

- Constraint checks near mutation points reduced accidental invalid transitions.
- Reuse of response mapping helpers reduced endpoint divergence.
- FastAPI dependency-driven context made tenant checks consistent.

## Edit/Workflow Lessons

- PM route work moved faster when models + schemas + routes + tests were handled in one contiguous pass.
- Targeted checks are more maintainable than large generic validators.

## Simpler Solutions Discovered Later

- A narrowly-scoped active sprint guard solved most sprint consistency concerns without complex orchestration.

## 2026-05-02 Completion Addendum

- Added sprint lifecycle endpoints for explicit start and complete actions, including carry-over handling.
- Added dependency edge APIs with cycle detection and a dedicated dependency table.
- Added burndown snapshot model plus burndown/velocity report APIs.
- Implemented PM overlay UI for board, backlog, timeline, carry-over modal, report cards, and topbar Projects entrypoint.
- Added targeted API tests for lifecycle flow, cycle prevention, and report correctness.
