from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_rider
from app.core.time import utcnow  # noqa: F401
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle, VerificationStatus
from app.schemas.vehicle import (
    DOCUMENT_FIELDS,
    DriverVerificationStatus,
    VehicleRead,
    normalize_model,
    normalize_plate,
    vehicle_to_read,
)
from app.services.storage import delete_document, read_document_bytes, save_document

router = APIRouter(prefix="/drivers", tags=["Driver & Vehicle Verification"])

_DOC_KEYS = ("licence", "registration", "university_id")


def _owned_vehicle(db: Session, user: User, vehicle_id: int) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None or vehicle.owner_id != user.id:
        raise HTTPException(404, "Vehicle not found.")
    return vehicle


@router.post("/vehicles", response_model=VehicleRead, status_code=201)
def submit_vehicle(
    plate_number: str = Form(...),
    model: str = Form(...),
    seat_capacity: int = Form(..., ge=1, le=8),
    licence_document: UploadFile = File(...),
    registration_document: UploadFile = File(...),
    university_id_document: UploadFile = File(...),
    user: User = Depends(require_rider),
    db: Session = Depends(get_db),
):
    """Submit a vehicle with licence, vehicle registration and university ID documents for admin review."""
    plate = normalize_plate(plate_number)
    model = normalize_model(model)
    if db.scalar(select(Vehicle.id).where(Vehicle.plate_number == plate)):
        raise HTTPException(409, "A vehicle with this plate number is already registered.")

    saved: list[str] = []
    try:
        for key, upload in zip(_DOC_KEYS, (licence_document, registration_document, university_id_document)):
            saved.append(save_document(upload, user.id, key, db=db))
        vehicle = Vehicle(
            owner_id=user.id,
            plate_number=plate,
            model=model,
            seat_capacity=seat_capacity,
            licence_document=saved[0],
            registration_document=saved[1],
            university_id_document=saved[2],
        )
        db.add(vehicle)
        db.commit()
    except IntegrityError:
        db.rollback()
        for p in saved:
            delete_document(p)
        raise HTTPException(409, "A vehicle with this plate number is already registered.")
    except Exception:
        db.rollback()
        for p in saved:
            delete_document(p)
        raise
    return vehicle_to_read(vehicle)


@router.get("/vehicles", response_model=list[VehicleRead])
def my_vehicles(user: User = Depends(require_rider), db: Session = Depends(get_db)):
    vehicles = db.scalars(select(Vehicle).where(Vehicle.owner_id == user.id).order_by(Vehicle.id)).all()
    return [vehicle_to_read(v) for v in vehicles]


@router.get("/vehicles/{vehicle_id}", response_model=VehicleRead)
def my_vehicle(vehicle_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    return vehicle_to_read(_owned_vehicle(db, user, vehicle_id))


@router.put("/vehicles/{vehicle_id}", response_model=VehicleRead)
def resubmit_vehicle(
    vehicle_id: int,
    plate_number: str | None = Form(None),
    model: str | None = Form(None),
    seat_capacity: int | None = Form(None, ge=1, le=8),
    licence_document: UploadFile | None = File(None),
    registration_document: UploadFile | None = File(None),
    university_id_document: UploadFile | None = File(None),
    user: User = Depends(require_rider),
    db: Session = Depends(get_db),
):
    """Correct and resubmit a pending or rejected vehicle. Sends it back to 'pending'."""
    vehicle = _owned_vehicle(db, user, vehicle_id)
    if vehicle.verification_status == VerificationStatus.VERIFIED:
        raise HTTPException(409, "A verified vehicle cannot be edited. Contact an administrator.")

    uploads = dict(zip(_DOC_KEYS, (licence_document, registration_document, university_id_document)))
    uploads = {k: u for k, u in uploads.items() if u is not None and u.filename}
    if plate_number is None and model is None and seat_capacity is None and not uploads:
        raise HTTPException(422, "Provide at least one field or document to update.")

    if plate_number is not None:
        plate = normalize_plate(plate_number)
        clash = db.scalar(select(Vehicle.id).where(Vehicle.plate_number == plate, Vehicle.id != vehicle.id))
        if clash:
            raise HTTPException(409, "A vehicle with this plate number is already registered.")
        vehicle.plate_number = plate
    if model is not None:
        vehicle.model = normalize_model(model)
    if seat_capacity is not None:
        vehicle.seat_capacity = seat_capacity

    new_paths: list[str] = []
    old_paths: list[str] = []
    try:
        for key, upload in uploads.items():
            path = save_document(upload, user.id, key, db=db)
            new_paths.append(path)
            attr = DOCUMENT_FIELDS[key]
            old_paths.append(getattr(vehicle, attr))
            setattr(vehicle, attr, path)
        vehicle.verification_status = VerificationStatus.PENDING
        vehicle.rejection_reason = None
        vehicle.reviewed_by = None
        vehicle.reviewed_at = None
        db.commit()
    except IntegrityError:
        db.rollback()
        for p in new_paths:
            delete_document(p)
        raise HTTPException(409, "A vehicle with this plate number is already registered.")
    except Exception:
        db.rollback()
        for p in new_paths:
            delete_document(p)
        raise
    for p in old_paths:
        delete_document(p, db=db)
    if old_paths:
        db.commit()
    return vehicle_to_read(vehicle)


@router.get("/verification-status", response_model=DriverVerificationStatus)
def verification_status(user: User = Depends(require_rider), db: Session = Depends(get_db)):
    vehicles = db.scalars(select(Vehicle).where(Vehicle.owner_id == user.id).order_by(Vehicle.id)).all()
    return DriverVerificationStatus(
        role=user.role,
        is_driver_verified=user.is_driver_verified,
        vehicles=[vehicle_to_read(v) for v in vehicles],
    )


@router.get("/vehicles/{vehicle_id}/documents/{doc_type}")
def download_document(
    vehicle_id: int,
    doc_type: Literal["licence", "registration", "university_id"],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner or admin only. Documents are never publicly served."""
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None or (vehicle.owner_id != user.id and user.role != UserRole.ADMIN):
        raise HTTPException(404, "Document not found.")
    data, media_type = read_document_bytes(getattr(vehicle, DOCUMENT_FIELDS[doc_type]), db=db)
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, no-store"})
