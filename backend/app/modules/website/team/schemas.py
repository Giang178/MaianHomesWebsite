import re
from typing import Literal
from urllib.parse import urlparse

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ContentItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=1000)

    @field_validator("title", "description")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class TeamProfilePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(default="", max_length=160)
    profile_type: Literal["BROKER", "LEADERSHIP", "SPECIALIST"] = "SPECIALIST"
    full_name: str = Field(min_length=1, max_length=200)
    position: str = Field(default="", max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=254)
    avatar_media_id: str | None = None
    avatar_alt_text: str = Field(default="", max_length=300)
    years_experience: int = Field(default=0, ge=0, le=80)
    headline: str = Field(default="", max_length=300)
    short_bio: str = Field(default="", max_length=1000)
    about: str = Field(default="", max_length=10000)
    quote: str | None = Field(default=None, max_length=1000)
    specialties: list[ContentItem] = Field(default_factory=list, max_length=30)
    achievements: list[ContentItem] = Field(default_factory=list, max_length=30)
    customers_served: int = Field(default=0, ge=0, le=1_000_000)
    deals_completed: int = Field(default=0, ge=0, le=1_000_000)
    satisfaction_rate: int = Field(default=0, ge=0, le=100)
    linkedin_url: str | None = Field(default=None, max_length=1000)
    show_on_home: bool = False
    is_featured: bool = False
    allow_detail_view: bool = True
    display_order: int = Field(default=100, ge=0, le=9999)
    project_ids: list[str] = Field(default_factory=list, max_length=50)
    seo_title: str | None = Field(default=None, max_length=120)
    seo_description: str | None = Field(default=None, max_length=320)
    consent_confirmed: bool = False
    expected_version: int | None = Field(default=None, ge=1)

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", cleaned):
            raise ValueError("Slug khong hop le")
        return cleaned

    @field_validator("full_name", "position", "headline", "short_bio", "about", "avatar_alt_text")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("phone", "email", "avatar_media_id", "quote", "linkedin_url", "seo_title", "seo_description")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        cleaned = str(value or "").strip()
        return cleaned or None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email khong hop le")
        return value

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin_url(cls, value: str | None) -> str | None:
        if not value:
            return None
        parsed = urlparse(value)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not (host == "linkedin.com" or host.endswith(".linkedin.com")):
            raise ValueError("LinkedIn phai la URL HTTPS thuoc linkedin.com")
        return value

    @field_validator("project_ids")
    @classmethod
    def validate_project_ids(cls, values: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(str(value).strip() for value in values if str(value).strip()))
        if any(not ObjectId.is_valid(value) for value in cleaned):
            raise ValueError("Danh sach du an chua ID khong hop le")
        return cleaned


class TeamTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["publish", "unpublish", "archive", "rollback"]
    expected_version: int = Field(ge=1)
    target_version: int | None = Field(default=None, ge=1)
    note: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_action_fields(self):
        if self.action == "rollback" and self.target_version is None:
            raise ValueError("Can chon phien ban muon khoi phuc")
        return self