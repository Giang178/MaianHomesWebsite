import inspect
import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.api.protected.ai import ProjectSEOSourceInput, SEORequest, SEOSourceInput, generate_article_seo_geo, generate_project_seo
from app.modules.content.common.dependencies import marketing_user
from app.modules.content.assistant.knowledge_service import ChatKnowledgeService, KnowledgeResult
from app.modules.content.assistant.grounded_service import (
    answer_passes_evidence_guard,
    generate_grounded_answer,
    language_matches,
)
from app.modules.content.assistant.seo_service import (
    ProjectSEOSuggestion,
    SEOGenerationService,
    evidence_validation,
    is_evidence_supported,
    supported_evidence_payload,
)


class StubKnowledge(ChatKnowledgeService):
    def __init__(self, bundle: dict):
        self.bundle = bundle

    async def _load_bundle(self) -> dict:
        return self.bundle


class TestMayaReleaseContract(unittest.IsolatedAsyncioTestCase):
    async def test_company_name_is_answered_deterministically_in_both_languages(self):
        knowledge = KnowledgeResult(
            facts=[
                {
                    "id": "company:company_name",
                    "field": "company_name",
                    "value": "Maian Homes",
                    "text": "company_name: Maian Homes",
                }
            ],
            sources=[
                {
                    "title": "Giới thiệu Maian Homes",
                    "url": "/gioi-thieu",
                    "type": "company",
                }
            ],
            intent="company",
        )
        with patch(
            "app.modules.content.assistant.grounded_service.OllamaService.get_client",
            side_effect=AssertionError("Gemini must not be called for an exact company name"),
        ):
            vi_result = await generate_grounded_answer(
                [{"role": "user", "content": "Công ty tên gì?"}],
                knowledge,
                "vi",
            )
            en_result = await generate_grounded_answer(
                [{"role": "user", "content": "What is the company name?"}],
                knowledge,
                "en",
            )

        self.assertEqual(vi_result["answer"], "Tên công ty là Maian Homes.")
        self.assertEqual(en_result["answer"], "The company name is Maian Homes.")
        self.assertEqual(vi_result["status"], "ok")
        self.assertEqual(vi_result["reason"], "deterministic")

    async def test_multi_topic_company_question_uses_grounded_generation(self):
        knowledge = KnowledgeResult(
            facts=[
                {
                    "id": "company:company_name",
                    "field": "company_name",
                    "value": "Maian Homes",
                    "text": "company_name: Maian Homes",
                },
                {
                    "id": "company:services",
                    "field": "services",
                    "value": ["Property consulting"],
                    "text": "services: ['Property consulting']",
                },
                {
                    "id": "company:consultation_process",
                    "field": "consultation_process",
                    "value": ["Receive customer requirements"],
                    "text": "consultation_process: ['Receive customer requirements']",
                },
            ],
            intent="company",
        )
        client = AsyncMock()
        client.generate.return_value = {"response": json.dumps({
            "answer": (
                "Maian Homes provides property consulting. "
                "The process starts by receiving customer requirements."
            ),
            "used_fact_ids": [
                "company:company_name",
                "company:services",
                "company:consultation_process",
            ],
            "completeness": True,
        })}
        with patch(
            "app.modules.content.assistant.grounded_service.OllamaService.get_client",
            return_value=client,
        ):
            result = await generate_grounded_answer(
                [
                    {
                        "role": "user",
                        "content": "Compare the services and consultation process",
                    }
                ],
                knowledge,
                "en",
            )

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["reason"], "generated")
        client.generate.assert_awaited_once()
    def test_evidence_guard_accepts_translated_field_label_but_rejects_hype(self):
        facts = [
            {
                "id": "company:company_name",
                "field": "company_name",
                "value": "Maian Homes",
                "text": "company_name: Maian Homes",
            }
        ]
        self.assertTrue(
            answer_passes_evidence_guard(
                "Tên công ty là Maian Homes.",
                ["company:company_name"],
                facts,
                None,
            )
        )
        self.assertFalse(
            answer_passes_evidence_guard(
                "Maian Homes là công ty hàng đầu thị trường.",
                ["company:company_name"],
                facts,
                None,
            )
        )

    def test_evidence_guard_ignores_list_ordinals_but_not_claimed_numbers(self):
        facts = [
            {
                "id": "company:consultation_process",
                "field": "consultation_process",
                "value": [
                    "Receive requirements",
                    "Verify information",
                    "Recommend next steps",
                ],
            }
        ]
        used_ids = ["company:consultation_process"]
        self.assertTrue(
            answer_passes_evidence_guard(
                "1. Receive requirements\n2. Verify information\n3. Recommend next steps",
                used_ids,
                facts,
                None,
            )
        )
        self.assertFalse(
            answer_passes_evidence_guard(
                "1. Receive requirements within 4 days",
                used_ids,
                facts,
                None,
            )
        )
    async def test_provider_failure_is_reported_as_unavailable(self):
        knowledge = KnowledgeResult(
            facts=[
                {
                    "id": "company:overview",
                    "field": "overview",
                    "value": "Verified company overview",
                    "text": "overview: Verified company overview",
                }
            ],
            phone="0900 000 000",
            intent="unsupported",
        )
        client = AsyncMock()
        client.generate.side_effect = __import__("httpx").RequestError("offline")
        with patch(
            "app.modules.content.assistant.grounded_service.OllamaService.get_client",
            return_value=client,
        ):
            result = await generate_grounded_answer(
                [{"role": "user", "content": "Summarize the verified profile"}],
                knowledge,
                "en",
            )

        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["reason"], "provider_unavailable")
        self.assertIn("temporarily unable", result["answer"])
    async def test_project_query_does_not_fall_through_to_company_profile(self):
        service = StubKnowledge({
            "company": {"company_name": "Maian Homes", "overview": "Company profile"},
            "contact": {"phone": "0900 000 000"},
            "projects": [{
                "_id": "alpha", "name": "Alpha", "slug": "alpha", "status": "AVAILABLE",
                "is_published": True, "publication_status": "PUBLISHED", "location": "Thu Duc",
            }],
        })
        result = await service.retrieve("Du an Maian Homes Alpha o dau?")
        self.assertEqual(result.intent, "projects")
        self.assertEqual(result.sources[0]["url"], "/du_an/alpha")
        self.assertFalse(any(fact["id"].startswith("company:") for fact in result.facts))

    async def test_projects_without_public_slug_are_not_retrievable(self):
        service = StubKnowledge({
            "company": None,
            "contact": {"phone": "0900 000 000"},
            "projects": [{
                "_id": "secret", "name": "Secret", "slug": "", "status": "AVAILABLE",
                "is_published": True, "publication_status": "PUBLISHED",
            }],
        })
        result = await service.retrieve("du an Secret")
        self.assertFalse(result.grounded)
        self.assertEqual(result.sources, [])

    async def test_sensitive_question_without_evidence_is_marked_partial(self):
        service = StubKnowledge({
            "company": None,
            "contact": {"phone": "0900 000 000"},
            "projects": [{
                "_id": "alpha", "name": "Alpha", "slug": "alpha", "status": "AVAILABLE",
                "is_published": True, "publication_status": "PUBLISHED",
                "description": "Dự án Alpha có công viên trung tâm.",
            }],
        })
        result = await service.retrieve("Pháp lý dự án Alpha như thế nào?")
        self.assertTrue(result.grounded)
        self.assertTrue(result.partial)
        self.assertIn("legal:alpha", result.missing_topics)

    async def test_partial_answer_appends_exact_dynamic_hotline_fallback(self):
        knowledge = KnowledgeResult(
            facts=[
                {"id": "project:alpha:name", "text": "name: Alpha"},
                {"id": "project:alpha:location", "text": "location: Thủ Đức"},
            ],
            phone="0900 000 000",
            partial=True,
            missing_topics=["legal:alpha"],
        )
        client = AsyncMock()
        client.generate.return_value = {"response": json.dumps({
            "answer": "Dự án Alpha tọa lạc tại Thủ Đức.",
            "used_fact_ids": ["project:alpha:name", "project:alpha:location"],
            "completeness": "partial",
        }, ensure_ascii=False)}
        with patch("app.modules.content.assistant.grounded_service.OllamaService.get_client", return_value=client):
            result = await generate_grounded_answer(
                [{"role": "user", "content": "Pháp lý dự án Alpha như thế nào?"}],
                knowledge,
                "vi",
            )
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["completeness"], "partial")
        self.assertIn("0900 000 000", result["answer"])
        self.assertIn("chưa có dữ liệu đã xác minh", result["answer"])

    async def test_unknown_fact_id_forces_fallback(self):
        knowledge = KnowledgeResult(
            facts=[{"id": "project:alpha:name", "text": "name: Alpha"}],
            phone="0900 000 000",
        )
        client = AsyncMock()
        client.generate.return_value = {"response": json.dumps({
            "answer": "Alpha có giá 5 tỷ đồng.",
            "used_fact_ids": ["project:alpha:secret_price"],
            "completeness": "complete",
        }, ensure_ascii=False)}
        with patch("app.modules.content.assistant.grounded_service.OllamaService.get_client", return_value=client):
            result = await generate_grounded_answer(
                [{"role": "user", "content": "Giá dự án Alpha?"}], knowledge, "vi"
            )
        self.assertEqual(result["status"], "fallback")
        self.assertNotIn("5 tỷ", result["answer"])

    async def test_language_rewrite_cannot_add_an_unsupported_number(self):
        knowledge = KnowledgeResult(
            facts=[
                {"id": "project:alpha:name", "text": "name: Alpha"},
                {"id": "project:alpha:status", "text": "status: AVAILABLE đang bán"},
            ],
            phone="0900 000 000",
        )
        client = AsyncMock()
        client.generate.side_effect = [
            {"response": json.dumps({
                "answer": "Alpha is available và đang bán.",
                "used_fact_ids": ["project:alpha:name", "project:alpha:status"],
                "completeness": "complete",
            }, ensure_ascii=False)},
            {"response": "Alpha is available for 5 billion."},
        ]
        with patch("app.modules.content.assistant.grounded_service.OllamaService.get_client", return_value=client):
            result = await generate_grounded_answer(
                [{"role": "user", "content": "Is Alpha available?"}], knowledge, "en"
            )
        self.assertEqual(result["status"], "fallback")
        self.assertTrue(result["language_rewritten"])
        self.assertNotIn("5 billion", result["answer"])

    def test_language_validator_allows_names_but_rejects_mixed_sentences(self):
        self.assertTrue(language_matches("The Privé is currently available.", "en", ["The Privé"]))
        self.assertFalse(language_matches("The Privé is available và đang mở bán.", "en", ["The Privé"]))


