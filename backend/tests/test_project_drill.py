from contextlib import asynccontextmanager
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.content.common.enums import MarketingAction, PublicationStatus, WorkflowStatus
from app.modules.content.projects.schemas import ProjectCreateRequest
from app.modules.content.projects.service import ProjectApplicationService
from app.modules.content.seo_geo.validators import validate_project_for_publish
from app.modules.content.workflow.policies import assert_can_edit, assert_transition_allowed


STAFF_A = {"id": "staff-a", "role": "MARKETING_STAFF"}
STAFF_B = {"id": "staff-b", "role": "MARKETING_STAFF"}
MANAGER = {"id": "manager-1", "role": "MARKETING_MANAGER"}


@asynccontextmanager
async def fake_transaction():
    yield None


async def fake_execute_once(*, key, scope, actor_id, operation):
    return await operation()


def valid_project_payload():
    return {
        "name": "The Privé Luxury Residences",
        "slug": "the-prive-luxury-residences",
        "description": "Dự án căn hộ nghỉ dưỡng hạng sang tọa lạc tại vị trí đắc địa với thiết kế kiến trúc chuẩn quốc tế.",
        "location": "Thành phố Thủ Đức, TP. Hồ Chí Minh",
        "developer": "Tập đoàn Đất Xanh",
        "hero_images": ["/api/public/marketing-media/11111111111111111111111111111111"],
        "images": ["/api/public/marketing-media/22222222222222222222222222222222"],
        "image_metadata": [
            {
                "url": "/api/public/marketing-media/11111111111111111111111111111111",
                "alt_text": "Phối cảnh tổng thể dự án The Prive",
                "field": "hero_images.0",
            },
            {
                "url": "/api/public/marketing-media/22222222222222222222222222222222",
                "alt_text": "Hồ bơi vô cực dự án The Prive",
                "field": "images.0",
            },
        ],
        "seo_metadata": {
            "title": "The Privé - Dự án căn hộ hạng sang TP.HCM",
            "description": "Khám phá dự án The Privé với vị trí chiến lược, hệ tiện ích cao cấp, thiết kế hiện đại và chính sách bán hàng ưu đãi từ Maian Homes.",
            "focus_keyword": "The Prive",
            "keywords": ["The Prive", "căn hộ hạng sang", "bất động sản TP.HCM"],
            "cornerstone_text": "The Privé là dự án căn hộ cao cấp được quy hoạch đồng bộ phục vụ nhu cầu sống thượng lưu.",
            "usps": ["Vị trí trung tâm", "Tiện ích 5 sao", "Pháp lý hoàn chỉnh"],
            "key_facts": ["Vị trí Thủ Đức TP.HCM", "Chủ đầu tư uy tín", "Bàn giao hoàn thiện"],
            "faqs": [
                {"question": "Vị trí dự án ở đâu?", "answer": "Tại TP. Thủ Đức, TP. Hồ Chí Minh."},
                {"question": "Khi nào bàn giao?", "answer": "Dự kiến bàn giao quý IV năm 2026."},
            ],
            "sources": [
                {"title": "Tập đoàn Đất Xanh", "url": "https://datxanh.vn/du-an-the-prive"}
            ],
            "canonical_url": "https://maianhomes.vn/du_an/the-prive-luxury-residences",
        },
        "idempotency_key": "drill-create-key-001",
    }


class ProjectLifecycleExceptionDrillTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = ProjectApplicationService()

    # --- 1. KIỂM TRA LỖI VALIDATION ĐẦU VÀO ---
    def test_create_project_missing_required_fields_throws_validation_error(self):
        invalid_data = {
            "name": "Dự án thiếu thông tin",
            # Thiếu: location, description, slug, idempotency_key
        }
        with self.assertRaises(ValidationError) as caught:
            ProjectCreateRequest(**invalid_data)
        
        errors = caught.exception.errors()
        missing_fields = {err["loc"][0] for err in errors}
        self.assertIn("location", missing_fields)
        self.assertIn("description", missing_fields)
        self.assertIn("slug", missing_fields)
        self.assertIn("idempotency_key", missing_fields)

    async def test_create_project_invalid_slug_throws_422(self):
        with self.assertRaises(HTTPException) as caught:
            await self.service._validate_slug("Du An Sai Gon Co Dau & Ky Tu!")
        
        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(caught.exception.detail["code"], "INVALID_SLUG")

    async def test_create_project_duplicate_slug_throws_409_conflict(self):
        with patch.object(self.service.repository, "slug_exists", AsyncMock(return_value=True)):
            with self.assertRaises(HTTPException) as caught:
                await self.service._validate_slug("the-prive-luxury-residences")
        
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(caught.exception.detail["code"], "SLUG_CONFLICT")

    # --- 2. KIỂM TRA LỖI PHÂN QUYỀN RBAC ---
    def test_staff_cannot_edit_other_staff_project_throws_403(self):
        project_doc = {
            "_id": ObjectId(),
            "created_by": "staff-a",
            "publication_status": PublicationStatus.NEVER_PUBLISHED.value,
            "workflow_status": WorkflowStatus.DRAFT.value,
        }
        with self.assertRaises(HTTPException) as caught:
            assert_can_edit(project_doc, STAFF_B)
        
        self.assertEqual(caught.exception.status_code, 403)
        self.assertIn("chỉ được sửa nội dung do mình tạo", caught.exception.detail)

    def test_owner_can_edit_project_without_review_lock(self):
        project_doc = {
            "_id": ObjectId(),
            "created_by": "staff-a",
            "publication_status": PublicationStatus.NEVER_PUBLISHED.value,
            "workflow_status": WorkflowStatus.DRAFT.value,
        }
        assert_can_edit(project_doc, STAFF_A)

    def test_staff_cannot_publish_without_publish_permission(self):
        project_doc = {
            "_id": ObjectId(),
            "created_by": "staff-a",
            "publication_status": PublicationStatus.NEVER_PUBLISHED.value,
            "workflow_status": WorkflowStatus.DRAFT.value,
        }
        with self.assertRaises(HTTPException) as caught:
            assert_transition_allowed(project_doc, MarketingAction.PUBLISH, STAFF_A)
        self.assertEqual(caught.exception.status_code, 403)

    # --- 3. KIỂM TRA LỖI CỔNG CHẤT LƯỢNG (QUALITY GATE) KHI XUẤT BẢN ---
    def test_quality_gate_rejects_project_without_hero_media_throws_422(self):
        data = valid_project_payload()
        data["hero_images"] = []
        data["images"] = []
        report = validate_project_for_publish(data)
        
        error_codes = {issue.code for issue in report.errors}
        self.assertIn("HERO_MISSING", error_codes)
        self.assertLess(report.score, 100)

    def test_quality_gate_rejects_project_with_invalid_seo_lengths(self):
        data = valid_project_payload()
        # Title quá ngắn (< 30 ký tự)
        data["seo_metadata"]["title"] = "Quá ngắn"
        # Description quá ngắn (< 120 ký tự)
        data["seo_metadata"]["description"] = "Mô tả sơ sài dưới 120 ký tự"
        
        report = validate_project_for_publish(data)
        error_codes = {issue.code for issue in report.errors}
        self.assertIn("META_TITLE_LENGTH", error_codes)
        self.assertIn("META_DESCRIPTION_LENGTH", error_codes)

    def test_quality_gate_rejects_project_with_insufficient_key_facts_or_faqs(self):
        data = valid_project_payload()
        data["seo_metadata"]["key_facts"] = ["Chỉ có 1 fact"]
        data["seo_metadata"]["faqs"] = []
        
        report = validate_project_for_publish(data)
        error_codes = {issue.code for issue in report.errors}
        self.assertIn("KEY_FACTS_MISSING", error_codes)
        self.assertIn("FAQ_MISSING", error_codes)

    # --- 4. KIỂM TRA LỖI XUNG ĐỘT PHIÊN BẢN (OPTIMISTIC LOCK / CONCURRENCY) ---
    async def test_update_project_with_wrong_expected_version_throws_409(self):
        project_id = str(ObjectId())
        root_doc = {
            "_id": ObjectId(project_id),
            "created_by": "staff-a",
            "version": 3,
            "publication_status": "NEVER_PUBLISHED",
            "workflow_status": "DRAFT",
        }
        mock_request = SimpleNamespace(
            model_dump=lambda **kwargs: {"name": "Tên mới", "expected_version": 1, "idempotency_key": "k-123"}
        )
        with patch.object(self.service.repository, "find_root", AsyncMock(return_value=root_doc)), \
             patch.object(self.service.repository, "get_draft", AsyncMock(return_value=None)), \
             patch.object(self.service, "_validate_slug", AsyncMock()), \
             patch.object(self.service.repository, "save_draft", AsyncMock(return_value=None)), \
             patch("app.modules.content.projects.service.execute_once", side_effect=fake_execute_once), \
             patch("app.modules.content.projects.service.marketing_transaction", fake_transaction):
            
            with self.assertRaises(HTTPException) as caught:
                await self.service.update(project_id, mock_request, STAFF_A)
            
            self.assertEqual(caught.exception.status_code, 409)
            self.assertEqual(caught.exception.detail["code"], "VERSION_CONFLICT")

class TestOptionalIdempotencyKeyDependency(unittest.IsolatedAsyncioTestCase):
    async def test_returns_none_when_header_is_none_or_fastapi_header_object(self):
        from fastapi import Header
        from app.api.deps_idempotency import get_optional_idempotency_key

        self.assertIsNone(await get_optional_idempotency_key(None))
        self.assertIsNone(await get_optional_idempotency_key(Header(default=None)))
        self.assertIsNone(await get_optional_idempotency_key("   "))

    async def test_returns_normalized_string_when_valid(self):
        from app.api.deps_idempotency import get_optional_idempotency_key

        self.assertEqual(
            await get_optional_idempotency_key("  valid-key-12345  "),
            "valid-key-12345",
        )

    async def test_throws_422_when_key_exceeds_128_chars(self):
        from app.api.deps_idempotency import get_optional_idempotency_key

        with self.assertRaises(HTTPException) as caught:
            await get_optional_idempotency_key("a" * 129)
        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(caught.exception.detail, "Khóa Idempotency-Key không hợp lệ")


if __name__ == "__main__":
    unittest.main()
