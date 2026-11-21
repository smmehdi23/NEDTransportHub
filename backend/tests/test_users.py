from tests.conftest import P


def test_get_profile(client, make_user):
    u = make_user()
    r = client.get(f"{P}/users/me", headers=u["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == u["email"]
    assert body["role"] == "rider"
    assert body["account_status"] == "active"
    assert "password_hash" not in body


def test_update_profile_and_preferences(client, make_user):
    u = make_user()
    r = client.patch(
        f"{P}/users/me",
        json={
            "name": "Ali K.",
            "phone": "+92 300 1234567",
            "department": "Computer Science",
            "ride_preferences": {"quiet_ride": True, "music_allowed": False},
        },
        headers=u["headers"],
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Ali K."
    assert body["phone"] == "+923001234567"
    assert body["ride_preferences"]["quiet_ride"] is True
    assert body["ride_preferences"]["music_allowed"] is False

    again = client.get(f"{P}/users/me", headers=u["headers"]).json()
    assert again["department"] == "Computer Science"
    assert again["ride_preferences"]["quiet_ride"] is True


def test_update_rejects_invalid_and_protected_fields(client, make_user):
    u = make_user()
    h = u["headers"]
    assert client.patch(f"{P}/users/me", json={"phone": "abc"}, headers=h).status_code == 422
    assert client.patch(f"{P}/users/me", json={"name": None}, headers=h).status_code == 422
    # role / status / email cannot be self-modified
    assert client.patch(f"{P}/users/me", json={"role": "admin"}, headers=h).status_code == 422
    assert client.patch(f"{P}/users/me", json={"email": "x@neduet.edu.pk"}, headers=h).status_code == 422
    assert client.patch(f"{P}/users/me", json={"ride_preferences": {"bogus": 1}}, headers=h).status_code == 422
