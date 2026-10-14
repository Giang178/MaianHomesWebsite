from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.modules.content.articles.public_service import PublicArticleService


def database_with(*, article: dict, updated: dict | None = None, duplicate: bool = False):
    articles = MagicMock()
    articles.find_one = AsyncMock(return_value=article)
    articles.find_one_and_update = AsyncMock(return_value=updated)
    view_logs = MagicMock()
    view_logs.insert_one = AsyncMock()
    if duplicate:
        view_logs.insert_one.side_effect = DuplicateKeyError("duplicate")
    database = MagicMock()
    database.__getitem__.side_effect = {
        "articles": articles,
        "article_view_logs": view_logs,
    }.__getitem__
    return database, articles, view_logs


@pytest.mark.asyncio
async def test_track_view_ignores_bots_before_accessing_database():
    with patch("app.modules.content.articles.public_service.get_database") as get_database:
        result = await PublicArticleService().track_view("news", "127.0.0.1", "Googlebot/2.1")

    assert result == {"tracked": False, "reason": "bot_detected", "current_views": None}
    get_database.assert_not_called()


@pytest.mark.asyncio
async def test_track_view_records_unique_published_view():
    article_id = ObjectId()
    database, articles, view_logs = database_with(
        article={"_id": article_id, "status": "published", "view_count": 4},
        updated={"view_count": 5},
    )

    with patch("app.modules.content.articles.public_service.get_database", return_value=database):
        result = await PublicArticleService().track_view("news", "127.0.0.1", "Mozilla/5.0")

    assert result == {"tracked": True, "reason": None, "current_views": 5}
    view_logs.insert_one.assert_awaited_once()
    articles.find_one_and_update.assert_awaited_once()


@pytest.mark.asyncio
async def test_track_view_does_not_increment_duplicate_view():
    database, articles, _ = database_with(
        article={"_id": ObjectId(), "publication_status": "PUBLISHED", "view_count": 8},
        duplicate=True,
    )

    with patch("app.modules.content.articles.public_service.get_database", return_value=database):
        result = await PublicArticleService().track_view("news", "127.0.0.1", "Mozilla/5.0")

    assert result == {
        "tracked": False,
        "reason": "duplicate_view_in_window",
        "current_views": 8,
    }
    articles.find_one_and_update.assert_not_awaited()
