from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, field_validator
from app.models.base import MongoBaseModel


class PublicationStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


class AvailabilityStatus(str, Enum):
    AVAILABLE = "AVAILABLE"          # Đang trống
    UPCOMING = "UPCOMING"            # Sắp trống
    NEGOTIATING = "NEGOTIATING"      # Đang thương lượng
    RENTED = "RENTED"                # Đã cho thuê
    SUSPENDED = "SUSPENDED"          # Tạm ngưng
    PENDING = "PENDING"              # Chờ xác nhận


class BuildingGrade(str, Enum):
    A = "A"
    B = "B"
    C = "C"


class CoworkingHero(BaseModel):
    title: str = ''
    subtitle: str = ''
    description: str = ''
    image_url: str = ''
    alt_text: str = ''
    cta_tour_label: str = ''
    cta_consult_label: str = ''


class CoworkingIntroduction(BaseModel):
    title: str = ''
    short_desc: str = ''
    full_desc: str = ''
    target_audience: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    image_url: str = ''
    alt_text: str = ''


class CoworkingLocation(BaseModel):
    address: str = ''
    district: str = ''
    city: str = ''
    latitude: float | None = None
    longitude: float | None = None
    map_embed_url: str = ''
    directions_url: str = ''
    contact_phone: str = ''
    contact_email: str = ''
    operating_hours: str = ''

class WorkspaceAmenity(BaseModel):
    id: str | None = None
    icon: str = "Wifi"
    name: str = ""
    description: str | None = None
    is_active: bool = True
    display_order: int = 0


class WorkspaceGalleryImage(BaseModel):
    id: str | None = None
    url: str = ""
    alt_text: str = ""
    caption: str | None = None
    is_primary: bool = False
    display_order: int = 0


class WorkspaceSEOMetadata(BaseModel):
    title: str = ""
    description: str = ""
    canonical_url: str = ""
    robots: str = "index, follow"
    og_title: str = ""
    og_description: str = ""
    og_image: str = ""
    focus_keyword: str = ""
    keywords: list[str] = Field(default_factory=list)
    h1: str = ""

    @field_validator("keywords", mode="before")
    @classmethod
    def normalize_keywords(cls, val: Any) -> list[str]:
        if isinstance(val, str):
            return [k.strip() for k in val.split(",") if k.strip()]
        if isinstance(val, (list, tuple, set)):
            return [str(k).strip() for k in val if str(k).strip()]
        return []


# --- Model 1: Coworking Space (Singleton per location) ---
class CoworkingSpace(MongoBaseModel):
    key: str = "singleton_location"
    name: str = ""
    slug: str = "coworking"
    status: PublicationStatus = PublicationStatus.DRAFT
    version: int = 1
    published_version: int = 1

    hero: CoworkingHero = Field(default_factory=CoworkingHero)
    introduction: CoworkingIntroduction = Field(default_factory=CoworkingIntroduction)
    location: CoworkingLocation = Field(default_factory=CoworkingLocation)
    amenities: list[WorkspaceAmenity] = Field(default_factory=list)
    gallery: list[WorkspaceGalleryImage] = Field(default_factory=list)
    seo_metadata: WorkspaceSEOMetadata = Field(default_factory=WorkspaceSEOMetadata)

    draft_snapshot: dict[str, Any] | None = None
    published_snapshot: dict[str, Any] | None = None


# --- Model 2: Seat Types for Coworking ---
class SeatType(MongoBaseModel):
    space_key: str = "singleton_location"
    name: str = ""
    code: str = ""
    description: str = ""
    image_url: str | None = None
    alt_text: str = ""
    capacity: int | None = None
    reference_price: str | None = None
    status: str = "ACTIVE" # ACTIVE, INACTIVE
    display_order: int = 0


# --- Model 3: Pricing Plans for Coworking ---
class PricingPlan(MongoBaseModel):
    space_key: str = "singleton_location"
    seat_type_id: str | None = None
    seat_type_name: str | None = None
    name: str = ""
    code: str = ""
    description: str = ""
    price: float | None = None
    currency: str = ""
    billing_period: str = ""
    duration: str = ""
    benefits: list[str] = Field(default_factory=list)
    extra_fees: str | None = None
    is_featured: bool = False
    badge: str | None = None
    status: str = "ACTIVE" # ACTIVE, HIDDEN
    display_order: int = 0


