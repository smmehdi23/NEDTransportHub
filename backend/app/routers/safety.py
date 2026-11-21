import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_rider
from app.core.time import as_utc, utcnow
from app.models.booking import Booking, BookingStatus
from app.models.ride import Ride, RideStatus
from app.models.safety import IncidentReport, SOSAlert, TripShare, TrustedContact
from app.models.user import User, UserRole
from app.schemas.misc import ContactCreate, ContactRead, ReportCreate, ReportRead, ShareRead, SOSCreate, SOSRead
from app.schemas.common import MessageResponse
from app.services.notifications import notify
from app.services.rides import require_participant
from app.services.email import EmailDeliveryError, EmailSender, get_email_sender
from app.services.sms import SMSSender, get_sms_sender

log = logging.getLogger("nth.safety")

router = APIRouter(prefix="/safety", tags=["Safety"])
MAX_CONTACTS = 5


def _admin_ids(db: Session) -> list[int]:
    return list(db.scalars(select(User.id).where(User.role == UserRole.ADMIN, User.account_status == "active")))


def _share_link(db: Session, user: User, ride: Ride) -> TripShare:
    share = TripShare(token=secrets.token_urlsafe(32), user_id=user.id, ride_id=ride.id,
                      expires_at=utcnow() + timedelta(hours=settings.share_link_hours))
    db.add(share)
    return share


def _url(share: TripShare) -> str:
    return f"{settings.public_base_url}{settings.api_prefix}/safety/shared/{share.token}"


# ---------------- Trusted contacts ----------------
@router.get("/contacts", response_model=list[ContactRead])
def list_contacts(user: User = Depends(require_rider), db: Session = Depends(get_db)):
    return db.scalars(select(TrustedContact).where(TrustedContact.user_id == user.id).order_by(TrustedContact.id)).all()


