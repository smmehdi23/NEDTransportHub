import smtplib
import ssl
from email.message import EmailMessage
from typing import Protocol

from app.core.config import settings


class EmailDeliveryError(Exception):
    pass


class EmailSender(Protocol):
    def send_otp(self, to_email: str, name: str, code: str, purpose: str) -> None: ...

    def send_text(self, to_email: str, subject: str, body: str) -> None: ...


_SUBJECTS = {
    "verify_email": "Verify your NED Transport Hub email",
    "reset_password": "Reset your NED Transport Hub password",
}
_ACTIONS = {
    "verify_email": "verify your email address",
    "reset_password": "reset your password",
}


class SMTPEmailSender:
    def send_otp(self, to_email: str, name: str, code: str, purpose: str) -> None:
        self.send_text(
            to_email,
            _SUBJECTS[purpose],
            f"Hello {name},\n\n"
            f"Use this code to {_ACTIONS[purpose]}: {code}\n\n"
            f"It expires in {settings.otp_expire_minutes} minutes. "
            "If you did not request it, you can ignore this email.\n\n"
            "NED Transport Hub",
        )

    def send_text(self, to_email: str, subject: str, body: str) -> None:
        if not settings.smtp_host or not settings.smtp_from_email:
            raise EmailDeliveryError("SMTP is not configured (SMTP_HOST / SMTP_FROM_EMAIL).")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = to_email
        msg.set_content(body)
        try:
            if settings.smtp_use_ssl:
                server = smtplib.SMTP_SSL(
                    settings.smtp_host, settings.smtp_port, timeout=15, context=ssl.create_default_context()
                )
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            with server:
                if settings.smtp_use_tls and not settings.smtp_use_ssl:
                    server.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(msg)
        except (smtplib.SMTPException, OSError) as exc:
            raise EmailDeliveryError(str(exc)) from exc


def get_email_sender() -> EmailSender:
    return SMTPEmailSender()
