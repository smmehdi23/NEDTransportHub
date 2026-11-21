import math

from app.core.config import settings


def split_fare(distance_km: float, passengers: int, rate_per_km: float | None = None) -> dict:
    """Split fuel cost between the driver and `passengers` riders (driver pays an equal share)."""
    rate = rate_per_km or settings.fare_rate_per_km
    total = max(distance_km, 0) * rate
    people = max(passengers, 0) + 1
    per_person = math.ceil(total / people / 10) * 10  # round up to nearest PKR 10
    return {
        "distance_km": round(distance_km, 2),
        "rate_per_km": rate,
        "total_cost": int(round(total)),
        "people_sharing": people,
        "fare_per_passenger": int(per_person),
    }
