# Progress Log

Repository-local session log for any coding agent. Read it at session start and update it
before handoff (see `AGENTS.md`).

## Current Verified State

- Repository root: `a-new-home/`
- Standard startup path: `uv run ingest && uv run dbt build --project-dir dbt --profiles-dir dbt && uv run export`, then `cd web && npm run dev`
- Standard verification path: `./init.sh` (same checks as `.github/workflows/ci.yml`)
- Current highest-priority unfinished feature: none recorded; add the backlog to `feature_list.json`
- Current blocker: none

## Session Log

### Session 001

- Date: 2026-11-07
- Goal: Add the minimal agent harness (AGENTS.md, init.sh, progress log, feature list).
- Completed: Added `AGENTS.md`, `init.sh`, `claude-progress.md`, `feature_list.json`.
- Verification run: `./init.sh` (exit 0).
- Evidence captured: see `baseline-001` in `feature_list.json`.
- Commits: harness setup.
- Files or artifacts updated: the four files above.
- Known risk or unresolved issue: `init.sh` does not run the data pipeline or the web build.
- Next best step: list the next features in `feature_list.json`.
