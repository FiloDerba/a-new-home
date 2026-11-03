# a-new-home

Where to live in Amsterdam: house price trends and livability per neighbourhood, built on the
city's open data with dbt and DuckDB.

## How it works

```
api.data.amsterdam.nl ──ingest──▶ data/raw/*.jsonl ──dbt (DuckDB)──▶ marts ──▶ (web map, planned)
```

| Mart | Grain | Content |
|---|---|---|
| `dim_buurt` | buurt | 504 residential neighbourhoods, geometry, gebied |
| `dim_gebied` | gebied | 25 gebiedsgericht-werken areas, geometry |
| `fct_buurt_year` | buurt, year | average WOZ value (2012+), green share (2020+), population |
| `fct_gebied_year` | gebied, year | livability and safety survey scores (2015-2025) |

Survey scores only exist per gebied, not per buurt, so they have their own fact table.

## Develop

```bash
uv sync
uv run ingest                                              # download raw data to data/raw/
uv run dbt build --project-dir dbt --profiles-dir dbt      # models + tests -> data/warehouse.duckdb
uv run pytest && uv run ruff check . && uv run ruff format . && uv run pyright
```

Run everything from the repo root. A GitHub Actions job refreshes and re-tests the data weekly.

## Data notes

- Source: Amsterdam open data (BBGA statistics and gebieden APIs). WOZ values are null where
  the city publishes none (about 20% of buurten per year); they are never imputed.
- Buurten use today's boundaries for all years. About 22 buurten only exist from 2022
  (boundary reform), so earlier years have fewer areas.
- The 14 Westpoort port/industrial buurten are excluded: no residents, no gebied.
