# Rate-Limit Efficiency Log

## Objective

- Maximize useful work under constrained request budget.

## What Was Costly

- Full-repo changed-file dumps in a dirty workspace produced oversized outputs and context bloat.
- Re-reading broad files repeatedly instead of targeted ranges.

## What Worked Better

- Prioritize focused grep/read on exact files and symbols.
- Run parallel read-only lookups when context gathering is independent.
- Avoid large binary/unrelated diff retrieval during active implementation.

## Practical Workflow

1. Read tracker section ranges only.
2. Open only files required for current task.
3. Batch edits per file, then run lint/tests once per batch.
4. Update tracker statuses only after evidence-producing validation.

## Edit Strategy That Saved Budget

- Small, scoped patches to backend tests and tracker lines.
- Avoid broad formatting/refactor-only changes.
- Prefer deterministic assertions over verbose integration scaffolding.

## Retrospective

- Most wasted budget came from noisy repository state inspection, not from implementation.
- Tight task-to-file mapping is the best budget control.

## 2026-05-02 Optimization Implemented

- Added backend sliding-window limiter with in-memory deque buckets.
- Added two-tier policy:
  - Global per-identity request cap per minute.
  - Stricter per-path mutation cap for write endpoints.
- Kept limiter keying compact (`global:user`, `mutation:user:path`) for low overhead.
- Applied as middleware before request handling to fail fast with 429 and reduce downstream DB load.
