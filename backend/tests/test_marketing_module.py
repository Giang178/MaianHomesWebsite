import ast
from pathlib import Path

from fastapi import HTTPException

from app.modules.content.common.enums import MarketingAction
from app.modules.content.projects.mappers import serialize_document
from app.modules.content.projects.service import ProjectApplicationService
from app.modules.content.articles.repository import admin_article_status
from app.modules.content.seo_geo.html_sanitizer import sanitize_marketing_html
from app.modules.content.seo_geo.validators import (
    validate_article_for_publish,
    validate_project_for_publish,
)
from app.modules.content.workflow.policies import (
    assert_can_edit,
    assert_transition_allowed,
)


STAFF = {"id": "staff-1", "role": "MARKETING_STAFF"}
MANAGER = {"id": "manager-1", "role": "MARKETING_MANAGER"}


def article_payload():
    return {
        "title": "Phân tích thị trường bất động sản cao cấp năm 2026",
        "slug": "phan-tich-thi-truong-bat-dong-san-cao-cap-2026",
        "category": "market",
        "sapo": "Báo cáo tổng hợp thị trường bất động sản cao cấp tại Việt Nam trong năm 2026.",
        "content": "<h2>Tổng quan</h2><p>" + "thị trường " * 310 + '</p><a href="/du_an">Dự án</a>',
        "gallery": [{"url": "/images/test.jpg", "alt_text": "Toàn cảnh dự án"}],
        "seo": {
            "meta_title": "Phân tích thị trường bất động sản cao cấp",
            "meta_description": "Báo cáo chuyên sâu về thị trường bất động sản cao cấp, xu hướng nguồn cung, nhu cầu và cơ hội đầu tư đáng chú ý trong năm 2026.",
            "canonical_url": "https://maianhomes.vn/tin_tuc/phan-tich-thi-truong-bat-dong-san-cao-cap-2026",
        },
        "geo": {
            "answer_summary": "Thị trường bất động sản cao cấp năm 2026 có sự phân hóa rõ rệt theo vị trí, chất lượng và năng lực của chủ đầu tư.",
            "key_facts": ["Nguồn cung chọn lọc", "Nhu cầu ổn định", "Pháp lý được ưu tiên"],
            "faqs": [
                {"question": "Thị trường ra sao?", "answer": "Nguồn cung đang được chọn lọc."},
                {"question": "Yếu tố quan trọng?", "answer": "Vị trí và pháp lý."},
            ],
            "sources": [{"title": "Báo cáo thị trường", "url": "https://example.com/report"}],
        },
    }


def test_article_quality_gate_accepts_complete_content():
    report = validate_article_for_publish(article_payload())
    assert report.errors == []
    assert report.score >= 90


def test_article_quality_gate_rejects_unsafe_or_incomplete_content():
    payload = article_payload()
    payload["content"] = "<h1>Sai</h1><p>ngắn</p>"
    payload["gallery"][0]["alt_text"] = ""
    report = validate_article_for_publish(payload)
    assert {"CONTENT_TOO_SHORT", "CONTENT_HAS_H1", "IMAGE_ALT_MISSING"} <= {
        issue.code for issue in report.errors
    }


def test_html_sanitizer_removes_script_and_event_handlers():
    clean = sanitize_marketing_html(
        '<p onclick="alert(1)">Nội dung</p><script>alert(1)</script>'
    )
    assert "<script" not in clean
    assert "onclick" not in clean
    assert "<p>Nội dung</p>" in clean


def test_html_sanitizer_keeps_whitelisted_figure_metadata_only():
    clean = sanitize_marketing_html(
        '<figure data-media-id="abc123" data-size="medium" data-align="center" '
        'style="position:fixed"><img src="/marketing-media/abc123" alt="Project" '
        'loading="lazy" onerror="alert(1)"><figcaption data-caption="View" '
        'data-credit="Maian Homes">View</figcaption></figure>'
    )
    assert 'data-media-id="abc123"' in clean
    assert 'data-size="medium"' in clean
    assert 'data-credit="Maian Homes"' in clean
    assert 'loading="lazy"' in clean
    assert "style=" not in clean
    assert "onerror=" not in clean


