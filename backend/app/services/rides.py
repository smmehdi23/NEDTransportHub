"""Shared ride/booking business rules, used by several routers (rides, bookings, admin, polls)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi import HTTPException

from app.core.time import utcnow
from app.models.booking import Booking, BookingStatus, FareStatus
from app.models.payment import Payment
from app.models.rating import Rating
from app.models.ride import Ride, RideStatus
from app.models.user import User
from app.services.notifications import notify

ACTIVE_RIDE = (RideStatus.OPEN, RideStatus.FULL)


def get_ride_locked(db: Session, ride_id: int) -> Ride:
    """Load a ride with a row lock (SELECT ... FOR UPDATE on PostgreSQL) so seat changes are serialised
    (SRS 4.1 #3). SQLite (tests) ignores the lock, which is fine for a single-threaded test run."""
    ride = db.scalar(select(Ride).where(Ride.id == ride_id).with_for_update())
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    return ride


def sync_ride_seat_status(ride: Ride) -> None:
    if ride.status in ACTIVE_RIDE:
        ride.status = RideStatus.FULL if ride.available_seats <= 0 else RideStatus.OPEN


def user_rating(db: Session, user_id: int) -> tuple[float | None, int]:
    avg, count = db.execute(
        select(func.avg(Rating.score), func.count(Rating.id)).where(Rating.rated_user_id == user_id)
    ).one()
    return (round(float(avg), 2) if avg is not None else None), count


def is_ride_participant(db: Session, user: User, ride: Ride) -> bool:
    if ride.driver_id == user.id:
        return True
    return db.scalar(
        select(Booking.id).where(
            Booking.ride_id == ride.id,
            Booking.passenger_id == user.id,
            Booking.status.in_((BookingStatus.CONFIRMED, BookingStatus.COMPLETED)),
        )
    ) is not None


def require_participant(db: Session, user: User, ride: Ride) -> None:
    if not is_ride_participant(db, user, ride):
        raise HTTPException(403, "You are not a participant of this ride.")


def cancel_booking(db: Session, booking: Booking, ride: Ride, by: User, reason: str | None) -> None:
    """Cancel a pending/confirmed booking, release its seat and notify the other side. Caller commits."""
    was_confirmed = booking.status == BookingStatus.CONFIRMED
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_by = by.id
    booking.cancel_reason = reason
    if was_confirmed:
        ride.available_seats = min(ride.total_seats, ride.available_seats + 1)
        sync_ride_seat_status(ride)
    other = booking.passenger_id if by.id == ride.driver_id else ride.driver_id
    notify(
        db, other, "booking_cancelled", "Booking cancelled",
        f"{by.name} cancelled the booking for {ride.origin_name} → {ride.destination_name}.",
        {"booking_id": booking.id, "ride_id": ride.id},
    )


def cancel_ride(db: Session, ride: Ride, reason: str | None, notify_title: str = "Ride cancelled") -> int:
    """Cancel a ride and all its live bookings. Returns the number of passengers notified."""
    ride.status = RideStatus.CANCELLED
    ride.cancel_reason = reason
    ride.available_seats = ride.total_seats
    n = 0
    for b in db.scalars(
        select(Booking).where(Booking.ride_id == ride.id, Booking.status.in_((BookingStatus.PENDING, BookingStatus.CONFIRMED)))
    ):
        b.status = BookingStatus.CANCELLED
        b.cancel_reason = reason or "Ride cancelled by driver"
        notify(
            db, b.passenger_id, "ride_cancelled", notify_title,
            f"The ride {ride.origin_name} → {ride.destination_name} was cancelled.",
            {"ride_id": ride.id, "booking_id": b.id},
        )
        n += 1
    return n


def complete_ride(db: Session, ride: Ride) -> None:
    """Mark a ride completed and create a pending payment for every confirmed passenger."""
    import uuid

    ride.status = RideStatus.COMPLETED
    ride.completed_at = utcnow()
    for b in db.scalars(select(Booking).where(Booking.ride_id == ride.id)):
        if b.status == BookingStatus.CONFIRMED:
            b.status = BookingStatus.COMPLETED
            amount = b.proposed_fare if b.fare_status == FareStatus.ACCEPTED and b.proposed_fare is not None else ride.estimated_fare
            if db.scalar(select(Payment.transaction_id).where(Payment.booking_id == b.id)) is None:
                db.add(Payment(transaction_id=f"TXN-{uuid.uuid4().hex[:24]}", booking_id=b.id, amount=amount))
            notify(
                db, b.passenger_id, "payment_due", "Ride completed",
                f"Please pay your fare of PKR {amount} to {ride.driver.name}.",
                {"booking_id": b.id, "ride_id": ride.id, "amount": amount},
            )
        elif b.status == BookingStatus.PENDING:
            b.status = BookingStatus.CANCELLED
            b.cancel_reason = "Ride completed without confirmation"
