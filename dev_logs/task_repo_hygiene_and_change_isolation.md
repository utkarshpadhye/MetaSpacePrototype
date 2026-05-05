# Repo Hygiene and Unrelated Changes Isolation

## Problem

- Large unrelated pre-existing changes made verification noisy and reduced execution efficiency.

## Safe Handling Approach

- Do not reset or revert unknown user work.
- Isolate task-relevant file set and validate only those paths.
- Clean obvious machine artifacts only when safe (`__pycache__`, stray `.DS_Store` where appropriate).

## What Did Not Work Well

- Using broad changed-file inspection in a very dirty tree.
- Treating repository-wide status as a blocker for scoped backend completion.

## Better Pattern

- Use path-scoped checks:
  - backend routes/models/migrations/tests
  - tracker markdown
  - dev logs
- Keep a dedicated log of unrelated changes and proceed with scoped verification.

## Recommended Ongoing Practice

- Maintain root ignore rules for OS/cache artifacts.
- Keep generated artifacts out of source control unless intentionally versioned.
- Use separate branches/worktrees for independent feature streams when possible.
