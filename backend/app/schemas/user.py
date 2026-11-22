from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import AccountStatus, UserRole
from app.schemas.auth import normalize_phone

NED_DEPARTMENTS = (
    # Faculty of Civil & Petroleum Engineering (CPL)
    "Civil Engineering",
    "Urban & Infrastructure Engineering",
    "Petroleum Engineering",
    "Earthquake Engineering",
    "Environmental Engineering",
    # Faculty of Electrical & Computer Engineering (ECE)
    "Electrical Engineering",
    "Electronic Engineering",
    "Telecommunications Engineering",
    "Computer & Information Systems Engineering (CIS)",
    "Biomedical Engineering",
    "Computer Science & Information Technology (CSIT)",
    "Software Engineering",
    # Faculty of Mechanical & Manufacturing Engineering (MME)
    "Mechanical Engineering",
    "Industrial & Manufacturing Engineering",
    "Textile Engineering",
    "Automotive & Marine Engineering",
    # Faculty of Chemical & Process Engineering (CPE)
    "Chemical Engineering",
    "Polymer & Petrochemical Engineering",
    "Materials Engineering",
    "Metallurgical Engineering",
    "Food Engineering",
    # Faculty of Architecture & Sciences (ASC)
    "Architecture & Planning",
    "Economics & Management Sciences",
    "Physics",
    "Chemistry",
    "Mathematics",
    "English Linguistics & Allied Studies",
    "Essential Studies",
    # Institutes / Constituent Campuses
    "Panjwani-Hisaar Water Institute (PHWI)",
    "Thar Institute of Engineering, Sciences & Technology (TIEST)",
    # Faculty / Non-Departmental Staff (always last)
    "Faculty / Admin Staff",
)

_NED_DEPT_ALIASES = {
    "computer systems engineering": "Computer & Information Systems Engineering (CIS)",
    "computer and information systems engineering": "Computer & Information Systems Engineering (CIS)",
    "cis": "Computer & Information Systems Engineering (CIS)",
    "computer science & it": "Computer Science & Information Technology (CSIT)",
    "computer science": "Computer Science",
    "csit": "Computer Science & Information Technology (CSIT)",
    "automotive engineering": "Automotive & Marine Engineering",
    "faculty": "Faculty / Admin Staff",
    "faculty / staff": "Faculty / Admin Staff",
}
_NED_DEPT_MAP = {**{d.lower(): d for d in NED_DEPARTMENTS}, **_NED_DEPT_ALIASES}


def normalize_department(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    key = value.strip().lower()
    if key not in _NED_DEPT_MAP:
        raise ValueError("Please select a valid NED University department or Faculty / Admin Staff.")
    return _NED_DEPT_MAP[key]


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
        return normalize_department(v)

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
