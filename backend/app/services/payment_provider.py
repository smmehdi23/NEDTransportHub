"""Payment provider adapter. Implement `PaymentProvider` for a real gateway (JazzCash, Easypaisa, Stripe...).

The backend NEVER marks an online payment successful on the client's word: only a webhook whose
HMAC signature verifies (see routers/payments.py) can do that (SRS FR-18).
"""
import hashlib
import hmac
import uuid
from typing import Protocol

from app.core.config import settings


class PaymentProvider(Protocol):
    def create_charge(self, amount: int, booking_id: int) -> dict: ...


class MockProvider:
    def create_charge(self, amount: int, booking_id: int) -> dict:
        ref = f"MOCK-{uuid.uuid4().hex[:20]}"
        return {"provider_reference": ref, "checkout_url": f"{settings.public_base_url}/mock-checkout/{ref}"}


def get_payment_provider() -> PaymentProvider:
    return MockProvider()


def sign_payload(body: bytes) -> str:
    return hmac.new(settings.payment_webhook_secret.encode(), body, hashlib.sha256).hexdigest()


def verify_signature(body: bytes, signature: str | None) -> bool:
    if not settings.payment_webhook_secret or not signature:
        return False
    return hmac.compare_digest(sign_payload(body), signature)
