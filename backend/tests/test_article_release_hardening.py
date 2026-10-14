from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from pydantic import ValidationError

from app.modules.content.articles.repository import ArticleRepository
from app.modules.content.articles.schemas import ArticleCreateRequest
from app.modules.content.seo_geo.html_sanitizer import sanitize_marketing_html
from app.modules.content.seo_geo.validators import validate_article_for_publish


def _valid_article() -> dict:
    return {
        "title": "Phan tich thi truong bat dong san cao cap 2026",
        "slug": "phan-tich-thi-truong-2026",
        "category": "market",
        "sapo": "Ban tin tong hop thi truong bat dong san voi du lieu va nhan dinh da duoc kiem chung.",
        "content": '<h2>Tong quan</h2><p>' + ('thi truong ' * 310) + '</p><a href="/du_an">Du an</a>',
        "gallery": [{"url": "/images/test.jpg", "alt_text": "Toan canh", "credit": "Maian Homes"}],
        "seo": {
            "meta_title": "Phan tich thi truong bat dong san 2026",
            "meta_description": "M" * 130,
            "canonical_url": "https://maianhomes.vn/tin_tuc/phan-tich-thi-truong-2026",
        },
        "geo": {
            "answer_summary": "A" * 80,
            "key_facts": ["a", "b", "c"],
            "faqs": [
                {"question": "q1", "answer": "a1"},
                {"question": "q2", "answer": "a2"},
            ],
            "sources": [{"title": "Nguon", "url": "https://example.com/report"}],
        },
    }


def test_article_request_rejects_oversized_and_unknown_fields():
    common = {
        "title": "T" * 121,
        "slug": "hop-le",
        "category": "market",
        "idempotency_key": "request-12345678",
    }
    with pytest.raises(ValidationError):
        ArticleCreateRequest(**common)

    common["title"] = "Hop le"
    common["unexpected"] = "must-not-be-stored"
    with pytest.raises(ValidationError):
        ArticleCreateRequest(**common)


def test_publish_gate_rejects_external_image_and_foreign_canonical():
    payload = _valid_article()
    payload["gallery"][0]["url"] = "https://tracker.example/pixel.png"
    payload["seo"]["canonical_url"] = "https://attacker.example/article"
    report = validate_article_for_publish(payload)
    assert {"EXTERNAL_IMAGE_URL", "INVALID_CANONICAL"} <= {
        issue.code for issue in report.errors
    }


def test_html_sanitizer_removes_external_images_and_layout_classes():
    sanitized = sanitize_marketing_html(
        '<img src="//tracker.example/pixel.png" alt="x">'
        '<span class="fixed inset-0 z-50">overlay</span>'
        '<a href="https://example.com" target="_blank" rel="opener">link</a>'
    )
    assert "tracker.example" not in sanitized
    assert "class=" not in sanitized
    assert 'rel="opener"' not in sanitized
    assert sanitized.count('rel="noopener noreferrer"') == 1


@pytest.mark.asyncio
async def test_saving_draft_does_not_transfer_author_or_owner():
    article_id = str(ObjectId())
    articles = MagicMock()
    articles.find_one_and_update = AsyncMock(
        return_value={"_id": ObjectId(article_id), "version": 2}
    )
    drafts = MagicMock()
    drafts.update_one = AsyncMock()
    database = MagicMock()
    database.__getitem__.side_effect = {
        "articles": articles,
        "article_drafts": drafts,
    }.__getitem__

    repository = ArticleRepository()
    with patch(
        "app.modules.content.articles.repository.get_database",
        return_value=database,
    ):
        await repository.save_draft(
            article_id,
            {"title": "Updated"},
            1,
            "manager-1",
            False,
        )

    update = articles.find_one_and_update.await_args.args[1]["$set"]
    assert update["updated_by"] == "manager-1"
    assert not {"author_id", "author_name", "author_email", "editor_owner_id"} & set(update)


@pytest.mark.asyncio
async def test_publish_writes_revision_snapshot():
    article_id = str(ObjectId())
    old = {
        "_id": ObjectId(article_id),
        "slug": "old-slug",
        "published_version": 1,
        "published_at": None,
    }
    updated = {**old, "slug": "new-slug", "published_version": 2, "version": 3}
    articles = MagicMock()
    articles.find_one_and_update = AsyncMock(return_value=updated)
    revisions = MagicMock()
    revisions.insert_one = AsyncMock()
    redirects = MagicMock()
    redirects.update_one = AsyncMock()
    database = MagicMock()
    database.__getitem__.side_effect = {
        "articles": articles,
        "article_revisions": revisions,
        "marketing_redirects": redirects,
    }.__getitem__

    repository = ArticleRepository()
    repository.root = AsyncMock(return_value=old)
    payload = {
        "title": "Published article",
        "slug": "new-slug",
        "sapo": "Summary",
        "content": "<h2>Content</h2>",
        "gallery": [],
    }
    with patch(
        "app.modules.content.articles.repository.get_database",
        return_value=database,
    ), patch(
        "app.modules.content.articles.repository.record_event",
        AsyncMock(),
    ):
        await repository.publish(
            article_id,
            2,
            payload,
            {},
            "publisher-1",
        )

    snapshot = revisions.insert_one.await_args.args[0]
    assert snapshot["article_id"] == article_id
    assert snapshot["version"] == 2
    assert snapshot["content"] == payload["content"]