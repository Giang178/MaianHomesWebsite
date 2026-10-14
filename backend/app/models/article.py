import uuid
from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field

from .base import MongoBaseModel


class ArticleCategory(str, Enum):
    INTERNAL = "internal"
    MARKET = "market"
    PROJECT = "project"


class ArticleImage(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    media_id: str | None = Field(default=None, max_length=64)
    url: str = Field(default="", max_length=2048)
    alt_text: str = Field(default="", max_length=500)
    caption: str = Field(default="", max_length=1000)
    credit: str = Field(default="", max_length=500)
    sort_order: int = 0
    is_featured: bool = False


class ArticleSEO(BaseModel):
    meta_title: str = Field(default="", max_length=120)
    meta_description: str = Field(default="", max_length=500)
    canonical_url: str = Field(default="", max_length=2048)
    focus_keyword: str = Field(default="", max_length=200)
    keywords: list[Annotated[str, Field(max_length=200)]] = Field(default_factory=list, max_length=50)


class Article(MongoBaseModel):
    title: str
    slug: str
    category: ArticleCategory
    project_id: str | None = None
    sapo: str = ""
    content: str = ""
    featured_image_id: str | None = None
    gallery: list[ArticleImage] = Field(default_factory=list)
    status: str = "draft"
    author_id: str
    author_name: str = ""
    author_email: str = ""
    reviewed_by: str | None = None
    rejection_reason: str | None = None
    published_at: datetime | None = None
    version: int = 1
    view_count: int = 0
    seo: ArticleSEO = Field(default_factory=ArticleSEO)
