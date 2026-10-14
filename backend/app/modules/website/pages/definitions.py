from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

FieldKind = Literal["text", "textarea", "url", "media", "sections"]

@dataclass(frozen=True)
class ContentField:
    key: str
    label: str
    kind: FieldKind = "text"
    required: bool = False
    max_length: int = 500
    section: str = "Nội dung chung"

@dataclass(frozen=True)
class MediaSlot:
    key: str
    label: str
    min_width: int
    min_height: int
    aspect_ratio: float | None = None
    ratio_tolerance: float = 0.08
    required: bool = False

@dataclass(frozen=True)
class PageDefinition:
    label: str
    public_path: str
    fields: tuple[ContentField, ...]
    media_slots: tuple[MediaSlot, ...] = ()
    frontend_component: str = ""

def text(key: str, label: str, *, required: bool = False, max_length: int = 500, section: str = "Nội dung chung") -> ContentField:
    return ContentField(key, label, "text", required, max_length, section)

def area(key: str, label: str, *, required: bool = False, max_length: int = 5000, section: str = "Nội dung chung") -> ContentField:
    return ContentField(key, label, "textarea", required, max_length, section)

def url(key: str, label: str, *, required: bool = False, section: str = "Nội dung chung") -> ContentField:
    return ContentField(key, label, "url", required, 500, section)

def media(key: str, label: str, width: int, height: int, *, required: bool = False, ratio: float | None = None, section: str = "Hình ảnh") -> tuple[ContentField, MediaSlot]:
    return ContentField(key, label, "media", required, 160, section), MediaSlot(key, label, width, height, ratio, required=required)

hero_home, hero_home_slot = media("hero_media_id", "Banner trang chủ", 1600, 900, required=True, ratio=16 / 9)
contact_banner, contact_banner_slot = media("contact_banner_media_id", "Ảnh khu vực liên hệ", 1200, 675, ratio=16 / 9)
about_hero, about_hero_slot = media("hero_media_id", "Banner giới thiệu", 1600, 900, required=True, ratio=16 / 9)
about_story, about_story_slot = media("story_media_id", "Ảnh câu chuyện thương hiệu", 1000, 750, required=True, ratio=4 / 3)
about_culture, about_culture_slot = media("culture_media_id", "Ảnh văn hóa doanh nghiệp", 1400, 788, required=True, ratio=16 / 9)

about_intro_summary = area("intro_summary", "Tóm tắt giới thiệu", required=True, max_length=2000, section="Tổng quan")
about_mission_label = text("mission_label", "Nhãn sứ mệnh", required=True, max_length=80, section="Câu chuyện thương hiệu")
about_core_eyebrow = text("core_eyebrow", "Nhãn giá trị cốt lõi", required=True, max_length=80, section="Giá trị cốt lõi")
about_core_title = text("core_title", "Tiêu đề giá trị cốt lõi", required=True, max_length=160, section="Giá trị cốt lõi")
about_core_values = ContentField("core_values", "Các giá trị cốt lõi", "sections", True, 12000, "Giá trị cốt lõi")
about_culture_eyebrow = text("culture_eyebrow", "Nhãn văn hóa doanh nghiệp", required=True, max_length=100, section="Văn hóa doanh nghiệp")
about_culture_title = text("culture_title", "Tiêu đề văn hóa doanh nghiệp", required=True, max_length=160, section="Văn hóa doanh nghiệp")
about_culture_content = area("culture_content", "Mô tả văn hóa doanh nghiệp", required=True, max_length=4000, section="Văn hóa doanh nghiệp")
about_culture_values = ContentField("culture_values", "Các trụ cột văn hóa", "sections", True, 12000, "Văn hóa doanh nghiệp")
about_partners_eyebrow = text("partners_eyebrow", "Nhãn đối tác", required=True, max_length=100, section="Đối tác chiến lược")
about_partners_title = text("partners_title", "Tiêu đề đối tác", required=True, max_length=160, section="Đối tác chiến lược")
about_philosophy_eyebrow = text("philosophy_eyebrow", "Nhãn triết lý kinh doanh", required=True, max_length=100, section="Triết lý kinh doanh")
about_philosophy_title = text("philosophy_title", "Tiêu đề triết lý kinh doanh", required=True, max_length=160, section="Triết lý kinh doanh")
about_philosophy_quote = area("philosophy_quote", "Trích dẫn triết lý kinh doanh", required=True, max_length=2000, section="Triết lý kinh doanh")
about_philosophy_points = ContentField("philosophy_points", "Các điểm triết lý", "sections", True, 12000, "Triết lý kinh doanh")

def listing_page(label: str, path: str, component: str) -> PageDefinition:
    return PageDefinition(label, path, (
        text("title", "Tiêu đề danh sách", required=True, max_length=120, section="Đầu trang"),
        area("description", "Mô tả dưới tiêu đề", required=True, max_length=1000, section="Đầu trang"),
    ), frontend_component=component)

