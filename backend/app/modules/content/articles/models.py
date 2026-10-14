
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.article import Article, ArticleCategory, ArticleImage, ArticleSEO

ShortText = Annotated[str, Field(max_length=500)]


class ArticleFAQ(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(default="", max_length=500)
    answer: str = Field(default="", max_length=5000)


class ArticleSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="", max_length=500)
    url: str = Field(default="", max_length=2048)
    publisher: str = Field(default="", max_length=500)


class ArticleInternalLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="", max_length=500)
    url: str = Field(default="", max_length=2048)
    type: str = Field(default="article", pattern=r"^(article|project)$")


class ArticleGEO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer_summary: str = Field(default="", max_length=2000)
    key_facts: list[ShortText] = Field(default_factory=list, max_length=50)
    faqs: list[ArticleFAQ] = Field(default_factory=list, max_length=50)
    sources: list[ArticleSource] = Field(default_factory=list, max_length=50)
    internal_links: list[ArticleInternalLink] = Field(default_factory=list, max_length=5)


class MarketingArticle(Article):
    geo: ArticleGEO = Field(default_factory=ArticleGEO)
    workflow_status: str = "DRAFT"
    publication_status: str = "NEVER_PUBLISHED"
    published_version: int = 0
    created_by: str = ""
    updated_by: str = ""


__all__ = [
    "ArticleCategory",
    "ArticleFAQ",
    "ArticleGEO",
    "ArticleInternalLink",
    "ArticleImage",
    "ArticleSEO",
    "ArticleSource",
    "MarketingArticle",
]
