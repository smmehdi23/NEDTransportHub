import json

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.database import get_db
from app.core.deps import require_rider
from app.core.time import utcnow
from app.models.booking import Booking
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.ride import Ride
from app.models.user import User
from app.schemas.booking import PayRequest, PayResponse, PaymentRead, PaymentWebhook
from app.schemas.common import MessageResponse
from app.services.notifications import notify
from app.services.payment_provider import PaymentProvider, get_payment_provider, verify_signature

router = APIRouter(prefix="/payments", tags=["Payments"])


def _payment_for(db: Session, booking_id: int, user: User) -> tuple[Payment, Booking]:
    pay = db.scalar(select(Payment).where(Payment.booking_id == booking_id))
    b = db.get(Booking, booking_id)
    if pay is None or b is None or user.id not in (b.passenger_id, b.ride.driver_id):
        raise HTTPException(404, "Payment not found. Payments are created when a ride is completed.")
    return pay, b


@router.get("/history", response_model=list[PaymentRead])
def history(
    role: str = Query("passenger", pattern="^(passenger|driver)$"),
    status: PaymentStatus | None = None,
    user: User = Depends(require_rider), db: Session = Depends(get_db),
):
    """Payments I made (passenger) or received (driver)."""
    q = select(Payment).join(Booking, Booking.id == Payment.booking_id)
    q = q.where(Booking.passenger_id == user.id) if role == "passenger" else q.join(Ride, Ride.id == Booking.ride_id).where(Ride.driver_id == user.id)
    if status:
        q = q.where(Payment.status == status)
    return db.scalars(q.order_by(Payment.created_at.desc()).limit(200)).all()


@router.get("/booking/{booking_id}", response_model=PaymentRead)
def get_payment(booking_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    return _payment_for(db, booking_id, user)[0]


@router.post("/booking/{booking_id}/pay", response_model=PayResponse)
def pay(
    booking_id: int, payload: PayRequest, user: User = Depends(require_rider), db: Session = Depends(get_db),
    provider: PaymentProvider = Depends(get_payment_provider),
):
    """Passenger pays the agreed fare after the ride. Online -> provider checkout (confirmed by webhook).
    Cash -> the driver confirms receipt."""
    pay, b = _payment_for(db, booking_id, user)
    if b.passenger_id != user.id:
        raise HTTPException(403, "Only the passenger can pay.")
    if pay.status not in (PaymentStatus.PENDING, PaymentStatus.OUTSTANDING):
        raise HTTPException(409, f"This payment is already {pay.status.value}.")
    checkout = None
    pay.method = payload.method
    if payload.method == PaymentMethod.ONLINE:
        charge = provider.create_charge(pay.amount, b.id)
        pay.provider_reference, checkout = charge["provider_reference"], charge["checkout_url"]
    else:
        notify(db, b.ride.driver_id, "cash_payment", "Cash payment declared",
               f"{user.name} says they paid PKR {pay.amount} in cash. Please confirm receipt.", {"booking_id": b.id})
    pay.status = PaymentStatus.PENDING
    db.commit()
    return PayResponse(payment=pay, checkout_url=checkout)


@router.post("/booking/{booking_id}/confirm-cash", response_model=PaymentRead)
def confirm_cash(booking_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    pay, b = _payment_for(db, booking_id, user)
    if b.ride.driver_id != user.id:
        raise HTTPException(403, "Only the driver can confirm cash receipt.")
    if pay.method != PaymentMethod.CASH or pay.status != PaymentStatus.PENDING:
        raise HTTPException(409, "No pending cash payment to confirm.")
    pay.status, pay.paid_at = PaymentStatus.SUCCESSFUL, utcnow()
    notify(db, b.passenger_id, "payment_verified", "Payment confirmed", f"PKR {pay.amount} received. Thank you!", {"booking_id": b.id})
    db.commit()
    return pay


@router.post("/webhook", response_model=MessageResponse, include_in_schema=True)
async def webhook(request: Request, x_signature: str | None = Header(None), db: Session = Depends(get_db)):
    """Called by the payment provider. Only a correctly signed call can mark a payment successful."""
    raw = await request.body()
    if not verify_signature(raw, x_signature):
        raise HTTPException(401, "Invalid signature.")
    try:
        data = PaymentWebhook(**json.loads(raw))
    except (ValueError, ValidationError):
        raise HTTPException(422, "Malformed webhook payload.")
    pay = db.scalar(select(Payment).where(Payment.provider_reference == data.provider_reference).with_for_update())
    if pay is None:
        raise HTTPException(404, "Unknown payment reference.")
    if pay.status == PaymentStatus.SUCCESSFUL:
        return MessageResponse(message="Already processed.")  # idempotent: no duplicate recording (FR-19)
    b = pay.booking
    if data.status == "succeeded" and data.amount == pay.amount:
        pay.status, pay.paid_at = PaymentStatus.SUCCESSFUL, utcnow()
        for uid, text in ((b.passenger_id, f"Your payment of PKR {pay.amount} was verified."),
                          (b.ride.driver_id, f"You received PKR {pay.amount} from {b.passenger.name}.")):
            notify(db, uid, "payment_verified", "Payment verified", text, {"booking_id": b.id})
    else:  # failed, or amount mismatch -> stays outstanding so the passenger can retry (FR-20)
        pay.status = PaymentStatus.OUTSTANDING
        notify(db, b.passenger_id, "payment_failed", "Payment failed",
               "We could not verify your payment. You can retry from the booking.", {"booking_id": b.id})
    db.commit()
    return MessageResponse(message="OK")
