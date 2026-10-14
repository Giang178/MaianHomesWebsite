import pytest
from pydantic import ValidationError

from app.api.public.ai import ChatMessage, ChatRequest, trusted_chat_history
from app.modules.content.assistant.grounded_service import (
    detect_language,
    generate_grounded_answer,
)
from app.modules.content.assistant.knowledge_service import (
    ChatKnowledgeService,
    KnowledgeResult,
    fallback_message,
    normalize_text,
)
from app.modules.content.assistant.seo_service import (
    ArticleSEOSuggestion,
    ProjectSEOSuggestion,
)


class StubKnowledge(ChatKnowledgeService):
    def __init__(self, bundle: dict):
        self.bundle = bundle

    async def _load_bundle(self) -> dict:
        return self.bundle


def project(name: str, slug: str, *, published=True, publication_status="PUBLISHED", status="AVAILABLE") -> dict:
    return {
        "_id": slug,
        "name": name,
        "slug": slug,
        "status": status,
        "is_published": published,
        "publication_status": publication_status,
        "location": "Thành phố Hồ Chí Minh",
        "developer": "Chủ đầu tư đã xác minh",
        "description": "Mô tả công khai",
        "seo_metadata": {"key_facts": ["Dữ kiện công khai"]},
    }


def test_normalization_and_language_lock_detection():
    assert normalize_text("DỰ ÁN The Privé") == "du an the prive"
    assert detect_language("Cho tôi biết dự án đang bán") == "vi"
    assert detect_language("What projects are available?") == "en"


@pytest.mark.asyncio
async def test_company_name_query_returns_structured_published_fact():
    service = StubKnowledge({
        "company": {
            "company_name": "Maian Homes",
            "overview": "Verified overview",
            "published_version": 1,
        },
        "contact": {"phone": "0900 000 000"},
        "projects": [],
    })

    result = await service.retrieve("Cong ty ten gi?")

    assert result.intent == "company"
    assert result.grounded is True
    name_fact = next(fact for fact in result.facts if fact["id"] == "company:company_name")
    assert name_fact["field"] == "company_name"
    assert name_fact["value"] == "Maian Homes"

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query",
    ["thời gian làm việc", "lịch làm việc", "giờ hoạt động"],
)
async def test_working_hours_synonyms_use_published_company_knowledge(query, monkeypatch):
    service = StubKnowledge({
        "company": {
            "company_name": "Maian Homes",
            "working_hours": "Thứ Hai - Thứ Bảy, 08:30 - 17:30",
            "published_version": 1,
        },
        "contact": {"phone": "0900 000 000"},
        "projects": [],
    })
    knowledge = await service.retrieve(query)

    assert knowledge.intent == "company"
    assert any(fact["id"] == "company:working_hours" for fact in knowledge.facts)

    def fail_if_called():
        raise AssertionError("AI must not be called for published working hours")

    monkeypatch.setattr(
        "app.modules.content.assistant.grounded_service.OllamaService.get_client",
        fail_if_called,
    )
    result = await generate_grounded_answer(
        [{"role": "user", "content": query}],
        knowledge,
        "vi",
    )

    assert result["status"] == "ok"
    assert result["reason"] == "deterministic"
    assert result["answer"] == "Giờ làm việc của Maian Homes: Thứ Hai - Thứ Bảy, 08:30 - 17:30."

@pytest.mark.asyncio
async def test_greeting_is_answered_without_knowledge_or_ai(monkeypatch):
    def fail_if_called():
        raise AssertionError("AI must not be called for a greeting")

    monkeypatch.setattr(
        "app.modules.content.assistant.grounded_service.OllamaService.get_client",
        fail_if_called,
    )
    result = await generate_grounded_answer(
        [{"role": "user", "content": "chào Mái Đỏ"}],
        KnowledgeResult(phone="0900 000 000"),
        "vi",
    )

    assert result["status"] == "ok"
    assert result["reason"] == "conversation"
    assert "Xin chào" in result["answer"]
    assert "Mái Đỏ" in result["answer"]
    assert "Maian Homes" in result["answer"]


@pytest.mark.asyncio
async def test_project_count_query_uses_all_published_projects_without_ai(monkeypatch):
    service = StubKnowledge({
        "company": {"company_name": "Maian Homes"},
        "contact": {"phone": "0900 000 000"},
        "projects": [
            project("Alpha", "alpha"),
            project("Beta", "beta"),
            project("Gamma", "gamma"),
            project("Draft Secret", "draft-secret", published=False),
            project("Archived Secret", "archived-secret", publication_status="ARCHIVED"),
        ],
    })
    knowledge = await service.retrieve("Hiện tại công ty có bao nhiêu dự án?")

    assert knowledge.intent == "projects"
    assert knowledge.project_count is True
    assert knowledge.facts == [{
        "id": "projects:published_count",
        "field": "published_count",
        "value": 3,
        "text": "published_count: 3",
    }]

    def fail_if_called():
        raise AssertionError("AI must not be called for an exact project count")

    monkeypatch.setattr(
        "app.modules.content.assistant.grounded_service.OllamaService.get_client",
        fail_if_called,
    )
    result = await generate_grounded_answer(
        [{"role": "user", "content": "Hiện tại công ty có bao nhiêu dự án?"}],
        knowledge,
        "vi",
    )
    assert result["status"] == "ok"
    assert result["reason"] == "deterministic"
    assert "3 dự án" in result["answer"]


