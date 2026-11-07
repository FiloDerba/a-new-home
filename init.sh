#!/usr/bin/env bash
# Install dependencies and run the same checks as CI. Fix any failure before new work.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> Working directory: $PWD"
echo "==> Syncing dependencies"
uv sync --locked
(cd web && npm ci)

echo "==> Running baseline verification"
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest
(cd web && npm run typecheck && npm test)

echo "==> Startup command (needs data: uv run ingest && uv run dbt build --project-dir dbt --profiles-dir dbt && uv run export)"
echo "    cd web && npm run dev"

if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
  echo "==> Starting the app"
  cd web && exec npm run dev
fi

echo "Set RUN_START_COMMAND=1 if you want init.sh to launch the app directly."
