from pydantic import BaseModel, ConfigDict, Field


class AccountPolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=1000)
    password_min_length: int | None = Field(default=None, ge=8, le=128)
    require_uppercase: bool | None = None
    require_lowercase: bool | None = None
    require_digit: bool | None = None
    require_special: bool | None = None
    temporary_password_hours: int | None = Field(default=None, ge=1, le=168)
    reset_link_minutes: int | None = Field(default=None, ge=5, le=120)
    resend_cooldown_seconds: int | None = Field(default=None, ge=0, le=86400)
    email_retry_limit: int | None = Field(default=None, ge=1, le=20)


class EmailTemplateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    subject: str = Field(min_length=1, max_length=250)
    html_body: str = Field(min_length=1, max_length=50000)
    access_url: str | None = Field(default=None, max_length=2048)
    reason: str = Field(min_length=3, max_length=1000)


class EmailTemplateTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipient: str = Field(
        min_length=3,
        max_length=320,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=1000)
