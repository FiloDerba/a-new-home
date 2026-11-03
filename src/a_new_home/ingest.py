"""Download raw Amsterdam open data into data/raw/ as newline-delimited JSON.

Sources (all open, no API key): the BBGA statistics API and the gebieden (areas) API on
api.data.amsterdam.nl. dbt reads the files written here; nothing else touches the network.
"""

import json
import logging
import os
import tempfile
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any

import httpx

API = "https://api.data.amsterdam.nl/v1"
RAW_DIR = Path("data/raw")
PAGE_SIZE = 1000
# BBGA indicator ids; see /bbga/indicatoren_definities for the full catalogue.
INDICATORS = ("WWOZ_GEM", "ORGROEN_P", "BEVTOTAAL", "LLEEFBAARBRT_R", "VBUURTVEILIG_R")
KERNCIJFER_FIELDS = ("indicatorDefinitieId", "gebiedcode15", "jaar", "waarde")
DEFINITION_FIELDS = ("variabele", "label", "thema", "definitie", "bron", "peildatum")

log = logging.getLogger(__name__)

Row = dict[str, Any]


def next_url(page: Row) -> str | None:
    """Return the next-page URL; the BBGA API uses a dict, the GeoJSON API a list of links."""
    links = page.get("_links")
    if isinstance(links, dict):
        return (links.get("next") or {}).get("href")
    return next((link["href"] for link in links or [] if link.get("rel") == "next"), None)


def paginate(client: httpx.Client, url: str, params: Row | None = None) -> Iterator[Row]:
    """Yield every page of a paginated endpoint."""
    page_url: str | None = url
    while page_url:
        response = client.get(page_url, params=params)
        response.raise_for_status()
        page = response.json()
        yield page
        # The next link already carries the query string.
        page_url, params = next_url(page), None


def fetch_kerncijfers(client: httpx.Client, indicator: str) -> list[Row]:
    params = {"_format": "json", "_pageSize": PAGE_SIZE, "indicatorDefinitieId": indicator}
    rows = [
        {field: row[field] for field in KERNCIJFER_FIELDS}
        for page in paginate(client, f"{API}/bbga/kerncijfers/", params)
        for row in page["_embedded"]["kerncijfers"]
    ]
    if not rows:  # an empty indicator means the API or the id changed; fail loudly
        raise ValueError(f"No rows returned for indicator {indicator!r}")
    return rows


def fetch_definitions(client: httpx.Client, indicators: Iterable[str]) -> list[Row]:
    wanted = set(indicators)
    params = {"_format": "json", "_pageSize": PAGE_SIZE}
    found = [
        {field: row[field] for field in DEFINITION_FIELDS}
        for page in paginate(client, f"{API}/bbga/indicatoren_definities/", params)
        for row in page["_embedded"]["indicatoren_definities"]
        if row["variabele"] in wanted
    ]
    missing = wanted - {row["variabele"] for row in found}
    if missing:
        raise ValueError(f"Unknown indicators: {sorted(missing)}")
    return found


def fetch_areas(client: httpx.Client, resource: str) -> list[Row]:
    """Fetch an area layer as flat rows, with the WGS84 geometry kept as a JSON string."""
    params = {"_format": "geojson", "_pageSize": PAGE_SIZE}
    rows = [
        {**feature["properties"], "geometry": json.dumps(feature["geometry"])}
        for page in paginate(client, f"{API}/gebieden/{resource}/", params)
        for feature in page["features"]
    ]
    if not rows:
        raise ValueError(f"No features returned for {resource!r}")
    return rows


def write_jsonl(path: Path, rows: list[Row]) -> None:
    """Write atomically, so a failed run never leaves a half-written file for dbt."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        file.writelines(json.dumps(row, ensure_ascii=False) + "\n" for row in rows)
    os.replace(tmp, path)
    log.info("wrote %d rows to %s", len(rows), path)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # one line per request is noise
    client = httpx.Client(
        transport=httpx.HTTPTransport(retries=3),
        timeout=60,
        follow_redirects=True,
        headers={"Accept-Crs": "EPSG:4326"},  # web-map coordinates instead of RD New
    )
    with client:
        kerncijfers = [row for ind in INDICATORS for row in fetch_kerncijfers(client, ind)]
        write_jsonl(RAW_DIR / "kerncijfers.jsonl", kerncijfers)
        write_jsonl(RAW_DIR / "indicators.jsonl", fetch_definitions(client, INDICATORS))
        write_jsonl(RAW_DIR / "buurten.jsonl", fetch_areas(client, "buurten"))
        write_jsonl(RAW_DIR / "ggw_gebieden.jsonl", fetch_areas(client, "ggwgebieden"))


if __name__ == "__main__":
    main()