class TestSEOReleaseContract(unittest.TestCase):
    def test_seo_endpoints_use_marketing_only_rbac(self):
        checker = marketing_user.dependency
        for endpoint in (generate_project_seo, generate_article_seo_geo):
            parameter = inspect.signature(endpoint).parameters["current_user"]
            self.assertIs(parameter.default, marketing_user)
        with self.assertRaises(HTTPException) as raised:
            checker({"role": "MARKETING", "permissions": []})
        self.assertEqual(raised.exception.status_code, 403)

        marketer = {
            "role": "MARKETING",
            "permissions": ["website.projects.update"],
        }
        self.assertIs(checker(marketer), marketer)

        owner = {"role": "CEO", "permissions": ["*"]}
        self.assertIs(checker(owner), owner)

    def test_editor_source_url_is_validated_and_preserved_exactly(self):
        url = "https://example.com/source?id=10#evidence"
        self.assertEqual(ProjectSEOSourceInput(title="Source", url=url).url, url)
        self.assertEqual(SEOSourceInput(title="Source", url=url).url, url)
        with self.assertRaises(ValidationError):
            SEOSourceInput(title="Source", url="javascript:alert(1)")

    def test_evidence_guard_rejects_invented_numbers_and_urls(self):
        source = "Dự án Alpha tọa lạc tại Thủ Đức với công viên trung tâm."
        self.assertFalse(is_evidence_supported("Dự án Alpha có giá 5 tỷ đồng", source))
        self.assertFalse(is_evidence_supported("Xem dự án Alpha tại https://invented.invalid", source))

    def test_quality_gate_validates_every_claim_bearing_field(self):
        suggestion = ProjectSEOSuggestion(
            title="Dự án Alpha tại Thủ Đức có công viên trung tâm",
            description="Dự án Alpha tọa lạc tại Thủ Đức và có công viên trung tâm dành cho cư dân, với thông tin dự án được trình bày minh bạch cho khách hàng quan tâm.",
            focus_keyword="Dự án Alpha Thủ Đức",
            keywords=["Dự án Alpha", "Alpha Thủ Đức", "công viên trung tâm"],
            usps=["Tọa lạc tại Thủ Đức", "Có công viên trung tâm", "Thông tin dự án Alpha minh bạch"],
            key_facts=["Dự án có tên Alpha", "Dự án tọa lạc tại Thủ Đức", "Dự án có công viên trung tâm"],
            faqs=[
                {"question": "Dự án Alpha ở đâu?", "answer": "Dự án Alpha tọa lạc tại Thủ Đức."},
                {"question": "Dự án có tiện ích gì?", "answer": "Dự án Alpha có công viên trung tâm."},
            ],
            cornerstone_text="Dự án Alpha tọa lạc tại Thủ Đức và có công viên trung tâm với thông tin được trình bày minh bạch.",
        )
        result = evidence_validation(suggestion, {
            "project_name": "Dự án Alpha",
            "description": "Dự án Alpha tọa lạc tại Thủ Đức, có công viên trung tâm và thông tin dự án được trình bày minh bạch.",
        })
        self.assertTrue(result["all_supported"])
        suggestion.usps[0] = "Cam kết lợi suất đầu tư 20 phần trăm"
        result = evidence_validation(suggestion, {"description": "Dự án Alpha tọa lạc tại Thủ Đức."})
        self.assertFalse(result["all_supported"])
        self.assertIn("usps.0", result["unsupported"])

        suggestion.title = "Dự án Alpha tại Đà Nẵng có công viên trung tâm"
        result = evidence_validation(suggestion, {
            "project_name": "Dự án Alpha",
            "description": "Dự án Alpha có công viên trung tâm.",
            "location": "Thủ Đức",
        })
        self.assertIn("title", result["unsupported"])

    def test_safe_partial_seo_payload_keeps_supported_fields_only(self):
        suggestion = ProjectSEOSuggestion(
            title="Dự án Alpha tại Thủ Đức với công viên trung tâm",
            description="Dự án Alpha tọa lạc tại Thủ Đức và có công viên trung tâm dành cho cư dân, cung cấp thông tin minh bạch cho khách hàng đang quan tâm.",
            focus_keyword="Dự án Alpha Thủ Đức",
            keywords=["Dự án Alpha", "Alpha Thủ Đức", "công viên trung tâm"],
            usps=[
                "Tọa lạc tại Thủ Đức",
                "Có công viên trung tâm",
                "Có bãi biển riêng dành cho cư dân",
            ],
            key_facts=[
                "Dự án có tên Alpha",
                "Dự án tọa lạc tại Thủ Đức",
                "Dự án có công viên trung tâm",
            ],
            faqs=[
                {"question": "Dự án Alpha ở đâu?", "answer": "Dự án Alpha tọa lạc tại Thủ Đức."},
                {"question": "Dự án có tiện ích gì?", "answer": "Dự án Alpha có công viên trung tâm."},
            ],
            cornerstone_text="Dự án Alpha tọa lạc tại Thủ Đức và có công viên trung tâm với thông tin được trình bày minh bạch.",
        )
        payload, validation = supported_evidence_payload(suggestion, {
            "content_type": "dự án bất động sản",
            "project_name": "Dự án Alpha",
            "description": "Dự án Alpha tọa lạc tại Thủ Đức, có công viên trung tâm và thông tin dự án được trình bày minh bạch.",
        })

        self.assertIsNotNone(payload)
        self.assertTrue(validation["returned_all_supported"])
        self.assertFalse(validation["complete"])
        self.assertIn("usps.2", validation["unsupported"])
        self.assertNotIn("Có bãi biển riêng dành cho cư dân", payload["usps"])
        self.assertIn("title", validation["supported_fields"])
    def test_long_article_fact_selection_reaches_last_chunk(self):
        content = ("Nội dung nền đã được biên tập đầy đủ và xác minh. " * 150) + "Dữ kiện cuối bài xác nhận dự án Alpha có công viên trung tâm."
        facts = SEOGenerationService._select_article_facts(content)
        self.assertTrue(any("Dữ kiện cuối bài" in fact for fact in facts))


