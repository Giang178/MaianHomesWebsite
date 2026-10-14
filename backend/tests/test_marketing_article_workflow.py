import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.modules.content.articles.service import ArticleApplicationService
from app.modules.content.common.audit import record_audit
from app.modules.content.common.enums import MarketingAction
from app.modules.content.workflow.schemas import TransitionRequest


class ArticleWarningOverrideTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = ArticleApplicationService()
        self.service.repository = AsyncMock()
        self.service.repository.root.return_value = {
            "_id": "article-1",
            "created_by": "staff-1",
            "workflow_status": "DRAFT",
            "publication_status": "NEVER_PUBLISHED",
        }
        self.service.repository.draft.return_value = {
            "payload": {"title": "Draft"},
        }

    async def test_staff_cannot_override_quality_warnings(self):
        request = TransitionRequest(
            action=MarketingAction.PUBLISH,
            expected_version=1,
            idempotency_key="request-1234",
            note="Ignore warnings",
            override_warning_codes=["INTERNAL_LINK_MISSING"],
        )
        with self.assertRaises(HTTPException) as caught:
            await self.service.transition(
                "article-1",
                request,
                {"id": "staff-1", "role": "MARKETING_STAFF"},
            )
        self.assertEqual(caught.exception.status_code, 403)

    async def test_manager_override_requires_a_reason(self):
        request = TransitionRequest(
            action=MarketingAction.PUBLISH,
            expected_version=1,
            idempotency_key="request-1234",
            override_warning_codes=["INTERNAL_LINK_MISSING"],
        )
        with self.assertRaises(HTTPException) as caught:
            await self.service.transition(
                "article-1",
                request,
                {"id": "manager-1", "role": "MARKETING_MANAGER"},
            )
        self.assertEqual(caught.exception.status_code, 422)


class ArticleWarningAuditTests(unittest.IsolatedAsyncioTestCase):
    async def test_warning_codes_and_reason_are_recorded_in_audit_metadata(self):
        with patch(
            "app.modules.content.common.audit.record_event",
            AsyncMock(),
        ) as record_event:
            await record_audit(
                entity_type="ARTICLE",
                entity_id="article-1",
                action="publish",
                actor={"id": "manager-1", "role": "MARKETING_MANAGER"},
                note="Source is being updated",
                metadata={
                    "override_warning_codes": ["IMAGE_CREDIT_MISSING"],
                    "override_reason": "Source is being updated",
                },
            )

        metadata = record_event.await_args.kwargs["metadata"]
        self.assertEqual(metadata["override_warning_codes"], ["IMAGE_CREDIT_MISSING"])
        self.assertEqual(metadata["override_reason"], "Source is being updated")
        self.assertEqual(metadata["note"], "Source is being updated")


if __name__ == "__main__":
    unittest.main()
