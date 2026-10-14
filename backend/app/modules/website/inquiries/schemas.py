import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

LeadSource = Literal["WEBSITE", "PROJECT", "COWORKING", "OFFICE", "CONSIGNMENT"]


class WebsiteLeadCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=8, max_length=30)
    email: str | None = Field(default=None, max_length=254)
    source: LeadSource = "WEBSITE"
    type: str = Field(default="BUY", max_length=50)
    interest_project_id: str | None = Field(default=None, max_length=100)
    project_id: str | None = Field(default=None, max_length=100)
    staff_profile_id: str | None = Field(default=None, max_length=100)
    form_id: str = Field(default="website-contact", max_length=100)
    page_key: str | None = Field(default=None, max_length=100)
    page_url: str | None = Field(default=None, max_length=1000)
    note: str | None = Field(default=None, max_length=4000)
    notes: list[str] | None = Field(default=None, max_length=20)
    utm_source: str | None = Field(default=None, max_length=200)
    utm_medium: str | None = Field(default=None, max_length=200)
    utm_campaign: str | None = Field(default=None, max_length=200)
    utm_content: str | None = Field(default=None, max_length=200)
    referrer: str | None = Field(default=None, max_length=1000)
    consent: bool = True
    consent_version: str | None = Field(default=None, max_length=50)
    structured_details: dict = Field(default_factory=dict)

    @field_validator("customer_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Tên khách hàng không được để trống")
        return value

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        phone = re.sub(r"[^\d+]", "", value)
        if phone.startswith("+84"):
            phone = "0" + phone[3:]
        elif phone.startswith("84"):
            phone = "0" + phone[2:]
        if not re.match(r"^0\d{8,11}$", phone):
            raise ValueError("Số điện thoại không hợp lệ")
        return phone

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        email = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            raise ValueError("Email không hợp lệ")
        return email

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Cần đồng ý xử lý thông tin cá nhân")
        return value

    def message(self) -> str | None:
        if self.note and self.note.strip():
            return self.note.strip()
        values = [item.strip() for item in self.notes or [] if item and item.strip()]
        return "\n".join(values)[:4000] if values else None


class LeadSubmissionResponse(BaseModel):
    accepted: bool = True
    reference_id: str
    message: str = "Thông tin đã được tiếp nhận"


class WebsiteLeadStatusUpdate(BaseModel):
    status: Literal["VIEWED", "ARCHIVED"]
    expected_version: int = Field(ge=1)


class WebsiteLeadExport(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=5000)
    status: Literal["NEW", "VIEWED", "EXPORTED", "ARCHIVED"] | None = None
    source: str | None = None
    form_id: str | None = None
    project_id: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    format: Literal["csv", "xlsx", "zip"] = "xlsx"
