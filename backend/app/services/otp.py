import enum
import hmac
import logging
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_otp, hash_otp
from app.core.time import as_utc, utcnow
from app.models.auth import EmailOTP
from app.models.user import User
from app.services.email import EmailDeliveryError, EmailSender

logger = logging.getLogger(__name__)

INVALID_OTP = "Invalid or expired code."


class OTPPurpose(str, enum.Enum):
    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"


def send_otp_email(db: Session, user: User, purpose: OTPPurpose, sender: EmailSender) -> None:
    """Create an OTP, email it, and commit. Rolls back everything if delivery fails."""
    now = utcnow()
    last = db.scalar(
        select(EmailOTP)
        .where(EmailOTP.user_id == user.id, EmailOTP.purpose == purpose.value)
        .order_by(EmailOTP.id.desc())
        .limit(1)
    )
    if last and (now - as_utc(last.created_at)).total_seconds() < settings.otp_resend_cooldown_seconds:
        raise HTTPException(429, "Please wait a moment before requesting another code.")

    db.execute(
        update(EmailOTP)
        .where(EmailOTP.user_id == user.id, EmailOTP.purpose == purpose.value, EmailOTP.used_at.is_(None))
        .values(used_at=now)
    )
    code = generate_otp()
    db.add(
        EmailOTP(
            user_id=user.id,
            purpose=purpose.value,
            code_hash=hash_otp(user.email, purpose.value, code),
            expires_at=now + timedelta(minutes=settings.otp_expire_minutes),
        )
    )
    db.flush()
    try:
        sender.send_otp(user.email, user.name, code, purpose.value)
    except EmailDeliveryError:
        db.rollback()
        logger.exception("Failed to send OTP email to %s", user.email)
        raise HTTPException(503, "Could not send the email right now. Please try again later.")
    db.commit()


def verify_otp(db: Session, user: User, purpose: OTPPurpose, code: str) -> None:
    """Validate and consume an OTP. Caller commits on success."""
    now = utcnow()
    otp = db.scalar(
        select(EmailOTP)
        .where(EmailOTP.user_id == user.id, EmailOTP.purpose == purpose.value, EmailOTP.used_at.is_(None))
        .order_by(EmailOTP.id.desc())
        .limit(1)
    )
    if otp is None or as_utc(otp.expires_at) < now:
        raise HTTPException(400, INVALID_OTP)
    if otp.attempts >= settings.otp_max_attempts:
        raise HTTPException(429, "Too many incorrect attempts. Request a new code.")
    if not hmac.compare_digest(otp.code_hash, hash_otp(user.email, purpose.value, code)):
        otp.attempts += 1
        db.commit()
        raise HTTPException(400, INVALID_OTP)
    otp.used_at = now
