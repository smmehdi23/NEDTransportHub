"""Mapping service (routes, ETAs, place search).

Provider is picked from .env: MAPBOX_TOKEN set -> Mapbox; else GOOGLE_MAPS_API_KEY set -> Google;
else a straight-line fallback so the app still works in development and tests.
If the provider fails, routing falls back to straight lines instead of breaking the request.
"""
import logging
from dataclasses import dataclass
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services.geo import Point, decode_polyline, haversine_m, straight_route

log = logging.getLogger(__name__)
_GOOGLE_DIRECTIONS = "https://maps.googleapis.com/maps/api/directions/json"
_GOOGLE_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json"
_MAPBOX_DIRECTIONS = "https://api.mapbox.com/directions/v5/mapbox/driving/{coords}"
_MAPBOX_GEOCODE = "https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
ROAD_FACTOR = 1.3  # straight-line -> approximate road distance
_ERRORS = (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError)


@dataclass
class RouteInfo:
    route: list[Point]
    distance_km: float
    duration_min: float
    source: str  # "mapbox" | "google" | "fallback"


def provider() -> str:
    if settings.mapbox_token:
        return "mapbox"
    if settings.google_maps_api_key:
        return "google"
    return "fallback"


def _fallback(origin: Point, dest: Point) -> RouteInfo:
    km = haversine_m(origin, dest) / 1000 * ROAD_FACTOR
    return RouteInfo(straight_route(origin, dest), round(km, 2), round(km / settings.avg_speed_kmh * 60, 1), "fallback")


# ---------------- Mapbox ----------------
def _mapbox_route(origin: Point, dest: Point) -> RouteInfo | None:
    coords = f"{origin[1]},{origin[0]};{dest[1]},{dest[0]}"  # Mapbox wants lng,lat
    data = httpx.get(
        _MAPBOX_DIRECTIONS.format(coords=coords),
        params={"geometries": "polyline", "overview": "full", "access_token": settings.mapbox_token},
        timeout=8,
    ).json()
    if data.get("code") != "Ok" or not data.get("routes"):
        log.warning("Mapbox Directions code=%s message=%s", data.get("code"), data.get("message"))
        return None
    r = data["routes"][0]
    return RouteInfo(decode_polyline(r["geometry"]), round(r["distance"] / 1000, 2), round(r["duration"] / 60, 1), "mapbox")


_NOMINATIM_GEOCODE = "https://nominatim.openstreetmap.org/search"
_KARACHI_PROXIMITY = "67.1116,24.9333"


def _nominatim_geocode(query: str) -> list[dict]:
    """Free OpenStreetMap Nominatim fallback for detailed Karachi/NED landmarks."""
    q = query.strip()
    search_q = q if "karachi" in q.lower() else f"{q}, Karachi"
    try:
        resp = httpx.get(
            _NOMINATIM_GEOCODE,
            params={
                "q": search_q,
                "format": "json",
                "countrycodes": "pk",
                "limit": 5,
                "addressdetails": 0,
            },
            headers={
                "User-Agent": "NEDTransportHub/1.0 (dev@neduet.edu.pk)",
                "Accept-Language": "en",
            },
            timeout=8,
        )
        items = resp.json()
        if not isinstance(items, list):
            return []
        return [
            {"name": item["display_name"], "lat": float(item["lat"]), "lng": float(item["lon"])}
            for item in items[:5]
            if "display_name" in item and "lat" in item and "lon" in item
        ]
    except _ERRORS as exc:
        log.warning("Nominatim geocoding fallback failed: %s", exc)
        return []


def _mapbox_geocode(query: str) -> list[dict]:
    data = httpx.get(
        _MAPBOX_GEOCODE.format(query=quote(query, safe="")),
        params={
            "country": "pk",
            "proximity": _KARACHI_PROXIMITY,
            "limit": 5,
            "access_token": settings.mapbox_token,
        },
        timeout=8,
    ).json()
    if "features" not in data:
        log.warning("Mapbox Geocoding error: %s", data.get("message"))
        raise HTTPException(503, "Map service is temporarily unavailable.")
    results = [
        {"name": f["place_name"], "lat": f["center"][1], "lng": f["center"][0]}
        for f in data["features"][:5]
    ]
    if not results:
        return _nominatim_geocode(query)
    return results


# ---------------- Google ----------------
def _google_route(origin: Point, dest: Point) -> RouteInfo | None:
    data = httpx.get(
        _GOOGLE_DIRECTIONS,
        params={
            "origin": f"{origin[0]},{origin[1]}",
            "destination": f"{dest[0]},{dest[1]}",
            "mode": "driving",
            "key": settings.google_maps_api_key,
        },
        timeout=8,
    ).json()
    if data.get("status") != "OK":
        log.warning("Google Directions status=%s", data.get("status"))
        return None
    leg = data["routes"][0]["legs"][0]
    return RouteInfo(
        decode_polyline(data["routes"][0]["overview_polyline"]["points"]),
        round(leg["distance"]["value"] / 1000, 2),
        round(leg["duration"]["value"] / 60, 1),
        "google",
    )


def _google_geocode(query: str) -> list[dict]:
    data = httpx.get(_GOOGLE_GEOCODE, params={"address": query, "region": "pk", "key": settings.google_maps_api_key}, timeout=8).json()
    return [
        {"name": r["formatted_address"], "lat": r["geometry"]["location"]["lat"], "lng": r["geometry"]["location"]["lng"]}
        for r in data.get("results", [])[:5]
    ]


# ---------------- Public API ----------------
def get_route(origin: Point, dest: Point) -> RouteInfo:
    p = provider()
    if p == "fallback":
        return _fallback(origin, dest)
    try:
        info = _mapbox_route(origin, dest) if p == "mapbox" else _google_route(origin, dest)
    except _ERRORS as exc:
        log.warning("%s directions failed, using fallback: %s", p, exc)
        info = None
    return info or _fallback(origin, dest)


def eta_minutes(current: Point, dest: Point) -> float:
    """Estimated minutes from `current` to `dest`."""
    return get_route(current, dest).duration_min


def geocode(query: str) -> list[dict]:
    p = provider()
    if p == "fallback":
        raise HTTPException(503, "Place search is not configured (set MAPBOX_TOKEN or GOOGLE_MAPS_API_KEY).")
    try:
        return _mapbox_geocode(query) if p == "mapbox" else _google_geocode(query)
    except _ERRORS:
        raise HTTPException(503, "Map service is temporarily unavailable.")