import os
import unittest

from bson import ObjectId

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.content.common.indexes import ensure_marketing_indexes


@unittest.skipUnless(
    os.getenv("MARKETING_INTEGRATION_TESTS") == "1",
    "Marketing integration infrastructure is not enabled",
)
class MarketingInfrastructureTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await connect_to_mongo()
        self.db = db_manager.db
        for collection in (
            "projects",
            "project_drafts",
            "project_revisions",
            "articles",
            "article_drafts",
            "article_revisions",
            "marketing_redirects",
            "marketing_idempotency",
            "marketing_outbox",
        ):
            await self.db[collection].drop()

    async def asyncTearDown(self):
        await close_mongo_connection()

    async def test_canonical_indexes_are_repeatable_and_preserve_documents(self):
        project_id = ObjectId()
        article_id = ObjectId()
        await self.db["projects"].insert_one(
            {
                "_id": project_id,
                "name": "Dự án kiểm thử",
                "slug": "du-an-kiem-thu",
                "is_published": True,
            }
        )
        await self.db["articles"].insert_one(
            {
                "_id": article_id,
                "title": "Bài viết kiểm thử",
                "slug": "bai-viet-kiem-thu",
                "status": "published",
                "author_id": "staff-1",
            }
        )

        await ensure_marketing_indexes(self.db)
        await ensure_marketing_indexes(self.db)
        self.assertEqual(1, await self.db["projects"].count_documents({"_id": project_id}))
        self.assertEqual(1, await self.db["articles"].count_documents({"_id": article_id}))
        self.assertEqual(
            1,
            await self.db["project_drafts"].count_documents(
                {"project_id": str(project_id)}
            ),
        )
        self.assertEqual(
            1,
            await self.db["article_drafts"].count_documents(
                {"article_id": str(article_id)}
            ),
        )
        project = await self.db["projects"].find_one({"_id": project_id})
        article = await self.db["articles"].find_one({"_id": article_id})
        self.assertEqual("PUBLISHED", project["publication_status"])
        self.assertEqual("PUBLISHED", article["publication_status"])
        self.assertEqual("LEGACY", project["quality_status"])
        self.assertEqual("LEGACY", article["quality_status"])

    async def test_indexes_are_idempotent(self):
        await ensure_marketing_indexes(self.db)
        await ensure_marketing_indexes(self.db)
        self.assertIn(
            "project_id_1",
            await self.db["project_drafts"].index_information(),
        )
        self.assertIn(
            "article_id_1",
            await self.db["article_drafts"].index_information(),
        )

    async def test_replica_set_transaction_rolls_back(self):
        marker = ObjectId()
        with self.assertRaises(RuntimeError):
            async with await db_manager.client.start_session() as session:
                async with session.start_transaction():
                    await self.db["marketing_outbox"].insert_one(
                        {"_id": marker, "status": "PENDING"},
                        session=session,
                    )
                    raise RuntimeError("force rollback")
        self.assertIsNone(
            await self.db["marketing_outbox"].find_one({"_id": marker})
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
