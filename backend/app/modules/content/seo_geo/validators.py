import re
from html.parser import HTMLParser
from urllib.parse import urlparse

from app.core.config import settings
from app.modules.content.seo_geo.schemas import ValidationIssue, ValidationReport


class _TextCounter(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.tags: list[str] = []
        self.headings: list[int] = []
        self.images: list[dict[str, str]] = []

    def handle_data(self, data: str):
        self.parts.append(data)

    def handle_starttag(self, tag: str, attrs):
        normalized = tag.lower()
        self.tags.append(normalized)
        if normalized in {"h1", "h2", "h3", "h4"}:
            self.headings.append(int(normalized[1]))
        if normalized == "img":
            self.images.append({str(name).lower(): str(value or "") for name, value in attrs})


def _length_error(
    value: str, minimum: int, maximum: int, code: str, field: str, label: str
) -> ValidationIssue | None:
    length = len((value or "").strip())
    if length < minimum or length > maximum:
        return ValidationIssue(
            code=code,
            field=field,
            message=f"{label} phải có từ {minimum} đến {maximum} ký tự.",
        )
    return None


def _canonical_valid(value: str) -> bool:
    if not value:
        return False
    parsed = urlparse(value)
    expected = urlparse(settings.PUBLIC_SITE_URL)
    return (
        parsed.scheme == "https"
        and bool(parsed.netloc)
        and parsed.netloc.casefold() == expected.netloc.casefold()
    )


def _internal_media_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc:
        return False
    return bool(
        re.fullmatch(r"/api/public/marketing-media/[a-f0-9]{32}", parsed.path)
        or parsed.path.startswith("/images/")
    )


def _report(errors: list[ValidationIssue], warnings: list[ValidationIssue]) -> ValidationReport:
    score = max(0, 100 - len(errors) * 15 - len(warnings) * 5)
    return ValidationReport(score=score, errors=errors, warnings=warnings)


def validate_article_for_publish(data: dict) -> ValidationReport:
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    seo = data.get("seo") or {}
    geo = data.get("geo") or {}
    gallery = data.get("gallery") or []

    for issue in [
        _length_error(data.get("title", ""), 20, 120, "TITLE_LENGTH", "title", "Tiêu đề"),
        _length_error(data.get("sapo", ""), 50, 250, "SAPO_LENGTH", "sapo", "Sapo"),
        _length_error(seo.get("meta_title", ""), 30, 60, "META_TITLE_LENGTH", "seo.meta_title", "Meta title"),
        _length_error(seo.get("meta_description", ""), 120, 160, "META_DESCRIPTION_LENGTH", "seo.meta_description", "Meta description"),
        _length_error(geo.get("answer_summary", ""), 50, 300, "GEO_SUMMARY_LENGTH", "geo.answer_summary", "Answer summary"),
    ]:
        if issue:
            errors.append(issue)

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", data.get("slug", "")):
        errors.append(ValidationIssue(code="INVALID_SLUG", field="slug", message="Slug không hợp lệ."))
    if not _canonical_valid(seo.get("canonical_url", "")):
        errors.append(ValidationIssue(code="INVALID_CANONICAL", field="seo.canonical_url", message="Canonical phải là URL HTTPS hợp lệ."))

    parser = _TextCounter()
    parser.feed(data.get("content", ""))
    words = re.findall(r"\b[\wÀ-ỹ]+\b", " ".join(parser.parts), flags=re.UNICODE)
    if len(words) < 300:
        errors.append(ValidationIssue(code="CONTENT_TOO_SHORT", field="content", message="Nội dung phải có ít nhất 300 từ."))
    if "h1" in parser.tags:
        errors.append(ValidationIssue(code="CONTENT_HAS_H1", field="content", message="Nội dung không được chứa H1; tiêu đề trang đã là H1."))
    if 2 not in parser.headings:
        errors.append(ValidationIssue(code="H2_MISSING", field="content", message="Nội dung phải có ít nhất một H2."))
    for previous, current in zip(parser.headings, parser.headings[1:]):
        if current > previous + 1:
            errors.append(ValidationIssue(code="HEADING_LEVEL_SKIPPED", field="content", message="Cấp heading không được nhảy bậc."))
            break
    valid_gallery = [
        image
        for image in gallery
        if str(image.get("url", "") if isinstance(image, dict) else getattr(image, "url", "")).strip()
    ]
    if not valid_gallery:
        errors.append(ValidationIssue(code="FEATURED_IMAGE_MISSING", field="gallery", message="Bài viết phải có ít nhất một ảnh."))
    for index, image in enumerate(gallery):
        image_url = str(
            image.get("url", "") if isinstance(image, dict) else getattr(image, "url", "")
        ).strip()
        if image_url and not _internal_media_url(image_url):
            errors.append(ValidationIssue(
                code="EXTERNAL_IMAGE_URL",
                field=f"gallery.{index}.url",
                message="Ảnh bài viết phải thuộc kho media nội bộ.",
            ))
        if not (image.get("alt_text", "") if isinstance(image, dict) else getattr(image, "alt_text", "")).strip():
            errors.append(ValidationIssue(code="IMAGE_ALT_MISSING", field=f"gallery.{index}.alt_text", message="Mọi ảnh phải có alt text."))
        credit = image.get("credit", "") if isinstance(image, dict) else getattr(image, "credit", "")
        if not str(credit).strip():
            warnings.append(ValidationIssue(code="IMAGE_CREDIT_MISSING", field=f"gallery.{index}.credit", message="Nên ghi nguồn ảnh."))
    for index, image in enumerate(parser.images):
        if not image.get("alt", "").strip():
            errors.append(ValidationIssue(code="INLINE_IMAGE_ALT_MISSING", field=f"content.image.{index}", message="Ảnh trong nội dung phải có alt text."))
        if image.get("src") and not _internal_media_url(image["src"]):
            errors.append(ValidationIssue(
                code="INLINE_IMAGE_EXTERNAL_URL",
                field=f"content.image.{index}",
                message="Ảnh trong nội dung phải thuộc kho media nội bộ.",
            ))
    if len([item for item in geo.get("key_facts", []) if str(item).strip()]) < 3:
        errors.append(ValidationIssue(code="GEO_KEY_FACTS_MISSING", field="geo.key_facts", message="Cần tối thiểu ba key facts."))
    valid_faqs = [item for item in geo.get("faqs", []) if item.get("question") and item.get("answer")]
    if len(valid_faqs) < 2:
        errors.append(ValidationIssue(code="GEO_FAQS_MISSING", field="geo.faqs", message="Cần tối thiểu hai FAQ."))
    category = getattr(data.get("category"), "value", data.get("category"))
    if category == "market" and not geo.get("sources"):
        errors.append(ValidationIssue(code="SOURCE_MISSING", field="geo.sources", message="Tin thị trường phải có nguồn tham khảo."))
    for index, source in enumerate(geo.get("sources", [])):
        title = str(source.get("title", "")).strip()
        url = str(source.get("url", "")).strip()
        parsed = urlparse(url)
        if not title or parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(
                ValidationIssue(
                    code="SOURCE_INVALID",
                    field=f"geo.sources.{index}",
                    message="Nguồn tham khảo phải có tên và URL HTTP(S) hợp lệ.",
                )
            )
    if not re.search(r'href=["\']/[^"\']+', data.get("content", "")):
        warnings.append(ValidationIssue(code="INTERNAL_LINK_MISSING", field="content", message="Nên có ít nhất một liên kết nội bộ."))
    return _report(errors, warnings)


def validate_project_for_publish(data: dict) -> ValidationReport:
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    seo = data.get("seo_metadata") or {}

    def mapping(value) -> dict:
        if isinstance(value, dict):
            return value
        if hasattr(value, "model_dump"):
            return value.model_dump()
        return {}
    seo = mapping(seo)

    def add_error(code: str, field: str, message: str, group: str) -> None:
        errors.append(ValidationIssue(code=code, field=field, message=message, group=group))

    def add_warning(code: str, field: str, message: str, group: str) -> None:
        warnings.append(ValidationIssue(code=code, field=field, message=message, group=group))

    required = {
        "name": "Tên dự án",
        "description": "Mô tả",
        "location": "Vị trí",
        "developer": "Chủ đầu tư",
    }
    for field, label in required.items():
        if not str(data.get(field, "")).strip():
            add_error(f"{field.upper()}_MISSING", field, f"{label} là bắt buộc.", "CONTENT")

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", str(data.get("slug") or "")):
        add_error("INVALID_SLUG", "slug", "Slug chỉ được dùng chữ thường, số và dấu gạch ngang.", "SEO")

    if not _canonical_valid(str(seo.get("canonical_url") or "")):
        add_error(
            "INVALID_CANONICAL",
            "seo_metadata.canonical_url",
            "Canonical must be a valid HTTPS URL.",
            "SEO",
        )

    hero_images = [item for item in (data.get("hero_images") or []) if str(item).strip()]
    gallery_images = [item for item in (data.get("images") or []) if str(item).strip()]
    if not (hero_images or gallery_images or str(data.get("hero_video_url") or "").strip()):
        add_error("HERO_MISSING", "hero_images", "Dự án phải có hero image hoặc video.", "MEDIA")
    if data.get("hero_video_url") and not str(seo.get("og_image") or "").strip():
        add_error("OG_IMAGE_MISSING", "hero_images", "Dự án dùng video vẫn cần một ảnh hero cho Open Graph.", "SEO")

    for value, minimum, maximum, code, field, label, group in [
        (seo.get("title", ""), 30, 60, "META_TITLE_LENGTH", "seo_metadata.title", "SEO title", "SEO"),
        (seo.get("description", ""), 120, 160, "META_DESCRIPTION_LENGTH", "seo_metadata.description", "SEO description", "SEO"),
        (seo.get("cornerstone_text", ""), 50, 1000, "GEO_SUMMARY_LENGTH", "seo_metadata.cornerstone_text", "Cornerstone summary", "GEO"),
    ]:
        issue = _length_error(value, minimum, maximum, code, field, label)
        if issue:
            issue.group = group
            errors.append(issue)

    focus_keyword = str(seo.get("focus_keyword") or "").strip()
    if not focus_keyword:
        add_error("FOCUS_KEYWORD_MISSING", "seo_metadata.focus_keyword", "Focus keyword là bắt buộc.", "SEO")
    keywords = {str(item).strip().casefold() for item in seo.get("keywords", []) if str(item).strip()}
    if len(keywords) < 3:
        add_error("KEYWORDS_MISSING", "seo_metadata.keywords", "Cần tối thiểu ba keyword không trùng nhau.", "SEO")

    if len([item for item in seo.get("usps", []) if str(item).strip()]) < 3:
        add_error("USP_MISSING", "seo_metadata.usps", "Cần tối thiểu ba USP.", "GEO")
    if len([item for item in seo.get("key_facts", []) if str(item).strip()]) < 3:
        add_error("KEY_FACTS_MISSING", "seo_metadata.key_facts", "Cần tối thiểu ba key fact.", "GEO")
    valid_faqs = [mapping(item) for item in seo.get("faqs", [])]
    valid_faqs = [item for item in valid_faqs if item.get("question") and item.get("answer")]
    if len(valid_faqs) < 2:
        add_error("FAQ_MISSING", "seo_metadata.faqs", "Cần tối thiểu hai FAQ đầy đủ.", "GEO")

    valid_sources = 0
    for index, raw_source in enumerate(seo.get("sources", [])):
        source = mapping(raw_source)
        title = str(source.get("title") or "").strip()
        url = str(source.get("url") or "").strip()
        parsed = urlparse(url)
        if title and parsed.scheme in {"http", "https"} and parsed.netloc:
            valid_sources += 1
        else:
            add_error("SOURCE_INVALID", f"seo_metadata.sources.{index}", "Nguồn phải có tên và URL HTTP(S) hợp lệ.", "GEO")
    if valid_sources < 1:
        add_error("SOURCE_MISSING", "seo_metadata.sources", "Cần tối thiểu một nguồn tham khảo.", "GEO")

    image_entries: list[tuple[str, str, str]] = []

    def add_image(field: str, label: str, value) -> None:
        url = str(value or "").strip()
        if url and all(existing[2] != url for existing in image_entries):
            image_entries.append((field, label, url))

    add_image("logo_url", "Logo dự án", data.get("logo_url"))
    for index, url in enumerate(hero_images):
        add_image(f"hero_images.{index}", f"Hero - ảnh {index + 1}", url)
    for index, url in enumerate(gallery_images):
        add_image(f"images.{index}", f"Thư viện chung - ảnh {index + 1}", url)
    overview_images = data.get("overview_images")
    if not overview_images and isinstance(data.get("stats"), dict):
        raw_ov = data["stats"].get("overview_images")
        if raw_ov:
            try:
                import json
                overview_images = json.loads(raw_ov)
            except Exception:
                pass
    has_overview_list = isinstance(overview_images, list) and any(str(x or "").strip() for x in overview_images)
    if has_overview_list:
        for index in range(min(3, len(overview_images))):
            ov_url = str(overview_images[index] or "").strip()
            if ov_url:
                add_image(f"overview_images.{index}", f"Ảnh tổng quan {index + 1}", ov_url)
    elif data.get("stats_bg_image"):
        add_image("stats_bg_image", "Tổng quan - ảnh nền", data.get("stats_bg_image"))
    add_image("contact_bg_image", "Liên hệ - ảnh nền", data.get("contact_bg_image"))
    add_image("location_map_image", "Vị trí - bản đồ tĩnh", data.get("location_map_image"))
    add_image("master_plan_image", "Mặt bằng - master plan", data.get("master_plan_image"))
    add_image("amenity_map_image", "Sơ đồ tiện ích chung", data.get("amenity_map_image"))
    for index, raw_block in enumerate(data.get("story_blocks") or []):
        block = mapping(raw_block)
        add_image(f"story_blocks.{index}.image_url", f"Câu chuyện - khối {index + 1}", block.get("image_url"))
    for index, raw_item in enumerate(data.get("highlights") or []):
        item = mapping(raw_item)
        add_image(
            f"highlights.{index}.image",
            f"Điểm nổi bật - {item.get('title') or f'mục {index + 1}'}",
            item.get("image"),
        )
    for floor_index, raw_floor in enumerate(data.get("amenity_floors") or []):
        floor = mapping(raw_floor)
        floor_label = str(floor.get("floor_label") or f"tầng/khu {floor_index + 1}")
        add_image(
            f"amenity_floors.{floor_index}.floor_map_image",
            f"Sơ đồ tiện ích - {floor_label}",
            floor.get("floor_map_image"),
        )
        amenities = [mapping(item) for item in floor.get("amenities") or []]
        for item_index, item in enumerate(amenities):
            add_image(
                f"amenity_floors.{floor_index}.amenities.{item_index}.image_url",
                f"Tiện ích {floor_label} - {item.get('name') or f'mục {item_index + 1}'}",
                item.get("image_url"),
            )
    for index, raw_item in enumerate(data.get("amenity_gallery") or []):
        item = mapping(raw_item)
        add_image(
            f"amenity_gallery.{index}.image_url",
            f"Thư viện tiện ích - {item.get('name') or f'ảnh {index + 1}'}",
            item.get("image_url"),
        )
    for group_index, raw_group in enumerate(data.get("floor_layouts") or []):
        group = mapping(raw_group)
        group_label = str(group.get("group_name") or f"nhóm {group_index + 1}")
        add_image(
            f"floor_layouts.{group_index}.floor_map_image",
            f"Mặt bằng - {group_label}",
            group.get("floor_map_image"),
        )
        unit_layouts = [mapping(item) for item in group.get("unit_layouts") or []]
        for item_index, item in enumerate(unit_layouts):
            add_image(
                f"floor_layouts.{group_index}.unit_layouts.{item_index}.image_url",
                f"Mẫu căn {group_label} - {item.get('name') or f'mẫu {item_index + 1}'}",
                item.get("image_url"),
            )
    for tower_index, raw_tower in enumerate(data.get("towers") or []):
        tower = mapping(raw_tower)
        tower_label = tower.get("name") or tower.get("id") or str(tower_index + 1)
        for image_index, url in enumerate(tower.get("floor_plan_images") or []):
            add_image(
                f"towers.{tower_index}.floor_plan_images.{image_index}",
                f"Tháp {tower_label} - mặt bằng {image_index + 1}",
                url,
            )

    alt_by_url = {
        str(mapping(item).get("url") or "").strip(): str(mapping(item).get("alt_text") or "").strip()
        for item in seo.get("image_alts", [])
        if str(mapping(item).get("url") or "").strip()
    }
    metadata_by_field = {
        str(mapping(item).get("field") or "").strip(): mapping(item)
        for item in data.get("image_metadata") or []
        if str(mapping(item).get("field") or "").strip()
    }

    def minimum_size(field: str) -> tuple[int, int]:
        if field == "logo_url":
            return (480, 0)
        if field.startswith("hero_images") or field == "contact_bg_image":
            return (1600, 900)
        if field == "stats_bg_image" and not has_overview_list:
            return (1600, 900)
        if field.startswith("overview_images.") or field == "stats_bg_image":
            return (1200, 0)
        if field.startswith("story_blocks."):
            return (900, 900)
        if ".unit_layouts." in field and field.endswith(".image_url"):
            return (600, 500)
        if (
            str(data.get("amenity_template") or "").upper() == "GLOBAL"
            and field.startswith("amenity_floors.")
            and field.endswith(".floor_map_image")
        ):
            return (1200, 300)
        if (
            field in {"master_plan_image", "amenity_map_image", "location_map_image"}
            or ".floor_map_image" in field
            or ".floor_plan_images." in field
        ):
            return (900, 900)
        return (1200, 0)

    for field, label, url in image_entries:
        metadata = metadata_by_field.get(field)
        if not metadata and field == "stats_bg_image":
            metadata = metadata_by_field.get("overview_images.0")
        if not metadata:
            metadata = next(
                (mapping(m) for m in (data.get("image_metadata") or []) if str(mapping(m).get("url") or "").strip() == url),
                {},
            )
        alt_text = str(metadata.get("alt_text") or alt_by_url.get(url) or "").strip()
        if not alt_text:
            add_error("IMAGE_ALT_MISSING", field, f"Thiếu alt ảnh tại: {label}.", "MEDIA")
        if url.startswith(("http://", "https://")):
            add_error(
                "EXTERNAL_IMAGE_URL",
                field,
                f"{label} phải được tải lên kho media nội bộ.",
                "MEDIA",
            )
        if metadata:
            width = int(metadata.get("width") or 0)
            height = int(metadata.get("height") or 0)
            min_width, min_height = minimum_size(field)
            if width < min_width or (min_height and height < min_height):
                expected = f"{min_width}×{min_height}px" if min_height else f"rộng tối thiểu {min_width}px"
                add_error(
                    "IMAGE_DIMENSIONS_TOO_SMALL",
                    field,
                    f"{label} có kích thước {width}×{height}px; yêu cầu {expected}.",
                    "MEDIA",
                )
            variants = metadata.get("variants")
            if not isinstance(variants, dict) or not {
                "thumbnail_webp", "medium_webp", "large_webp"
            }.issubset(variants):
                add_error(
                    "IMAGE_VARIANTS_MISSING",
                    field,
                    f"{label} chưa có đủ biến thể ảnh tối ưu.",
                    "MEDIA",
                )
            if field == "hero_images.0" and (
                not isinstance(variants, dict) or "og_webp" not in variants
            ):
                add_error(
                    "OG_IMAGE_VARIANT_MISSING",
                    field,
                    f"{label} thiếu biến thể Open Graph 1200×630.",
                    "MEDIA",
                )
        elif "/api/public/marketing-media/" in url:
            add_error(
                "IMAGE_METADATA_MISSING",
                field,
                f"{label} chưa có metadata kích thước và điểm trọng tâm.",
                "MEDIA",
            )

    if not data.get("contact_phone") and not data.get("contact_email"):
        add_warning("CONTACT_MISSING", "contact_phone", "Nên có thông tin liên hệ riêng cho dự án.", "CONTENT")
    if not str(data.get("price_range") or "").strip() or str(data.get("price_range") or "").strip().casefold() == "đang cập nhật":
        add_warning("PRICE_PLACEHOLDER", "price_range", "Nên cập nhật khoảng giá cụ thể.", "CONTENT")
    searchable = f'{seo.get("title", "")} {seo.get("description", "")}'.casefold()
    if focus_keyword and focus_keyword.casefold() not in searchable:
        add_warning("FOCUS_KEYWORD_NOT_USED", "seo_metadata.focus_keyword", "Focus keyword nên xuất hiện trong SEO title hoặc description.", "SEO")
    has_stories = bool(data.get("story_blocks") or [])
    has_amenities = bool(data.get("amenity_floors") or [])
    if not has_stories and not has_amenities:
        add_warning("PUBLIC_SECTION_THIN", "story_blocks", "Nên bổ sung câu chuyện và tiện ích để trang dự án đầy đủ hơn.", "CONTENT")
    elif not has_stories:
        add_warning("PUBLIC_SECTION_THIN", "story_blocks", "Nên bổ sung thêm khối câu chuyện giới thiệu dự án.", "CONTENT")
    elif not has_amenities:
        add_warning("PUBLIC_SECTION_THIN", "amenity_floors", "Nên bổ sung thêm danh mục hoặc hình ảnh tiện ích dự án.", "CONTENT")
    return _report(errors, warnings)
