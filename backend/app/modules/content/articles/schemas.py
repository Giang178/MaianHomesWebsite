
from pydantic import BaseModel, ConfigDict, Field

from app.models.article import ArticleCategory, ArticleImage, ArticleSEO
from app.modules.content.articles.models import ArticleGEO


class ArticleCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(max_length=120)
    slug: str = Field(max_length=160)
    category: ArticleCategory
    project_id: str | None = Field(default=None, max_length=64)
    sapo: str = Field(default="", max_length=500)
    content: str = Field(default="", max_length=1_000_000)
    featured_image_id: str | None = Field(default=None, max_length=64)
    gallery: list[ArticleImage] = Field(default_factory=list, max_length=100)
    seo: ArticleSEO = Field(default_factory=ArticleSEO)
    geo: ArticleGEO = Field(default_factory=ArticleGEO)
    idempotency_key: str = Field(min_length=8, max_length=128)


class ArticleDraftBootstrapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: str = Field(min_length=8, max_length=128)


class ArticleDraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=120)
    slug: str | None = Field(default=None, max_length=160)
    category: ArticleCategory | None = None
    project_id: str | None = Field(default=None, max_length=64)
    sapo: str | None = Field(default=None, max_length=500)
    content: str | None = Field(default=None, max_length=1_000_000)
    featured_image_id: str | None = Field(default=None, max_length=64)
    gallery: list[ArticleImage] | None = Field(default=None, max_length=100)
    seo: ArticleSEO | None = None
    geo: ArticleGEO | None = None
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=128)

