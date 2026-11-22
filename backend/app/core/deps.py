"""Authentication and authorization dependencies. Backend Member 2 should reuse these:

    Depends(get_current_user)   any authenticated, active user
    Depends(require_rider)      rider or driver (not admin)
    Depends(require_driver)     verified driver
    Depends(require_admin)      admin
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.auth import RevokedToken
from app.models.user import AccountStatus, User, UserRole

bearer = HTTPBearer(auto_error=False)


def get_token_payload(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if creds is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Not authenticated.", headers={"WWW-Authenticate": "Bearer"}
        )
    return decode_token(creds.credentials, "access")


def get_current_user(payload: dict = Depends(get_token_payload), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Invalid or expired token.", headers={"WWW-Authenticate": "Bearer"}
    )
    if db.get(RevokedToken, payload["jti"]) is not None:
        raise unauthorized
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise unauthorized
    if user.account_status != AccountStatus.ACTIVE:
        if payload.get("tv") != user.token_version:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                f"Account is {user.account_status.value}.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Account is {user.account_status.value}.")
    if payload.get("tv") != user.token_version:
        raise unauthorized
    return user


def require_roles(*roles: UserRole):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to perform this action.")
        return user

    return checker


require_admin = require_roles(UserRole.ADMIN)
require_rider = require_roles(UserRole.RIDER, UserRole.DRIVER)


def require_driver(user: User = Depends(require_roles(UserRole.DRIVER))) -> User:
    if not user.is_driver_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Driver verification is required.")
    return user
