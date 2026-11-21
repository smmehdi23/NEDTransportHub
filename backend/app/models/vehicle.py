import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, str_enum
from app.core.time import utcnow
from app.models.user import User


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Vehicle(Base):
    """A vehicle plus the documents submitted for driver verification."""

    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plate_number: Mapped[str] = mapped_column(String(15), unique=True, index=True)
    model: Mapped[str] = mapped_column(String(50))
    seat_capacity: Mapped[int] = mapped_column(Integer)
    # Relative paths inside UPLOAD_DIR (never served directly).
    licence_document: Mapped[str] = mapped_column(String(255))
    registration_document: Mapped[str] = mapped_column(String(255))
    university_id_document: Mapped[str] = mapped_column(String(255))
    verification_status: Mapped[VerificationStatus] = mapped_column(
        str_enum(VerificationStatus), default=VerificationStatus.PENDING, index=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship(back_populates="vehicles", foreign_keys=[owner_id])
