from tests.conftest import P, PASSWORD


def test_admin_endpoints_forbidden_for_non_admins(client, make_user):
    u = make_user()
    assert client.get(f"{P}/admin/users", headers=u["headers"]).status_code == 403
    assert client.get(f"{P}/admin/driver-verifications", headers=u["headers"]).status_code == 403
    assert client.get(f"{P}/admin/users").status_code == 401


def test_list_filter_and_get_users(client, make_user, admin):
    make_user("ali@cloud.neduet.edu.pk", "Ali Khan")
    make_user("sara@cloud.neduet.edu.pk", "Sara Ahmed")
    h = admin["headers"]

    assert client.get(f"{P}/admin/users", headers=h).json()["total"] == 3
    r = client.get(f"{P}/admin/users", params={"search": "sara"}, headers=h).json()
    assert r["total"] == 1 and r["items"][0]["email"] == "sara@cloud.neduet.edu.pk"
    assert client.get(f"{P}/admin/users", params={"role": "admin"}, headers=h).json()["total"] == 1
    assert client.get(f"{P}/admin/users", params={"page_size": 1}, headers=h).json()["items"].__len__() == 1

    uid = r["items"][0]["id"]
    assert client.get(f"{P}/admin/users/{uid}", headers=h).json()["name"] == "Sara Ahmed"
    assert client.get(f"{P}/admin/users/9999", headers=h).status_code == 404


def test_suspend_and_reactivate(client, make_user, admin):
    u = make_user()
    h = admin["headers"]
    url = f"{P}/admin/users/{u['id']}/status"

    assert client.patch(url, json={"status": "suspended"}, headers=h).status_code == 422  # reason required
    r = client.patch(url, json={"status": "suspended", "reason": "Reported harassment"}, headers=h)
    assert r.status_code == 200
    assert r.json()["account_status"] == "suspended"
    assert r.json()["status_reason"] == "Reported harassment"

    # Existing sessions and new logins are blocked
    assert client.get(f"{P}/users/me", headers=u["headers"]).status_code == 401
    r = client.post(f"{P}/auth/login", json={"email": u["email"], "password": PASSWORD})
    assert r.status_code == 403
    assert client.post(f"{P}/auth/refresh", json={"refresh_token": u["tokens"]["refresh_token"]}).status_code == 401

    r = client.patch(url, json={"status": "active"}, headers=h)
    assert r.status_code == 200 and r.json()["status_reason"] is None
    assert client.post(f"{P}/auth/login", json={"email": u["email"], "password": PASSWORD}).status_code == 200


def test_remove_account_blocks_login(client, make_user, admin):
    u = make_user()
    url = f"{P}/admin/users/{u['id']}/status"
    r = client.patch(url, json={"status": "removed", "reason": "Left the university"}, headers=admin["headers"])
    assert r.status_code == 200
    assert client.post(f"{P}/auth/login", json={"email": u["email"], "password": PASSWORD}).status_code == 403


def test_admin_cannot_change_own_status(client, admin):
    r = client.patch(
        f"{P}/admin/users/{admin['id']}/status",
        json={"status": "suspended", "reason": "oops"},
        headers=admin["headers"],
    )
    assert r.status_code == 400


def test_cannot_approve_vehicle_of_suspended_owner(client, make_user, admin, submit_vehicle):
    u = make_user()
    vid = submit_vehicle(u["headers"]).json()["id"]
    client.patch(
        f"{P}/admin/users/{u['id']}/status",
        json={"status": "suspended", "reason": "Under investigation"},
        headers=admin["headers"],
    )
    r = client.post(f"{P}/admin/driver-verifications/{vid}/approve", headers=admin["headers"])
    assert r.status_code == 409
