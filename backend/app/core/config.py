import os
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_gates(raw: str) -> list[tuple[str, float, float]]:
    """"Name:lat,lng;Name:lat,lng" -> [(name, lat, lng)]. Raises ValueError on bad input."""
    gates = []
    for item in filter(None, (p.strip() for p in raw.split(";"))):
        try:
            name, coords = item.rsplit(":", 1)
            lat, lng = (float(x) for x in coords.split(","))
        except ValueError:
            raise ValueError(f"CAMPUS_GATES entry {item!r} must look like 'Main Gate:24.9300,67.1140'")
        if not (-90 <= lat <= 90 and -180 <= lng <= 180) or not name.strip():
            raise ValueError(f"CAMPUS_GATES entry {item!r} has an empty name or invalid coordinates")
        gates.append((name.strip(), lat, lng))
    return gates


class Settings(BaseSettings):
    # ENV_FILE="" disables the .env file (the test suite does this so a developer's .env can't change test results)
    model_config = SettingsConfigDict(env_file=os.getenv("ENV_FILE", ".env") or None, extra="ignore")

    app_name: str = "NED Transport Hub API"
    api_prefix: str = "/api/v1"

    database_url: str
    secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # SRS SEC-01: 24 h
    refresh_token_expire_days: int = 7
    bcrypt_rounds: int = Field(12, ge=4, le=16)  # SRS SEC-02: work factor 12

    otp_expire_minutes: int = 10
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60

    allowed_email_domains: str = "cloud.neduet.edu.pk"
    cors_origins: str = "*"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    smtp_from_email: str = ""
    smtp_from_name: str = "NED Transport Hub"

    upload_dir: str = "/tmp/uploads" if os.getenv("VERCEL") else "uploads"
    max_upload_mb: int = 5

    # ---- Member 2: maps, matching, fares, payments, notifications ----
    mapbox_token: str = ""                 # Mapbox token (pk.…); takes priority over Google when set
    google_maps_api_key: str = ""          # used if no Mapbox token; both empty -> straight-line fallback
    corridor_radius_m: int = 500           # SRS 4.1: 500 m route-matching corridor
    match_time_window_minutes: int = 60
    fare_rate_per_km: float = 35.0         # PKR/km fuel-cost estimate for split fares
    avg_speed_kmh: float = 30.0            # used for ETA when Google is not configured

    payment_provider: str = "mock"         # "mock" until a real provider adapter is added
    payment_webhook_secret: str = ""       # HMAC secret shared with the payment provider

    fcm_credentials_file: str = ""         # Firebase service-account JSON; empty -> push is logged only
    sms_provider: str = "console"          # "console" logs SMS; replace with a real gateway adapter

    campus_security_phone: str = ""        # receives SOS SMS (SRS SAF-02); empty = admins are notified in-app only
    campus_security_email: str = ""        # receives SOS by email (free alternative to SMS); needs SMTP

    # Night-time rule: between night_start_hour and night_end_hour (campus local time) pickups must be
    # within gate_radius_m of a campus gate. Format: "Main Gate:24.9300,67.1140;Gate 2:24.9310,67.1160".
    # Empty -> rule disabled.
    campus_gates: str = ""
    gate_radius_m: int = Field(150, ge=10, le=2000)
    night_start_hour: int = Field(20, ge=0, le=23)
    night_end_hour: int = Field(6, ge=0, le=23)
    campus_utc_offset_hours: float = 5.0   # Pakistan Standard Time (no daylight saving)
    reminders_enabled: bool = not bool(os.getenv("VERCEL"))
    reminder_minutes_before: int = 30
    share_link_hours: int = 24
    public_base_url: str = "http://localhost:8000"

    first_admin_email: str = ""
    first_admin_password: str = ""
    first_admin_name: str = "System Admin"

    @property
    def email_domains(self) -> list[str]:
        return [d.strip().lower() for d in self.allowed_email_domains.split(",") if d.strip()]

    @field_validator("campus_gates")
    @classmethod
    def _check_gates(cls, v: str) -> str:
        parse_gates(v)  # fail at startup on a typo rather than on the first night booking
        return v

    @property
    def gates(self) -> list[tuple[str, float, float]]:
        return parse_gates(self.campus_gates)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()