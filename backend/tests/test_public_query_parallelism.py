import asyncio
import unittest
from unittest.mock import AsyncMock, PropertyMock, patch

from app.modules.content.articles.repository import ArticleRepository
from app.modules.content.projects.repository import ProjectRepository
from app.modules.content.projects.service import ProjectApplicationService


class ParallelProbe:
    def __init__(self):
        self.started: set[str] = set()
        self.all_started = asyncio.Event()

    async def enter(self, name: str) -> None:
        self.started.add(name)
        if len(self.started) == 2:
            self.all_started.set()
        await asyncio.wait_for(self.all_started.wait(), timeout=0.5)


class QueryCursor:
    def __init__(self, probe: ParallelProbe, rows: list[dict]):
        self.probe = probe
        self.rows = rows

    def sort(self, *_args):
        return self

    def skip(self, _value):
        return self

    def limit(self, _value):
        return self

    async def to_list(self, length):
        await self.probe.enter("list")
        return self.rows[:length]


class QueryCollection:
    def __init__(self, rows: list[dict]):
        self.probe = ParallelProbe()
        self.rows = rows
        self.projection = None

    def find(self, _query, _projection):
        self.projection = _projection
        return QueryCursor(self.probe, self.rows)

    async def count_documents(self, _query):
        await self.probe.enter("count")
        return len(self.rows)


class PublicQueryParallelismTests(unittest.IsolatedAsyncioTestCase):
    async def test_project_list_runs_count_and_page_query_concurrently(self):
        collection = QueryCollection([{"slug": "project-a"}])
        with patch.object(
            ProjectRepository,
            "db",
            new_callable=PropertyMock,
            return_value={"projects": collection},
        ):
            items, total = await ProjectRepository().list_public(0, 100)

        self.assertEqual(collection.probe.started, {"count", "list"})
        self.assertEqual(items, [{"slug": "project-a"}])
        self.assertEqual(total, 1)

    async def test_project_summary_uses_inclusion_and_slice_projection(self):
        collection = QueryCollection([{"slug": "project-a"}])
        with patch.object(
            ProjectRepository,
            "db",
            new_callable=PropertyMock,
            return_value={"projects": collection},
        ):
            await ProjectRepository().list_public(0, 100, summary=True)

        self.assertEqual(collection.projection["description"] if "description" in collection.projection else None, None)
        self.assertEqual(collection.projection["images"], {"$slice": 1})
        self.assertEqual(collection.projection["hero_images"], {"$slice": 1})
        self.assertNotIn("assigned_staff_id", collection.projection)
        self.assertNotIn("lead_routing", collection.projection)

    async def test_project_service_forwards_summary_to_repository(self):
        service = ProjectApplicationService()
        service.repository = AsyncMock()
        service.repository.list_public.return_value = ([], 0)

        result = await service.public_list(0, 100, True, summary=True)

        service.repository.list_public.assert_awaited_once_with(
            0,
            100,
            True,
            summary=True,
        )
        self.assertEqual(
            result,
            {"data": [], "total": 0, "skip": 0, "limit": 100},
        )

    async def test_article_list_runs_count_and_page_query_concurrently(self):
        collection = QueryCollection([{"slug": "article-a"}])
        with patch.object(
            ArticleRepository,
            "db",
            new_callable=PropertyMock,
            return_value={"articles": collection},
        ):
            items, total = await ArticleRepository().public_list({}, 0, 20)

        self.assertEqual(collection.probe.started, {"count", "list"})
        self.assertEqual(items, [{"slug": "article-a"}])
        self.assertEqual(total, 1)


if __name__ == "__main__":
    unittest.main()
