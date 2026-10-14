import unittest

from scripts.migrations.seed_company_knowledge_draft import INITIAL_DRAFT, run


class UpdateResult:
    def __init__(self, upserted_id=None):
        self.upserted_id = upserted_id


class FakeCollection:
    def __init__(self):
        self.documents = {}

    async def count_documents(self, query, limit=0):
        return int(query.get("_id") in self.documents)

    async def update_one(self, query, update, upsert=False):
        document_id = query["_id"]
        existing = self.documents.get(document_id)
        if existing is not None:
            if "$set" in update:
                existing.update(update["$set"])
            return UpdateResult()
        if not upsert:
            return UpdateResult()
        document = {"_id": document_id}
        document.update(update.get("$setOnInsert", {}))
        document.update(update.get("$set", {}))
        self.documents[document_id] = document
        return UpdateResult(document_id)


class FakeDatabase:
    def __init__(self):
        self.collections = {
            "company_knowledge": FakeCollection(),
            "release_migrations": FakeCollection(),
        }

    def __getitem__(self, name):
        return self.collections[name]


class TestCompanyKnowledgeMigration(unittest.IsolatedAsyncioTestCase):
    async def test_dry_run_never_creates_or_publishes(self):
        database = FakeDatabase()
        report = await run(apply=False, database=database)
        self.assertEqual(report["created"], 0)
        self.assertFalse(report["published"])
        self.assertEqual(database["company_knowledge"].documents, {})

    async def test_apply_is_idempotent_and_seeds_unpublished_draft(self):
        database = FakeDatabase()
        first = await run(apply=True, database=database)
        second = await run(apply=True, database=database)
        document = database["company_knowledge"].documents["company_profile"]
        self.assertEqual(first["created"], 1)
        self.assertEqual(second["created"], 0)
        self.assertTrue(second["already_exists"])
        self.assertEqual(document["draft"], INITIAL_DRAFT)
        self.assertIsNone(document["published"])
        self.assertEqual(document["publication_status"], "NEVER_PUBLISHED")
        self.assertEqual(document["published_version"], 0)

    async def test_existing_published_document_is_never_overwritten(self):
        database = FakeDatabase()
        existing = {"_id": "company_profile", "published": {"overview": "verified"}, "publication_status": "PUBLISHED", "version": 9}
        database["company_knowledge"].documents["company_profile"] = existing.copy()
        report = await run(apply=True, database=database)
        self.assertEqual(report["created"], 0)
        self.assertEqual(database["company_knowledge"].documents["company_profile"], existing)


if __name__ == "__main__":
    unittest.main()
