from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator
from app.models.workspace import (
    AvailabilityStatus,
    BuildingGrade,
    CoworkingHero,
    CoworkingIntroduction,
    CoworkingLocation,
    WorkspaceGalleryImage,
    WorkspaceSEOMetadata,
)


# --- Coworking Schemas ---
class CoworkingContentUpsert(BaseModel):
    model_config = {"extra": "allow"}
    name: str = ""
    hero: CoworkingHero | dict[str, Any] | None = Field(default_factory=CoworkingHero)
    introduction: CoworkingIntroduction | dict[str, Any] | None = Field(default_factory=CoworkingIntroduction)
    location: CoworkingLocation | dict[str, Any] | None = Field(default_factory=CoworkingLocation)
    amenities: list[Any] = Field(default_factory=list)
    gallery: list[Any] = Field(default_factory=list)
    seo_metadata: WorkspaceSEOMetadata | dict[str, Any] | None = Field(default_factory=WorkspaceSEOMetadata)


class SeatTypeCreateUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(default="", max_length=50)
    description: str = Field(default="", max_length=1000)
    image_url: str | None = None
    alt_text: str = ""
    capacity: int | None = Field(default=None, ge=1)
    reference_price: str | None = Field(default=None, max_length=100)
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"
    display_order: int = 0


class PricingPlanCreateUpdate(BaseModel):
    seat_type_id: str | None = None
    seat_type_name: str | None = None
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(default="", max_length=50)
    description: str = Field(default="", max_length=1000)
    price: float | None = Field(default=None, ge=0)
    currency: str = Field(default="", max_length=10)
    billing_period: str = Field(default="", max_length=50)
    duration: str = Field(default="", max_length=100)
    benefits: list[str] = Field(default_factory=list)
    extra_fees: str | None = Field(default=None, max_length=500)
    is_featured: bool = False
    badge: str | None = Field(default=None, max_length=100)
    status: Literal["ACTIVE", "HIDDEN"] = "ACTIVE"
    display_order: int = 0


# --- Office Landing Content Schemas ---
class OfficeLandingContentUpsert(BaseModel):
    model_config = {"extra": "allow"}

    hero_title: str = Field(default="", max_length=200)
    hero_subtitle: str = Field(default="", max_length=200)
    hero_description: str = Field(default="", max_length=1000)
    hero_image_url: str = Field(default="", max_length=1000)
    hero_alt_text: str = Field(default="", max_length=500)
    hero_badge: str = Field(default="", max_length=150)
    hero_counters: list[dict[str, Any]] = Field(default_factory=list)

    intro_title: str = Field(default="", max_length=200)
    intro_description: str = Field(default="", max_length=2000)
    cta_consult_label: str = Field(default="", max_length=100)
    cta_list_label: str = Field(default="", max_length=100)

    districts_title: str = Field(default="", max_length=200)
    districts_subtitle: str = Field(default="", max_length=500)
    districts: list[dict[str, Any]] = Field(default_factory=list)

    process_badge: str = Field(default="", max_length=100)
    process_title: str = Field(default="", max_length=200)
    process_subtitle: str = Field(default="", max_length=500)
    process_steps: list[dict[str, Any]] = Field(default_factory=list)

    market_section_title: str = Field(default="", max_length=200)
    market_section_description: str = Field(default="", max_length=5000)

    consultation_badge: str = Field(default="", max_length=100)
    consultation_title: str = Field(default="", max_length=200)
    consultation_description: str = Field(default="", max_length=1000)

    seo_metadata: WorkspaceSEOMetadata = Field(default_factory=WorkspaceSEOMetadata)
    grade_pages: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_input(cls, data: dict[str, Any]) -> "OfficeLandingContentUpsert":
        mapped = dict(data)
        if "title" in mapped and "hero_title" not in mapped:
            mapped["hero_title"] = mapped["title"]
        if "subtitle" in mapped and "hero_subtitle" not in mapped:
            mapped["hero_subtitle"] = mapped["subtitle"]
        if "hero_image" in mapped and "hero_image_url" not in mapped:
            mapped["hero_image_url"] = mapped["hero_image"]
        if "alt_text" in mapped and "hero_alt_text" not in mapped:
            mapped["hero_alt_text"] = mapped["alt_text"]
        if "seo" in mapped and ("seo_metadata" not in mapped or not mapped["seo_metadata"]):
            seo_raw = mapped["seo"]
            if isinstance(seo_raw, dict):
                mapped["seo_metadata"] = {
                    "title": seo_raw.get("meta_title") or seo_raw.get("title") or "",
                    "description": seo_raw.get("meta_description") or seo_raw.get("description") or "",
                    "keywords": seo_raw.get("keywords") or seo_raw.get("meta_keywords") or "",
                }
        return cls(**mapped)


