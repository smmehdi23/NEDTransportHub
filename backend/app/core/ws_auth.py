"""WebSocket helpers. Browsers/Flutter cannot set an Authorization header on a WebSocket
handshake reliably, so the access token is sent as ?token=<JWT>."""
from typing import Callable

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.models.auth import RevokedToken
from app.models.user import AccountStatus, User


def get_session_factory() -> Callable[[], Session]:
    """Dependency so tests can swap the DB. WebSocket handlers open one short session per message."""
    return SessionLocal


def user_from_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token, "access")
    except HTTPException:
        return None
    if db.get(RevokedToken, payload["jti"]) is not None:
        return None
    user = db.get(User, int(payload["sub"]))
    if user is None or payload.get("tv") != user.token_version or user.account_status != AccountStatus.ACTIVE:
        return None
    return user
