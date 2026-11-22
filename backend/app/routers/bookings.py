from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_driver, require_rider
from app.core.time import as_utc, utcnow
from app.models.booking import Booking, BookingStatus, FareStatus
from app.models.ride import Ride, RideStatus
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingRead, BookingRespond, FareDecision, PassengerBrief
from app.schemas.ride import CancelRequest
from app.services.campus import night_pickup_error
from app.services.matching import match_ride
from app.services.notifications import notify
from app.services.rides import cancel_booking, get_ride_locked, sync_ride_seat_status

router = APIRouter(prefix="/bookings", tags=["Bookings"])

LIVE = (BookingStatus.PENDING, BookingStatus.CONFIRMED)


def booking_to_read(b: Booking, viewer: User) -> BookingRead:
    """Serialise for `viewer`. The driver cannot see the exact pickup pin until the booking is confirmed (SEC-05)."""
    ride = b.ride
    is_driver = viewer.id == ride.driver_id
    reveal = (not is_driver) or b.status in (BookingStatus.CONFIRMED, BookingStatus.COMPLETED)
    return BookingRead(
        id=b.id, ride_id=b.ride_id,
        passenger=PassengerBrief(id=b.passenger.id, name=b.passenger.name, phone=b.passenger.phone if reveal else None),
        origin_name=ride.origin_name, destination_name=ride.destination_name,
        departure_time=ride.departure_time, ride_status=ride.status.value,
        pickup_name=b.pickup_name if reveal else None,
        pickup_lat=b.pickup_lat if reveal else None, pickup_lng=b.pickup_lng if reveal else None,
        dropoff_name=b.dropoff_name if reveal else None,
        status=b.status, proposed_fare=b.proposed_fare, fare_status=b.fare_status,
        cancel_reason=b.cancel_reason, created_at=b.created_at,
    )


def _booking(db: Session, booking_id: int) -> Booking:
    b = db.get(Booking, booking_id)
    if b is None:
        raise HTTPException(404, "Booking not found.")
    return b


