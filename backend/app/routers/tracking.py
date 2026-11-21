from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_driver
from app.core.time import utcnow
from app.core.ws_auth import get_session_factory, user_from_token
from app.models.booking import Booking, BookingStatus
from app.models.ride import Ride, RideStatus
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.misc import LocationUpdate
from app.services import maps
from app.services.realtime import tracking_manager
from app.services.rides import is_ride_participant, require_participant

router = APIRouter(prefix="/tracking", tags=["Live Tracking"])


def _save_location(db: Session, ride: Ride, loc: LocationUpdate) -> dict:
    ride.last_lat, ride.last_lng, ride.last_location_at = loc.lat, loc.lng, utcnow()
    db.commit()
    return {"type": "location", "ride_id": ride.id, "lat": loc.lat, "lng": loc.lng,
            "speed_kmh": loc.speed_kmh, "at": ride.last_location_at.isoformat()}


@router.post("/rides/{ride_id}/location", response_model=MessageResponse)
async def push_location(ride_id: int, loc: LocationUpdate, driver: User = Depends(require_driver), db: Session = Depends(get_db)):
    """HTTP fallback for the driver's GPS stream (the WebSocket is preferred)."""
    ride = db.get(Ride, ride_id)
    if ride is None or ride.driver_id != driver.id:
        raise HTTPException(404, "Ride not found.")
    if ride.status != RideStatus.IN_PROGRESS:
        raise HTTPException(409, "Location can only be shared while the ride is in progress.")
    event = _save_location(db, ride, loc)
    await tracking_manager.broadcast(f"ride:{ride_id}", event)
    return MessageResponse(message="Location updated.")


@router.get("/rides/{ride_id}")
def ride_tracking(ride_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Snapshot for the map screen: route, live position, ETAs and pickup points (visible only to participants)."""
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    require_participant(db, user, ride)
    is_driver = ride.driver_id == user.id
    bookings = list(db.scalars(select(Booking).where(Booking.ride_id == ride.id, Booking.status.in_((BookingStatus.CONFIRMED, BookingStatus.COMPLETED)))))
    if not is_driver:  # a passenger only ever sees their own pickup
        bookings = [b for b in bookings if b.passenger_id == user.id]
    current = (ride.last_lat, ride.last_lng) if ride.last_lat is not None else None
    eta_dest = eta_pickup = None
    if current and ride.status == RideStatus.IN_PROGRESS:
        eta_dest = maps.eta_minutes(current, (ride.dest_lat, ride.dest_lng))
        if not is_driver and bookings:
            eta_pickup = maps.eta_minutes(current, (bookings[0].pickup_lat, bookings[0].pickup_lng))
    return {
        "ride_id": ride.id, "status": ride.status.value,
        "route": ride.route, "origin": [ride.origin_lat, ride.origin_lng], "destination": [ride.dest_lat, ride.dest_lng],
        "vehicle_plate": ride.vehicle.plate_number, "driver_name": ride.driver.name,
        "location": None if current is None else {"lat": current[0], "lng": current[1], "at": ride.last_location_at},
        "eta_to_destination_min": eta_dest, "eta_to_my_pickup_min": eta_pickup,
        "pickups": [{"booking_id": b.id, "passenger": b.passenger.name, "name": b.pickup_name, "lat": b.pickup_lat, "lng": b.pickup_lng} for b in bookings],
    }


@router.websocket("/ws/{ride_id}")
async def tracking_ws(websocket: WebSocket, ride_id: int, token: str | None = Query(None),
                      factory: Callable[[], Session] = Depends(get_session_factory)):
    """?token=<access JWT>. The driver sends {"lat":..,"lng":..,"speed_kmh":..}; participants receive location events."""
    with factory() as db:
        user = user_from_token(db, token)
        ride = db.get(Ride, ride_id) if user else None
        if user is None or ride is None or not is_ride_participant(db, user, ride):
            await websocket.close(code=4401)
            return
        user_id, is_driver = user.id, ride.driver_id == user.id
        last = None if ride.last_lat is None else {"type": "location", "ride_id": ride_id, "lat": ride.last_lat, "lng": ride.last_lng, "at": ride.last_location_at.isoformat()}
    room = f"ride:{ride_id}"
    await tracking_manager.connect(room, websocket, user_id)
    if last:
        await websocket.send_json(last)
    try:
        while True:
            data = await websocket.receive_json()
            if not is_driver:
                continue  # passengers are listen-only
            try:
                loc = LocationUpdate(lat=data["lat"], lng=data["lng"], speed_kmh=data.get("speed_kmh"))
            except (ValueError, KeyError, TypeError):
                await websocket.send_json({"type": "error", "detail": "Invalid location."})
                continue
            with factory() as db:
                ride = db.get(Ride, ride_id)
                if ride.status != RideStatus.IN_PROGRESS:
                    await websocket.send_json({"type": "error", "detail": "Ride is not in progress."})
                    continue
                event = _save_location(db, ride, loc)
            await tracking_manager.broadcast(room, event, exclude=websocket)
    except WebSocketDisconnect:
        pass
    finally:
        tracking_manager.disconnect(room, websocket)
