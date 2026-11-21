"""Admin APIs for Member 2's domain (rides, stats, reports, SOS, refunds). Member 1's user/driver admin lives in admin.py."""
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.time import as_utc, utcnow
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus, RefundStatus
from app.models.ride import Ride, RideStatus
from app.models.safety import IncidentReport, ReportStatus, SOSAlert, SOSStatus
from app.models.user import AccountStatus, User
from app.schemas.booking import BookingRead, PaymentRead, RefundUpdate
from app.schemas.common import MessageResponse
from app.schemas.misc import ReportRead, ReportUpdate, SOSRead
from app.schemas.ride import CancelRequest, RidePage
from app.routers.bookings import booking_to_read
from app.routers.rides import ride_to_read
from app.services.notifications import notify
from app.services.rides import cancel_ride

router = APIRouter(prefix="/admin", tags=["Admin - Operations"], dependencies=[Depends(require_admin)])


@router.get("/stats")
def stats(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    """Dashboard numbers: users, rides, bookings, payments and daily activity (FR-28)."""
    def by(col, model):
        return {getattr(k, "value", k): n for k, n in db.execute(select(col, func.count()).select_from(model).group_by(col))}

    since = utcnow() - timedelta(days=days)
    daily_rides = Counter(as_utc(d).date().isoformat() for d in db.scalars(select(Ride.created_at).where(Ride.created_at >= since)))
    daily_bookings = Counter(as_utc(d).date().isoformat() for d in db.scalars(select(Booking.created_at).where(Booking.created_at >= since)))
    paid = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == PaymentStatus.SUCCESSFUL))
    return {
        "users": {"total": db.scalar(select(func.count(User.id))), "by_status": by(User.account_status, User),
                  "verified_drivers": db.scalar(select(func.count(User.id)).where(User.is_driver_verified.is_(True)))},
        "rides": {"total": db.scalar(select(func.count(Ride.id))), "by_status": by(Ride.status, Ride)},
        "bookings": {"total": db.scalar(select(func.count(Booking.id))), "by_status": by(Booking.status, Booking)},
        "payments": {"by_status": by(Payment.status, Payment), "total_paid_pkr": paid},
        "safety": {"active_sos": db.scalar(select(func.count(SOSAlert.id)).where(SOSAlert.status == SOSStatus.ACTIVE)),
                   "open_reports": db.scalar(select(func.count(IncidentReport.id)).where(IncidentReport.status != ReportStatus.RESOLVED))},
        "activity": {"days": days, "rides_created": dict(sorted(daily_rides.items())), "bookings_made": dict(sorted(daily_bookings.items()))},
    }


@router.get("/rides", response_model=RidePage)
def list_rides(
    status: RideStatus | None = None, driver_id: int | None = None,
    date_from: datetime | None = None, date_to: datetime | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
):
    q = select(Ride)
    if status:
        q = q.where(Ride.status == status)
    if driver_id:
        q = q.where(Ride.driver_id == driver_id)
    if date_from:
        q = q.where(Ride.departure_time >= date_from)
    if date_to:
        q = q.where(Ride.departure_time <= date_to)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Ride.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return RidePage(items=[ride_to_read(db, r, None) for r in rows], total=total, page=page, page_size=page_size)


@router.get("/rides/{ride_id}/bookings", response_model=list[BookingRead])
def ride_bookings(ride_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.get(Ride, ride_id) is None:
        raise HTTPException(404, "Ride not found.")
    return [booking_to_read(b, admin) for b in db.scalars(select(Booking).where(Booking.ride_id == ride_id))]


@router.post("/rides/{ride_id}/cancel", response_model=MessageResponse)
def admin_cancel_ride(ride_id: int, payload: CancelRequest | None = None, db: Session = Depends(get_db)):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    if ride.status not in (RideStatus.OPEN, RideStatus.FULL, RideStatus.IN_PROGRESS):
        raise HTTPException(409, f"A {ride.status.value} ride cannot be cancelled.")
    n = cancel_ride(db, ride, (payload.reason if payload else None) or "Cancelled by administrator", "Ride cancelled by administrator")
    notify(db, ride.driver_id, "ride_cancelled", "Ride cancelled by administrator", f"Your ride #{ride.id} was cancelled.", {"ride_id": ride.id})
    db.commit()
    return MessageResponse(message=f"Ride cancelled. {n} passenger(s) notified.")


# ---- Incident reports ----
@router.get("/reports", response_model=list[ReportRead])
def list_reports(status: ReportStatus | None = None, db: Session = Depends(get_db)):
    q = select(IncidentReport)
    if status:
        q = q.where(IncidentReport.status == status)
    return db.scalars(q.order_by(IncidentReport.id.desc()).limit(200)).all()


@router.get("/reports/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: Session = Depends(get_db)):
    rep = db.get(IncidentReport, report_id)
    if rep is None:
        raise HTTPException(404, "Report not found.")
    return rep


@router.patch("/reports/{report_id}", response_model=ReportRead)
def update_report(report_id: int, payload: ReportUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rep = db.get(IncidentReport, report_id)
    if rep is None:
        raise HTTPException(404, "Report not found.")
    rep.status, rep.handled_by = payload.status, admin.id
    if payload.admin_notes is not None:
        rep.admin_notes = payload.admin_notes
    notify(db, rep.reporter_id, "report_update", "Your report was updated", f"Report #{rep.id} is now {rep.status.value.replace('_', ' ')}.", {"report_id": rep.id})
    db.commit()
    return rep


# ---- SOS ----
@router.get("/sos", response_model=list[SOSRead])
def list_sos(status: SOSStatus | None = SOSStatus.ACTIVE, db: Session = Depends(get_db)):
    q = select(SOSAlert)
    if status:
        q = q.where(SOSAlert.status == status)
    return db.scalars(q.order_by(SOSAlert.id.desc()).limit(200)).all()


@router.post("/sos/{sos_id}/resolve", response_model=SOSRead)
def resolve_sos(sos_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = db.get(SOSAlert, sos_id)
    if a is None:
        raise HTTPException(404, "SOS alert not found.")
    if a.status == SOSStatus.RESOLVED:
        raise HTTPException(409, "Already resolved.")
    a.status, a.resolved_by, a.resolved_at = SOSStatus.RESOLVED, admin.id, utcnow()
    notify(db, a.user_id, "sos_resolved", "SOS resolved", "Campus security marked your emergency as resolved.", {"sos_id": a.id})
    db.commit()
    return a


# ---- Refund tracking (FR-21) ----
@router.patch("/payments/{transaction_id}/refund", response_model=PaymentRead)
def update_refund(transaction_id: str, payload: RefundUpdate, db: Session = Depends(get_db)):
    pay = db.get(Payment, transaction_id)
    if pay is None:
        raise HTTPException(404, "Payment not found.")
    if pay.status not in (PaymentStatus.SUCCESSFUL, PaymentStatus.REFUNDED):
        raise HTTPException(409, "Only a successful payment can be refunded.")
    pay.refund_status = payload.refund_status
    if payload.refund_status == RefundStatus.COMPLETED:
        pay.status = PaymentStatus.REFUNDED
    notify(db, pay.booking.passenger_id, "refund_update", "Refund update", f"Your refund is now {payload.refund_status.value}.", {"booking_id": pay.booking_id})
    db.commit()
    return pay
