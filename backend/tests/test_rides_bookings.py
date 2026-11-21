from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.ws_auth import get_session_factory
from app.main import app
from app.services.email import get_email_sender
from tests.conftest import P, TestingSession

ORIGIN = (24.9000, 67.0800)   # somewhere in Gulshan
DEST = (24.9298, 67.1150)     # NED campus
MID = (24.9150, 67.0975)      # on the straight-line route (fallback router)
FAR = (25.1000, 67.3000)


@pytest.fixture()
def client(sink):
    """Overrides the shared fixture: entering TestClient as a context manager keeps ONE event loop for all
    requests and WebSockets, like a real Uvicorn server. (Without it every WebSocket gets its own loop,
    so cross-connection broadcasts would never be delivered in tests.)"""
    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_email_sender] = lambda: sink
    app.dependency_overrides[get_session_factory] = lambda: TestingSession
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def when(minutes=120):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


@pytest.fixture()
def setup(client, make_user, submit_vehicle, admin):
    """A verified driver with an approved vehicle, plus three riders."""
    d = make_user("driver@cloud.neduet.edu.pk", "Dana Driver")
    vid = submit_vehicle(d["headers"], seats=3).json()["id"]
    assert client.post(f"{P}/admin/driver-verifications/{vid}/approve", headers=admin["headers"]).status_code == 200
    d["headers"] = {"Authorization": "Bearer " + client.post(f"{P}/auth/login", json={"email": d["email"], "password": "Str0ngPass1"}).json()["access_token"]}
    riders = [make_user(f"rider{i}@cloud.neduet.edu.pk", f"Rider {i}") for i in range(3)]
    return {"driver": d, "vehicle_id": vid, "riders": riders, "admin": admin}


def make_ride(client, s, seats=2, minutes=120, **extra):
    body = dict(vehicle_id=s["vehicle_id"], origin_name="Gulshan", destination_name="NED University",
                origin_lat=ORIGIN[0], origin_lng=ORIGIN[1], dest_lat=DEST[0], dest_lng=DEST[1],
                departure_time=when(minutes), total_seats=seats, **extra)
    return client.post(f"{P}/rides", json=body, headers=s["driver"]["headers"])


def request_seat(client, rider, ride_id, point=MID):
    return client.post(f"{P}/bookings", headers=rider["headers"], json=dict(ride_id=ride_id, pickup_name="Stop", pickup_lat=point[0], pickup_lng=point[1]))


def confirm(client, s, rider, ride_id, fare=None):
    b = request_seat(client, rider, ride_id).json()
    body = {"action": "accept"} | ({"fare": fare} if fare else {})
    assert client.post(f"{P}/bookings/{b['id']}/respond", json=body, headers=s["driver"]["headers"]).status_code == 200
    r = client.post(f"{P}/bookings/{b['id']}/fare", json={"accept": True}, headers=rider["headers"])
    return r


def test_only_verified_drivers_can_offer_rides(client, setup):
    r = client.post(f"{P}/rides", headers=setup["riders"][0]["headers"], json={})
    assert r.status_code == 403


def test_create_ride_defaults_fare_and_validates(client, setup):
    r = make_ride(client, setup)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["estimated_fare"] > 0 and body["distance_km"] > 0 and len(body["route"]) >= 2
    assert body["vehicle_plate"] == "ABC-123"  # the driver sees their own plate
    assert make_ride(client, setup, seats=4).status_code == 422          # vehicle only has 3 seats
    assert make_ride(client, setup, minutes=-30).status_code == 422      # past departure


