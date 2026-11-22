from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import AccountStatus, UserRole
from app.schemas.auth import normalize_phone

NED_DEPARTMENTS = (
    "Computer Systems Engineering",
    "Software Engineering",
    "Computer Science & IT",
    "Computer Science",
    "Electrical Engineering",
    "Electronic Engineering",
    "Telecommunications Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Urban & Infrastructure Engineering",
    "Chemical Engineering",
    "Petroleum Engineering",
    "Polymer & Petrochemical Engineering",
    "Industrial & Manufacturing Engineering",
    "Automotive & Marine Engineering",
    "Biomedical Engineering",
    "Textile Engineering",
    "Metallurgical Engineering",
    "Materials Engineering",
    "Environmental Engineering",
    "Food Engineering",
    "Earthquake Engineering",
    "Architecture & Planning",
    "Economics & Management Sciences",
    "Mathematics",
    "Physics",
    "Chemistry",
    "English Linguistics & Allied Studies",
    "Faculty / Staff",
)
_NED_DEPT_MAP = {d.lower(): d for d in NED_DEPARTMENTS}


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

    @field_validator("department")
    @classmethod
    def _department(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        key = v.strip().lower()
        if key not in _NED_DEPT_MAP:
            raise ValueError("Please select a valid NED University department.")
        return _NED_DEPT_MAP[key]

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
