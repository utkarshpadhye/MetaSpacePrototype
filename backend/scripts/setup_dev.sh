#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v /opt/homebrew/opt/postgresql@15/bin/psql >/dev/null 2>&1; then
  echo "PostgreSQL 15 binaries not found at /opt/homebrew/opt/postgresql@15/bin"
  exit 1
fi

DB_EXISTS=$(/opt/homebrew/opt/postgresql@15/bin/psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='metaspace'")
if [[ "$DB_EXISTS" != "1" ]]; then
  /opt/homebrew/opt/postgresql@15/bin/createdb metaspace
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

alembic upgrade head
python -m scripts.bootstrap_workspace

echo "SETUP_OK"
