from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.time import utcnow
from app.models.ride import PollStatus, RideStatus

Lat = Field(ge=-90, le=90)
Lng = Field(ge=-180, le=180)


def _aware(v: datetime) -> datetime:
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)  # naive input is treated as UTC


class RideCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_id: int
    poll_id: int | None = None
    origin_name: str = Field(min_length=2, max_length=100)
    destination_name: str = Field(min_length=2, max_length=100)
    origin_lat: float = Lat
    origin_lng: float = Lng
    dest_lat: float = Lat
    dest_lng: float = Lng
    # Optional [lat, lng] polyline (e.g. from Google on the phone). Otherwise the server computes it.
    route: list[tuple[float, float]] | None = Field(None, min_length=2, max_length=2000)
    departure_time: datetime
    total_seats: int = Field(ge=1, le=8)
    estimated_fare: int | None = Field(None, ge=0, le=10000, description="PKR per seat; default = split-fuel estimate")
    notes: str | None = Field(None, max_length=255)

    @field_validator("departure_time")
    @classmethod
    def _future(cls, v: datetime) -> datetime:
        v = _aware(v)
        if v <= utcnow():
            raise ValueError("Departure time must be in the future.")
        return v

    @field_validator("origin_name", "destination_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class RideUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    departure_time: datetime | None = None
    estimated_fare: int | None = Field(None, ge=0, le=10000)
    total_seats: int | None = Field(None, ge=1, le=8)
    notes: str | None = Field(None, max_length=255)

    @field_validator("departure_time")
    @classmethod
    def _future(cls, v):
        if v is None:
            raise ValueError("departure_time cannot be null.")
        v = _aware(v)
        if v <= utcnow():
            raise ValueError("Departure time must be in the future.")
        return v

    @model_validator(mode="after")
    def _not_empty(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update.")
        return self


class CancelRequest(BaseModel):
    reason: str | None = Field(None, max_length=255)


class DriverBrief(BaseModel):
    id: int
    name: str
    rating_avg: float | None = None
    rating_count: int = 0


class RideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    driver: DriverBrief
    vehicle_model: str
    origin_name: str
    destination_name: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    route: list[tuple[float, float]]
    distance_km: float
    duration_min: float
    departure_time: datetime
    total_seats: int
    available_seats: int
    estimated_fare: int
    status: RideStatus
    notes: str | None
    poll_id: int | None
    # Only filled for the driver and confirmed passengers (SRS 2.3.2 / SEC-05):
    vehicle_plate: str | None = None
    driver_phone: str | None = None
    created_at: datetime


class RideMatchRead(BaseModel):
    ride: RideRead
    pickup_distance_m: float
    dropoff_distance_m: float | None
    time_diff_min: float
    score: float


class RidePage(BaseModel):
    items: list[RideRead]
    total: int
    page: int
    page_size: int


class FareEstimate(BaseModel):
    distance_km: float
    duration_min: float
    rate_per_km: float
    total_cost: int
    people_sharing: int
    fare_per_passenger: int
    route_source: str


class RoutePreview(BaseModel):
    route: list[tuple[float, float]]
    distance_km: float
    duration_min: float
    source: str


# ---------------- Polls ----------------
class PollCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    origin_name: str = Field(min_length=2, max_length=100)
    destination_name: str = Field(min_length=2, max_length=100)
    origin_lat: float = Lat
    origin_lng: float = Lng
    dest_lat: float = Lat
    dest_lng: float = Lng
    departure_time: datetime
    seats_needed: int = Field(1, ge=1, le=4)
    note: str | None = Field(None, max_length=255)

    @field_validator("departure_time")
    @classmethod
    def _future(cls, v: datetime) -> datetime:
        v = _aware(v)
        if v <= utcnow():
            raise ValueError("Departure time must be in the future.")
        return v


class PollRead(BaseModel):
    id: int
    creator_id: int
    creator_name: str
    origin_name: str
    destination_name: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    departure_time: datetime
    seats_needed: int
    note: str | None
    status: PollStatus
    vote_count: int
    has_voted: bool
    created_at: datetime


class PollPage(BaseModel):
    items: list[PollRead]
    total: int
    page: int
    page_size: int
