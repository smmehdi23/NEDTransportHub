"""Route matching (SRS FR-9, section 4.1 corridor matching).

A ride matches a rider when the rider's pickup lies within `radius_m` of the driver's route,
the drop-off (if given) also lies within the corridor *after* the pickup (same direction),
and departure times are within the time window. Pure Python so it runs on SQLite and PostgreSQL;
for very large datasets replace `route_matches` with a PostGIS ST_DWithin query.
"""
from dataclasses import dataclass
from datetime import datetime

from app.core.config import settings
from app.core.time import as_utc
from app.models.ride import Ride
from app.services.geo import Point, project_on_route


@dataclass
class Match:
    ride: Ride
    pickup_distance_m: float
    dropoff_distance_m: float | None
    time_diff_min: float
    score: float  # 0..100, higher is better


def route_of(ride: Ride) -> list[Point]:
    pts = [(float(p[0]), float(p[1])) for p in (ride.route or [])]
    return pts if len(pts) >= 2 else [(ride.origin_lat, ride.origin_lng), (ride.dest_lat, ride.dest_lng)]


def match_ride(
    ride: Ride,
    pickup: Point,
    dropoff: Point | None,
    when: datetime | None,
    radius_m: float | None = None,
    window_min: float | None = None,
) -> Match | None:
    radius = radius_m or settings.corridor_radius_m
    window = window_min or settings.match_time_window_minutes
    route = route_of(ride)

    d_pick, i_pick = project_on_route(pickup, route)
    if d_pick > radius:
        return None
    d_drop = None
    if dropoff is not None:
        d_drop, i_drop = project_on_route(dropoff, route)
        if d_drop > radius or i_drop < i_pick:  # must be along the route and in the driving direction
            return None
    diff = 0.0
    if when is not None:
        diff = abs((as_utc(ride.departure_time) - as_utc(when)).total_seconds()) / 60
        if diff > window:
            return None

    spatial = 1 - (d_pick + (d_drop or 0)) / (radius * (2 if dropoff else 1))
    temporal = 1 - diff / window
    return Match(ride, d_pick, d_drop, diff, round(100 * (0.6 * spatial + 0.4 * temporal), 1))
