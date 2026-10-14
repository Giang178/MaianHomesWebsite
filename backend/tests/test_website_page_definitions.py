from app.modules.website.pages.definitions import admin_definitions, public_definitions
from app.modules.website.pages.service import WebsitePageService
from app.modules.content.company_knowledge.schemas import CompanyKnowledgePayload
from pydantic import ValidationError


def test_admin_definitions_include_editable_about_fields_and_media_slots():
    about = admin_definitions()["about"]
    field_keys = {field["key"] for field in about["fields"]}
    media_keys = {slot["key"] for slot in about["media_slots"]}

    assert {"hero_media_id", "story_media_id", "story_title", "story_content", "culture_media_id"} <= field_keys
    assert {"hero_media_id", "story_media_id", "culture_media_id"} <= media_keys


def test_public_definitions_do_not_expose_internal_editor_schema():
    about = public_definitions()["about"]
    assert about["fields"] == []
    assert about["media_slots"] == []


def test_company_knowledge_rejects_duplicate_faq_questions():
    try:
        CompanyKnowledgePayload(faqs=[
            {"question": "Maian Homes là gì?", "answer": "Câu trả lời thứ nhất"},
            {"question": " maian homes LÀ GÌ? ", "answer": "Câu trả lời thứ hai"},
        ])
    except ValidationError as error:
        assert "COMPANY_KNOWLEDGE_FAQ_DUPLICATE" in str(error)
    else:
        raise AssertionError("Duplicate FAQ questions must be rejected")


def test_page_content_validation_enforces_required_fields_and_types():
    missing = WebsitePageService.validate_content("projects_index", {}, enforce_required=True)
    assert {item["field"] for item in missing} == {"content.title", "content.description"}

    invalid = WebsitePageService.validate_content(
        "projects_index",
        {"title": 123, "description": "Mô tả hợp lệ"},
    )
    assert any(item["code"] == "CONTENT_TYPE_INVALID" for item in invalid)
