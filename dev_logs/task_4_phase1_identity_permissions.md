# Task 4.x Identity, Tenancy, Permissions Log

## Scope

- Core permission architecture and tenant scoping
- Roles/members/overrides APIs
- Owner/Guest invariants and cross-tenant protections

## Problems Faced

- Permission precedence complexity (revoke vs grant vs role defaults).
- High risk of missing tenant boundary checks on mutation paths.
- Owner role mutability/deletion edge cases.

## What Failed First

- Early confidence based on endpoint behavior without enough adversarial tests.
- Underestimating edge-case order in permission evaluation.

## How It Was Solved

- Centralized permission evaluation with explicit precedence.
- Enforced workspace context validation from path + headers.
- Added guardrails:
  - Owner role immutable
  - Owner role not deletable
  - Guest hard-block for crm.\* regardless of grants
- Added integration/security tests for tenant mismatch and restricted mutations.

## Best Practices That Worked

- Single `check_permission` path used consistently by mutation routes.
- Explicitly test negative paths, not just happy paths.
- Validate role override behavior with deterministic test fixtures.

## Edit/Workflow Lessons

- Permission-related code changes were safest when coupled with tests in the same iteration.
- Route-level checks were easier to audit when permission names were explicit constants.

## Simpler Solutions Discovered Later

- A few targeted security tests gave disproportionate confidence compared to broad manual API checks.

## 2026-05-02 Completion Addendum

- Implemented UI role manager and per-user override manager panels in the PM overlay.
- Added role badges to participant rows in world sidebar.
- Added PM/CRM room doors with permission-gated access, padlock hints, and lock tooltip messaging.
- Extended validation confidence with fresh backend test run: 15 passed.
