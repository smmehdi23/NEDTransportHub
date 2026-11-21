import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, str_enum
from app.core.time import utcnow


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"          # created, awaiting provider/driver confirmation
    SUCCESSFUL = "successful"    # verified
    OUTSTANDING = "outstanding"  # failed / unverified: passenger may retry
    REFUNDED = "refunded"


class RefundStatus(str, enum.Enum):
    NONE = "none"
    INITIATED = "initiated"
    COMPLETED = "completed"
    FAILED = "failed"


class PaymentMethod(str, enum.Enum):
    ONLINE = "online"
    CASH = "cash"


class Payment(Base):
    """One payment per booking. Raw card data is never stored (SRS FR-21)."""

    __tablename__ = "payments"

    transaction_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), unique=True)
    amount: Mapped[int] = mapped_column(Integer)  # PKR (the agreed fare)
    method: Mapped[PaymentMethod | None] = mapped_column(str_enum(PaymentMethod), nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(str_enum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    refund_status: Mapped[RefundStatus] = mapped_column(str_enum(RefundStatus), default=RefundStatus.NONE)
    provider_reference: Mapped[str | None] = mapped_column(String(80), nullable=True, unique=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    booking = relationship("Booking", back_populates="payment")
