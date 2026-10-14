import os
import unittest

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from scripts.database_bootstrap import bootstrap, verify_baseline


@unittest.skipUnless(
    os.getenv("IT_INTEGRATION_TESTS") == "1",
    "Mongo integration disabled",
)
class DatabaseBaselineIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await connect_to_mongo()

    async def asyncTearDown(self):
        await close_mongo_connection()

    async def test_bootstrap_is_idempotent(self):
        first = await bootstrap(db_manager.db)
        second = await bootstrap(db_manager.db)
        verified = await verify_baseline(db_manager.db)
        self.assertEqual(first["status"], "ok")
        self.assertTrue(second["already_initialized"])
        self.assertEqual(verified["protected_ceo_accounts"], 1)
        self.assertTrue(verified["checks"]["no_department_collections"])


if __name__ == "__main__":
    unittest.main()
