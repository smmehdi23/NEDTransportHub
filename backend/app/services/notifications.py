"""In-app notifications (stored in DB) + FCM push. Push failures never break the request."""
import logging
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import DeviceToken, Notification

log = logging.getLogger("nth.notify")


@lru_cache
def _fcm():
    if not settings.fcm_credentials_file:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.Certificate(settings.fcm_credentials_file))
        return messaging
    except Exception as exc:  # missing package / bad credentials
        log.warning("FCM disabled: %s", exc)
        return None


def _push(tokens: list[str], title: str, body: str, data: dict) -> None:
    messaging = _fcm()
    if not tokens:
        return
    if messaging is None:
        log.info("[push-disabled] %s: %s", title, body)
        return
    try:
        msg = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in data.items()},
        )
        messaging.send_each_for_multicast(msg)
    except Exception as exc:
        log.warning("FCM send failed: %s", exc)


def notify(db: Session, user_id: int, type_: str, title: str, body: str, data: dict | None = None, commit: bool = False) -> Notification:
    """Create an in-app notification and push it to the user's devices.

    Adds to the caller's session so it commits atomically with the business change.
    """
    n = Notification(user_id=user_id, type=type_, title=title[:120], body=body[:500], data=data or {})
    db.add(n)
    if commit:
        db.commit()
    tokens = list(db.scalars(select(DeviceToken.token).where(DeviceToken.user_id == user_id)))
    _push(tokens, title, body, {"type": type_, **(data or {})})
    return n
