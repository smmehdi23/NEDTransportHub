from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_driver, require_rider
from app.core.time import as_utc, utcnow
from app.models.booking import Booking, BookingStatus
from app.models.ride import PollStatus, PollVote, Ride, RidePoll, RideStatus
from app.models.user import User
from app.models.vehicle import Vehicle, VerificationStatus
from app.schemas.common import MessageResponse
from app.schemas.ride import (
    CancelRequest, DriverBrief, RideCreate, RideMatchRead, RidePage, RideRead, RideUpdate,
)
from app.services import maps
from app.services.fare import split_fare
from app.services.matching import match_ride
from app.services.notifications import notify
from app.services.rides import (
    ACTIVE_RIDE, cancel_ride, complete_ride, get_ride_locked, is_ride_participant, user_rating,
)

router = APIRouter(prefix="/rides", tags=["Rides"])


def ride_to_read(db: Session, ride: Ride, viewer: User | None = None) -> RideRead:
    avg, cnt = user_rating(db, ride.driver_id)
    private = viewer is not None and is_ride_participant(db, viewer, ride)
    return RideRead(
        id=ride.id,
        driver=DriverBrief(id=ride.driver_id, name=ride.driver.name, rating_avg=avg, rating_count=cnt),
        vehicle_model=ride.vehicle.model,
        origin_name=ride.origin_name, destination_name=ride.destination_name,
        origin_lat=ride.origin_lat, origin_lng=ride.origin_lng, dest_lat=ride.dest_lat, dest_lng=ride.dest_lng,
        route=[(p[0], p[1]) for p in ride.route], distance_km=ride.distance_km, duration_min=ride.duration_min,
        departure_time=ride.departure_time, total_seats=ride.total_seats, available_seats=ride.available_seats,
        estimated_fare=ride.estimated_fare, status=ride.status, notes=ride.notes, poll_id=ride.poll_id,
        vehicle_plate=ride.vehicle.plate_number if private else None,
        driver_phone=ride.driver.phone if private else None,
        created_at=ride.created_at,
    )


def _own_ride(db: Session, user: User, ride_id: int, lock: bool = False) -> Ride:
    ride = get_ride_locked(db, ride_id) if lock else db.get(Ride, ride_id)
    if ride is None or ride.driver_id != user.id:
        raise HTTPException(404, "Ride not found.")
    return ride


@router.post("", response_model=RideRead, status_code=201)
def create_ride(payload: RideCreate, driver: User = Depends(require_driver), db: Session = Depends(get_db)):
    """Offer a ride (verified drivers only). Route and fare are computed if not supplied."""
    vehicle = db.get(Vehicle, payload.vehicle_id)
    if vehicle is None or vehicle.owner_id != driver.id:
        raise HTTPException(404, "Vehicle not found.")
    if vehicle.verification_status != VerificationStatus.VERIFIED:
        raise HTTPException(403, "This vehicle has not been verified by an administrator.")
    if vehicle.model.lower().startswith("bike") and payload.total_seats > 1:
        raise HTTPException(422, "A motorbike can carry at most 1 passenger.")
    if payload.total_seats > vehicle.seat_capacity:
        raise HTTPException(422, f"This vehicle has only {vehicle.seat_capacity} seats.")

    poll = None
    if payload.poll_id is not None:
        poll = db.get(RidePoll, payload.poll_id)
        if poll is None or poll.status != PollStatus.OPEN:
            raise HTTPException(409, "That poll is no longer open.")

    origin, dest = (payload.origin_lat, payload.origin_lng), (payload.dest_lat, payload.dest_lng)
    info = maps.get_route(origin, dest)
    route = payload.route or info.route
    fare = payload.estimated_fare
    if fare is None:
        fare = split_fare(info.distance_km, payload.total_seats)["fare_per_passenger"]

    ride = Ride(
        driver_id=driver.id, vehicle_id=vehicle.id, poll_id=payload.poll_id,
        origin_name=payload.origin_name, destination_name=payload.destination_name,
        origin_lat=origin[0], origin_lng=origin[1], dest_lat=dest[0], dest_lng=dest[1],
        route=[list(p) for p in route], distance_km=info.distance_km, duration_min=info.duration_min,
        departure_time=payload.departure_time, total_seats=payload.total_seats, available_seats=payload.total_seats,
        estimated_fare=fare, notes=payload.notes,
    )
    db.add(ride)
    db.flush()

    # Tell people who asked for this kind of trip (poll creator + voters, or any matching open poll).
    if poll is not None:
        poll.status = PollStatus.CONVERTED
        audience = {poll.creator_id, *db.scalars(select(PollVote.user_id).where(PollVote.poll_id == poll.id))}
    else:
        audience = set()
        for p in db.scalars(select(RidePoll).where(RidePoll.status == PollStatus.OPEN).limit(200)):
            if p.creator_id != driver.id and match_ride(
                ride, (p.origin_lat, p.origin_lng), (p.dest_lat, p.dest_lng), p.departure_time
            ):
                audience.add(p.creator_id)
    for uid in audience - {driver.id}:
        notify(db, uid, "ride_available", "A ride matches your request",
               f"{driver.name} is going {ride.origin_name} → {ride.destination_name}.", {"ride_id": ride.id})
    db.commit()
    return ride_to_read(db, ride, driver)


