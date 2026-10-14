import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from scripts import database_fresh_verify
from scripts.verify_website_bootstrap import (
    FRESH_BOOTSTRAP_SOURCE,
    WEBSITE_BOOTSTRAP_PROFILE,
)


class FreshDatabaseVerificationTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def database(*, account_count=1, marker_source=FRESH_BOOTSTRAP_SOURCE):
        collections = {}

        def collection(name):
            if name not in collections:
                item = MagicMock()
                item.find_one = AsyncMock(return_value={"_id": "record"})
                item.count_documents = AsyncMock(return_value=account_count)
                collections[name] = item
            return collections[name]

        database = MagicMock()
        database.name = "maian_staging"
        database.__getitem__.side_effect = collection
        collection("system_bootstrap").find_one = AsyncMock(
            return_value={
                "_id": "current",
                "status": "complete",
                "source": marker_source,
                "profile": WEBSITE_BOOTSTRAP_PROFILE,
            }
        )
        collection("user_accounts").find_one = AsyncMock(
            return_value={
                "normalized_email": "ceo@example.com",
                "role": "CEO",
                "is_protected": True,
                "is_active": True,
            }
        )
        return database

    async def test_accepts_the_fresh_website_baseline(self):
        database = self.database()
        verification = {
            "database": "maian_staging",
            "ok": True,
            "checks": {"bootstrap_complete": True},
            "forbidden_collections": [],
        }
        with patch.dict(
            "os.environ",
            {"CEO_EMAIL": "ceo@example.com"},
        ), patch.object(
            database_fresh_verify,
            "verify_database",
            AsyncMock(return_value=verification),
        ):
            result = await database_fresh_verify.verify_fresh_database(database)

        self.assertEqual(result["ceo_email"], "ceo@example.com")
        self.assertEqual(result["user_accounts"], 1)
        self.assertEqual(result["unexpected_nonempty_collections"], 0)

    async def test_rejects_more_than_one_account(self):
        database = self.database(account_count=2)
        with patch.dict(
            "os.environ",
            {"CEO_EMAIL": "ceo@example.com"},
        ), patch.object(
            database_fresh_verify,
            "verify_database",
            AsyncMock(
                return_value={
                    "ok": True,
                    "checks": {},
                    "forbidden_collections": [],
                }
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "exactly the configured CEO"):
                await database_fresh_verify.verify_fresh_database(database)

    async def test_rejects_foreign_bootstrap_marker(self):
        database = self.database(marker_source="legacy-migration")
        with patch.dict(
            "os.environ",
            {"CEO_EMAIL": "ceo@example.com"},
        ), patch.object(
            database_fresh_verify,
            "verify_database",
            AsyncMock(
                return_value={
                    "ok": True,
                    "checks": {},
                    "forbidden_collections": [],
                }
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "website-only fresh bootstrap"):
                await database_fresh_verify.verify_fresh_database(database)


if __name__ == "__main__":
    unittest.main()
