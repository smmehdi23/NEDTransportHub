import os
import tempfile

# Must be set before the app is imported.
os.environ["ENV_FILE"] = ""  # ignore any real .env: tests must give the same result on every machine
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-test-secret-key-1234567890"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="nth_uploads_")
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["OTP_RESEND_COOLDOWN_SECONDS"] = "0"
os.environ["FIRST_ADMIN_EMAIL"] = ""
os.environ["REMINDERS_ENABLED"] = "false"
os.environ["PAYMENT_WEBHOOK_SECRET"] = "test-webhook-secret-123456"
os.environ["FIRST_ADMIN_PASSWORD"] = ""
# Pin settings the tests depend on, even if they are set as system environment variables.
os.environ["ALLOWED_EMAIL_DOMAINS"] = "cloud.neduet.edu.pk,neduet.edu.pk"
os.environ["GOOGLE_MAPS_API_KEY"] = ""     # straight-line routing: test points are on these straight lines
os.environ["MAPBOX_TOKEN"] = ""
os.environ["CAMPUS_GATES"] = ""            # night rule off unless a test switches it on
os.environ["CAMPUS_SECURITY_EMAIL"] = ""
os.environ["FCM_CREDENTIALS_FILE"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.database import Base, get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.core.ws_auth import get_session_factory  # noqa: E402
from app.services.email import get_email_sender  # noqa: E402

P = "/api/v1"
PASSWORD = "Str0ngPass1"

test_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


class FakeEmailSender:
    def __init__(self):
        self.sent: list[dict] = []

    def send_otp(self, to_email, name, code, purpose):
        self.sent.append({"to": to_email, "code": code, "purpose": purpose})

    def send_text(self, to_email, subject, body):
        self.sent.append({"to": to_email, "subject": subject, "body": body})

    def last_code(self, email):
        return [m for m in self.sent if m["to"] == email][-1]["code"]


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.drop_all(test_engine)
    Base.metadata.create_all(test_engine)
    yield


@pytest.fixture()
def sink():
    return FakeEmailSender()


@pytest.fixture()
def client(sink):
    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_email_sender] = lambda: sink
    app.dependency_overrides[get_session_factory] = lambda: TestingSession
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def db_session():
    db = TestingSession()
    yield db
    db.close()


@pytest.fixture()
def make_user(client, sink):
    """Register + verify + log in a user. Returns {"email", "tokens", "headers", "id"}."""

    def _make(email="ali@cloud.neduet.edu.pk", name="Ali Khan"):
        r = client.post(
            f"{P}/auth/register",
            json={"name": name, "email": email, "password": PASSWORD, "phone": "03001234567"},
        )
        assert r.status_code == 201, r.text
        r = client.post(f"{P}/auth/verify-email", json={"email": email, "otp": sink.last_code(email)})
        assert r.status_code == 200, r.text
        r = client.post(f"{P}/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        tokens = r.json()
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        me = client.get(f"{P}/users/me", headers=headers).json()
        return {"email": email, "tokens": tokens, "headers": headers, "id": me["id"]}

    return _make


@pytest.fixture()
def admin(client, db_session):
    email = "admin@neduet.edu.pk"
    db_session.add(
        User(
            name="Admin",
            email=email,
            password_hash=hash_password(PASSWORD),
            role=UserRole.ADMIN,
            is_email_verified=True,
        )
    )
    db_session.commit()
    tokens = client.post(f"{P}/auth/login", json={"email": email, "password": PASSWORD}).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = client.get(f"{P}/users/me", headers=headers).json()
    return {"email": email, "headers": headers, "id": me["id"]}


def vehicle_files():
    return {
        "licence_document": ("licence.pdf", b"%PDF-1.4 licence", "application/pdf"),
        "registration_document": ("reg.png", b"\x89PNG\r\n\x1a\n registration", "image/png"),
        "university_id_document": ("uni.jpg", b"\xff\xd8\xff\xe0 university id", "image/jpeg"),
    }


@pytest.fixture()
def submit_vehicle(client):
    def _submit(headers, plate="ABC-123", model="Honda Civic", seats=3):
        return client.post(
            f"{P}/drivers/vehicles",
            data={"plate_number": plate, "model": model, "seat_capacity": str(seats)},
            files=vehicle_files(),
            headers=headers,
        )

    return _submit