@router.get("/search", response_model=list[RideMatchRead])
def search_rides(
    pickup_lat: float = Query(ge=-90, le=90), pickup_lng: float = Query(ge=-180, le=180),
    dropoff_lat: float | None = Query(None, ge=-90, le=90), dropoff_lng: float | None = Query(None, ge=-180, le=180),
    departure_time: datetime | None = Query(None, description="Preferred departure (UTC if no timezone)"),
    window_minutes: int = Query(60, ge=5, le=360),
    radius_m: int = Query(500, ge=50, le=5000),
    max_fare: int | None = Query(None, ge=0),
    min_seats: int = Query(1, ge=1, le=8),
    sort: str = Query("best", pattern="^(best|time|fare)$"),
    user: User = Depends(require_rider),
    db: Session = Depends(get_db),
):
    """Find open rides whose route passes within `radius_m` of the pickup (and drop-off, in driving direction)."""
    if (dropoff_lat is None) != (dropoff_lng is None):
        raise HTTPException(422, "Provide both dropoff_lat and dropoff_lng, or neither.")
    when = as_utc(departure_time) if departure_time else None
    q = select(Ride).where(
        Ride.status == RideStatus.OPEN, Ride.available_seats >= min_seats,
        Ride.departure_time > utcnow(), Ride.driver_id != user.id,
    )
    if when:
        from datetime import timedelta
        q = q.where(Ride.departure_time.between(when - timedelta(minutes=window_minutes), when + timedelta(minutes=window_minutes)))
    if max_fare is not None:
        q = q.where(Ride.estimated_fare <= max_fare)
    dropoff = (dropoff_lat, dropoff_lng) if dropoff_lat is not None else None
    matches = [
        m for r in db.scalars(q.limit(500))
        if (m := match_ride(r, (pickup_lat, pickup_lng), dropoff, when, radius_m, window_minutes))
    ]
    key = {"best": lambda m: -m.score, "time": lambda m: m.ride.departure_time, "fare": lambda m: m.ride.estimated_fare}[sort]
    matches.sort(key=key)
    return [
        RideMatchRead(ride=ride_to_read(db, m.ride, user), pickup_distance_m=round(m.pickup_distance_m, 1),
                      dropoff_distance_m=None if m.dropoff_distance_m is None else round(m.dropoff_distance_m, 1),
                      time_diff_min=round(m.time_diff_min, 1), score=m.score)
        for m in matches[:50]
    ]


@router.get("", response_model=RidePage)
def browse_rides(
    origin: str | None = Query(None, max_length=100), destination: str | None = Query(None, max_length=100),
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD (UTC)"),
    mine: bool = False,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_rider), db: Session = Depends(get_db),
):
    """Browse open rides by name/date, or (mine=true) the rides I offer."""
    q = select(Ride)
    if mine:
        q = q.where(Ride.driver_id == user.id)
    else:
        q = q.where(Ride.status.in_(ACTIVE_RIDE), Ride.departure_time > utcnow())
    if origin:
        q = q.where(Ride.origin_name.ilike(f"%{origin.strip()}%"))
    if destination:
        q = q.where(Ride.destination_name.ilike(f"%{destination.strip()}%"))
    if date:
        from datetime import timedelta, timezone
        d0 = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        q = q.where(Ride.departure_time >= d0, Ride.departure_time < d0 + timedelta(days=1))
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Ride.departure_time).offset((page - 1) * page_size).limit(page_size)).all()
    return RidePage(items=[ride_to_read(db, r, user) for r in rows], total=total, page=page, page_size=page_size)


