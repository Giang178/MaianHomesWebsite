import re

from pydantic import BaseModel, Field, field_validator


class BrandingPayload(BaseModel):
    logo_header_media_id: str | None = None
    logo_footer_media_id: str | None = None
    logo_light_media_id: str | None = None
    logo_dark_media_id: str | None = None
    favicon_media_id: str | None = None
    default_og_media_id: str | None = None
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=320)
    zalo_oa_id: str | None = Field(default=None, max_length=32)
    zalo_url: str | None = Field(default=None, max_length=2048)
    messenger_url: str | None = Field(default=None, max_length=2048)
    address: str | None = Field(default=None, max_length=1000)
    social_links: dict[str, str] = Field(default_factory=dict)
    header: dict = Field(default_factory=dict)
    footer: dict = Field(default_factory=dict)
    expected_version: int | None = Field(default=None, ge=1)

    @field_validator("zalo_oa_id", mode="before")
    @classmethod
    def validate_zalo_oa_id(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        if not re.fullmatch(r"\d{10,30}", normalized):
            raise ValueError("INVALID_ZALO_OA_ID")
        return normalized


class BrandingPublish(BaseModel):
    expected_version: int = Field(ge=1)
