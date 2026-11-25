# Progress Log

Repository-local session log for any coding agent. Read it at session start and update it
before handoff (see `AGENTS.md`).

## Current Verified State

- Repository root: `a-new-home/`
- Standard startup path: `uv run ingest && uv run dbt build --project-dir dbt --profiles-dir dbt && uv run export`, then `cd web && npm run dev`
- Standard verification path: `./init.sh` (same checks as `.github/workflows/ci.yml`)
- Current highest-priority unfinished feature: none recorded
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

### Session 002

- Date: 2026-11-25
- Goal: Tighten the dbt project.
- Completed: `dbt parse` added to CI and `init.sh`; `assert_kerncijfers_grain` test; enforced contracts on all four marts; removed the unused `stg_bbga__indicators` model and its source.
- Verification run: `dbt build` (PASS=30), `uv run export`, `./init.sh` (exit 0), a contract-violation check that failed as expected.
- Evidence captured: see `dbt-hardening-002` in `feature_list.json`.
- Known risk or unresolved issue: `profiles.yml` and `export.py` still use the cwd-relative `data/warehouse.duckdb`, so commands must run from the repo root.
- Next best step: none queued.
