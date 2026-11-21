from datetime import timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_token
from app.models.auth import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenResponse


def issue_token_pair(db: Session, user: User) -> TokenResponse:
    """Create access + refresh tokens. Caller commits."""
    access, _, _ = create_token(
        user.id, "access", timedelta(minutes=settings.access_token_expire_minutes), user.token_version
    )
    refresh, jti, exp = create_token(
        user.id, "refresh", timedelta(days=settings.refresh_token_expire_days), user.token_version
    )
    db.add(RefreshToken(jti=jti, user_id=user.id, expires_at=exp))
    return TokenResponse(
        access_token=access, refresh_token=refresh, expires_in=settings.access_token_expire_minutes * 60
    )


def revoke_all_refresh_tokens(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False)).values(revoked=True)
    )


def invalidate_all_sessions(db: Session, user: User) -> None:
    """Invalidate every access and refresh token of the user. Caller commits."""
    user.token_version += 1
    revoke_all_refresh_tokens(db, user.id)
