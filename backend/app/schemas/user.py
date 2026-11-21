from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import AccountStatus, UserRole
from app.schemas.auth import normalize_phone


class RidePreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quiet_ride: bool = False
    music_allowed: bool = True
    smoking_allowed: bool = False
    luggage_space_needed: bool = False


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None
    department: str | None
    role: UserRole
    account_status: AccountStatus
    is_email_verified: bool
    is_driver_verified: bool
    ride_preferences: RidePreferences
    created_at: datetime


class AdminUserRead(UserRead):
    status_reason: str | None
    updated_at: datetime


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(None, min_length=2, max_length=100)
    phone: str | None = None
    department: str | None = Field(None, max_length=100)
    ride_preferences: RidePreferences | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str:
        if v is None or len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v else None

    @field_validator("ride_preferences")
    @classmethod
    def _prefs(cls, v):
        if v is None:
            raise ValueError("ride_preferences cannot be null.")
        return v


class AccountStatusUpdate(BaseModel):
    status: AccountStatus
    reason: str | None = Field(None, max_length=255)

    @field_validator("reason")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v else None


class UserPage(BaseModel):
    items: list[AdminUserRead]
    total: int
    page: int
    page_size: int
