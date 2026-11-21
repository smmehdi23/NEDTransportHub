import enum
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, str_enum
from app.core.time import utcnow


class ReportStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"


class SOSStatus(str, enum.Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(20))


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id", ondelete="CASCADE"), index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reported_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str] = mapped_column(String(500))
    status: Mapped[ReportStatus] = mapped_column(str_enum(ReportStatus), default=ReportStatus.SUBMITTED, index=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    handled_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SOSAlert(Base):
    __tablename__ = "sos_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id", ondelete="CASCADE"), index=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[SOSStatus] = mapped_column(str_enum(SOSStatus), default=SOSStatus.ACTIVE, index=True)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TripShare(Base):
    """Expiring, tokenised read-only link a rider sends to trusted contacts."""

    __tablename__ = "trip_shares"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