@pytest.mark.asyncio
async def test_zero_project_count_is_a_valid_verified_answer():
    service = StubKnowledge({
        "company": {"company_name": "Maian Homes"},
        "contact": {},
        "projects": [],
    })
    knowledge = await service.retrieve("Công ty có mấy dự án?")
    result = await generate_grounded_answer(
        [{"role": "user", "content": "Công ty có mấy dự án?"}],
        knowledge,
        "vi",
    )

    assert result["status"] == "ok"
    assert "chưa có dự án nào" in result["answer"]


@pytest.mark.asyncio
async def test_empty_project_list_is_answered_without_a_hotline_fallback():
    service = StubKnowledge({
        "company": {"company_name": "Maian Homes"},
        "contact": {"phone": "0900 000 000"},
        "projects": [],
    })
    knowledge = await service.retrieve("Công ty có dự án nào?")
    result = await generate_grounded_answer(
        [{"role": "user", "content": "Công ty có dự án nào?"}],
        knowledge,
        "vi",
    )

    assert result["status"] == "ok"
    assert result["reason"] == "deterministic"
    assert "chưa có dự án nào" in result["answer"]
    assert "hotline" not in result["answer"]

@pytest.mark.asyncio
async def test_natural_project_list_question_returns_the_published_list():
    service = StubKnowledge({
        "company": {"company_name": "Maian Homes"},
        "contact": {},
        "projects": [project("Alpha", "alpha"), project("Beta", "beta")],
    })
    knowledge = await service.retrieve("Công ty có dự án nào?")

    assert knowledge.list_all is True
    result = await generate_grounded_answer(
        [{"role": "user", "content": "Công ty có dự án nào?"}],
        knowledge,
        "vi",
    )
    assert result["status"] == "ok"
    assert "Alpha" in result["answer"]
    assert "Beta" in result["answer"]

def test_fallback_contract_is_exact_and_dynamic():
    phone = "0969 895 059"
    assert fallback_message("vi", phone) == f"Hiện Mái Đỏ chưa có thông tin chính xác về nội dung này. Quý khách vui lòng liên hệ hotline {phone} để được hỗ trợ."
    assert fallback_message("en", phone) == f"Mái Đỏ does not currently have verified information about this. Please contact our hotline at {phone} for assistance."


def test_chat_contract_rejects_extra_controls_and_large_context():
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role": "user", "content": "Xin chào"}], temperature=0.9)
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role": "user", "content": "x" * 2001}])


def test_trusted_history_reconstructs_roles():
    messages = [ChatMessage(role="user", content="one"), ChatMessage(role="user", content="two")]
    history = trusted_chat_history(messages)
    assert [item["role"] for item in history] == ["assistant", "user"]


@pytest.mark.asyncio
async def test_retrieval_excludes_draft_and_archived_projects_and_limits_comparison():
    service = StubKnowledge({
        "company": None,
        "contact": {"phone": "0969 895 059"},
        "projects": [
            project("Alpha", "alpha"),
            project("Beta", "beta"),
            project("Gamma", "gamma"),
            project("Draft Secret", "draft-secret", published=False),
            project("Archived Secret", "archived-secret", publication_status="ARCHIVED"),
        ],
    })
    result = await service.retrieve("So sánh dự án Alpha Beta Gamma Draft Secret Archived Secret")
    urls = {source["url"] for source in result.sources}
    assert urls == {"/du_an/alpha", "/du_an/beta", "/du_an/gamma"}
    assert all("Secret" not in fact["text"] for fact in result.facts)


@pytest.mark.asyncio
async def test_no_knowledge_returns_fallback_without_ollama(monkeypatch):
    def fail_if_called():
        raise AssertionError("Ollama must not be called on a knowledge miss")

    monkeypatch.setattr("app.modules.content.assistant.grounded_service.OllamaService.get_client", fail_if_called)
    result = await generate_grounded_answer(
        [{"role": "user", "content": "Nội dung ngoài phạm vi"}],
        KnowledgeResult(phone="0900 000 000"),
        "vi",
    )
    assert result["status"] == "fallback"
    assert "0900 000 000" in result["answer"]


@pytest.mark.parametrize("schema", [ProjectSEOSuggestion, ArticleSEOSuggestion])
def test_seo_schemas_forbid_unexpected_urls(schema):
    with pytest.raises(ValidationError):
        schema.model_validate({"source_url": "https://invented.invalid"})
