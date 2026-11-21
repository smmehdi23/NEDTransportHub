from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.notification import DeviceToken, Notification
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.misc import DeviceRegister, NotificationPage, NotificationRead

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationPage)
def list_notifications(
    unread_only: bool = False, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    q = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        q = q.where(Notification.is_read.is_(False))
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    unread = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    items = db.scalars(q.order_by(Notification.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return NotificationPage(items=[NotificationRead.model_validate(n) for n in items], total=total, unread=unread, page=page, page_size=page_size)


@router.post("/read-all", response_model=MessageResponse)
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)).values(is_read=True))
    db.commit()
    return MessageResponse(message="All notifications marked as read.")


@router.post("/devices", response_model=MessageResponse, status_code=201)
def register_device(payload: DeviceRegister, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Register this phone's FCM token. If the token already belongs to someone else (shared phone), it moves to this user."""
    existing = db.scalar(select(DeviceToken).where(DeviceToken.token == payload.token))
    if existing:
        existing.user_id, existing.platform = user.id, payload.platform
    else:
        db.add(DeviceToken(user_id=user.id, token=payload.token, platform=payload.platform))
    db.commit()
    return MessageResponse(message="Device registered.")


@router.delete("/devices", response_model=MessageResponse)
def unregister_device(token: str = Query(min_length=20, max_length=512), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Call on logout so the phone stops receiving this user's pushes."""
    row = db.scalar(select(DeviceToken).where(DeviceToken.token == token, DeviceToken.user_id == user.id))
    if row:
        db.delete(row)
        db.commit()
    return MessageResponse(message="Device removed.")


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(404, "Notification not found.")
    n.is_read = True
    db.commit()
    return n