class TestSEOEndpointContract(unittest.IsolatedAsyncioTestCase):
    async def test_project_endpoint_returns_safe_partial_suggestion_as_ok(self):
        suggestion = ProjectSEOSuggestion(
            title="Dự án Alpha tại Thủ Đức với công viên trung tâm",
            description="Dự án Alpha tọa lạc tại Thủ Đức và có công viên trung tâm dành cho cư dân, cung cấp thông tin minh bạch cho khách hàng đang quan tâm.",
            focus_keyword="Dự án Alpha Thủ Đức",
            keywords=["Dự án Alpha", "Alpha Thủ Đức", "công viên trung tâm"],
            usps=[
                "Tọa lạc tại Thủ Đức",
                "Có công viên trung tâm",
                "Có bãi biển riêng dành cho cư dân",
            ],
            key_facts=[
                "Dự án có tên Alpha",
                "Dự án tọa lạc tại Thủ Đức",
                "Dự án có công viên trung tâm",
            ],
            faqs=[
                {"question": "Dự án Alpha ở đâu?", "answer": "Dự án Alpha tọa lạc tại Thủ Đức."},
                {"question": "Dự án có tiện ích gì?", "answer": "Dự án Alpha có công viên trung tâm."},
            ],
            cornerstone_text="Dự án Alpha tọa lạc tại Thủ Đức và có công viên trung tâm với thông tin được trình bày minh bạch.",
        )
        payload = SEORequest(
            project_name="Dự án Alpha",
            description="Dự án Alpha tọa lạc tại Thủ Đức, có công viên trung tâm và thông tin dự án được trình bày minh bạch cho khách hàng quan tâm.",
            location="Thủ Đức",
            amenities=["Công viên trung tâm"],
        )
        with patch(
            "app.api.protected.ai.seo_generation_service.project",
            AsyncMock(return_value=(suggestion, 0, None)),
        ), patch(
            "app.api.protected.ai.audit_service.log",
            AsyncMock(),
        ):
            response = await generate_project_seo.__wrapped__(
                request=None,
                payload=payload,
                current_user={"email": "editor@example.com", "role": "MARKETING"},
            )

        self.assertEqual(response["status"], "ok")
        self.assertTrue(response["validation"]["evidence_valid"])
        self.assertFalse(response["validation"]["complete"])
        self.assertNotIn("Có bãi biển riêng dành cho cư dân", response["data"]["usps"])
        self.assertEqual(response["warnings"][0]["code"], "PARTIAL_SUGGESTION")

    async def test_project_endpoint_explains_missing_input_in_vietnamese(self):
        with patch(
            "app.api.protected.ai.audit_service.log",
            AsyncMock(),
        ):
            response = await generate_project_seo.__wrapped__(
                request=None,
                payload=SEORequest(project_name="Dự án Alpha", description="Ngắn"),
                current_user={"email": "editor@example.com", "role": "MARKETING"},
            )

        self.assertEqual(response["status"], "needs_input")
        self.assertEqual(response["warnings"][0]["code"], "PROJECT_EVIDENCE_REQUIRED")
        self.assertIn("100 ký tự", response["warnings"][0]["message"])
if __name__ == "__main__":
    unittest.main()
