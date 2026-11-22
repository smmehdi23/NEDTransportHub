import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_token_payload
from app.core.security import (
    decode_token,
    hash_password,
    token_expiry,
    verify_dummy_password,
    verify_password,
)
from app.core.time import utcnow
from app.models.auth import RefreshToken, RevokedToken
from app.models.user import AccountStatus, User
from app.schemas.auth import (
    EmailRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.common import MessageResponse
from app.services.email import EmailSender, get_email_sender
from app.services.otp import INVALID_OTP, OTPPurpose, send_otp_email, verify_otp
from app.services.tokens import invalidate_all_sessions, issue_token_pair

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


@router.post("/register", response_model=MessageResponse, status_code=201)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    sender: EmailSender = Depends(get_email_sender),
):
    user = _user_by_email(db, payload.email)
    if user and user.is_email_verified:
        raise HTTPException(409, "An account with this email already exists.")
    if user:  # unverified earlier attempt: refresh details
        user.name, user.phone, user.department = payload.name, payload.phone, payload.department
        user.password_hash = hash_password(payload.password)
    else:
        user = User(
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
            department=payload.department,
            password_hash=hash_password(payload.password),
        )
        db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.")
    send_otp_email(db, user, OTPPurpose.VERIFY_EMAIL, sender)
    return MessageResponse(message="Registration successful. A verification code was sent to your email.")


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = _user_by_email(db, payload.email)
    if user is None:
        raise HTTPException(400, INVALID_OTP)
    if user.is_email_verified:
        return MessageResponse(message="Email is already verified.")
    verify_otp(db, user, OTPPurpose.VERIFY_EMAIL, payload.otp)
    user.is_email_verified = True
    db.commit()
    return MessageResponse(message="Email verified. You can now log in.")


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    payload: EmailRequest, db: Session = Depends(get_db), sender: EmailSender = Depends(get_email_sender)
):
    user = _user_by_email(db, payload.email)
    if user and not user.is_email_verified:
        send_otp_email(db, user, OTPPurpose.VERIFY_EMAIL, sender)
    return MessageResponse(message="If the account exists and is unverified, a new code has been sent.")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = _user_by_email(db, payload.email)
    if user is None:
        verify_dummy_password(payload.password)
        raise HTTPException(401, "Invalid email or password.")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")
    if not user.is_email_verified:
        raise HTTPException(403, "Email not verified. Please verify your email first.")
    if user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(403, f"Account is {user.account_status.value}.")
    tokens = issue_token_pair(db, user)
    db.commit()
    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    claims = decode_token(payload.refresh_token, "refresh")
    row = db.get(RefreshToken, claims["jti"])
    user = db.get(User, int(claims["sub"]))
    if row is None or user is None:
        raise HTTPException(401, "Invalid or expired token.")
    if row.revoked:
        # A rotated/revoked token was replayed: assume theft and end every session.
        invalidate_all_sessions(db, user)
        db.commit()
        raise HTTPException(401, "Invalid or expired token.")
    if claims.get("tv") != user.token_version:
        raise HTTPException(401, "Invalid or expired token.")
    if user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(403, f"Account is {user.account_status.value}.")
    row.revoked = True  # rotation
    tokens = issue_token_pair(db, user)
    db.commit()
    return tokens


@router.post("/logout", response_model=MessageResponse)
def logout(
    body: LogoutRequest | None = None,
    payload: dict = Depends(get_token_payload),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(delete(RevokedToken).where(RevokedToken.expires_at < utcnow()))
    db.add(RevokedToken(jti=payload["jti"], expires_at=token_expiry(payload)))
    if body and body.refresh_token:
        try:
            claims = decode_token(body.refresh_token, "refresh")
        except HTTPException:
            claims = None
        if claims:
            row = db.get(RefreshToken, claims["jti"])
            if row and row.user_id == user.id:
                row.revoked = True
    db.commit()
    return MessageResponse(message="Logged out.")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: EmailRequest, db: Session = Depends(get_db), sender: EmailSender = Depends(get_email_sender)
):
    generic = MessageResponse(message="If the account exists, a password reset code has been sent.")
    user = _user_by_email(db, payload.email)
    if user is None or not user.is_email_verified or user.account_status == AccountStatus.REMOVED:
        return generic
    try:
        send_otp_email(db, user, OTPPurpose.RESET_PASSWORD, sender)
    except HTTPException as exc:  # swallow cooldown/SMTP errors so responses never reveal account existence
        logger.warning("Password reset OTP not sent for %s: %s", user.email, exc.detail)
    return generic


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = _user_by_email(db, payload.email)
    if user is None or user.account_status == AccountStatus.REMOVED:
        raise HTTPException(400, INVALID_OTP)
    verify_otp(db, user, OTPPurpose.RESET_PASSWORD, payload.otp)
    user.password_hash = hash_password(payload.new_password)
    invalidate_all_sessions(db, user)
    db.commit()
    return MessageResponse(message="Password updated. Please log in with your new password.")
