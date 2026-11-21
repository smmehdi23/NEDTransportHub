"""Mapbox / Google / fallback selection in app.services.maps, with the HTTP calls faked."""
import httpx
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services import maps

A, B = (24.9000, 67.0800), (24.9298, 67.1150)
# Google-format encoded polyline for [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
POLY = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"


class FakeResp:
    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


@pytest.fixture()
def calls(monkeypatch):
    seen = []

    def install(data=None, exc=None):
        def fake_get(url, params=None, timeout=None):
            seen.append({"url": url, "params": params})
            if exc:
                raise exc
            return FakeResp(data)
        monkeypatch.setattr(maps.httpx, "get", fake_get)
        return seen
    return install


@pytest.fixture()
def mapbox(monkeypatch):
    monkeypatch.setattr(settings, "mapbox_token", "pk.test")
    monkeypatch.setattr(settings, "google_maps_api_key", "google-key")  # Mapbox must win


def test_provider_selection(monkeypatch):
    assert maps.provider() == "fallback"
    monkeypatch.setattr(settings, "google_maps_api_key", "g")
    assert maps.provider() == "google"
    monkeypatch.setattr(settings, "mapbox_token", "pk.x")
    assert maps.provider() == "mapbox"


def test_mapbox_route(mapbox, calls):
    seen = calls({"code": "Ok", "routes": [{"geometry": POLY, "distance": 5234.0, "duration": 754.0}]})
    info = maps.get_route(A, B)
    assert info.source == "mapbox" and info.distance_km == 5.23 and info.duration_min == 12.6
    assert info.route[0] == (38.5, -120.2) and len(info.route) == 3
    assert "67.08,24.9;67.115,24.9298" in seen[0]["url"]          # lng,lat order
    assert seen[0]["params"]["access_token"] == "pk.test"


@pytest.mark.parametrize("data,exc", [
    ({"code": "InvalidInput", "message": "bad"}, None),
    ({"message": "Not Authorized - Invalid Token"}, None),
    (None, httpx.ConnectError("offline")),
])
def test_mapbox_route_errors_fall_back(mapbox, calls, data, exc):
    calls(data, exc)
    assert maps.get_route(A, B).source == "fallback"


def test_mapbox_geocode(mapbox, calls):
    seen = calls({"features": [{"place_name": "NED University, Karachi, Pakistan", "center": [67.115, 24.9298]}]})
    assert maps.geocode("NED University") == [{"name": "NED University, Karachi, Pakistan", "lat": 24.9298, "lng": 67.115}]
    assert "NED%20University.json" in seen[0]["url"] and seen[0]["params"]["country"] == "pk"


def test_mapbox_geocode_errors_are_503(mapbox, calls):
    calls({"message": "Not Authorized - Invalid Token"})
    with pytest.raises(HTTPException) as e:
        maps.geocode("NED")
    assert e.value.status_code == 503


def test_geocode_unconfigured_is_503():
    with pytest.raises(HTTPException) as e:
        maps.geocode("NED")
    assert e.value.status_code == 503 and "MAPBOX_TOKEN" in e.value.detail