@router.post("/contacts", response_model=ContactRead, status_code=201)
def add_contact(payload: ContactCreate, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    if db.scalar(select(func.count(TrustedContact.id)).where(TrustedContact.user_id == user.id)) >= MAX_CONTACTS:
        raise HTTPException(409, f"You can save at most {MAX_CONTACTS} trusted contacts.")
    c = TrustedContact(user_id=user.id, name=payload.name.strip(), phone=payload.phone)
    db.add(c)
    db.commit()
    return c


@router.delete("/contacts/{contact_id}", response_model=MessageResponse)
def delete_contact(contact_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    c = db.get(TrustedContact, contact_id)
    if c is None or c.user_id != user.id:
        raise HTTPException(404, "Contact not found.")
    db.delete(c)
    db.commit()
    return MessageResponse(message="Contact removed.")


# ---------------- Trip sharing ----------------
@router.post("/trips/{ride_id}/share", response_model=ShareRead)
def share_trip(ride_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db), sms: SMSSender = Depends(get_sms_sender)):
    """Send my trusted contacts a temporary read-only link to follow this ride."""
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    require_participant(db, user, ride)
    if ride.status not in (RideStatus.OPEN, RideStatus.FULL, RideStatus.IN_PROGRESS):
        raise HTTPException(409, "Only upcoming or active rides can be shared.")
    contacts = db.scalars(select(TrustedContact).where(TrustedContact.user_id == user.id)).all()
    if not contacts:
        raise HTTPException(409, "Add at least one trusted contact first.")
    share = _share_link(db, user, ride)
    for c in contacts:
        sms.send(c.phone, f"{user.name} shared a trip with you: {ride.origin_name} to {ride.destination_name}. Follow: {_url(share)}")
    db.commit()
    return ShareRead(url=_url(share), expires_at=share.expires_at, contacts_notified=len(contacts))


@router.get("/shared/{token}", tags=["Safety"])
def view_shared_trip(token: str, db: Session = Depends(get_db)):
    """PUBLIC (no login): what a trusted contact sees. Limited to safety-relevant info only."""
    share = db.get(TripShare, token)
    if share is None or as_utc(share.expires_at) < utcnow():
        raise HTTPException(404, "This link is invalid or has expired.")
    ride = db.get(Ride, share.ride_id)
    user = db.get(User, share.user_id)
    return {
        "shared_by": user.name, "status": ride.status.value,
        "from": ride.origin_name, "to": ride.destination_name, "departure_time": ride.departure_time,
        "driver_name": ride.driver.name, "vehicle_model": ride.vehicle.model, "vehicle_plate": ride.vehicle.plate_number,
        "last_location": None if ride.last_lat is None else {"lat": ride.last_lat, "lng": ride.last_lng, "at": ride.last_location_at},
        "expires_at": share.expires_at,
    }


# ---------------- SOS ----------------
def _email_security(mailer: EmailSender, subject: str, body: str) -> None:
    try:
        mailer.send_text(settings.campus_security_email, subject, body)
    except EmailDeliveryError as exc:
        log.error("SOS email to campus security failed: %s", exc)


@router.post("/sos", response_model=SOSRead, status_code=201)
def trigger_sos(payload: SOSCreate, background: BackgroundTasks, user: User = Depends(require_rider), db: Session = Depends(get_db),
                sms: SMSSender = Depends(get_sms_sender), mailer: EmailSender = Depends(get_email_sender)):
    """One-touch emergency (SRS SAF-02): alerts admins/campus security and the user's emergency contacts with live trip info."""
    ride = db.get(Ride, payload.ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    require_participant(db, user, ride)
    if ride.status != RideStatus.IN_PROGRESS:
        raise HTTPException(409, "SOS is available while a ride is in progress.")
    lat, lng = (payload.lat, payload.lng) if payload.lat is not None and payload.lng is not None else (ride.last_lat, ride.last_lng)
    alert = SOSAlert(user_id=user.id, ride_id=ride.id, lat=lat, lng=lng, message=payload.message)
    db.add(alert)
    share = _share_link(db, user, ride)
    db.flush()
    where = f"{lat:.5f},{lng:.5f}" if lat is not None else "location unknown"
    text = (f"SOS from {user.name} ({user.phone or 'no phone'}). Ride {ride.origin_name} to {ride.destination_name}, "
            f"vehicle {ride.vehicle.plate_number}, driver {ride.driver.name}. Last location: {where}. Live: {_url(share)}")
    for admin_id in _admin_ids(db):
        notify(db, admin_id, "sos", "🚨 SOS alert", text[:500], {"sos_id": alert.id, "ride_id": ride.id, "lat": lat, "lng": lng})
    for c in db.scalars(select(TrustedContact).where(TrustedContact.user_id == user.id)):
        sms.send(c.phone, text)
    if settings.campus_security_phone:
        sms.send(settings.campus_security_phone, text)
    if settings.campus_security_email:
        # after the response, so a slow/broken SMTP server never delays or fails the SOS itself
        background.add_task(_email_security, mailer, f"SOS: {user.name} needs help", text)
    # also tell the other people in the vehicle
    others = {ride.driver_id} | set(db.scalars(select(Booking.passenger_id).where(Booking.ride_id == ride.id, Booking.status == BookingStatus.CONFIRMED)))
    for uid in others - {user.id}:
        notify(db, uid, "sos_ride", "Emergency alert on your ride", f"{user.name} triggered an SOS. Campus security was notified.", {"ride_id": ride.id})
    db.commit()
    return alert


# ---------------- Incident reports ----------------
@router.post("/reports", response_model=ReportRead, status_code=201)
def create_report(payload: ReportCreate, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    ride = db.get(Ride, payload.ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    require_participant(db, user, ride)
    if payload.reported_user_id is not None and payload.reported_user_id == user.id:
        raise HTTPException(422, "You cannot report yourself.")
    rep = IncidentReport(ride_id=ride.id, reporter_id=user.id, reported_user_id=payload.reported_user_id, description=payload.description.strip())
    db.add(rep)
    db.flush()
    for admin_id in _admin_ids(db):
        notify(db, admin_id, "incident_report", "New incident report", f"Report #{rep.id} on ride #{ride.id}.", {"report_id": rep.id})
    db.commit()
    return rep


@router.get("/reports/mine", response_model=list[ReportRead])
def my_reports(user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """Reporters see only their own reports (details are otherwise restricted to admins, FR-25)."""
    return db.scalars(select(IncidentReport).where(IncidentReport.reporter_id == user.id).order_by(IncidentReport.id.desc())).all()
