from tests.conftest import P, PASSWORD

EMAIL = "ali@cloud.neduet.edu.pk"


def _register(client, email=EMAIL, password=PASSWORD):
    return client.post(
        f"{P}/auth/register", json={"name": "Ali Khan", "email": email, "password": password}
    )


def test_register_rejects_non_ned_email(client):
    assert _register(client, email="ali@gmail.com").status_code == 422


def test_register_rejects_weak_password(client):
    assert _register(client, password="weakpass").status_code == 422


def test_register_verify_login_flow(client, sink):
    assert _register(client).status_code == 201
    assert len(sink.sent) == 1 and sink.sent[0]["purpose"] == "verify_email"

    # Cannot log in before verification
    r = client.post(f"{P}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 403

    r = client.post(f"{P}/auth/verify-email", json={"email": EMAIL, "otp": sink.last_code(EMAIL)})
    assert r.status_code == 200
    r = client.post(f"{P}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200
    assert {"access_token", "refresh_token"} <= set(r.json())


def test_duplicate_verified_email_rejected(client, make_user):
    make_user(EMAIL)
    assert _register(client).status_code == 409


def test_wrong_credentials(client, make_user):
    make_user(EMAIL)
    assert client.post(f"{P}/auth/login", json={"email": EMAIL, "password": "Wrong1234"}).status_code == 401
    assert client.post(f"{P}/auth/login", json={"email": "no@neduet.edu.pk", "password": PASSWORD}).status_code == 401


def test_otp_lockout_after_max_attempts(client, sink):
    _register(client)
    good = sink.last_code(EMAIL)
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        assert client.post(f"{P}/auth/verify-email", json={"email": EMAIL, "otp": bad}).status_code == 400
    r = client.post(f"{P}/auth/verify-email", json={"email": EMAIL, "otp": good})
    assert r.status_code == 429


def test_resend_cooldown(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 60)
    assert _register(client).status_code == 201
    r = client.post(f"{P}/auth/resend-verification", json={"email": EMAIL})
    assert r.status_code == 429


def test_refresh_rotation_and_reuse_detection(client, make_user):
    old = make_user(EMAIL)["tokens"]["refresh_token"]
    r = client.post(f"{P}/auth/refresh", json={"refresh_token": old})
    assert r.status_code == 200
    new = r.json()["refresh_token"]

    # Replaying the rotated token is rejected and kills the whole session family
    assert client.post(f"{P}/auth/refresh", json={"refresh_token": old}).status_code == 401
    assert client.post(f"{P}/auth/refresh", json={"refresh_token": new}).status_code == 401


def test_access_token_cannot_be_used_as_refresh(client, make_user):
    access = make_user(EMAIL)["tokens"]["access_token"]
    assert client.post(f"{P}/auth/refresh", json={"refresh_token": access}).status_code == 401


def test_logout_revokes_tokens(client, make_user):
    u = make_user(EMAIL)
    r = client.post(
        f"{P}/auth/logout", json={"refresh_token": u["tokens"]["refresh_token"]}, headers=u["headers"]
    )
    assert r.status_code == 200
    assert client.get(f"{P}/users/me", headers=u["headers"]).status_code == 401
    assert client.post(f"{P}/auth/refresh", json={"refresh_token": u["tokens"]["refresh_token"]}).status_code == 401


def test_password_reset_flow(client, make_user, sink):
    u = make_user(EMAIL)
    assert client.post(f"{P}/auth/forgot-password", json={"email": EMAIL}).status_code == 200
    code = sink.last_code(EMAIL)
    assert sink.sent[-1]["purpose"] == "reset_password"

    new_pw = "NewPassw0rd"
    r = client.post(
        f"{P}/auth/reset-password", json={"email": EMAIL, "otp": code, "new_password": new_pw}
    )
    assert r.status_code == 200
    assert client.post(f"{P}/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    assert client.post(f"{P}/auth/login", json={"email": EMAIL, "password": new_pw}).status_code == 200
    # Sessions from before the reset are dead
    assert client.get(f"{P}/users/me", headers=u["headers"]).status_code == 401
    # OTP is single-use
    r = client.post(
        f"{P}/auth/reset-password", json={"email": EMAIL, "otp": code, "new_password": new_pw}
    )
    assert r.status_code == 400


def test_forgot_password_unknown_email_is_generic(client, sink):
    r = client.post(f"{P}/auth/forgot-password", json={"email": "ghost@neduet.edu.pk"})
    assert r.status_code == 200
    assert sink.sent == []


def test_protected_route_requires_token(client):
    assert client.get(f"{P}/users/me").status_code == 401
    assert client.get(f"{P}/users/me", headers={"Authorization": "Bearer junk"}).status_code == 401
