
from pydantic import BaseModel, Field, HttpUrl


class ValidationIssue(BaseModel):
    code: str
    field: str
    message: str
    group: str = "CONTENT"


class ValidationReport(BaseModel):
    score: int = Field(ge=0, le=100)
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)

    @property
    def publishable(self) -> bool:
        return not self.errors


class FAQItem(BaseModel):
    question: str = ""
    answer: str = ""


class SourceReference(BaseModel):
    title: str = ""
    url: HttpUrl | None = None
    publisher: str = ""


class ContentSEO(BaseModel):
    meta_title: str = ""
    meta_description: str = ""
    canonical_url: str = ""
    focus_keyword: str = ""
    secondary_keywords: list[str] = Field(default_factory=list)
    robots: str = "index,follow"
    og_title: str = ""
    og_description: str = ""
    og_image_url: str = ""


class ContentGEO(BaseModel):
    answer_summary: str = ""
    key_facts: list[str] = Field(default_factory=list)
    faqs: list[FAQItem] = Field(default_factory=list)
    sources: list[SourceReference] = Field(default_factory=list)

