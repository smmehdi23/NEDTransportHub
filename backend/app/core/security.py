import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.time import utcnow

_dummy_hash: bytes | None = None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=settings.bcrypt_rounds)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def verify_dummy_password(password: str) -> None:
    """Burn comparable CPU time when the email is unknown (mitigates user enumeration by timing)."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = bcrypt.hashpw(b"dummy", bcrypt.gensalt(rounds=settings.bcrypt_rounds))
    bcrypt.checkpw(password.encode(), _dummy_hash)


def create_token(user_id: int, token_type: str, expires_in: timedelta, token_version: int) -> tuple[str, str, datetime]:
    now = utcnow()
    exp = now + expires_in
    jti = uuid.uuid4().hex
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "type": token_type,
        "tv": token_version,
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, jti, exp


def decode_token(token: str, expected_type: str) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "jti", "type"]},
        )
    except jwt.PyJWTError:
        raise unauthorized
    if payload.get("type") != expected_type:
        raise unauthorized
    return payload


def token_expiry(payload: dict) -> datetime:
    return datetime.fromtimestamp(payload["exp"], tz=timezone.utc)


def generate_otp() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def hash_otp(email: str, purpose: str, code: str) -> str:
    msg = f"{email}:{purpose}:{code}".encode()
    return hmac.new(settings.secret_key.encode(), msg, hashlib.sha256).hexdigest()