def test_search_matching_and_privacy(client, setup):
    ride = make_ride(client, setup, estimated_fare=150).json()
    rider = setup["riders"][0]
    q = dict(pickup_lat=MID[0], pickup_lng=MID[1], dropoff_lat=DEST[0], dropoff_lng=DEST[1], departure_time=when(130))
    hits = client.get(f"{P}/rides/search", params=q, headers=rider["headers"]).json()
    assert [h["ride"]["id"] for h in hits] == [ride["id"]]
    assert hits[0]["ride"]["vehicle_plate"] is None and hits[0]["ride"]["driver_phone"] is None  # private until confirmed
    far = client.get(f"{P}/rides/search", params=q | {"pickup_lat": FAR[0], "pickup_lng": FAR[1]}, headers=rider["headers"]).json()
    assert far == []
    # wrong direction: pickup at the destination, drop-off at the origin
    back = q | {"pickup_lat": DEST[0], "pickup_lng": DEST[1], "dropoff_lat": ORIGIN[0], "dropoff_lng": ORIGIN[1]}
    assert client.get(f"{P}/rides/search", params=back, headers=rider["headers"]).json() == []
    late = client.get(f"{P}/rides/search", params=q | {"departure_time": when(600)}, headers=rider["headers"]).json()
    assert late == []
    cheap = client.get(f"{P}/rides/search", params=q | {"max_fare": 100}, headers=rider["headers"]).json()
    assert cheap == []


