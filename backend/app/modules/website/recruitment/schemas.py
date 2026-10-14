from typing import Literal

from pydantic import BaseModel, Field, field_validator


class JobPayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(default="", max_length=160)
    department: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=200)
    employment_type: str = Field(default="Full-time", max_length=100)
    quantity: int = Field(default=1, ge=1, le=1000)
    salary_range: str | None = Field(default=None, max_length=200)
    short_description: str | None = Field(default=None, max_length=1000)
    address_detail: str | None = Field(default=None, max_length=1000)
    description_html: str = Field(default="", max_length=100_000)
    requirements_html: str = Field(default="", max_length=100_000)
    benefits_html: str = Field(default="", max_length=100_000)
    seo_title: str | None = Field(default=None, max_length=120)
    seo_description: str | None = Field(default=None, max_length=320)
    expected_version: int | None = Field(default=None, ge=1)

    @field_validator(
        "title", "slug", "department", "location", "employment_type",
        "salary_range", "short_description", "address_detail", "seo_title", "seo_description",
    )
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class JobTransition(BaseModel):
    action: Literal["publish", "unpublish", "close", "archive"]
    expected_version: int = Field(ge=1)
