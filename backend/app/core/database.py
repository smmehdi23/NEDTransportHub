import enum
from typing import Iterator

from sqlalchemy import Enum as SAEnum
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

_engine_kwargs: dict = {"pool_pre_ping": True}
if not settings.database_url.startswith("sqlite"):
    # Neon (serverless Postgres) suspends idle compute and closes idle connections:
    # recycle early and keep pools small so we stay inside Neon's connection limits.
    _engine_kwargs.update(pool_recycle=300, pool_size=5, max_overflow=5)
engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Shared declarative base. Backend Member 2 models should inherit from this."""


def str_enum(enum_cls: type[enum.Enum], length: int = 20) -> SAEnum:
    """Store enums as plain VARCHAR (no native PG enum) so values are easy to extend."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
