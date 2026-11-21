"""Night-time gate rule (pickups at night only at campus gates) and SOS email to campus security."""
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import parse_gates, settings
from app.services.campus import is_night
from tests.conftest import P
from tests.test_rides_bookings import MID, ORIGIN, client, confirm, make_ride, request_seat, setup  # noqa: F401

NEAR_ORIGIN = ((ORIGIN[0] + MID[0]) / 2, (ORIGIN[1] + MID[1]) / 2)  # on the route, ~1.2 km from MID


def pkt(hour: int) -> datetime:
    """Tomorrow at `hour`:00 Pakistan time, returned in UTC."""
    tomorrow = (datetime.now(timezone.utc) + timedelta(hours=5) + timedelta(days=1)).date()
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, hour, tzinfo=timezone.utc) - timedelta(hours=5)


@pytest.fixture()
def gates(monkeypatch):
    monkeypatch.setattr(settings, "campus_gates", f"Test Gate:{MID[0]},{MID[1]}")


def ride_at(client, s, dt):  # noqa: F811
    minutes = (dt - datetime.now(timezone.utc)).total_seconds() / 60
    r = make_ride(client, s, minutes=minutes)
    assert r.status_code == 201, r.text
    return r.json()


def test_is_night_handles_midnight_and_pkt():
    assert is_night(pkt(22)) and is_night(pkt(2)) and is_night(pkt(20))
    assert not is_night(pkt(6)) and not is_night(pkt(12)) and not is_night(pkt(19))


def test_parse_gates():
    assert parse_gates("Main Gate:24.93,67.11; Gate 2:24.94,67.12") == [("Main Gate", 24.93, 67.11), ("Gate 2", 24.94, 67.12)]
    assert parse_gates("") == []
    for bad in ("Main Gate", "Gate:abc,1", "Gate:95,67", ":24.9,67.1"):
        with pytest.raises(ValueError):
            parse_gates(bad)


def test_night_pickup_must_be_at_gate(client, setup, gates):  # noqa: F811
    s, rider = setup, setup["riders"][0]
    night = ride_at(client, s, pkt(22))
    r = request_seat(client, rider, night["id"], point=NEAR_ORIGIN)
    assert r.status_code == 422 and "Test Gate" in r.json()["detail"]
    assert request_seat(client, rider, night["id"], point=MID).status_code == 201   # at the gate

    day = ride_at(client, s, pkt(12))
    assert request_seat(client, setup["riders"][1], day["id"], point=NEAR_ORIGIN).status_code == 201


def test_rule_off_without_gates(client, setup):  # noqa: F811
    night = ride_at(client, setup, pkt(23))
    assert request_seat(client, setup["riders"][0], night["id"], point=NEAR_ORIGIN).status_code == 201
    assert client.get(f"{P}/maps/gates", headers=setup["riders"][0]["headers"]).json()["rule_enabled"] is False


def test_gates_endpoint(client, setup, gates):  # noqa: F811
    body = client.get(f"{P}/maps/gates", headers=setup["riders"][0]["headers"]).json()
    assert body["rule_enabled"] is True and body["gates"][0]["name"] == "Test Gate"


def test_sos_emails_campus_security(client, setup, sink, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "campus_security_email", "security@neduet.edu.pk")
    s, rider = setup, setup["riders"][0]
    ride = make_ride(client, s).json()
    confirm(client, s, rider, ride["id"])
    client.post(f"{P}/rides/{ride['id']}/start", headers=s["driver"]["headers"])
    assert client.post(f"{P}/safety/sos", json={"ride_id": ride["id"]}, headers=rider["headers"]).status_code == 201
    mail = [m for m in sink.sent if m["to"] == "security@neduet.edu.pk"]
    assert len(mail) == 1 and mail[0]["subject"].startswith("SOS") and "ABC-123" in mail[0]["body"]
