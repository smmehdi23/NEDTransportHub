import re
from datetime import datetime

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.models.user import UserRole
from app.models.vehicle import Vehicle, VerificationStatus
from app.schemas.user import UserBrief

DOCUMENT_FIELDS = {
    "licence": "licence_document",
    "registration": "registration_document",
    "university_id": "university_id_document",
}


class DocumentLinks(BaseModel):
    licence: str
    registration: str
    university_id: str


class VehicleRead(BaseModel):
    id: int
    plate_number: str
    model: str
    seat_capacity: int
    verification_status: VerificationStatus
    rejection_reason: str | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    owner: UserBrief
    documents: DocumentLinks


class VehiclePage(BaseModel):
    items: list[VehicleRead]
    total: int
    page: int
    page_size: int


class DriverVerificationStatus(BaseModel):
    role: UserRole
    is_driver_verified: bool
    vehicles: list[VehicleRead]


class RejectRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Reason must be at least 5 characters.")
        return v


def normalize_plate(raw: str) -> str:
    plate = re.sub(r"\s+", "", raw).upper()
    if not re.fullmatch(r"[A-Z0-9-]{3,15}", plate):
        raise HTTPException(422, "Plate number must be 3-15 letters, digits or hyphens.")
    return plate


def normalize_model(raw: str) -> str:
    model = raw.strip()
    if not 2 <= len(model) <= 50:
        raise HTTPException(422, "Vehicle model must be 2-50 characters.")
    return model


def vehicle_to_read(v: Vehicle) -> VehicleRead:
    base = f"{settings.api_prefix}/drivers/vehicles/{v.id}/documents"
    return VehicleRead(
        id=v.id,
        plate_number=v.plate_number,
        model=v.model,
        seat_capacity=v.seat_capacity,
        verification_status=v.verification_status,
        rejection_reason=v.rejection_reason,
        reviewed_at=v.reviewed_at,
        created_at=v.created_at,
        updated_at=v.updated_at,
        owner=UserBrief.model_validate(v.owner),
        documents=DocumentLinks(
            licence=f"{base}/licence",
            registration=f"{base}/registration",
            university_id=f"{base}/university_id",
        ),
    )