def test_full_ride_lifecycle(client, setup):
    s, rider = setup, setup["riders"][0]
    d = s["driver"]["headers"]
    ride = make_ride(client, s, seats=1).json()

    b = request_seat(client, rider, ride["id"])
    assert b.status_code == 201
    bid = b.json()["id"]
    assert request_seat(client, rider, ride["id"]).status_code == 409  # duplicate request

    # Driver cannot see the exact pickup before confirmation (SEC-05)
    seen = client.get(f"{P}/bookings/{bid}", headers=d).json()
    assert seen["pickup_lat"] is None and seen["passenger"]["phone"] is None

    # The passenger cannot confirm before the driver proposes a fare
    assert client.post(f"{P}/bookings/{bid}/fare", json={"accept": True}, headers=rider["headers"]).status_code == 409
    r = client.post(f"{P}/bookings/{bid}/respond", json={"action": "accept", "fare": 180}, headers=d).json()
    assert r["fare_status"] == "proposed" and r["status"] == "pending"
    assert client.get(f"{P}/rides/{ride['id']}", headers=d).json()["available_seats"] == 1  # not reserved yet

    done = client.post(f"{P}/bookings/{bid}/fare", json={"accept": True}, headers=rider["headers"]).json()
    assert done["status"] == "confirmed" and done["proposed_fare"] == 180
    after = client.get(f"{P}/rides/{ride['id']}", headers=rider["headers"]).json()
    assert after["status"] == "full" and after["available_seats"] == 0
    assert after["vehicle_plate"] == "ABC-123" and after["driver_phone"]  # revealed to confirmed rider
    assert client.get(f"{P}/bookings/{bid}", headers=d).json()["pickup_lat"] == MID[0]

    # Notifications reached the right people
    types = [n["type"] for n in client.get(f"{P}/notifications", headers=rider["headers"]).json()["items"]]
    assert "fare_proposed" in types
    assert "booking_confirmed" in [n["type"] for n in client.get(f"{P}/notifications", headers=d).json()["items"]]

    # Start -> live location -> tracking -> complete
    assert client.post(f"{P}/tracking/rides/{ride['id']}/location", json={"lat": MID[0], "lng": MID[1]}, headers=d).status_code == 409
    assert client.post(f"{P}/rides/{ride['id']}/start", headers=d).status_code == 200
    assert client.post(f"{P}/tracking/rides/{ride['id']}/location", json={"lat": MID[0], "lng": MID[1], "speed_kmh": 30}, headers=d).status_code == 200
    t = client.get(f"{P}/tracking/rides/{ride['id']}", headers=rider["headers"]).json()
    assert t["location"]["lat"] == MID[0] and t["eta_to_destination_min"] > 0 and len(t["pickups"]) == 1
    assert client.get(f"{P}/tracking/rides/{ride['id']}", headers=setup["riders"][1]["headers"]).status_code == 403
    assert client.post(f"{P}/rides/{ride['id']}/complete", headers=d).json()["status"] == "completed"

    # Payment created at the agreed fare; verified only by a signed webhook
    pay = client.get(f"{P}/payments/booking/{bid}", headers=rider["headers"]).json()
    assert pay["amount"] == 180 and pay["status"] == "pending"
    res = client.post(f"{P}/payments/booking/{bid}/pay", json={"method": "online"}, headers=rider["headers"]).json()
    ref = res["payment"]["provider_reference"]
    assert res["checkout_url"] and res["payment"]["status"] == "pending"

    import json
    from app.services.payment_provider import sign_payload
    def hook(payload, sig=None):
        raw = json.dumps(payload).encode()
        return client.post(f"{P}/payments/webhook", content=raw, headers={"X-Signature": sig or sign_payload(raw), "Content-Type": "application/json"})
    assert hook({"provider_reference": ref, "status": "succeeded", "amount": 180}, sig="bad").status_code == 401
    assert hook({"provider_reference": ref, "status": "succeeded", "amount": 999}).status_code == 200  # wrong amount
    assert client.get(f"{P}/payments/booking/{bid}", headers=rider["headers"]).json()["status"] == "outstanding"
    ref2 = client.post(f"{P}/payments/booking/{bid}/pay", json={"method": "online"}, headers=rider["headers"]).json()["payment"]["provider_reference"]
    assert ref2 != ref  # retry works (FR-20)
    assert hook({"provider_reference": ref2, "status": "succeeded", "amount": 180}).status_code == 200
    assert hook({"provider_reference": ref2, "status": "succeeded", "amount": 180}).json()["message"] == "Already processed."
    final = client.get(f"{P}/payments/booking/{bid}", headers=rider["headers"]).json()
    assert final["status"] == "successful" and final["paid_at"]
    assert client.post(f"{P}/payments/booking/{bid}/pay", json={"method": "cash"}, headers=rider["headers"]).status_code == 409
    assert len(client.get(f"{P}/payments/history", headers=rider["headers"]).json()) == 1
    assert len(client.get(f"{P}/payments/history?role=driver", headers=d).json()) == 1

    # Ratings, only after completion, once per pair
    rate = lambda who, score: client.post(f"{P}/ratings", headers=who, json={"ride_id": ride["id"], "rated_user_id": (s["driver"]["id"] if who is rider["headers"] else rider["id"]), "score": score})
    assert rate(rider["headers"], 5).status_code == 201
    assert rate(rider["headers"], 4).status_code == 409
    assert rate(d, 4).status_code == 201
    assert client.post(f"{P}/ratings", headers=setup["riders"][1]["headers"], json={"ride_id": ride["id"], "rated_user_id": rider["id"], "score": 1}).status_code == 403
    summ = client.get(f"{P}/ratings/users/{s['driver']['id']}", headers=rider["headers"]).json()
    assert summ["average"] == 5 and summ["count"] == 1

    # History buckets
    h = client.get(f"{P}/history?bucket=completed", headers=rider["headers"]).json()
    assert len(h) == 1 and h[0]["role"] == "passenger"
    assert client.get(f"{P}/history?bucket=upcoming", headers=rider["headers"]).json() == []


def test_no_overbooking_last_seat(client, setup):
    s = setup
    ride = make_ride(client, s, seats=1).json()
    bookings = []
    for rider in s["riders"][:2]:
        b = request_seat(client, rider, ride["id"]).json()
        client.post(f"{P}/bookings/{b['id']}/respond", json={"action": "accept"}, headers=s["driver"]["headers"])
        bookings.append((rider, b["id"]))
    first = client.post(f"{P}/bookings/{bookings[0][1]}/fare", json={"accept": True}, headers=bookings[0][0]["headers"])
    second = client.post(f"{P}/bookings/{bookings[1][1]}/fare", json={"accept": True}, headers=bookings[1][0]["headers"])
    assert first.status_code == 200 and second.status_code == 409
    assert client.get(f"{P}/bookings/{bookings[1][1]}", headers=bookings[1][0]["headers"]).json()["status"] == "rejected"
    assert client.get(f"{P}/rides/{ride['id']}", headers=s["driver"]["headers"]).json()["available_seats"] == 0


