from enum import Enum

from pydantic import BaseModel, Field

from .base import MongoBaseModel


class ProjectStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    COMING_SOON = "COMING_SOON"
    PRE_SALE = "PRE_SALE"
    HANDING_OVER = "HANDING_OVER"
    # Legacy values remain readable so existing records can be edited without
    # forcing an unsafe business-status migration.
    RESERVED = "RESERVED"
    SOLD = "SOLD"


class ProjectSEOFAQ(BaseModel):
    question: str = ""
    answer: str = ""


class ProjectSEOSource(BaseModel):
    title: str = ""
    url: str = ""


class ProjectImageAlt(BaseModel):
    url: str = ""
    alt_text: str = ""


class ProjectImageMetadata(BaseModel):
    field: str = ""
    media_id: str = ""
    url: str = ""
    alt_text: str = ""
    width: int = 0
    height: int = 0
    focal_x: float = Field(default=50.0, ge=0, le=100)
    focal_y: float = Field(default=50.0, ge=0, le=100)
    variants: dict[str, str] = Field(default_factory=dict)


class ProjectSEOMetadata(BaseModel):
    title: str = ""
    description: str = ""
    canonical_url: str = ""
    og_title: str = ""
    og_description: str = ""
    og_image: str = ""
    keywords: list[str] = Field(default_factory=list)
    focus_keyword: str = ""
    cornerstone_text: str = ""
    usps: list[str] = Field(default_factory=list)
    key_facts: list[str] = Field(default_factory=list)
    faqs: list[ProjectSEOFAQ] = Field(default_factory=list)
    sources: list[ProjectSEOSource] = Field(default_factory=list)
    image_alts: list[ProjectImageAlt] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Nested sub-models for luxury project data
# ──────────────────────────────────────────────

class LocationDistance(BaseModel):
    """Khoảng cách từ dự án tới các điểm lân cận"""
    destination: str = ""        # "Bệnh viện FV"
    distance: str = ""           # "5 phút lái xe"
    distance_km: str = ""        # "3.5 km"


class Tower(BaseModel):
    """Thông tin từng tháp / block trong dự án"""
    id: str = ""                         # "T1", "T2", ...
    name: str = ""                       # "Tháp Symphony"
    floors: int = 0                      # Số tầng
    units_per_floor: int = 0             # Số căn/tầng
    total_units: int = 0                 # Tổng số căn
    area_range: str = ""                 # "65 - 180 m²"
    position_x: float = 50.0            # % vị trí X trên master plan
    position_y: float = 50.0            # % vị trí Y trên master plan
    floor_plan_images: list[str] = []    # Ảnh mặt bằng tầng
    description: str = ""


class AmenityItem(BaseModel):
    """Một tiện ích cụ thể"""
    name: str = ""
    image_url: str = ""
    description: str = ""
    icon: str = ""
    position_x: float = 0.0            # % vị trí X trên bản đồ tiện ích
    position_y: float = 0.0            # % vị trí Y trên bản đồ tiện ích
    number: int = 0                    # Số thứ tự marker hiển thị (ví dụ 1, 2, 3...)
    category: str = "outdoor"          # Phân loại ("outdoor" | "indoor" | "rooftop" ...)


class AmenityFloor(BaseModel):
    """Tiện ích được phân theo tầng/khu vực"""
    floor_label: str = ""              # "Tầng 1", "Tầng 2-3", "Tầng Thượng"
    floor_map_image: str = ""          # Ảnh sơ đồ mặt bằng riêng của tầng này
    sub_categories: list[str] = []     # Danh sách các nhóm/tầng con do người dùng tạo
    amenities: list[AmenityItem] = []


class AmenityGalleryItem(BaseModel):
    """Ảnh tiện ích độc lập dùng riêng cho Thư viện tiện ích"""
    name: str = ""
    image_url: str = ""
    description: str = ""
    category: str = "general"          # Phân loại ("outdoor" | "indoor" | "general" | hoặc tùy chọn)


class ProjectHighlight(BaseModel):
    """Card ưu điểm nổi bật của dự án"""
    title: str = ""
    description: str = ""
    icon: str = ""                    # Emoji hoặc tên icon
    image: str = ""