# --- Model 4: Office Building ---
class OfficeBuilding(MongoBaseModel):
    name: str = ""
    slug: str = ""
    code: str = ""
    address: str = ""
    district: str = ""
    city: str = ""
    latitude: float | None = None
    longitude: float | None = None
    building_grade: BuildingGrade | None = None
    certification: str = ""
    total_floors: int | str = ""
    basements: int = 0
    elevators: str = ""
    ceiling_height: float | str = ""
    typical_floor_area: float | str = ""
    direction: str = ""
    year_completed: str = ""
    lease_term_min: str = ""
    motorcycle_parking_fee: str = ""
    motorbike_fee: str = ""
    car_parking_fee: str = ""
    electricity_fee: str = ""
    electricity_backup: str = ""
    overtime_fee: str = ""
    vat_tax: str = ""
    deposit_term: str = ""
    payment_term: str = ""
    air_conditioning: str = ""
    management_company: str = ""
    location_highlights: list[str] = Field(default_factory=list)
    price_per_sqm_min: float | None = None
    price_per_sqm_max: float | None = None
    management_fee_per_sqm: float | None = None
    description: str = ""
    highlights: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    images: list[WorkspaceGalleryImage] = Field(default_factory=list)
    map_embed_url: str = ""
    directions_url: str = ""
    contact_phone: str = ""
    contact_email: str = ""

    status: PublicationStatus = PublicationStatus.DRAFT
    version: int = 1
    published_version: int = 1
    display_order: int = 0

    draft_snapshot: dict[str, Any] | None = None
    published_snapshot: dict[str, Any] | None = None
    seo_metadata: WorkspaceSEOMetadata = Field(default_factory=WorkspaceSEOMetadata)


# --- Model 5: Office Unit (Rentable Space in a Building) ---
class OfficeUnit(MongoBaseModel):
    building_id: str = ""
    unit_code: str = ""
    floor: str = ""
    area: float = 0.0 # m2
    rental_price: float = 0.0
    currency: str = "USD" # USD, VND
    price_unit: str = ""
    management_fee: str = ""
    handover_condition: str = ""
    extra_fees: str | None = None
    availability_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    available_from: str = ""
    notes: str | None = None
    status: str = "ACTIVE" # ACTIVE, HIDDEN
    display_order: int = 0


# --- Model 6: Office Landing Page Content ---
class OfficeLandingContent(MongoBaseModel):
    key: str = 'office_landing'
    status: PublicationStatus = PublicationStatus.DRAFT
    version: int = 1
    published_version: int = 1

    hero_title: str = ''
    hero_subtitle: str = ''
    hero_description: str = ''
    hero_image_url: str = ''
    hero_alt_text: str = ''
    hero_badge: str = ''
    hero_counters: list[dict[str, Any]] = Field(default_factory=list)

    intro_title: str = ''
    intro_description: str = ''
    cta_consult_label: str = ''
    cta_list_label: str = ''

    districts_title: str = ''
    districts_subtitle: str = ''
    districts: list[dict[str, Any]] = Field(default_factory=list)

    process_badge: str = ''
    process_title: str = ''
    process_subtitle: str = ''
    process_steps: list[dict[str, Any]] = Field(default_factory=list)

    market_section_title: str = ''
    market_section_description: str = ''

    consultation_badge: str = ''
    consultation_title: str = ''
    consultation_description: str = ''

    draft_snapshot: dict[str, Any] | None = None
    published_snapshot: dict[str, Any] | None = None
    seo_metadata: WorkspaceSEOMetadata = Field(default_factory=WorkspaceSEOMetadata)
    grade_pages: dict[str, Any] = Field(default_factory=dict)

class WorkspaceFAQ(MongoBaseModel):
    entity_type: str = "COWORKING" # COWORKING, OFFICE_LANDING, BUILDING
    entity_id: str = "singleton_location" # hoặc building_id
    question: str = ""
    answer: str = ""
    display_order: int = 0
    status: str = "PUBLISHED" # PUBLISHED, HIDDEN
