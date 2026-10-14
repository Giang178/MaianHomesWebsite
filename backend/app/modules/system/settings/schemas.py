import re
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_ALLOWED_PATTERN = re.compile(r"^[+\d\s().-]+$")
_MESSENGER_HOSTS = {"m.me", "messenger.com", "www.messenger.com"}
_ZALO_HOSTS = {"zalo.me", "www.zalo.me", "chat.zalo.me", "oa.zalo.me"}


class EmailSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
    host: str = Field(default="smtp.gmail.com", min_length=1, max_length=255)
    port: int = Field(default=587, ge=1, le=65535)
    username: str = Field(min_length=3, max_length=320)
    from_name: str = Field(default="Maian Homes", min_length=1, max_length=200)
    from_email: str | None = Field(default=None, max_length=320)
    start_tls: bool = True
    app_password: str | None = Field(default=None, max_length=200)
    reason: str = Field(min_length=3, max_length=1000)

    @model_validator(mode="after")
    def validate_transport_security(self):
        if self.port == 587 and not self.start_tls:
            raise ValueError("SMTP_STARTTLS_REQUIRED_FOR_PORT_587")
        return self

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("INVALID_SMTP_USERNAME")
        return normalized

    @field_validator("from_email")
    @classmethod
    def validate_from_email(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("INVALID_SMTP_FROM_EMAIL")
        return normalized


class EmailTemplateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
    subject: str = Field(min_length=1, max_length=250)
    html_body: str = Field(min_length=1, max_length=50000)
    reason: str = Field(min_length=3, max_length=1000)


class EmailTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipient: str = Field(min_length=3, max_length=320)
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("INVALID_TEST_RECIPIENT")
        return normalized


class ContactSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    phone: str | None = Field(default=None, max_length=50)
    zalo_url: str | None = Field(default=None, max_length=2048)
    messenger_url: str | None = Field(default=None, max_length=2048)
    email: str | None = Field(default=None, max_length=320)
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        if not _PHONE_ALLOWED_PATTERN.fullmatch(normalized):
            raise ValueError("INVALID_CONTACT_PHONE")
        has_international_prefix = "+" in normalized
        first_digit = next((index for index, char in enumerate(normalized) if char.isdigit()), -1)
        if normalized.count("+") > 1 or (
            has_international_prefix and normalized.index("+") > first_digit
        ):
            raise ValueError("INVALID_CONTACT_PHONE")
        digits = re.sub(r"\D", "", normalized)
        if not 8 <= len(digits) <= 15:
            raise ValueError("INVALID_CONTACT_PHONE")
        return f"+{digits}" if has_international_prefix else digits

    @field_validator("zalo_url", mode="before")
    @classmethod
    def validate_zalo_url(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        if not normalized.startswith("http://") and not normalized.startswith("https://"):
            cleaned = re.sub(r"[^\w+]", "", normalized)
            if cleaned:
                normalized = f"https://zalo.me/{cleaned}"
        parsed = urlparse(normalized)
        if parsed.scheme != "https" or (parsed.hostname or "").lower() not in _ZALO_HOSTS:
            raise ValueError("INVALID_ZALO_URL")
        if not parsed.path or parsed.path == "/":
            raise ValueError("INVALID_ZALO_URL")
        return normalized

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        if not normalized:
            return None
        if not _EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("INVALID_CONTACT_EMAIL")
        return normalized

    @field_validator("messenger_url", mode="before")
    @classmethod
    def validate_messenger_url(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        parsed = urlparse(normalized)
        if parsed.scheme != "https" or (parsed.hostname or "").lower() not in _MESSENGER_HOSTS:
            raise ValueError("INVALID_MESSENGER_URL")
        if not parsed.path or parsed.path == "/":
            raise ValueError("INVALID_MESSENGER_URL")
        return normalized
