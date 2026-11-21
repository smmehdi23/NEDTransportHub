from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_rider
from app.models.booking import Booking, BookingStatus
from app.models.ride import Ride, RideStatus
from app.models.user import User

router = APIRouter(prefix="/history", tags=["Ride History"])


class HistoryItem(BaseModel):
    role: Literal["driver", "passenger"]
    bucket: Literal["upcoming", "completed", "cancelled"]
    ride_id: int
    booking_id: int | None
    origin_name: str
    destination_name: str
    departure_time: datetime
    ride_status: str
    booking_status: str | None
    fare: int | None


def _bucket_ride(r: Ride) -> str:
    return {RideStatus.COMPLETED: "completed", RideStatus.CANCELLED: "cancelled"}.get(r.status, "upcoming")


def _bucket_booking(b: Booking) -> str:
    if b.status in (BookingStatus.CANCELLED, BookingStatus.REJECTED):
        return "cancelled"
    return "completed" if b.status == BookingStatus.COMPLETED else ("cancelled" if b.ride.status == RideStatus.CANCELLED else "upcoming")


@router.get("", response_model=list[HistoryItem])
def my_history(
    bucket: Literal["upcoming", "completed", "cancelled", "all"] = "all",
    role: Literal["driver", "passenger", "all"] = "all",
    limit: int = Query(100, ge=1, le=300),
    user: User = Depends(require_rider), db: Session = Depends(get_db),
):
    """Upcoming / completed / cancelled rides, both the ones I drive and the ones I booked (FR-23)."""
    items: list[HistoryItem] = []
    if role in ("driver", "all"):
        for r in db.scalars(select(Ride).where(Ride.driver_id == user.id).order_by(Ride.departure_time.desc()).limit(limit)):
            items.append(HistoryItem(role="driver", bucket=_bucket_ride(r), ride_id=r.id, booking_id=None, origin_name=r.origin_name,
                                     destination_name=r.destination_name, departure_time=r.departure_time, ride_status=r.status.value,
                                     booking_status=None, fare=r.estimated_fare))
    if role in ("passenger", "all"):
        for b in db.scalars(select(Booking).where(Booking.passenger_id == user.id).order_by(Booking.id.desc()).limit(limit)):
            r = b.ride
            items.append(HistoryItem(role="passenger", bucket=_bucket_booking(b), ride_id=r.id, booking_id=b.id, origin_name=r.origin_name,
                                     destination_name=r.destination_name, departure_time=r.departure_time, ride_status=r.status.value,
                                     booking_status=b.status.value, fare=b.proposed_fare))
    if bucket != "all":
        items = [i for i in items if i.bucket == bucket]
    return sorted(items, key=lambda i: i.departure_time, reverse=True)[:limit]