def test_cancel_booking_frees_seat_and_ride_cancel_notifies(client, setup):
    s, r0, r1 = setup, setup["riders"][0], setup["riders"][1]
    ride = make_ride(client, s, seats=1).json()
    bid = confirm(client, s, r0, ride["id"]).json()["id"]
    assert client.get(f"{P}/rides/{ride['id']}", headers=r0["headers"]).json()["status"] == "full"
    assert client.post(f"{P}/bookings/{bid}/cancel", headers=r1["headers"]).status_code == 404  # not yours
    assert client.post(f"{P}/bookings/{bid}/cancel", json={"reason": "plans changed"}, headers=r0["headers"]).json()["status"] == "cancelled"
    back = client.get(f"{P}/rides/{ride['id']}", headers=r0["headers"]).json()
    assert back["status"] == "open" and back["available_seats"] == 1
    assert "booking_cancelled" in [n["type"] for n in client.get(f"{P}/notifications", headers=s["driver"]["headers"]).json()["items"]]
    # can re-request after cancelling, then driver cancels the whole ride
    assert confirm(client, s, r0, ride["id"]).status_code == 200
    assert client.post(f"{P}/rides/{ride['id']}/cancel", json={"reason": "car trouble"}, headers=s["driver"]["headers"]).status_code == 200
    assert "ride_cancelled" in [n["type"] for n in client.get(f"{P}/notifications", headers=r0["headers"]).json()["items"]]
    assert request_seat(client, r1, ride["id"]).status_code == 409


def test_fare_decline_then_new_proposal(client, setup):
    s, rider = setup, setup["riders"][0]
    ride = make_ride(client, s).json()
    bid = request_seat(client, rider, ride["id"]).json()["id"]
    client.post(f"{P}/bookings/{bid}/respond", json={"action": "accept", "fare": 500}, headers=s["driver"]["headers"])
    assert client.post(f"{P}/bookings/{bid}/fare", json={"accept": False}, headers=rider["headers"]).json()["fare_status"] == "declined"
    assert client.get(f"{P}/rides/{ride['id']}", headers=rider["headers"]).json()["available_seats"] == 2
    client.post(f"{P}/bookings/{bid}/respond", json={"action": "accept", "fare": 150}, headers=s["driver"]["headers"])
    assert client.post(f"{P}/bookings/{bid}/fare", json={"accept": True}, headers=rider["headers"]).json()["status"] == "confirmed"


def test_pickup_must_be_near_route_and_cash_flow(client, setup):
    s, rider = setup, setup["riders"][0]
    ride = make_ride(client, s).json()
    assert request_seat(client, rider, ride["id"], point=FAR).status_code == 422
    bid = confirm(client, s, rider, ride["id"], fare=120).json()["id"]
    d = s["driver"]["headers"]
    client.post(f"{P}/rides/{ride['id']}/start", headers=d)
    client.post(f"{P}/rides/{ride['id']}/complete", headers=d)
    assert client.post(f"{P}/payments/booking/{bid}/pay", json={"method": "cash"}, headers=rider["headers"]).status_code == 200
    assert client.post(f"{P}/payments/booking/{bid}/confirm-cash", headers=rider["headers"]).status_code == 403
    assert client.post(f"{P}/payments/booking/{bid}/confirm-cash", headers=d).json()["status"] == "successful"


