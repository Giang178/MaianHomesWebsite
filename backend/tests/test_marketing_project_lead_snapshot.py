import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.modules.content.projects.repository import ProjectRepository


class TestProjectLeadSnapshot(unittest.IsolatedAsyncioTestCase):
    async def test_backfills_project_identity_without_overwriting_existing_snapshots(self):
        leads = SimpleNamespace(
            update_many=AsyncMock(return_value=SimpleNamespace(modified_count=3)),
        )
        with patch(
            "app.modules.content.projects.repository.get_database",
            return_value={"website_leads": leads},
        ):
            count = await ProjectRepository().preserve_lead_project_context(
                "project-1",
                {"name": "Dự án Riverside", "slug": "du-an-riverside"},
            )

        self.assertEqual(count, 3)
        query, operation = leads.update_many.await_args.args
        self.assertEqual(query["interest_project_id"], "project-1")
        self.assertIn({"interest_project_name": {"$exists": False}}, query["$or"])
        self.assertEqual(
            operation["$set"],
            {
                "interest_project_name": "Dự án Riverside",
                "interest_project_slug": "du-an-riverside",
            },
        )

    async def test_permanent_delete_keeps_leads_and_removes_only_project_documents(self):
        project_id = ObjectId()
        root = {
            "_id": project_id,
            "slug": "du-an-riverside",
            "publication_status": "ARCHIVED",
            "version": 4,
        }
        projects = SimpleNamespace(find_one_and_delete=AsyncMock(return_value=root))
        drafts = SimpleNamespace(delete_many=AsyncMock())
        revisions = SimpleNamespace(delete_many=AsyncMock())
        redirects = SimpleNamespace(delete_many=AsyncMock())
        database = {
            "projects": projects,
            "project_drafts": drafts,
            "project_revisions": revisions,
            "marketing_redirects": redirects,
        }

        with patch(
            "app.modules.content.projects.repository.get_database",
            return_value=database,
        ):
            deleted = await ProjectRepository().delete_archived(
                str(project_id),
                4,
            )

        self.assertEqual(deleted, root)
        self.assertNotIn("website_leads", database)
        projects.find_one_and_delete.assert_awaited_once()
        drafts.delete_many.assert_awaited_once()
        revisions.delete_many.assert_awaited_once()
        redirects.delete_many.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
