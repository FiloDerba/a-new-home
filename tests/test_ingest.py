import json
from pathlib import Path

import httpx
import pytest

from a_new_home import ingest


def make_client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_next_url_handles_both_link_styles():
    assert ingest.next_url({"_links": {"next": {"href": "a"}}}) == "a"
    assert ingest.next_url({"_links": [{"rel": "next", "href": "b"}]}) == "b"
    assert ingest.next_url({"_links": {}}) is None
    assert ingest.next_url({"_links": [{"rel": "prev", "href": "c"}]}) is None


def test_paginate_follows_next_links():
    pages = {
        "https://x/api": {"n": 1, "_links": {"next": {"href": "https://x/api?page=2"}}},
        "https://x/api?page=2": {"n": 2, "_links": {}},
    }
    client = make_client(lambda request: httpx.Response(200, json=pages[str(request.url)]))
    assert [page["n"] for page in ingest.paginate(client, "https://x/api")] == [1, 2]


def test_fetch_kerncijfers_keeps_only_known_fields():
    row = {"indicatorDefinitieId": "WWOZ_GEM", "gebiedcode15": "AA01", "jaar": 2025, "waarde": 1.0}
    payload = {"_embedded": {"kerncijfers": [{**row, "_links": {}}]}, "_links": {}}
    client = make_client(lambda request: httpx.Response(200, json=payload))
    assert ingest.fetch_kerncijfers(client, "WWOZ_GEM") == [row]


def test_fetch_kerncijfers_fails_on_empty_result():
    payload = {"_embedded": {"kerncijfers": []}, "_links": {}}
    client = make_client(lambda request: httpx.Response(200, json=payload))
    with pytest.raises(ValueError, match="WWOZ_GEM"):
        ingest.fetch_kerncijfers(client, "WWOZ_GEM")


def test_fetch_areas_flattens_features_and_keeps_geometry_as_json():
    feature = {"properties": {"code": "AA01"}, "geometry": {"type": "Point", "coordinates": [1, 2]}}
    client = make_client(
        lambda request: httpx.Response(200, json={"features": [feature], "_links": []})
    )
    (row,) = ingest.fetch_areas(client, "buurten")
    assert row["code"] == "AA01"
    assert json.loads(row["geometry"]) == feature["geometry"]


def test_http_errors_are_raised():
    client = make_client(lambda request: httpx.Response(500))
    with pytest.raises(httpx.HTTPStatusError):
        ingest.fetch_areas(client, "buurten")


def test_write_jsonl_is_atomic_and_round_trips(tmp_path: Path):
    path = tmp_path / "raw" / "rows.jsonl"
    ingest.write_jsonl(path, [{"a": 1}, {"a": "é"}])
    assert [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()] == [
        {"a": 1},
        {"a": "é"},
    ]
    assert list(path.parent.glob("*.tmp")) == []