def test_polls_vote_and_convert(client, setup):
    s, r0, r1 = setup, setup["riders"][0], setup["riders"][1]
    body = dict(origin_name="Gulshan", destination_name="NED", origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
                dest_lat=DEST[0], dest_lng=DEST[1], departure_time=when(180), seats_needed=1)
    poll = client.post(f"{P}/polls", json=body, headers=r0["headers"]).json()
    assert poll["vote_count"] == 1 and poll["has_voted"]
    assert client.post(f"{P}/polls/{poll['id']}/vote", headers=r1["headers"]).json()["vote_count"] == 2
    assert client.post(f"{P}/polls/{poll['id']}/vote", headers=r1["headers"]).status_code == 409
    assert client.delete(f"{P}/polls/{poll['id']}/vote", headers=r1["headers"]).json()["vote_count"] == 1
    client.post(f"{P}/polls/{poll['id']}/vote", headers=r1["headers"])
    assert client.get(f"{P}/polls?sort=votes", headers=r1["headers"]).json()["items"][0]["id"] == poll["id"]
    # a driver offers a ride for the poll: creator + voters are notified, poll becomes converted
    ride = make_ride(client, s, poll_id=poll["id"], departure_time=None) if False else client.post(
        f"{P}/rides", headers=s["driver"]["headers"],
        json=dict(vehicle_id=s["vehicle_id"], origin_name="Gulshan", destination_name="NED", origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
                  dest_lat=DEST[0], dest_lng=DEST[1], departure_time=when(180), total_seats=2, poll_id=poll["id"]))
    assert ride.status_code == 201, ride.text
    assert client.get(f"{P}/polls/{poll['id']}", headers=r0["headers"]).json()["status"] == "converted"
    for r in (r0, r1):
        assert "ride_available" in [n["type"] for n in client.get(f"{P}/notifications", headers=r["headers"]).json()["items"]]
    assert client.post(f"{P}/polls/{poll['id']}/vote", headers=setup["riders"][2]["headers"]).status_code == 409


def test_matching_open_polls_notified_on_new_ride(client, setup):
    body = dict(origin_name="Gulshan", destination_name="NED", origin_lat=MID[0], origin_lng=MID[1],
                dest_lat=DEST[0], dest_lng=DEST[1], departure_time=when(125), seats_needed=1)
    client.post(f"{P}/polls", json=body, headers=setup["riders"][0]["headers"])
    ride = make_ride(client, setup).json()
    assert "ride_available" in [n["type"] for n in client.get(f"{P}/notifications", headers=setup["riders"][0]["headers"]).json()["items"]]
    poll_id = client.get(f"{P}/polls?mine=true", headers=setup["riders"][0]["headers"]).json()["items"][0]["id"]
    assert [m["ride"]["id"] for m in client.get(f"{P}/polls/{poll_id}/matches", headers=setup["riders"][0]["headers"]).json()] == [ride["id"]]


def test_chat_rest_and_websocket(client, setup):
    s, rider = setup, setup["riders"][0]
    ride = make_ride(client, s).json()
    b = request_seat(client, rider, ride["id"]).json()
    assert client.get(f"{P}/chat/{b['id']}/messages", headers=rider["headers"]).status_code == 403  # not confirmed yet
    confirm_resp = client.post(f"{P}/bookings/{b['id']}/respond", json={"action": "accept"}, headers=s["driver"]["headers"])
    client.post(f"{P}/bookings/{b['id']}/fare", json={"accept": True}, headers=rider["headers"])
    assert client.post(f"{P}/chat/{b['id']}/messages", json={"content": "I'm at the gate"}, headers=rider["headers"]).status_code == 201
    assert client.post(f"{P}/chat/{b['id']}/messages", json={"content": "x"}, headers=s["riders"][1]["headers"] if False else setup["riders"][1]["headers"]).status_code == 404
    with client.websocket_connect(f"{P}/ws/chat/{b['id']}?token={s['driver']['headers']['Authorization'][7:]}") as ws:
        ws.send_json({"content": "On my way"})
        assert ws.receive_json()["content"] == "On my way"
    msgs = client.get(f"{P}/chat/{b['id']}/messages", headers=rider["headers"]).json()
    assert [m["content"] for m in msgs] == ["I'm at the gate", "On my way"]
    # outsiders and bad tokens are rejected
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"{P}/ws/chat/{b['id']}?token=garbage"):
            pass


