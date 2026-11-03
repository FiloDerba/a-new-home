"""Export the dbt marts as the two static files the web map loads.

buurten.geojson  geometry and static properties, loaded once.
metrics.json     numbers per area, as arrays aligned with a shared `years` list.

Keeping them apart means polygons are not repeated for every year.
"""

import json
import logging
from pathlib import Path
from typing import Any

import duckdb

from a_new_home.ingest import write_text_atomic

WAREHOUSE = Path("data/warehouse.duckdb")
OUT_DIR = Path("web/public/data")
COORDINATE_DECIMALS = 5  # about 1 m; keeps the GeoJSON small

BUURT_METRICS = ("avg_woz_eur", "green_pct", "population")
GEBIED_METRICS = ("livability_score", "safety_score")

log = logging.getLogger(__name__)

Json = dict[str, Any]


def round_coordinates(coordinates: Any) -> Any:
    """Round a GeoJSON coordinates array of any nesting depth."""
    if isinstance(coordinates[0], int | float):
        return [round(value, COORDINATE_DECIMALS) for value in coordinates]
    return [round_coordinates(part) for part in coordinates]


def build_geojson(con: duckdb.DuckDBPyConnection) -> Json:
    rows = con.execute(
        "select buurt_code, name, gebied_code, geometry from dim_buurt order by buurt_code"
    ).fetchall()
    features = []
    for code, name, gebied_code, geometry in rows:
        geometry = json.loads(geometry)
        geometry["coordinates"] = round_coordinates(geometry["coordinates"])
        features.append(
            {
                "type": "Feature",
                "properties": {"code": code, "name": name, "gebied": gebied_code},
                "geometry": geometry,
            }
        )
    return {"type": "FeatureCollection", "features": features}


def series(
    con: duckdb.DuckDBPyConnection, table: str, key: str, metrics: tuple[str, ...], years: list[int]
) -> dict[str, Json]:
    """Pivot a fact table into {key: {metric: [value per year, None where missing]}}."""
    position = {year: index for index, year in enumerate(years)}
    # Table and column names are module constants, never user input.
    rows = con.execute(f"select {key}, year, {', '.join(metrics)} from {table}").fetchall()
    result: dict[str, Json] = {}
    for code, year, *values in rows:
        entry = result.setdefault(code, {metric: [None] * len(years) for metric in metrics})
        for metric, value in zip(metrics, values, strict=True):
            entry[metric][position[year]] = value
    return result


def build_metrics(con: duckdb.DuckDBPyConnection) -> Json:
    rows = con.execute("select distinct year from fct_buurt_year order by 1").fetchall()
    years = [year for (year,) in rows]
    gebieden = series(con, "fct_gebied_year", "gebied_code", GEBIED_METRICS, years)
    for code, name in con.execute("select gebied_code, name from dim_gebied").fetchall():
        # A gebied without survey data still gets an entry, so lookups never fail.
        entry = gebieden.setdefault(code, {m: [None] * len(years) for m in GEBIED_METRICS})
        entry["name"] = name
    return {
        "years": years,
        "buurten": series(con, "fct_buurt_year", "buurt_code", BUURT_METRICS, years),
        "gebieden": gebieden,
    }


def validate(geojson: Json, metrics: Json) -> None:
    """Check the contract between the two files, so a mismatch fails here, not in the browser."""
    geo_codes = {feature["properties"]["code"] for feature in geojson["features"]}
    if geo_codes != set(metrics["buurten"]):
        raise ValueError("buurten.geojson and metrics.json describe different buurten")
    gebied_codes = {feature["properties"]["gebied"] for feature in geojson["features"]}
    if not gebied_codes <= set(metrics["gebieden"]):
        raise ValueError("a buurt points at a gebied missing from metrics.json")
    expected = len(metrics["years"])
    for group in ("buurten", "gebieden"):
        for code, entry in metrics[group].items():
            for metric, values in entry.items():
                if metric != "name" and len(values) != expected:
                    raise ValueError(f"{group}/{code}/{metric} is not aligned with years")


def write_json(path: Path, data: Json) -> None:
    write_text_atomic(path, json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    log.info("wrote %s (%.0f kB)", path, path.stat().st_size / 1000)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    with duckdb.connect(str(WAREHOUSE), read_only=True) as con:
        geojson, metrics = build_geojson(con), build_metrics(con)
    validate(geojson, metrics)
    write_json(OUT_DIR / "buurten.geojson", geojson)
    write_json(OUT_DIR / "metrics.json", metrics)


if __name__ == "__main__":
    main()
