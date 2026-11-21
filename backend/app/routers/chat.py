from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_rider
from app.core.ws_auth import get_session_factory, user_from_token
from app.models.booking import Booking, BookingStatus
from app.models.chat import Message
from app.models.ride import RideStatus
from app.models.user import User
from app.schemas.misc import MessageCreate, MessageRead
from app.services.notifications import notify
from app.services.realtime import chat_manager

router = APIRouter(tags=["Chat"])
CHAT_STATUSES = (BookingStatus.CONFIRMED, BookingStatus.COMPLETED)


def _chat_booking(db: Session, user: User, booking_id: int, for_sending: bool) -> Booking:
    """Only the passenger and driver of a *confirmed* booking may chat; completed bookings are read-only."""
    b = db.get(Booking, booking_id)
    if b is None or user.id not in (b.passenger_id, b.ride.driver_id):
        raise HTTPException(404, "Booking not found.")
    if b.status not in CHAT_STATUSES:
        raise HTTPException(403, "Chat opens once the booking is confirmed.")
    if for_sending and (b.status != BookingStatus.CONFIRMED or b.ride.status == RideStatus.CANCELLED):
        raise HTTPException(403, "This chat is closed.")
    return b


def _store(db: Session, b: Booking, sender: User, content: str) -> Message:
    msg = Message(booking_id=b.id, sender_id=sender.id, content=content)
    db.add(msg)
    other = b.ride.driver_id if sender.id == b.passenger_id else b.passenger_id
    if not chat_manager.is_online(f"booking:{b.id}", other):  # offline -> push
        notify(db, other, "chat_message", f"Message from {sender.name}", content[:120], {"booking_id": b.id})
    db.commit()
    return msg


@router.get("/chat/{booking_id}/messages", response_model=list[MessageRead])
def history(
    booking_id: int, before_id: int | None = Query(None, ge=1), limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_rider), db: Session = Depends(get_db),
):
    _chat_booking(db, user, booking_id, for_sending=False)
    q = select(Message).where(Message.booking_id == booking_id)
    if before_id:
        q = q.where(Message.id < before_id)
    return list(reversed(db.scalars(q.order_by(Message.id.desc()).limit(limit)).all()))


@router.post("/chat/{booking_id}/messages", response_model=MessageRead, status_code=201)
async def send_message(booking_id: int, payload: MessageCreate, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """REST fallback for sending (e.g. when the socket is down). Also pushes to connected sockets."""
    b = _chat_booking(db, user, booking_id, for_sending=True)
    msg = _store(db, b, user, payload.content)
    out = MessageRead.model_validate(msg)
    await chat_manager.broadcast(f"booking:{booking_id}", {"type": "message", **out.model_dump(mode="json")})
    return out


@router.websocket("/ws/chat/{booking_id}")
async def chat_ws(websocket: WebSocket, booking_id: int, token: str | None = Query(None),
                  factory: Callable[[], Session] = Depends(get_session_factory)):
    """Connect with ?token=<access JWT>. Send {"content": "..."}; receive {"type":"message", ...}."""
    with factory() as db:
        user = user_from_token(db, token)
        try:
            if user is None:
                raise HTTPException(401)
            _chat_booking(db, user, booking_id, for_sending=False)
        except HTTPException:
            await websocket.close(code=4401)
            return
        user_id = user.id
    room = f"booking:{booking_id}"
    await chat_manager.connect(room, websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            try:
                payload = MessageCreate(content=str(data.get("content", "")))
            except ValueError:
                await websocket.send_json({"type": "error", "detail": "Invalid message."})
                continue
            with factory() as db:  # short session per message (friendly to Neon's connection limits)
                try:
                    sender = db.get(User, user_id)
                    b = _chat_booking(db, sender, booking_id, for_sending=True)
                except HTTPException as exc:
                    await websocket.send_json({"type": "error", "detail": exc.detail})
                    continue
                msg = _store(db, b, sender, payload.content)
                out = MessageRead.model_validate(msg)
            await chat_manager.broadcast(room, {"type": "message", **out.model_dump(mode="json")})
    except WebSocketDisconnect:
        pass
    finally:
        chat_manager.disconnect(room, websocket)
