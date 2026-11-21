from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.safety import ReportStatus, SOSStatus
from app.schemas.auth import normalize_phone


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    body: str
    data: dict
    is_read: bool
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[NotificationRead]
    total: int
    unread: int
    page: int
    page_size: int


class DeviceRegister(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    platform: Literal["android", "ios", "web"] = "android"


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty.")
        return v


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    sender_id: int
    content: str
    sent_at: datetime


class LocationUpdate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    speed_kmh: float | None = Field(None, ge=0, le=300)


class RatingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ride_id: int
    rated_user_id: int
    score: int = Field(ge=1, le=5)
    review: str | None = Field(None, max_length=300)


class RatingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ride_id: int
    rater_id: int
    rated_user_id: int
    score: int
    review: str | None
    created_at: datetime


class RatingSummary(BaseModel):
    user_id: int
    average: float | None
    count: int
    recent: list[RatingRead]


class ContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=50)
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)


class ContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str


class SOSCreate(BaseModel):
    ride_id: int
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    message: str | None = Field(None, max_length=255)


class SOSRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    ride_id: int
    lat: float | None
    lng: float | None
    message: str | None
    status: SOSStatus
    created_at: datetime
    resolved_at: datetime | None


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ride_id: int
    reported_user_id: int | None = None
    description: str = Field(min_length=10, max_length=500)


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ride_id: int
    reporter_id: int
    reported_user_id: int | None
    description: str
    status: ReportStatus
    admin_notes: str | None
    created_at: datetime
    updated_at: datetime


class ReportUpdate(BaseModel):
    status: ReportStatus
    admin_notes: str | None = Field(None, max_length=1000)


class ShareRead(BaseModel):
    url: str
    expires_at: datetime
    contacts_notified: int
