from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.booking import BookingStatus, FareStatus
from app.models.payment import PaymentMethod, PaymentStatus, RefundStatus
from app.schemas.ride import Lat, Lng


class BookingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ride_id: int
    pickup_name: str = Field(min_length=2, max_length=100)
    pickup_lat: float = Lat
    pickup_lng: float = Lng
    dropoff_name: str | None = Field(None, max_length=100)
    dropoff_lat: float | None = Field(None, ge=-90, le=90)
    dropoff_lng: float | None = Field(None, ge=-180, le=180)
    proposed_fare: int | None = Field(
        None, ge=0, le=10000, description="Optional passenger fare offer in PKR (e.g. partial route)"
    )

    @model_validator(mode="after")
    def _dropoff_pair(self):
        if (self.dropoff_lat is None) != (self.dropoff_lng is None):
            raise ValueError("Provide both dropoff_lat and dropoff_lng, or neither.")
        return self


class BookingRespond(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["accept", "reject"]
    fare: int | None = Field(None, ge=0, le=10000, description="PKR; defaults to the ride's estimated fare")
    reason: str | None = Field(None, max_length=255)


class FareDecision(BaseModel):
    accept: bool


class PassengerBrief(BaseModel):
    id: int
    name: str
    phone: str | None = None  # only shown to the driver once confirmed


class BookingRead(BaseModel):
    id: int
    ride_id: int
    passenger: PassengerBrief
    origin_name: str
    destination_name: str
    departure_time: datetime
    ride_status: str
    pickup_name: str | None   # masked for the driver until the booking is confirmed (SEC-05)
    pickup_lat: float | None
    pickup_lng: float | None
    dropoff_name: str | None
    status: BookingStatus
    proposed_fare: int | None
    fare_status: FareStatus
    cancel_reason: str | None
    created_at: datetime


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: str
    booking_id: int
    amount: int
    method: PaymentMethod | None
    status: PaymentStatus
    refund_status: RefundStatus
    provider_reference: str | None
    paid_at: datetime | None
    created_at: datetime


class PayRequest(BaseModel):
    method: PaymentMethod


class PayResponse(BaseModel):
    payment: PaymentRead
    checkout_url: str | None = None


class PaymentWebhook(BaseModel):
    provider_reference: str
    status: Literal["succeeded", "failed"]
    amount: int


class RefundUpdate(BaseModel):
    refund_status: RefundStatus
