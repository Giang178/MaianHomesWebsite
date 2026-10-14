import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from scripts import database_bootstrap


class FreshWebsiteBootstrapTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def database(*, marker=None, collections=None, counts=None):
        collections = collections or []
        counts = counts or {}
        items = {}

        def collection(name):
            if name not in items:
                item = MagicMock()
                item.find_one = AsyncMock(
                    return_value=marker if name == "system_bootstrap" else None
                )
                item.estimated_document_count = AsyncMock(
                    return_value=counts.get(name, 0)
                )
                items[name] = item
            return items[name]

        database = MagicMock()
        database.__getitem__.side_effect = collection
        database.list_collection_names = AsyncMock(return_value=collections)
        return database

    async def test_rejects_populated_database_without_marker(self):
        database = self.database(
            collections=["website_pages"],
            counts={"website_pages": 3},
        )
        with self.assertRaisesRegex(RuntimeError, "requires an empty database"):
            await database_bootstrap._assert_empty(database)

    async def test_rejects_foreign_completed_marker(self):
        database = self.database(
            marker={
                "_id": "current",
                "status": "complete",
                "source": "legacy-migration",
                "profile": "legacy",
            }
        )
        with patch.object(
            database_bootstrap,
            "_bootstrap_mode",
            return_value="fresh-only",
        ):
            with self.assertRaisesRegex(RuntimeError, "foreign bootstrap marker"):
                await database_bootstrap.bootstrap(database)

    async def test_completed_website_marker_is_repaired_and_verified(self):
        marker = {
            "_id": "current",
            "status": "complete",
            "source": database_bootstrap.FRESH_BOOTSTRAP_SOURCE,
            "profile": database_bootstrap.WEBSITE_BOOTSTRAP_PROFILE,
        }
        database = self.database(marker=marker)
        with patch.object(
            database_bootstrap,
            "_bootstrap_mode",
            return_value="fresh-only",
        ), patch.object(
            database_bootstrap,
            "bootstrap_database",
            AsyncMock(),
        ) as seed, patch.object(
            database_bootstrap,
            "verify_baseline",
            AsyncMock(return_value={"status": "ok", "pages": 10, "accounts": 1}),
        ):
            result = await database_bootstrap.bootstrap(database)

        seed.assert_awaited_once_with(database)
        self.assertTrue(result["already_initialized"])

    async def test_empty_database_runs_only_website_bootstrap(self):
        database = self.database()
        configured = {
            "CEO_EMAIL": "ceo@example.com",
            "CEO_FULL_NAME": "CEO",
            "CEO_PHONE": "0900000000",
            "CEO_BOOTSTRAP_PASSWORD": "Strong-Password-2026!",
        }
        with patch.object(
            database_bootstrap,
            "_bootstrap_mode",
            return_value="fresh-only",
        ), patch.object(
            database_bootstrap,
            "_configured_value",
            side_effect=lambda name: configured[name],
        ), patch.object(
            database_bootstrap,
            "_assert_empty",
            AsyncMock(),
        ), patch.object(
            database_bootstrap,
            "bootstrap_database",
            AsyncMock(),
        ) as seed, patch.object(
            database_bootstrap,
            "verify_baseline",
            AsyncMock(return_value={"status": "ok", "pages": 10, "accounts": 1}),
        ):
            result = await database_bootstrap.bootstrap(database)

        seed.assert_awaited_once_with(database)
        self.assertFalse(result["already_initialized"])

    def test_production_requires_fresh_only_mode(self):
        with patch.dict(
            "os.environ",
            {"DATABASE_BOOTSTRAP_MODE": "auto"},
            clear=False,
        ), patch.object(
            database_bootstrap.settings,
            "ENVIRONMENT",
            "production",
        ):
            with self.assertRaisesRegex(RuntimeError, "must be fresh-only"):
                database_bootstrap._bootstrap_mode()

    def test_legacy_adopt_mode_is_not_supported(self):
        with patch.dict(
            "os.environ",
            {"DATABASE_BOOTSTRAP_MODE": "legacy-adopt"},
            clear=False,
        ):
            with self.assertRaisesRegex(RuntimeError, "auto, fresh-only"):
                database_bootstrap._bootstrap_mode()


if __name__ == "__main__":
    unittest.main()