def test_tracking_websocket_streams_to_passenger(client, setup):
    s, rider = setup, setup["riders"][0]
    ride = make_ride(client, s).json()
    confirm(client, s, rider, ride["id"])
    client.post(f"{P}/rides/{ride['id']}/start", headers=s["driver"]["headers"])
    tok = lambda u: u["headers"]["Authorization"][7:]
    with client.websocket_connect(f"{P}/tracking/ws/{ride['id']}?token={tok(rider)}") as pax, \
         client.websocket_connect(f"{P}/tracking/ws/{ride['id']}?token={tok(s['driver'])}") as drv:
        drv.send_json({"lat": MID[0], "lng": MID[1], "speed_kmh": 25})
        ev = pax.receive_json()
        assert ev["type"] == "location" and ev["lat"] == MID[0]
        drv.send_json({"lat": 999, "lng": 1})
        assert drv.receive_json()["type"] == "error"
    assert client.get(f"{P}/tracking/rides/{ride['id']}", headers=rider["headers"]).json()["location"]["lat"] == MID[0]


def test_sos_share_contacts_and_reports(client, setup, admin):
    s, rider = setup, setup["riders"][0]
    ride = make_ride(client, s).json()
    confirm(client, s, rider, ride["id"])
    assert client.post(f"{P}/safety/sos", json={"ride_id": ride["id"]}, headers=rider["headers"]).status_code == 409  # not started
    assert client.post(f"{P}/safety/trips/{ride['id']}/share", headers=rider["headers"]).status_code == 409        # no contacts
    c = client.post(f"{P}/safety/contacts", json={"name": "Mom", "phone": "03111234567"}, headers=rider["headers"])
    assert c.status_code == 201
    share = client.post(f"{P}/safety/trips/{ride['id']}/share", headers=rider["headers"]).json()
    assert share["contacts_notified"] == 1
    token = share["url"].rsplit("/", 1)[1]
    pub = client.get(f"{P}/safety/shared/{token}").json()   # no auth header
    assert pub["vehicle_plate"] == "ABC-123" and "phone" not in str(pub)
    assert client.get(f"{P}/safety/shared/nope").status_code == 404

    client.post(f"{P}/rides/{ride['id']}/start", headers=s["driver"]["headers"])
    sos = client.post(f"{P}/safety/sos", json={"ride_id": ride["id"], "lat": MID[0], "lng": MID[1]}, headers=rider["headers"])
    assert sos.status_code == 201
    assert client.post(f"{P}/safety/sos", json={"ride_id": ride["id"]}, headers=setup["riders"][1]["headers"]).status_code == 403
    assert "sos" in [n["type"] for n in client.get(f"{P}/notifications", headers=admin["headers"]).json()["items"]]
    assert client.get(f"{P}/admin/sos", headers=admin["headers"]).json()[0]["status"] == "active"
    assert client.get(f"{P}/admin/sos", headers=rider["headers"]).status_code == 403
    assert client.post(f"{P}/admin/sos/{sos.json()['id']}/resolve", headers=admin["headers"]).json()["status"] == "resolved"

    rep = client.post(f"{P}/safety/reports", headers=rider["headers"], json={"ride_id": ride["id"], "reported_user_id": s["driver"]["id"], "description": "Driver was speeding dangerously"})
    assert rep.status_code == 201
    assert client.post(f"{P}/safety/reports", headers=setup["riders"][1]["headers"], json={"ride_id": ride["id"], "description": "I was not even here ok"}).status_code == 403
    upd = client.patch(f"{P}/admin/reports/{rep.json()['id']}", headers=admin["headers"], json={"status": "resolved", "admin_notes": "Warned driver"})
    assert upd.json()["status"] == "resolved"
    assert "report_update" in [n["type"] for n in client.get(f"{P}/notifications", headers=rider["headers"]).json()["items"]]
    assert client.get(f"{P}/admin/reports", headers=rider["headers"]).status_code == 403


