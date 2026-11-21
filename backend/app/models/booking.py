import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, str_enum
from app.core.time import utcnow


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class FareStatus(str, enum.Enum):
    NONE = "none"          # driver has not proposed a fare yet
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class Booking(Base):
    """One seat on one ride. Flow: pending -> (driver proposes fare) -> (passenger accepts) -> confirmed."""

    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("ride_id", "passenger_id", name="uq_booking_ride_passenger"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id", ondelete="CASCADE"), index=True)
    passenger_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    pickup_name: Mapped[str] = mapped_column(String(100))
    pickup_lat: Mapped[float] = mapped_column(Float)
    pickup_lng: Mapped[float] = mapped_column(Float)
    dropoff_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dropoff_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    dropoff_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[BookingStatus] = mapped_column(str_enum(BookingStatus), default=BookingStatus.PENDING, index=True)
    proposed_fare: Mapped[int | None] = mapped_column(Integer, nullable=True)  # PKR
    fare_status: Mapped[FareStatus] = mapped_column(str_enum(FareStatus), default=FareStatus.NONE)
    cancelled_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    ride = relationship("Ride", back_populates="bookings")
    passenger = relationship("User", foreign_keys=[passenger_id])
    payment = relationship("Payment", back_populates="booking", uselist=False)