class UnitLayout(BaseModel):
    """Mẫu thiết kế căn hộ (ví dụ: 1PN, 2PN, 3PN)"""
    name: str = ""
    bedrooms: int = 1
    bathrooms: int = 1
    gross_area: float = 0.0
    net_area: float = 0.0
    door_direction: str = ""
    balcony_direction: str = ""
    view_direction: str = ""
    image_url: str = ""
    description: str = ""


class FloorUnitHotspot(BaseModel):
    """Tọa độ ghim của từng căn hộ trên sơ đồ mặt bằng tầng"""
    unit_code: str = ""
    unit_number: str = ""
    position_x: float = 50.0
    position_y: float = 50.0
    layout_name: str = ""  # Tên liên kết sang UnitLayout.name (VD: "Căn 1 PN - Type A")


class FloorLayoutGroup(BaseModel):
    """Nhóm các tầng có chung một ảnh mặt bằng tổng thể"""
    group_name: str = ""  # Tên nhóm tự chọn: "Tầng điển hình 3-7"
    floors: list[int] = []  # Danh sách các tầng: [3, 4, 5, 6, 7]
    floor_map_image: str = ""  # Ảnh sơ đồ mặt bằng tầng ngang dùng chung
    unit_layouts: list[UnitLayout] = []  # Các mẫu thiết kế căn hộ (1PN, 2PN, 3PN)
    hotspots: list[FloorUnitHotspot] = []  # Các điểm ghim căn hộ trên sơ đồ


# ──────────────────────────────────────────────
# Main Project Model (fully backward-compatible)
# ──────────────────────────────────────────────

