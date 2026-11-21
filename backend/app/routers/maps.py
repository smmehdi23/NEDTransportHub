from fastapi import APIRouter, Depends, Query

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.ride import FareEstimate, RoutePreview
from app.services import maps
from app.services.fare import split_fare

router = APIRouter(prefix="/maps", tags=["Maps"])


@router.get("/route", response_model=RoutePreview)
def route_preview(
    origin_lat: float = Query(ge=-90, le=90), origin_lng: float = Query(ge=-180, le=180),
    dest_lat: float = Query(ge=-90, le=90), dest_lng: float = Query(ge=-180, le=180),
    _: User = Depends(get_current_user),
):
    info = maps.get_route((origin_lat, origin_lng), (dest_lat, dest_lng))
    return RoutePreview(route=info.route, distance_km=info.distance_km, duration_min=info.duration_min, source=info.source)


@router.get("/fare-estimate", response_model=FareEstimate)
def fare_estimate(
    origin_lat: float = Query(ge=-90, le=90), origin_lng: float = Query(ge=-180, le=180),
    dest_lat: float = Query(ge=-90, le=90), dest_lng: float = Query(ge=-180, le=180),
    passengers: int = Query(1, ge=1, le=8),
    _: User = Depends(get_current_user),
):
    """Split-fuel fare: total fuel cost shared equally by the driver and `passengers` riders."""
    info = maps.get_route((origin_lat, origin_lng), (dest_lat, dest_lng))
    return FareEstimate(duration_min=info.duration_min, route_source=info.source, **split_fare(info.distance_km, passengers))


@router.get("/geocode")
def geocode(q: str = Query(min_length=2, max_length=120), _: User = Depends(get_current_user)):
    return {"results": maps.geocode(q)}


@router.get("/gates")
def campus_gates(_: User = Depends(get_current_user)):
    """Campus gates and the night window, so the app can show where night-time pickups are allowed."""
    return {
        "night_start_hour": settings.night_start_hour,
        "night_end_hour": settings.night_end_hour,
        "gate_radius_m": settings.gate_radius_m,
        "rule_enabled": bool(settings.gates),
        "gates": [{"name": n, "lat": lat, "lng": lng} for n, lat, lng in settings.gates],
    }
