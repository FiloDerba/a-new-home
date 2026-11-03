# a-new-home

Where to live in Amsterdam: house price trends and livability per neighbourhood, built on the
city's open data with dbt and DuckDB.

## How it works

```
api.data.amsterdam.nl ──ingest──▶ data/raw/*.jsonl ──dbt (DuckDB)──▶ marts
                                                                       │ export
                                  web/ (Next.js + MapLibre) ◀── web/public/data/*.{geojson,json}
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
uv run export                                              # marts -> web/public/data/ (buurten.geojson, metrics.json)
uv run pytest && uv run ruff check . && uv run ruff format . && uv run pyright
```

Run the Python commands from the repo root. A GitHub Actions job refreshes and re-tests the data
weekly.

### Web map

```bash
cd web
npm install
npm run dev          # http://localhost:3000 (needs the data from `uv run export`)
npm run typecheck && npm test
npm run build        # static site in web/out/, deployable on any static host
```

The map shows average WOZ value, green space and population per buurt, with a year slider, a
trend chart per buurt, and a table view as the keyboard-accessible alternative. `uv run export`
validates that the two data files agree, and the front end only reads those files.

Colours: WOZ value is shown relative to that year's Amsterdam median (diverging blue-red, so
"cheaper or pricier than typical" is readable at a glance); green space and population use
one-hue ramps. Dark mode flips the ramps so the extremes stay the brightest.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` refreshes the data, runs all tests, builds the site and publishes it
weekly, on demand, and on every push to `main`. One-time setup: in the repo go to
**Settings → Pages → Build and deployment → Source: GitHub Actions**. The site is then served at
`https://<user>.github.io/a-new-home/`. The workflow sets `NEXT_PUBLIC_BASE_PATH=/a-new-home`; locally
the site runs at the root.

## Data notes

- BBGA labels the green-space indicator `ORGROEN_P` as a percentage but publishes a 0-1 fraction;
  `fct_buurt_year` scales it to a real percentage (a dbt range test guards the unit).

- Source: Amsterdam open data (BBGA statistics and gebieden APIs). WOZ values are null where
  the city publishes none (about 20% of buurten per year); they are never imputed.
- Buurten use today's boundaries for all years. About 22 buurten only exist from 2022
  (boundary reform), so earlier years have fewer areas.
- The 14 Westpoort port/industrial buurten are excluded: no residents, no gebied.
