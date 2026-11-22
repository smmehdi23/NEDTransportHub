import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import settings


def validate_password_strength(value: str) -> str:
    if len(value) < 8 or len(value.encode()) > 72:
        raise ValueError("Password must be 8 to 72 characters long.")
    if not (re.search(r"[a-z]", value) and re.search(r"[A-Z]", value) and re.search(r"\d", value)):
        raise ValueError("Password must contain an uppercase letter, a lowercase letter and a digit.")
    return value


def normalize_phone(value: str) -> str:
    cleaned = re.sub(r"[\s-]", "", value.strip())
    if re.fullmatch(r"03\d{9}", cleaned):
        return "+92" + cleaned[1:]
    if re.fullmatch(r"\+923\d{9}", cleaned):
        return cleaned
    raise ValueError("Enter a valid Pakistani mobile number (e.g. +923001234567 or 03001234567).")


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str
    phone: str | None = None
    department: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name is too short.")
        return v

    @field_validator("email")
    @classmethod
    def _email_domain(cls, v: str) -> str:
        v = v.lower()
        if v.rsplit("@", 1)[1] != "cloud.neduet.edu.pk":
            raise ValueError("Only @cloud.neduet.edu.pk email addresses are allowed to register.")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password_strength(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v else None

    @field_validator("department")
    @classmethod
    def _department(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        from app.schemas.user import normalize_department

        return normalize_department(v)


class EmailRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class VerifyEmailRequest(EmailRequest):
    otp: str = Field(pattern=r"^\d{6}$")


class LoginRequest(EmailRequest):
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ResetPasswordRequest(VerifyEmailRequest):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password_strength(v)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token lifetime in seconds
