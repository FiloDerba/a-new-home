import json

import duckdb
import pytest

from a_new_home import export

POINT = json.dumps({"type": "Polygon", "coordinates": [[[4.123456789, 52.1], [4.2, 52.2]]]})


@pytest.fixture
def con():
    """A tiny in-memory stand-in for the four dbt marts."""
    con = duckdb.connect()
    con.execute("create table dim_gebied as select 'GA01' as gebied_code, 'Centrum' as name")
    con.execute(
        "create table dim_buurt as select 'AA01' as buurt_code, 'Buurt' as name,"
        f" 'GA01' as gebied_code, '{POINT}' as geometry"
    )
    con.execute(
        "create table fct_buurt_year as select buurt_code, year, avg_woz_eur::double"
        " as avg_woz_eur, green_pct::double as green_pct, population from (values"
        " ('AA01', 2024, 500000.0, 12.5, 900), ('AA01', 2025, null, 13.0, 910))"
        " t(buurt_code, year, avg_woz_eur, green_pct, population)"
    )
    con.execute(
        "create table fct_gebied_year as select 'GA01' as gebied_code, 2025 as year,"
        " 7.4::double as livability_score, 7.0::double as safety_score"
    )
    return con


def test_geojson_has_rounded_coordinates_and_properties(con):
    (feature,) = export.build_geojson(con)["features"]
    assert feature["properties"] == {"code": "AA01", "name": "Buurt", "gebied": "GA01"}
    assert feature["geometry"]["coordinates"][0][0] == [4.12346, 52.1]


def test_metrics_are_aligned_with_years_and_keep_nulls(con):
    metrics = export.build_metrics(con)
    assert metrics["years"] == [2024, 2025]
    assert metrics["buurten"]["AA01"]["avg_woz_eur"] == [500000.0, None]
    assert metrics["gebieden"]["GA01"]["livability_score"] == [None, 7.4]
    assert metrics["gebieden"]["GA01"]["name"] == "Centrum"


def test_validate_accepts_consistent_files(con):
    export.validate(export.build_geojson(con), export.build_metrics(con))


def test_validate_rejects_buurt_missing_from_metrics(con):
    metrics = export.build_metrics(con)
    del metrics["buurten"]["AA01"]
    with pytest.raises(ValueError, match="different buurten"):
        export.validate(export.build_geojson(con), metrics)


def test_validate_rejects_misaligned_series(con):
    metrics = export.build_metrics(con)
    metrics["buurten"]["AA01"]["green_pct"].pop()
    with pytest.raises(ValueError, match="not aligned"):
        export.validate(export.build_geojson(con), metrics)
