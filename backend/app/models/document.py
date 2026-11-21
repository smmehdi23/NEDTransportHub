from datetime import datetime

from sqlalchemy import DateTime, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utcnow


class StoredDocument(Base):
    """Persistent binary store for uploaded verification documents (serverless-safe on Vercel)."""

    __tablename__ = "stored_documents"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    media_type: Mapped[str] = mapped_column(String(64))
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