def test_admin_stats_rides_and_refund(client, setup, admin):
    s, rider = setup, setup["riders"][0]
    ride = make_ride(client, s).json()
    bid = confirm(client, s, rider, ride["id"]).json()["id"]
    client.post(f"{P}/rides/{ride['id']}/start", headers=s["driver"]["headers"])
    client.post(f"{P}/rides/{ride['id']}/complete", headers=s["driver"]["headers"])
    client.post(f"{P}/payments/booking/{bid}/pay", json={"method": "cash"}, headers=rider["headers"])
    client.post(f"{P}/payments/booking/{bid}/confirm-cash", headers=s["driver"]["headers"])
    st = client.get(f"{P}/admin/stats", headers=admin["headers"]).json()
    assert st["rides"]["by_status"]["completed"] == 1 and st["payments"]["total_paid_pkr"] > 0
    assert st["users"]["total"] >= 5
    assert client.get(f"{P}/admin/stats", headers=rider["headers"]).status_code == 403
    assert client.get(f"{P}/admin/rides?status=completed", headers=admin["headers"]).json()["total"] == 1
    assert len(client.get(f"{P}/admin/rides/{ride['id']}/bookings", headers=admin["headers"]).json()) == 1
    txn = client.get(f"{P}/payments/booking/{bid}", headers=rider["headers"]).json()["transaction_id"]
    r = client.patch(f"{P}/admin/payments/{txn}/refund", json={"refund_status": "completed"}, headers=admin["headers"]).json()
    assert r["status"] == "refunded" and r["refund_status"] == "completed"


def test_notifications_devices_and_reminders(client, setup, db_session):
    s, rider = setup, setup["riders"][0]
    tok = "f" * 40
    assert client.post(f"{P}/notifications/devices", json={"token": tok}, headers=rider["headers"]).status_code == 201
    assert client.post(f"{P}/notifications/devices", json={"token": tok}, headers=s["driver"]["headers"]).status_code == 201  # moves to new owner
    assert client.delete(f"{P}/notifications/devices?token={tok}", headers=s["driver"]["headers"]).status_code == 200
    ride = make_ride(client, s, minutes=20).json()
    confirm(client, s, rider, ride["id"])
    from app.services.reminders import send_due_reminders
    assert send_due_reminders(db_session) == 1 and send_due_reminders(db_session) == 0   # only once
    n = client.get(f"{P}/notifications", headers=rider["headers"]).json()
    assert "ride_reminder" in [i["type"] for i in n["items"]] and n["unread"] >= 1
    assert client.post(f"{P}/notifications/read-all", headers=rider["headers"]).status_code == 200
    assert client.get(f"{P}/notifications?unread_only=true", headers=rider["headers"]).json()["total"] == 0


def test_maps_endpoints(client, setup):
    h = setup["riders"][0]["headers"]
    q = dict(origin_lat=ORIGIN[0], origin_lng=ORIGIN[1], dest_lat=DEST[0], dest_lng=DEST[1])
    assert client.get(f"{P}/maps/route", params=q, headers=h).json()["distance_km"] > 0
    fe = client.get(f"{P}/maps/fare-estimate", params=q | {"passengers": 3}, headers=h).json()
    assert fe["people_sharing"] == 4 and fe["fare_per_passenger"] % 10 == 0
    assert client.get(f"{P}/maps/geocode?q=NED", headers=h).status_code == 503  # no API key configured
    assert client.get(f"{P}/maps/route", params=q).status_code == 401
