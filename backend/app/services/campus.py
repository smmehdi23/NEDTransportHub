"""Campus rules: night-time pickups are only allowed at campus gates (configured in CAMPUS_GATES)."""
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.time import as_utc
from app.services.geo import Point, haversine_m


def is_night(dt: datetime) -> bool:
    """True if `dt` falls in the night window, in campus local time. Handles windows that cross midnight."""
    hour = (as_utc(dt) + timedelta(hours=settings.campus_utc_offset_hours)).hour
    start, end = settings.night_start_hour, settings.night_end_hour
    if start == end:
        return False
    return start <= hour < end if start < end else hour >= start or hour < end


def nearest_gate(point: Point) -> tuple[str, float] | None:
    """(gate name, distance in m) of the closest gate, or None if no gates are configured."""
    gates = settings.gates
    if not gates:
        return None
    return min(((name, haversine_m(point, (lat, lng))) for name, lat, lng in gates), key=lambda g: g[1])


def night_pickup_error(departure: datetime, pickup: Point) -> str | None:
    """Return an error message if this pickup breaks the night-time gate rule, else None."""
    if not settings.gates or not is_night(departure):
        return None
    name, dist = nearest_gate(pickup)
    if dist <= settings.gate_radius_m:
        return None
    names = ", ".join(g[0] for g in settings.gates)
    return (f"Rides between {settings.night_start_hour:02d}:00 and {settings.night_end_hour:02d}:00 can only pick up "
            f"at a campus gate ({names}). Your pickup is {dist:.0f} m from {name}.")
