# Manual Testing Guide: Docs + CRM

This is a brief checklist to validate the new Docs and CRM features. It also includes a question list and response format so you can send back findings for faster debugging.

## Quick setup

- Start frontend: `cd app && npm run dev`
- Start backend: `cd backend && /Users/utkarsh/Documents/code/MetaSpacePrototype/.venv/bin/python -m uvicorn app.main:app --reload --port 8787`
- Open the app and use the Top Bar buttons: Docs and CRM.

## Docs Studio manual tests

- Open Docs Studio from the top bar.
- Create a doc from a template.
- Rename, duplicate, move, and delete docs in the tree.
- Use search to find text in titles and body content.
- Toggle "Requirements" and verify approval banner behavior.
- Approve a doc, edit it, and confirm it resets back to draft.
- Open the app in a second browser tab to test Yjs live collaboration (type in both tabs).
- Run the in-UI baseline button and note timing output.

## CRM Suite manual tests

- Open CRM Suite from the top bar.
- Search companies and contacts.
- Drag deals across pipeline stages and verify status updates.
- Convert a deal and check that the item shows converted state.
- Run the report baseline button and note timing output.
- Run the stale contact check and verify stale status updates.
- Log a guest session prompt and verify it appears in the automation log.

## Expected outcomes

- UI styling matches the global pixel theme (colors, borders, typography).
- Docs tree actions and template management operate without errors.
- Approval banner shows and resets correctly on edits.
- Collaboration updates appear in both tabs quickly.
- CRM pipeline drag/drop and report metrics update consistently.

## What to send back (for debugging)

Please answer in this structure:

1. Summary

- One or two sentences describing what failed or felt off.

2. Steps

- Exact step-by-step actions taken.

3. Observed

- What you saw (error messages, wrong UI state, missing data).

4. Expected

- What you expected instead.

5. Environment

- Browser + version, OS, and whether multiple tabs were open.

6. Logs/Artifacts

- Console errors, network errors, or screenshots (if possible).

## Questions to answer

- Which tab were you on when the issue happened (Docs/CRM/Projects)?
- Did the issue reproduce after refresh? How many times?
- Did the problem occur in multiple browsers?
- Was a second tab open for collaboration testing?
- Any console or network errors? Copy the exact message.
