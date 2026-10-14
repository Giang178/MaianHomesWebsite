from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CompanyFAQ(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=300)
    answer: str = Field(min_length=1, max_length=2000)


class CompanyKnowledgePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company_name: str = Field(default="Maian Homes", min_length=1, max_length=200)
    overview: str = Field(default="", max_length=5000)
    services: list[str] = Field(default_factory=list, max_length=30)
    service_areas: list[str] = Field(default_factory=list, max_length=30)
    working_hours: str = Field(default="", max_length=500)
    consultation_process: list[str] = Field(default_factory=list, max_length=20)
    policies: list[str] = Field(default_factory=list, max_length=30)
    faqs: list[CompanyFAQ] = Field(default_factory=list, max_length=30)
    effective_date: str = Field(default="", max_length=40)

    @field_validator("effective_date")
    @classmethod
    def validate_effective_date(cls, value: str) -> str:
        value = value.strip()
        if not value:
            return ""
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("EFFECTIVE_DATE_INVALID") from exc
        return value
    @field_validator("services", "service_areas", "consultation_process", "policies")
    @classmethod
    def clean_list(cls, values: list[str]) -> list[str]:
        cleaned = [str(value).strip() for value in values if str(value).strip()]
        if any(len(value) > 1000 for value in cleaned):
            raise ValueError("COMPANY_KNOWLEDGE_ITEM_TOO_LONG")
        return cleaned

    @field_validator("faqs")
    @classmethod
    def validate_unique_faqs(cls, values: list[CompanyFAQ]) -> list[CompanyFAQ]:
        questions = [item.question.strip().casefold() for item in values]
        if len(questions) != len(set(questions)):
            raise ValueError("COMPANY_KNOWLEDGE_FAQ_DUPLICATE")
        return values


class CompanyKnowledgeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payload: CompanyKnowledgePayload
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=128)


class CompanyKnowledgeTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["publish", "unpublish"]
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=128)
    note: str = Field(default="", max_length=1000)
