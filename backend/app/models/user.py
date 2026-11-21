import enum
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, str_enum
from app.core.time import utcnow


class UserRole(str, enum.Enum):
    RIDER = "rider"
    DRIVER = "driver"  # verified driver; can also ride
    ADMIN = "admin"


class AccountStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REMOVED = "removed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[UserRole] = mapped_column(str_enum(UserRole), default=UserRole.RIDER, index=True)
    account_status: Mapped[AccountStatus] = mapped_column(
        str_enum(AccountStatus), default=AccountStatus.ACTIVE, index=True
    )
    status_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_driver_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    ride_preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    # Incremented to invalidate every issued JWT (password reset, suspension, token reuse).
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    vehicles: Mapped[list["Vehicle"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan", foreign_keys="Vehicle.owner_id"
    )
