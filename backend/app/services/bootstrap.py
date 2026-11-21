import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.auth import validate_password_strength

logger = logging.getLogger(__name__)


def bootstrap_admin(db: Session) -> None:
    """Create the first admin from FIRST_ADMIN_* env vars if it does not exist."""
    email = settings.first_admin_email.strip().lower()
    if not email or not settings.first_admin_password:
        return
    if db.scalar(select(User.id).where(User.email == email)):
        return
    validate_password_strength(settings.first_admin_password)
    db.add(
        User(
            name=settings.first_admin_name,
            email=email,
            password_hash=hash_password(settings.first_admin_password),
            role=UserRole.ADMIN,
            is_email_verified=True,
        )
    )
    db.commit()
    logger.info("Created first admin account %s", email)