def test_project_quality_gate():
    report = validate_project_for_publish(
        {
            "name": "The Privé",
            "slug": "the-prive",
            "description": "Dự án căn hộ cao cấp",
            "location": "TP. Hồ Chí Minh",
            "developer": "Tập đoàn Đất Xanh",
            "hero_images": ["/api/public/marketing-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
            "location_map_image": "/api/public/marketing-media/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "story_blocks": [{
                "title": "Câu chuyện",
                "content": "Nguồn cảm hứng của dự án",
                "image_url": "/api/public/marketing-media/cccccccccccccccccccccccccccccccc",
                "alignment": "left",
            }],
            "amenity_template": "GLOBAL",
            "amenity_floors": [{
                "floor_label": "Phân khu hồ bơi",
                "floor_map_image": "/api/public/marketing-media/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "amenities": [],
            }],
            "floor_layouts": [{
                "group_name": "Tầng điển hình",
                "floors": [2],
                "floor_map_image": "",
                "hotspots": [],
                "unit_layouts": [{
                    "name": "Căn 2 phòng ngủ",
                    "image_url": "/api/public/marketing-media/dddddddddddddddddddddddddddddddd",
                }],
            }],
            "contact_phone": "0900000000",
            "seo_metadata": {
                "canonical_url": "https://maianhomes.vn/du_an/the-prive",
                "title": "The Privé - Dự án căn hộ cao cấp tại TP.HCM",
                "description": "Khám phá dự án The Privé với vị trí chiến lược, hệ tiện ích cao cấp, thiết kế hiện đại và thông tin tư vấn chính xác từ Maian Homes.",
                "focus_keyword": "dự án The Privé",
                "keywords": ["dự án The Privé", "căn hộ cao cấp", "bất động sản TP.HCM"],
                "cornerstone_text": "The Privé là dự án căn hộ cao cấp được phát triển cho nhu cầu an cư và đầu tư dài hạn.",
                "usps": ["Vị trí", "Tiện ích", "Thiết kế"],
                "key_facts": ["Vị trí TP.HCM", "Phân khúc cao cấp", "Tư vấn Maian Homes"],
                "faqs": [
                    {"question": "Dự án ở đâu?", "answer": "TP.HCM"},
                    {"question": "Ai tư vấn?", "answer": "Maian Homes"},
                ],
                "sources": [{"title": "Trang chính thức", "url": "https://example.com/the-prive"}],
                "image_alts": [{"url": "/api/public/marketing-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "alt_text": "Toàn cảnh dự án The Privé"}],
            },
            "image_metadata": [{
                "field": "hero_images.0",
                "media_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "url": "/api/public/marketing-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "alt_text": "Toàn cảnh dự án The Privé",
                "width": 1600,
                "height": 900,
                "focal_x": 50,
                "focal_y": 50,
                "variants": {
                    "thumbnail_webp": "/media/hero?variant=thumbnail_webp",
                    "medium_webp": "/media/hero?variant=medium_webp",
                    "large_webp": "/media/hero?variant=large_webp",
                    "og_webp": "/media/hero?variant=og_webp",
                },
            }, {
                "field": "location_map_image",
                "media_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "url": "/api/public/marketing-media/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "alt_text": "Bản đồ vị trí dự án",
                "width": 900,
                "height": 900,
                "focal_x": 50,
                "focal_y": 50,
                "variants": {
                    "thumbnail_webp": "/media/map?variant=thumbnail_webp",
                    "medium_webp": "/media/map?variant=medium_webp",
                    "large_webp": "/media/map?variant=large_webp",
                },
            }, {
                "field": "story_blocks.0.image_url",
                "media_id": "cccccccccccccccccccccccccccccccc",
                "url": "/api/public/marketing-media/cccccccccccccccccccccccccccccccc",
                "alt_text": "Câu chuyện dự án",
                "width": 900,
                "height": 900,
                "focal_x": 50,
                "focal_y": 50,
                "variants": {
                    "thumbnail_webp": "/media/story?variant=thumbnail_webp",
                    "medium_webp": "/media/story?variant=medium_webp",
                    "large_webp": "/media/story?variant=large_webp",
                },
            }, {
                "field": "amenity_floors.0.floor_map_image",
                "media_id": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "url": "/api/public/marketing-media/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "alt_text": "Mặt bằng tiện ích phân khu hồ bơi",
                "width": 1200,
                "height": 300,
                "focal_x": 50,
                "focal_y": 50,
                "variants": {
                    "thumbnail_webp": "/media/amenity?variant=thumbnail_webp",
                    "medium_webp": "/media/amenity?variant=medium_webp",
                    "large_webp": "/media/amenity?variant=large_webp",
                },
            }, {
                "field": "floor_layouts.0.unit_layouts.0.image_url",
                "media_id": "dddddddddddddddddddddddddddddddd",
                "url": "/api/public/marketing-media/dddddddddddddddddddddddddddddddd",
                "alt_text": "Layout căn hộ hai phòng ngủ",
                "width": 600,
                "height": 500,
                "focal_x": 50,
                "focal_y": 50,
                "variants": {
                    "thumbnail_webp": "/media/unit?variant=thumbnail_webp",
                    "medium_webp": "/media/unit?variant=medium_webp",
                    "large_webp": "/media/unit?variant=large_webp",
                },
            }],
        }
    )
    assert report.errors == []


def test_project_metadata_is_generated_from_single_site_origin():
    prepared = ProjectApplicationService._prepare_payload({
        "slug": "the-prive",
        "hero_images": ["/hero.jpg"],
        "seo_metadata": {"title": "SEO title", "description": "SEO description"},
    })
    seo = prepared["seo_metadata"]
    assert seo["canonical_url"].endswith("/du_an/the-prive")
    assert seo["canonical_url"].startswith("https://")
    assert seo["og_title"] == "SEO title"
    assert seo["og_description"] == "SEO description"
    assert seo["og_image"] == "/hero.jpg"


def test_project_metadata_tolerates_malformed_legacy_values():
    prepared = ProjectApplicationService._prepare_payload({
        "slug": "legacy-project",
        "hero_images": None,
        "images": "not-an-array",
        "seo_metadata": "not-an-object",
    })
    assert prepared["seo_metadata"]["og_image"] == ""


def test_staff_ownership_and_manager_permissions():
    document = {
        "created_by": "staff-1",
        "workflow_status": "DRAFT",
        "publication_status": "NEVER_PUBLISHED",
    }
    assert_can_edit(document, STAFF)
    assert_transition_allowed(document, MarketingAction.PUBLISH, MANAGER)
    try:
        assert_transition_allowed(document, MarketingAction.PUBLISH, STAFF)
    except HTTPException:
        pass
    else:
        raise AssertionError('Staff publish must be rejected')


def test_transferred_article_uses_editor_owner_not_original_author():
    transferred = {
        "created_by": "staff-1",
        "author_id": "staff-1",
        "editor_owner_id": "staff-2",
        "workflow_status": "DRAFT",
        "publication_status": "NEVER_PUBLISHED",
    }
    assert_can_edit(transferred, {"id": "staff-2", "role": "MARKETING_STAFF"})
    try:
        assert_can_edit(transferred, STAFF)
    except HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("Original author must lose edit permission after transfer")


def test_archived_content_cannot_be_edited_or_published():
    archived = {
        "created_by": "staff-1",
        "workflow_status": "APPROVED",
        "publication_status": "ARCHIVED",
    }
    for operation in (
        lambda: assert_can_edit(archived, MANAGER),
        lambda: assert_transition_allowed(archived, MarketingAction.PUBLISH, MANAGER),
    ):
        try:
            operation()
        except HTTPException as exc:
            assert exc.status_code == 409
        else:
            raise AssertionError("Archived content must be restored first")


def test_admin_article_status_keeps_publication_state_separate():
    assert admin_article_status({
        "workflow_status": "APPROVED",
        "publication_status": "UNPUBLISHED",
        "status": "draft",
    }) == "unpublished"
    assert admin_article_status({
        "workflow_status": "APPROVED",
        "publication_status": "ARCHIVED",
        "status": "archived",
    }) == "archived"
    assert admin_article_status({
        "workflow_status": "PUBLISHED",
        "publication_status": "PUBLISHED",
        "status": "published",
    }) == "published"


def test_public_mapper_removes_workflow_metadata():
    mapped = serialize_document(
        {
            "name": "Project",
            "slug": "project",
            "workflow_status": "APPROVED",
            "publication_status": "PUBLISHED",
            "created_by": "staff-1",
            "assigned_staff_id": "employee-private",
            "lead_routing": {"sales_ids": ["sales-private"]},
            "future_internal_field": "must-not-leak",
            "version": 3,
        },
        public=True,
    )
    assert mapped["name"] == "Project"
    assert "workflow_status" not in mapped
    assert "assigned_staff_id" not in mapped
    assert "lead_routing" not in mapped
    assert "future_internal_field" not in mapped
    assert mapped["seo_metadata"]["key_facts"] == []


def test_public_project_summary_is_bounded():
    mapped = serialize_document(
        {
            "name": "Project",
            "slug": "project",
            "description": "Large detail",
            "images": ["one.jpg", "two.jpg"],
            "hero_images": ["hero-one.jpg", "hero-two.jpg"],
            "marketing_tags": ["First", "Second"],
            "floor_layouts": [{"large": "payload"}],
        },
        public=True,
        summary=True,
    )
    assert mapped["images"] == ["one.jpg"]
    assert mapped["hero_images"] == ["hero-one.jpg"]
    assert mapped["marketing_tags"] == ["First"]
    assert "description" not in mapped
    assert "floor_layouts" not in mapped


def test_marketing_routes_do_not_access_database_directly():
    root = Path(__file__).parents[1] / "app" / "modules" / "content"
    violations = []
    for relative in [
        "projects/api.py",
        "projects/public_api.py",
        "articles/api.py",
        "articles/public_api.py",
    ]:
        path = root / relative
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "app.db.mongodb":
                violations.append(relative)
    assert not violations
