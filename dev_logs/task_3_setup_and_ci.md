# Task 3.x Setup and CI Log

## Scope

- Environment bootstrap
- Backend/Frontend baseline checks
- CI-equivalent local validation

## Problems Faced

- Environment drift risk across local shells and service startup order.
- Incomplete confidence when only app boot was validated (without migration + lint + tests chain).

## What Failed First

- Treating successful app startup as sufficient verification.
- Running ad-hoc checks in different shell contexts without consistent command sequence.

## How It Was Solved

- Standardized a single validation chain:
  - Frontend build
  - Alembic migration to head
  - Backend lint
  - Backend tests
- Added/used reproducible scripts and CI workflow alignment to mirror local checks.

## Best Practices That Worked

- Validate in the same order as CI to catch dependency sequencing issues early.
- Keep backend migration check mandatory before test execution.
- Prefer deterministic commands over manual spot checks.

## Edit/Workflow Lessons

- Smaller, isolated changes per setup area were easier to verify than broad edits.
- Documentation updates paired with exact commands reduced rerun friction.

## Simpler Solutions Discovered Later

- A compact local CI-equivalent command sequence gave most confidence without full deploy simulation.
