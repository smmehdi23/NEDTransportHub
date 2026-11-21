from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.time import utcnow
from app.models.user import AccountStatus, User, UserRole
from app.models.vehicle import Vehicle, VerificationStatus
from app.schemas.user import AccountStatusUpdate, AdminUserRead, UserPage
from app.schemas.vehicle import RejectRequest, VehiclePage, VehicleRead, vehicle_to_read
from app.services.tokens import invalidate_all_sessions

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")
    return user


@router.get("/users", response_model=UserPage)
def list_users(
    role: UserRole | None = None,
    status: AccountStatus | None = None,
    is_driver_verified: bool | None = None,
    search: str | None = Query(None, max_length=100, description="Matches name or email"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(User.account_status == status)
    if is_driver_verified is not None:
        query = query.where(User.is_driver_verified == is_driver_verified)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(or_(User.name.ilike(like), User.email.ilike(like)))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return UserPage(
        items=[AdminUserRead.model_validate(u) for u in items], total=total, page=page, page_size=page_size
    )


@router.get("/users/{user_id}", response_model=AdminUserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return _get_user(db, user_id)


@router.patch("/users/{user_id}/status", response_model=AdminUserRead)
def update_user_status(
    user_id: int,
    payload: AccountStatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Activate, suspend or remove an account. Suspending/removing ends all of the user's sessions."""
    user = _get_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(400, "You cannot change your own account status.")
    if payload.status != AccountStatus.ACTIVE and not payload.reason:
        raise HTTPException(422, "A reason is required when suspending or removing an account.")

    user.account_status = payload.status
    user.status_reason = None if payload.status == AccountStatus.ACTIVE else payload.reason
    if payload.status != AccountStatus.ACTIVE:
        invalidate_all_sessions(db, user)
    db.commit()
    return user


def _get_vehicle(db: Session, vehicle_id: int) -> Vehicle:
    vehicle = db.scalar(select(Vehicle).options(joinedload(Vehicle.owner)).where(Vehicle.id == vehicle_id))
    if vehicle is None:
        raise HTTPException(404, "Verification request not found.")
    return vehicle


@router.get("/driver-verifications", response_model=VehiclePage)
def list_driver_verifications(
    status: VerificationStatus | None = VerificationStatus.PENDING,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Review queue (oldest first). Defaults to pending; pass status=verified|rejected for history."""
    query = select(Vehicle).options(joinedload(Vehicle.owner))
    if status:
        query = query.where(Vehicle.verification_status == status)
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = db.scalars(query.order_by(Vehicle.created_at, Vehicle.id).offset((page - 1) * page_size).limit(page_size)).all()
    return VehiclePage(items=[vehicle_to_read(v) for v in items], total=total, page=page, page_size=page_size)


@router.get("/driver-verifications/{vehicle_id}", response_model=VehicleRead)
def get_driver_verification(vehicle_id: int, db: Session = Depends(get_db)):
    return vehicle_to_read(_get_vehicle(db, vehicle_id))


@router.post("/driver-verifications/{vehicle_id}/approve", response_model=VehicleRead)
def approve_driver(vehicle_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    vehicle = _get_vehicle(db, vehicle_id)
    if vehicle.verification_status != VerificationStatus.PENDING:
        raise HTTPException(409, "Only pending requests can be approved.")
    owner = vehicle.owner
    if owner.account_status != AccountStatus.ACTIVE:
        raise HTTPException(409, "The vehicle owner's account is not active.")

    vehicle.verification_status = VerificationStatus.VERIFIED
    vehicle.rejection_reason = None
    vehicle.reviewed_by = admin.id
    vehicle.reviewed_at = utcnow()
    owner.is_driver_verified = True
    if owner.role == UserRole.RIDER:
        owner.role = UserRole.DRIVER
    db.commit()
    return vehicle_to_read(vehicle)


@router.post("/driver-verifications/{vehicle_id}/reject", response_model=VehicleRead)
def reject_driver(
    vehicle_id: int,
    payload: RejectRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    vehicle = _get_vehicle(db, vehicle_id)
    if vehicle.verification_status != VerificationStatus.PENDING:
        raise HTTPException(409, "Only pending requests can be rejected.")
    vehicle.verification_status = VerificationStatus.REJECTED
    vehicle.rejection_reason = payload.reason
    vehicle.reviewed_by = admin.id
    vehicle.reviewed_at = utcnow()
    db.commit()
    return vehicle_to_read(vehicle)