@router.post("", response_model=BookingRead, status_code=201)
def request_seat(payload: BookingCreate, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """Passenger asks for a seat. The pickup must lie on the driver's route corridor."""
    ride = db.get(Ride, payload.ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    if ride.driver_id == user.id:
        raise HTTPException(403, "You cannot book your own ride.")
    if ride.status != RideStatus.OPEN or ride.available_seats < 1:
        raise HTTPException(409, "This ride is not accepting bookings.")
    if as_utc(ride.departure_time) <= utcnow():
        raise HTTPException(409, "This ride has already departed.")
    dropoff = (payload.dropoff_lat, payload.dropoff_lng) if payload.dropoff_lat is not None else None
    if match_ride(ride, (payload.pickup_lat, payload.pickup_lng), dropoff, None) is None:
        raise HTTPException(422, "The pickup (and drop-off) must be near the driver's route.")
    if (err := night_pickup_error(ride.departure_time, (payload.pickup_lat, payload.pickup_lng))) is not None:
        raise HTTPException(422, err)

    existing = db.scalar(select(Booking).where(Booking.ride_id == ride.id, Booking.passenger_id == user.id))
    if existing is not None:
        if existing.status in LIVE:
            raise HTTPException(409, "You already have a request for this ride.")
        booking = existing  # re-request after a cancel/reject: reuse the row
        booking.status, booking.fare_status = BookingStatus.PENDING, FareStatus.NONE
        booking.proposed_fare = booking.cancel_reason = booking.cancelled_by = None
    else:
        booking = Booking(ride_id=ride.id, passenger_id=user.id)
        db.add(booking)
    booking.pickup_name, booking.pickup_lat, booking.pickup_lng = payload.pickup_name.strip(), payload.pickup_lat, payload.pickup_lng
    booking.dropoff_name, booking.dropoff_lat, booking.dropoff_lng = payload.dropoff_name, payload.dropoff_lat, payload.dropoff_lng
    if payload.proposed_fare is not None:
        booking.proposed_fare = payload.proposed_fare
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You already have a request for this ride.")
    offer_note = (
        f" Offered PKR {payload.proposed_fare} (listed: PKR {ride.estimated_fare})."
        if payload.proposed_fare is not None
        else ""
    )
    notify(db, ride.driver_id, "booking_request", "New seat request",
           f"{user.name} wants a seat on {ride.origin_name} → {ride.destination_name}.{offer_note}",
           {"booking_id": booking.id, "ride_id": ride.id})
    db.commit()
    return booking_to_read(booking, user)


@router.get("", response_model=list[BookingRead])
def my_bookings(
    as_driver: bool = Query(False, description="true: requests on rides I offer; false: my own bookings"),
    status: BookingStatus | None = None, ride_id: int | None = None,
    user: User = Depends(require_rider), db: Session = Depends(get_db),
):
    q = select(Booking).join(Ride, Ride.id == Booking.ride_id)
    q = q.where(Ride.driver_id == user.id) if as_driver else q.where(Booking.passenger_id == user.id)
    if status:
        q = q.where(Booking.status == status)
    if ride_id:
        q = q.where(Booking.ride_id == ride_id)
    return [booking_to_read(b, user) for b in db.scalars(q.order_by(Booking.id.desc()).limit(200))]


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    b = _booking(db, booking_id)
    if user.id not in (b.passenger_id, b.ride.driver_id):
        raise HTTPException(404, "Booking not found.")
    return booking_to_read(b, user)


@router.post("/{booking_id}/respond", response_model=BookingRead)
def respond(booking_id: int, payload: BookingRespond, driver: User = Depends(require_driver), db: Session = Depends(get_db)):
    """Driver accepts (and proposes a fare) or rejects. The booking is only *confirmed* after the passenger accepts the fare."""
    b = _booking(db, booking_id)
    if b.ride.driver_id != driver.id:
        raise HTTPException(404, "Booking not found.")
    if b.status != BookingStatus.PENDING:
        raise HTTPException(409, f"This request is already {b.status.value}.")
    ride = b.ride
    if payload.action == "reject":
        b.status, b.cancel_reason = BookingStatus.REJECTED, payload.reason
        notify(db, b.passenger_id, "booking_rejected", "Request declined",
               f"{driver.name} declined your request for {ride.origin_name} → {ride.destination_name}.",
               {"booking_id": b.id, "ride_id": ride.id})
    else:
        ride = get_ride_locked(db, b.ride_id)
        if ride.status != RideStatus.OPEN or ride.available_seats < 1:
            raise HTTPException(409, "No seat is available on this ride.")
        # If the passenger already offered a fare and the driver accepts that exact offer,
        # confirm the seat immediately without requiring another confirmation round-trip.
        accepted_rider_offer = (
            b.fare_status == FareStatus.NONE
            and b.proposed_fare is not None
            and (payload.fare is None or payload.fare == b.proposed_fare)
        )
        if accepted_rider_offer:
            ride.available_seats -= 1
            sync_ride_seat_status(ride)
            b.fare_status = FareStatus.ACCEPTED
            b.status = BookingStatus.CONFIRMED
            notify(
                db,
                b.passenger_id,
                "booking_confirmed",
                "Offer accepted! Seat confirmed",
                f"{driver.name} accepted your offer of PKR {b.proposed_fare} for {ride.origin_name} → {ride.destination_name}.",
                {"booking_id": b.id, "ride_id": ride.id, "fare": b.proposed_fare},
            )
        else:
            b.proposed_fare = payload.fare if payload.fare is not None else ride.estimated_fare
            b.fare_status = FareStatus.PROPOSED
            notify(
                db,
                b.passenger_id,
                "fare_proposed",
                "Fare proposed",
                f"{driver.name} proposed PKR {b.proposed_fare} for {ride.origin_name} → {ride.destination_name}. Please review it.",
                {"booking_id": b.id, "ride_id": ride.id, "fare": b.proposed_fare},
            )
    db.commit()
    return booking_to_read(b, driver)


@router.post("/{booking_id}/fare", response_model=BookingRead)
def decide_fare(booking_id: int, payload: FareDecision, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """Passenger accepts or declines the proposed fare. Accepting reserves the seat atomically (row lock)."""
    b = _booking(db, booking_id)
    if b.passenger_id != user.id:
        raise HTTPException(404, "Booking not found.")
    if b.status != BookingStatus.PENDING or b.fare_status != FareStatus.PROPOSED:
        raise HTTPException(409, "There is no proposed fare awaiting your decision.")
    ride = get_ride_locked(db, b.ride_id)  # serialise concurrent confirmations for this ride
    if not payload.accept:
        b.fare_status = FareStatus.DECLINED
        notify(db, ride.driver_id, "fare_declined", "Fare declined",
               f"{user.name} declined the proposed fare of PKR {b.proposed_fare}. You may propose another.",
               {"booking_id": b.id, "ride_id": ride.id})
    else:
        if ride.status != RideStatus.OPEN or ride.available_seats < 1:
            b.status, b.cancel_reason = BookingStatus.REJECTED, "The ride became full or unavailable"
            db.commit()
            raise HTTPException(409, "Sorry, the last seat was just taken.")
        ride.available_seats -= 1
        sync_ride_seat_status(ride)
        b.fare_status, b.status = FareStatus.ACCEPTED, BookingStatus.CONFIRMED
        notify(db, ride.driver_id, "booking_confirmed", "Booking confirmed",
               f"{user.name} accepted PKR {b.proposed_fare}. Pickup: {b.pickup_name}.",
               {"booking_id": b.id, "ride_id": ride.id})
    db.commit()
    return booking_to_read(b, user)


@router.post("/{booking_id}/cancel", response_model=BookingRead)
def cancel(booking_id: int, payload: CancelRequest | None = None, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """Passenger or driver cancels a pending/confirmed booking before the ride starts. Frees the seat."""
    b = _booking(db, booking_id)
    ride = get_ride_locked(db, b.ride_id)
    if user.id not in (b.passenger_id, ride.driver_id):
        raise HTTPException(404, "Booking not found.")
    if b.status not in LIVE:
        raise HTTPException(409, f"A {b.status.value} booking cannot be cancelled.")
    if ride.status not in (RideStatus.OPEN, RideStatus.FULL):
        raise HTTPException(409, "The ride has already started or ended.")
    cancel_booking(db, b, ride, user, payload.reason if payload else None)
    db.commit()
    return booking_to_read(b, user)