@router.get("/{ride_id}", response_model=RideRead)
def get_ride(ride_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    return ride_to_read(db, ride, user)


@router.patch("/{ride_id}", response_model=RideRead)
def update_ride(ride_id: int, payload: RideUpdate, driver: User = Depends(require_driver), db: Session = Depends(get_db)):
    ride = _own_ride(db, driver, ride_id, lock=True)
    if ride.status not in ACTIVE_RIDE:
        raise HTTPException(409, f"A {ride.status.value} ride cannot be edited.")
    data = payload.model_dump(exclude_unset=True)
    confirmed = db.scalar(select(func.count(Booking.id)).where(Booking.ride_id == ride.id, Booking.status == BookingStatus.CONFIRMED))
    if "total_seats" in data:
        vehicle_cap = ride.vehicle.seat_capacity
        if data["total_seats"] > vehicle_cap:
            raise HTTPException(422, f"This vehicle has only {vehicle_cap} seats.")
        if data["total_seats"] < confirmed:
            raise HTTPException(409, f"{confirmed} seats are already confirmed.")
        ride.total_seats = data["total_seats"]
        ride.available_seats = ride.total_seats - confirmed
    changed_time = "departure_time" in data and as_utc(data["departure_time"]) != as_utc(ride.departure_time)
    for f in ("departure_time", "estimated_fare", "notes"):
        if f in data:
            setattr(ride, f, data[f])
    from app.services.rides import sync_ride_seat_status
    sync_ride_seat_status(ride)
    if changed_time or "estimated_fare" in data:
        for b in db.scalars(select(Booking).where(Booking.ride_id == ride.id, Booking.status.in_((BookingStatus.PENDING, BookingStatus.CONFIRMED)))):
            notify(db, b.passenger_id, "ride_updated", "Ride updated",
                   f"{driver.name} changed the details of {ride.origin_name} → {ride.destination_name}.", {"ride_id": ride.id})
    db.commit()
    return ride_to_read(db, ride, driver)


@router.post("/{ride_id}/cancel", response_model=MessageResponse)
def cancel(ride_id: int, payload: CancelRequest | None = None, driver: User = Depends(require_driver), db: Session = Depends(get_db)):
    ride = _own_ride(db, driver, ride_id, lock=True)
    if ride.status not in ACTIVE_RIDE:
        raise HTTPException(409, f"A {ride.status.value} ride cannot be cancelled.")
    n = cancel_ride(db, ride, payload.reason if payload else None)
    db.commit()
    return MessageResponse(message=f"Ride cancelled. {n} passenger(s) notified.")


@router.post("/{ride_id}/start", response_model=RideRead)
def start(ride_id: int, driver: User = Depends(require_driver), db: Session = Depends(get_db)):
    ride = _own_ride(db, driver, ride_id, lock=True)
    if ride.status not in ACTIVE_RIDE:
        raise HTTPException(409, f"A {ride.status.value} ride cannot be started.")
    confirmed = list(db.scalars(select(Booking).where(Booking.ride_id == ride.id, Booking.status == BookingStatus.CONFIRMED)))
    if not confirmed:
        raise HTTPException(409, "At least one confirmed passenger is required to start the ride.")
    ride.status = RideStatus.IN_PROGRESS
    ride.started_at = utcnow()
    for b in db.scalars(select(Booking).where(Booking.ride_id == ride.id, Booking.status == BookingStatus.PENDING)):
        b.status = BookingStatus.CANCELLED
        b.cancel_reason = "Ride started without confirmation"
    for b in confirmed:
        notify(db, b.passenger_id, "ride_started", "Your ride has started",
               f"{driver.name} is on the way. Track the ride live.", {"ride_id": ride.id})
    db.commit()
    return ride_to_read(db, ride, driver)


@router.post("/{ride_id}/complete", response_model=RideRead)
def complete(ride_id: int, driver: User = Depends(require_driver), db: Session = Depends(get_db)):
    ride = _own_ride(db, driver, ride_id, lock=True)
    if ride.status != RideStatus.IN_PROGRESS:
        raise HTTPException(409, "Only a ride in progress can be completed.")
    complete_ride(db, ride)
    db.commit()
    return ride_to_read(db, ride, driver)
