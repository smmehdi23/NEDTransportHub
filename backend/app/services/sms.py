import logging
from typing import Protocol

from app.core.config import settings

log = logging.getLogger("nth.sms")


class SMSSender(Protocol):
    def send(self, phone: str, text: str) -> None: ...


class ConsoleSMSSender:
    """Development sender: logs instead of sending. Swap in Twilio/Jazz/Telenor gateway in production."""

    def send(self, phone: str, text: str) -> None:
        log.warning("SMS to %s: %s", phone, text)


def get_sms_sender() -> SMSSender:
    return ConsoleSMSSender()
