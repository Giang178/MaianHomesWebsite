import unittest
from unittest.mock import AsyncMock, MagicMock

from bson import ObjectId

from app.modules.content.common.indexes import (
    _backfill_legacy_marketing_documents,
)


class _AsyncDocuments:
    def __init__(self, documents):
        self._documents = documents

    def __aiter__(self):
        async def iterate():
            for document in self._documents:
                yield document

        return iterate()


class MarketingLegacyBackfillTests(unittest.IsolatedAsyncioTestCase):
    async def test_draft_is_persisted_before_root_workflow_marker(self):
        document = {
            "_id": ObjectId(),
            "name": "Legacy project",
            "slug": "legacy-project",
            "is_published": True,
        }
        projects = MagicMock()
        projects.find.return_value = _AsyncDocuments([document])
        projects.update_one = AsyncMock()
        project_drafts = MagicMock()
        project_drafts.update_one = AsyncMock(side_effect=RuntimeError("interrupted"))

        articles = MagicMock()
        articles.find.return_value = _AsyncDocuments([])
        article_drafts = MagicMock()
        article_drafts.update_one = AsyncMock()
        database = {
            "projects": projects,
            "project_drafts": project_drafts,
            "articles": articles,
            "article_drafts": article_drafts,
        }

        with self.assertRaisesRegex(RuntimeError, "interrupted"):
            await _backfill_legacy_marketing_documents(database)

        projects.update_one.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