def contact_page() -> PageDefinition:
    return PageDefinition("Liên hệ", "/lien-he", (
        text("title", "Tiêu đề khối liên hệ", required=True, max_length=120, section="Khối giới thiệu"),
        area("description", "Mô tả khối liên hệ", required=True, max_length=1000, section="Khối giới thiệu"),
    ), frontend_component="ContactLayout")

PAGE_DEFINITIONS: dict[str, PageDefinition] = {
    "home": PageDefinition("Trang chủ", "/", (hero_home, text("hero_eyebrow", "Dòng giới thiệu trên tiêu đề", max_length=80, section="Hero đầu trang"), text("hero_title_line_1", "Tiêu đề dòng 1", required=True, max_length=100, section="Hero đầu trang"), text("hero_title_line_2", "Tiêu đề dòng 2", required=True, max_length=100, section="Hero đầu trang"), area("hero_description", "Mô tả dưới tiêu đề", required=True, max_length=600, section="Hero đầu trang"), text("hero_cta_label", "Nhãn nút khám phá", required=True, max_length=80, section="Hero đầu trang"), url("hero_cta_href", "Đích đến của nút", required=True, section="Hero đầu trang"), text("featured_projects_title", "Tiêu đề dự án nổi bật", max_length=120, section="Dự án nổi bật"), area("featured_projects_description", "Mô tả dự án nổi bật", max_length=800, section="Dự án nổi bật"), contact_banner), (hero_home_slot, contact_banner_slot), "HomePage"),
    "about": PageDefinition("Giới thiệu", "/gioi-thieu", (about_hero, about_intro_summary, about_story, text("story_title", "Tiêu đề Câu chuyện thương hiệu", required=True, max_length=160, section="Câu chuyện thương hiệu"), about_mission_label, area("story_content", "Nội dung Sứ mệnh", required=True, max_length=8000, section="Câu chuyện thương hiệu"), about_core_eyebrow, about_core_title, about_core_values, about_culture, about_culture_eyebrow, about_culture_title, about_culture_content, about_culture_values, about_partners_eyebrow, about_partners_title, about_philosophy_eyebrow, about_philosophy_title, about_philosophy_quote, about_philosophy_points), (about_hero_slot, about_story_slot, about_culture_slot), "AboutUsPage"),
    "contact": contact_page(),
    "consignment": PageDefinition("Ký gửi", "/ky-gui", (media("hero_media_id", "Ảnh nền biểu mẫu ký gửi", 1600, 700, required=True, section="Biểu mẫu ký gửi")[0],), (media("hero_media_id", "Ảnh nền biểu mẫu ký gửi", 1600, 700, required=True)[1],), "KyGuiForm"),
    "projects_index": listing_page("Danh sách dự án", "/du_an", "ProjectsSection"),
    "news_index": listing_page("Danh sách tin tức", "/tin_tuc", "NewsListClient"),
    "team_index": listing_page("Đội ngũ", "/doi-ngu", "TeamDirectoryClient"),
    "recruitment_index": PageDefinition("Tuyển dụng", "/tuyen-dung", (media("hero_media_id", "Ảnh hero tuyển dụng", 1600, 700, required=True, section="Hero tuyển dụng")[0],), (media("hero_media_id", "Ảnh hero tuyển dụng", 1600, 700, required=True)[1],), "RecruitmentPageClient"),
    "privacy": PageDefinition("Chính sách bảo mật", "/chinh-sach-bao-mat", (text("title", "Tiêu đề chính sách", required=True, max_length=160, section="Đầu trang"), area("introduction", "Đoạn giới thiệu", required=True, max_length=2000, section="Đầu trang"), ContentField("sections", "Các điều khoản chính sách", "sections", True, 30000, "Nội dung chính sách")), frontend_component="PrivacyPolicyClient"),
    "sitemap": PageDefinition("Sơ đồ website", "/so-do-trang-web", (text("title", "Tiêu đề đầu trang", required=True, max_length=160, section="Đầu trang"), area("description", "Mô tả dưới tiêu đề", required=True, max_length=1000, section="Đầu trang")), frontend_component="SitemapPage"),
}

PAGE_KEYS = set(PAGE_DEFINITIONS)
PAGE_CONTENT_FIELDS = {key: {field.key for field in definition.fields} for key, definition in PAGE_DEFINITIONS.items()}

def admin_definitions() -> dict[str, dict]:
    return {key: asdict(definition) for key, definition in PAGE_DEFINITIONS.items()}


def public_definitions() -> dict[str, dict]:
    return {key: {"label": definition.label, "public_path": definition.public_path, "frontend_component": definition.frontend_component, "fields": [], "media_slots": []} for key, definition in PAGE_DEFINITIONS.items()}