class ProjectF1(MongoBaseModel):
    # ── Core Identity ────────────────────────
    name: str
    slug: str
    slogan: str = ""                   # Hero banner: "Tuyệt tác kiến trúc thượng lưu"
    tagline: str = ""                  # Dòng phụ: "Sống đẳng cấp - Đầu tư sinh lời"
    description: str
    developer: str = "Maian Homes"

    # ── Location ─────────────────────────────
    location: str
    location_description: str = ""
    location_distances: list[LocationDistance] = []
    map_embed_url: str = ""            # Google Maps embed URL
    location_map_image: str = ""       # Ảnh tĩnh bản đồ vị trí (dùng khi không có hoặc không muốn dùng embed URL)
    location_map_x: float = 50.0        # % vị trí X ghim trên bản đồ tĩnh
    location_map_y: float = 50.0        # % vị trí Y ghim trên bản đồ tĩnh
    location_map_position: str = "right" # Vị trí bản đồ trong section: "left" | "right"

    # ── Visual Assets ────────────────────────
    hero_images: list[str] = []        # Carousel hero (ưu tiên dùng nếu có)
    hero_video_url: str = ""           # Video YouTube background cho Hero (nếu có sẽ ưu tiên hơn ảnh)
    master_plan_image: str = ""        # Ảnh tổng mặt bằng cho Interactive Tower
    amenity_map_image: str = ""        # Ảnh mặt bằng tiện ích tổng thể cho Interactive Amenity Map
    images: list[str] = []             # Gallery chung (legacy + fallback)
    stats_bg_image: str = ""           # Ảnh nền cho phần hiển thị thông tin quy mô (Stats)
    overview_images: list[str] = []    # 3 ảnh tổng quan (Bộ ảnh tổng quan dự án)
    overview_image_position: str = "right" # Vị trí ảnh tổng quan: "left" | "right"
    logo_url: str = ""                 # Logo riêng của dự án
    contact_bg_image: str = ""         # Ảnh nền cho phần Liên hệ (Contact Section)

    # ── Theme ────────────────────────────────
    primary_color: str = "#1a3a5c"     # Màu chủ đạo (xanh đại dương)
    accent_color: str = "#c9a85c"      # Màu nhấn (vàng đồng)
    section_colors: dict[str, str] = Field(default_factory=dict) # Màu nền tuỳ chỉnh cho từng khối Section

    # ── Contact Section ──────────────────────
    contact_phone: str = ""            # Hotline liên hệ
    contact_email: str = ""            # Email liên hệ
    contact_title: str = ""            # Tiêu đề form liên hệ
    contact_description: str = ""      # Mô tả form liên hệ

    # ── Storytelling ─────────────────
    story_blocks: list[dict] = [] # Các khối nội dung [{"title": "", "content": "", "image_url": "", "alignment": "left"|"right"}]

    # ── Commercial ───────────────────────────
    master_plan_description: str = "" # Mô tả cho phần mặt bằng tổng thể
    price_range: str = "Đang cập nhật"
    status: ProjectStatus = ProjectStatus.AVAILABLE

    # ── Infographic Stats ────────────────────
    stats: dict[str, str] = Field(default_factory=dict)
    # Ví dụ: {"Tổng diện tích": "5 ha", "Tổng căn hộ": "2,150 căn", "Số tầng": "45 tầng"}

    # ── Interactive Tower ────────────────────
    towers: list[Tower] = []

    # ── Amenities ────────────────────────────
    amenities: list[str] = []          # Legacy: list of strings
    amenity_floors: list[AmenityFloor] = []  # Mới: tiện ích theo tầng
    amenity_template: str = "PRIVE"    # Mới: UI Template Mode ("PRIVE" or "GLOBAL")
    amenity_gallery: list[AmenityGalleryItem] = [] # Mới: Thư viện tiện ích độc lập
    outdoor_amenities_description: str = "" # Mô tả chung phần Tiện ích ngoài trời
    indoor_amenities_description: str = ""  # Mô tả chung phần Tiện ích trong nhà
    interior_design_description: str = ""   # Mô tả chung phần Thiết kế nội thất

    # ── Highlights ───────────────────────────
    highlights: list[ProjectHighlight] = []  # 6 ưu điểm nổi bật

    # ── Floor Layouts ────────────────────────
    floor_layouts: list[FloorLayoutGroup] = []  # Mặt bằng & Căn hộ tương tác

    # ── SEO & Marketing ──────────────────────
    seo_metadata: ProjectSEOMetadata = Field(default_factory=ProjectSEOMetadata)
    image_metadata: list[ProjectImageMetadata] = Field(default_factory=list)
    marketing_tags: list[str] = []
    assigned_staff_id: str | None = None
    is_published: bool = False
    is_featured: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    slogan: str | None = None
    tagline: str | None = None
    description: str | None = None
    developer: str | None = None
    location: str | None = None
    location_description: str | None = None
    location_distances: list[LocationDistance] | None = None
    map_embed_url: str | None = None
    location_map_image: str | None = None
    location_map_x: float | None = None
    location_map_y: float | None = None
    location_map_position: str | None = None
    hero_images: list[str] | None = None
    hero_video_url: str | None = None
    master_plan_image: str | None = None
    amenity_map_image: str | None = None
    images: list[str] | None = None
    stats_bg_image: str | None = None
    overview_images: list[str] | None = None
    overview_image_position: str | None = None
    logo_url: str | None = None
    contact_bg_image: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None
    section_colors: dict[str, str] | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    contact_title: str | None = None
    contact_description: str | None = None
    story_blocks: list[dict] | None = None
    master_plan_description: str | None = None
    price_range: str | None = None
    status: ProjectStatus | None = None
    stats: dict[str, str] | None = None
    towers: list[Tower] | None = None
    amenities: list[str] | None = None
    amenity_floors: list[AmenityFloor] | None = None
    amenity_template: str | None = None
    amenity_gallery: list[AmenityGalleryItem] | None = None
    outdoor_amenities_description: str | None = None
    indoor_amenities_description: str | None = None
    interior_design_description: str | None = None
    highlights: list[ProjectHighlight] | None = None
    floor_layouts: list[FloorLayoutGroup] | None = None
    seo_metadata: ProjectSEOMetadata | None = None
    image_metadata: list[ProjectImageMetadata] | None = None
    marketing_tags: list[str] | None = None
    assigned_staff_id: str | None = None
    is_published: bool | None = None
    is_featured: bool | None = None

