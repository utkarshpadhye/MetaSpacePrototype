# MetaSpace Backend (Lightweight)

This service provides the Phase 1 foundation for:

- Tenant-aware data isolation (`workspace_id` scoping)
- Role/permission checks via a shared `check_permission` utility
- Seeded default roles per workspace
- First protected mutation endpoint for project creation

## Quick Start

1. Create and activate environment:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Run migrations:

```bash
alembic upgrade head
```

4. Start API:

```bash
uvicorn app.main:app --reload --port 8787
```

5. Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Dev Authentication Convention (temporary)

For local development, authenticated context is passed via headers:

- `X-User-Id`: UUID for acting user
- `X-Workspace-Id`: UUID for active workspace

These are validated against the request path `workspace_id` and used by permission checks.

## Tests

```bash
pytest -q
```
