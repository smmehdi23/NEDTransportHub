from tests.conftest import P, vehicle_files


def test_submit_vehicle_and_view_status(client, make_user, submit_vehicle):
    u = make_user()
    r = submit_vehicle(u["headers"], plate="abc 123")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["plate_number"] == "ABC123"
    assert body["verification_status"] == "pending"

    status = client.get(f"{P}/drivers/verification-status", headers=u["headers"]).json()
    assert status["is_driver_verified"] is False
    assert len(status["vehicles"]) == 1


def test_submit_validation(client, make_user, submit_vehicle):
    u = make_user()
    h = u["headers"]
    assert submit_vehicle(h, seats=0).status_code == 422
    assert submit_vehicle(h, plate="!!").status_code == 422

    files = vehicle_files()
    files["licence_document"] = ("fake.pdf", b"not really a pdf", "application/pdf")
    r = client.post(
        f"{P}/drivers/vehicles",
        data={"plate_number": "XYZ-999", "model": "Suzuki Alto", "seat_capacity": "3"},
        files=files,
        headers=h,
    )
    assert r.status_code == 415

    assert submit_vehicle(h, plate="DUP-111").status_code == 201
    assert submit_vehicle(h, plate="DUP-111").status_code == 409


def test_document_access_control(client, make_user, admin, submit_vehicle):
    owner = make_user("owner@cloud.neduet.edu.pk")
    other = make_user("other@cloud.neduet.edu.pk")
    vid = submit_vehicle(owner["headers"]).json()["id"]
    url = f"{P}/drivers/vehicles/{vid}/documents/licence"

    r = client.get(url, headers=owner["headers"])
    assert r.status_code == 200 and r.content.startswith(b"%PDF-")
    assert client.get(url, headers=admin["headers"]).status_code == 200
    assert client.get(url, headers=other["headers"]).status_code == 404
    assert client.get(url).status_code == 401


def test_admin_approval_makes_user_driver(client, make_user, admin, submit_vehicle):
    u = make_user()
    vid = submit_vehicle(u["headers"]).json()["id"]

    queue = client.get(f"{P}/admin/driver-verifications", headers=admin["headers"]).json()
    assert queue["total"] == 1

    r = client.post(f"{P}/admin/driver-verifications/{vid}/approve", headers=admin["headers"])
    assert r.status_code == 200
    assert r.json()["verification_status"] == "verified"

    me = client.get(f"{P}/users/me", headers=u["headers"]).json()
    assert me["role"] == "driver" and me["is_driver_verified"] is True
    # cannot be reviewed twice, and verified vehicles cannot be edited by the owner
    assert client.post(f"{P}/admin/driver-verifications/{vid}/approve", headers=admin["headers"]).status_code == 409
    r = client.put(f"{P}/drivers/vehicles/{vid}", data={"model": "Toyota"}, headers=u["headers"])
    assert r.status_code == 409


def test_rejection_requires_reason_then_resubmit(client, make_user, admin, submit_vehicle):
    u = make_user()
    vid = submit_vehicle(u["headers"]).json()["id"]
    url = f"{P}/admin/driver-verifications/{vid}/reject"

    assert client.post(url, json={}, headers=admin["headers"]).status_code == 422
    assert client.post(url, json={"reason": "no"}, headers=admin["headers"]).status_code == 422
    r = client.post(url, json={"reason": "Licence photo is unreadable"}, headers=admin["headers"])
    assert r.status_code == 200
    assert r.json()["rejection_reason"] == "Licence photo is unreadable"

    me = client.get(f"{P}/users/me", headers=u["headers"]).json()
    assert me["role"] == "rider" and me["is_driver_verified"] is False

    # Owner sees the reason, fixes the document and resubmits
    r = client.put(
        f"{P}/drivers/vehicles/{vid}",
        files={"licence_document": ("l.pdf", b"%PDF-1.4 new licence", "application/pdf")},
        headers=u["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["verification_status"] == "pending"
    assert r.json()["rejection_reason"] is None


def test_resubmit_requires_changes_and_ownership(client, make_user, submit_vehicle):
    owner = make_user("owner@cloud.neduet.edu.pk")
    other = make_user("other@cloud.neduet.edu.pk")
    vid = submit_vehicle(owner["headers"]).json()["id"]
    assert client.put(f"{P}/drivers/vehicles/{vid}", headers=owner["headers"]).status_code == 422
    assert client.put(f"{P}/drivers/vehicles/{vid}", data={"model": "X5"}, headers=other["headers"]).status_code == 404


def test_admin_cannot_submit_vehicles(client, admin, submit_vehicle):
    assert submit_vehicle(admin["headers"]).status_code == 403
