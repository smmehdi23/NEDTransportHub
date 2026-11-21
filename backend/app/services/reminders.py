"""Ride reminders: notify confirmed passengers (and the driver) shortly before departure."""
import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.time import utcnow
from app.models.booking import Booking, BookingStatus
from app.models.ride import Ride, RideStatus
from app.services.notifications import notify

log = logging.getLogger("nth.reminders")


def send_due_reminders(db: Session) -> int:
    now = utcnow()
    horizon = now + timedelta(minutes=settings.reminder_minutes_before)
    q = (select(Booking).join(Ride, Ride.id == Booking.ride_id)
         .where(Booking.status == BookingStatus.CONFIRMED, Booking.reminder_sent.is_(False),
                Ride.status.in_((RideStatus.OPEN, RideStatus.FULL)), Ride.departure_time > now, Ride.departure_time <= horizon))
    n = 0
    for b in db.scalars(q):
        r = b.ride
        notify(db, b.passenger_id, "ride_reminder", "Ride reminder", f"Your ride {r.origin_name} → {r.destination_name} leaves soon.", {"ride_id": r.id, "booking_id": b.id})
        notify(db, r.driver_id, "ride_reminder", "Ride reminder", f"{b.passenger.name} is waiting for your ride soon.", {"ride_id": r.id, "booking_id": b.id})
        b.reminder_sent = True
        n += 1
    db.commit()
    return n


async def reminder_loop(interval_seconds: int = 60) -> None:
    while True:
        try:
            with SessionLocal() as db:
                send_due_reminders(db)
        except Exception:  # never let the loop die (e.g. Neon waking up)
            log.exception("Reminder pass failed")
        await asyncio.sleep(interval_seconds)