# --- Office Building Schemas ---
class OfficeBuildingCreateUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    code: str = Field(default="", max_length=50)
    address: str = Field(min_length=1, max_length=500)
    district: str = Field(min_length=1, max_length=100)
    city: str = Field(default="", max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    building_grade: BuildingGrade | None = None
    certification: str = Field(default="", max_length=100)
    total_floors: int | str = ""
    basements: int = Field(default=0, ge=0)
    elevators: str = Field(default="", max_length=200)
    ceiling_height: float | str = ""
    typical_floor_area: float | str = ""
    direction: str = Field(default="", max_length=100)
    year_completed: str = Field(default="", max_length=100)
    lease_term_min: str = Field(default="", max_length=100)
    motorcycle_parking_fee: str = Field(default="", max_length=200)
    motorbike_fee: str = Field(default="", max_length=200)
    car_parking_fee: str = Field(default="", max_length=200)
    electricity_fee: str = Field(default="", max_length=200)
    electricity_backup: str = Field(default="", max_length=500)
    overtime_fee: str = Field(default="", max_length=200)
    vat_tax: str = Field(default="", max_length=100)
    deposit_term: str = Field(default="", max_length=100)
    payment_term: str = Field(default="", max_length=100)
    air_conditioning: str = Field(default="", max_length=500)
    management_company: str = Field(default="", max_length=200)
    location_highlights: list[str] = Field(default_factory=list)
    price_per_sqm_min: float | None = Field(default=None, ge=0)
    price_per_sqm_max: float | None = Field(default=None, ge=0)
    management_fee_per_sqm: float | None = Field(default=None, ge=0)
    description: str = Field(default="", max_length=5000)
    highlights: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    images: list[WorkspaceGalleryImage] = Field(default_factory=list)
    map_embed_url: str = Field(default="", max_length=2000)
    directions_url: str = Field(default="", max_length=2000)
    contact_phone: str = Field(default="", max_length=50)
    contact_email: str = Field(default="", max_length=100)
    display_order: int = 0
    seo_metadata: WorkspaceSEOMetadata = Field(default_factory=WorkspaceSEOMetadata)
    expected_version: int | None = Field(default=None, ge=1, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        mapped = dict(value)
        if "grade" in mapped and "building_grade" not in mapped:
            mapped["building_grade"] = mapped.pop("grade")
        return mapped


# --- Office Unit Schemas ---
class OfficeUnitCreateUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    building_id: str
    unit_code: str = Field(min_length=1, max_length=50)
    floor: str = Field(default="", max_length=50)
    area: float = Field(gt=0)
    rental_price: float = Field(ge=0)
    currency: str = Field(default="", max_length=10)
    price_unit: str = Field(default="", max_length=50)
    management_fee: str = Field(default="", max_length=200)
    handover_condition: str = Field(default="", max_length=500)
    extra_fees: str | None = Field(default=None, max_length=500)
    availability_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    available_from: str = Field(default="", max_length=100)
    notes: str | None = Field(default=None, max_length=1000)
    status: Literal["ACTIVE", "HIDDEN"] = "ACTIVE"
    display_order: int = 0

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        mapped = dict(value)
        if "unit_code" not in mapped or not mapped["unit_code"]:
            if mapped.get("code"):
                mapped["unit_code"] = mapped.pop("code")
            elif mapped.get("unit_number"):
                mapped["unit_code"] = mapped.pop("unit_number")
        if "area_sqm" in mapped and "area" not in mapped:
            mapped["area"] = mapped.pop("area_sqm")
        if "price_per_sqm" in mapped and "rental_price" not in mapped:
            mapped["rental_price"] = mapped.pop("price_per_sqm")
        availability_values = {item.value for item in AvailabilityStatus}
        if mapped.get("status") in availability_values:
            mapped.setdefault("availability_status", mapped["status"])
            mapped["status"] = "ACTIVE"
        return mapped


# --- Workspace FAQ Schemas ---
class WorkspaceFAQCreateUpdate(BaseModel):
    entity_type: Literal["COWORKING", "OFFICE_LANDING", "BUILDING"] = "COWORKING"
    entity_id: str = "singleton_location"
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=5000)
    display_order: int = 0
    status: Literal["PUBLISHED", "HIDDEN"] = "PUBLISHED"


# --- Publishing / Transition Schema ---
class WorkspaceTransitionRequest(BaseModel):
    action: Literal["PUBLISH", "DRAFT", "HIDE"]
    expected_version: int = Field(ge=1)
    note: str | None = Field(default=None, max_length=500)


# --- SEO / GEO Audit Items ---
class AuditCheckItem(BaseModel):
    field: str
    status: Literal["PASSED", "WARNING", "ERROR"] # Đạt, Cần cải thiện, Lỗi
    message: str
    current_value: str | None = None
    recommendation: str | None = None


class PageSEOGEOAudit(BaseModel):
    page_id: str
    page_type: Literal["COWORKING", "OFFICE_LANDING", "BUILDING"]
    title: str
    slug: str
    seo_score_label: Literal["Đạt", "Cần cải thiện", "Lỗi cần xử lý"]
    geo_score_label: Literal["Đạt", "Cần cải thiện", "Lỗi cần xử lý"]
    seo_checks: list[AuditCheckItem]
    geo_checks: list[AuditCheckItem]
    structured_data_preview: dict[str, Any]
    last_updated: str | None = None
