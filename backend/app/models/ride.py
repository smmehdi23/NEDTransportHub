import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, str_enum
from app.core.time import utcnow


class RideStatus(str, enum.Enum):
    OPEN = "open"
    FULL = "full"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PollStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    CONVERTED = "converted"  # a driver turned it into a real ride


class Ride(Base):
    """A ride offered by a verified driver. `route` is a list of [lat, lng] points."""

    __tablename__ = "rides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id", ondelete="RESTRICT"))
    poll_id: Mapped[int | None] = mapped_column(ForeignKey("ride_polls.id", ondelete="SET NULL"), nullable=True)

    origin_name: Mapped[str] = mapped_column(String(100))
    destination_name: Mapped[str] = mapped_column(String(100))
    origin_lat: Mapped[float] = mapped_column(Float)
    origin_lng: Mapped[float] = mapped_column(Float)
    dest_lat: Mapped[float] = mapped_column(Float)
    dest_lng: Mapped[float] = mapped_column(Float)
    route: Mapped[list] = mapped_column(JSON, default=list)
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    duration_min: Mapped[float] = mapped_column(Float, default=0)

    departure_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    total_seats: Mapped[int] = mapped_column(Integer)
    available_seats: Mapped[int] = mapped_column(Integer)
    estimated_fare: Mapped[int] = mapped_column(Integer)  # PKR per seat
    status: Mapped[RideStatus] = mapped_column(str_enum(RideStatus), default=RideStatus.OPEN, index=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Latest driver GPS fix (history is not stored; live stream goes over WebSocket).
    last_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_location_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    driver = relationship("User", foreign_keys=[driver_id])
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])
    bookings = relationship("Booking", back_populates="ride")


class RidePoll(Base):
    """A rider-created request ('I need a ride X -> Y at T') that others can vote on."""

    __tablename__ = "ride_polls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    origin_name: Mapped[str] = mapped_column(String(100))
    destination_name: Mapped[str] = mapped_column(String(100))
    origin_lat: Mapped[float] = mapped_column(Float)
    origin_lng: Mapped[float] = mapped_column(Float)
    dest_lat: Mapped[float] = mapped_column(Float)
    dest_lng: Mapped[float] = mapped_column(Float)
    departure_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    seats_needed: Mapped[int] = mapped_column(Integer, default=1)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[PollStatus] = mapped_column(str_enum(PollStatus), default=PollStatus.OPEN, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    creator = relationship("User", foreign_keys=[creator_id])
    votes = relationship("PollVote", cascade="all, delete-orphan")


class PollVote(Base):
    __tablename__ = "poll_votes"
    __table_args__ = (UniqueConstraint("poll_id", "user_id", name="uq_poll_vote"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("ride_polls.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
