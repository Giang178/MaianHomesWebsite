from typing import Any, Literal

from pydantic import BaseModel, Field


class SeoPayload(BaseModel):
    title: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=320)
    focus_keyword: str = Field(default="", max_length=160)
    keywords: list[str] = Field(default_factory=list, max_length=30)
    canonical_url: str | None = Field(default=None, max_length=500)
    robots: str = Field(default="index,follow", max_length=100)
    og_media_id: str | None = None


class GeoPayload(BaseModel):
    answer_summary: str = Field(default="", max_length=1000)
    key_facts: list[str] = Field(default_factory=list, max_length=30)
    faqs: list[dict[str, str]] = Field(default_factory=list, max_length=30)
    sources: list[dict[str, str]] = Field(default_factory=list, max_length=30)
    internal_links: list[dict[str, str]] = Field(default_factory=list, max_length=50)


class WebsitePageUpsert(BaseModel):
    content: dict[str, Any] = Field(default_factory=dict)
    seo: SeoPayload = Field(default_factory=SeoPayload)
    geo: GeoPayload = Field(default_factory=GeoPayload)
    expected_version: int | None = Field(default=None, ge=1)


class PageTransition(BaseModel):
    action: Literal["publish", "unpublish", "archive", "rollback"]
    expected_version: int = Field(ge=1)
    target_version: int | None = Field(default=None, ge=1)
    note: str | None = Field(default=None, max_length=500)
