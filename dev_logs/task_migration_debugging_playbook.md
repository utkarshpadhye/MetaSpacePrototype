# Migration Debugging Playbook (Phase 4-6 Stabilization)

## Incident

- Alembic upgrade failed with PostgreSQL error: duplicate enum type creation (`DuplicateObject`, sprint_status already exists).

## Root Cause Pattern

- Named PostgreSQL enum lifecycle collided in partially-migrated/local divergent states.
- Re-running migration against existing enum objects was brittle.

## Failed Attempts

- Removing explicit enum create/drop orchestration alone did not reliably eliminate duplicate-type emissions.
- Assuming `checkfirst`-style behavior would cover all migration states was insufficient.

## Final Fix

- Replaced enum-backed columns with String + CheckConstraint for affected status/priority fields in model + migration.
- Removed enum lifecycle dependency from migration path.

## Why This Worked

- String + CHECK avoids global enum object lifecycle conflicts while preserving value constraints.
- Better tolerance to partially-applied local migration histories.

## Validation Run

- `alembic upgrade head` success
- `ruff check backend` success
- `pytest backend/tests` success

## Reusable Guidance

- During rapid iteration, prefer String + CHECK for volatile status vocabularies.
- Use database enums only when lifecycle and rollout discipline is strong and stable.
