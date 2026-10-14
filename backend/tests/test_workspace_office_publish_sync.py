import unittest
from unittest.mock import PropertyMock, patch

from fastapi import HTTPException

from app.modules.website.workspaces.service import WorkspaceService


class FakeOfficeLandingCollection:
    def __init__(self, existing):
        self.existing = existing
        self.update = None

    async def find_one(self, _query, *_args):
        if _query.get("status") == "PUBLISHED" and self.existing.get("status") != "PUBLISHED":
            return None
        return self.existing

    async def find_one_and_update(self, _query, update, **_kwargs):
        self.raw_update = update
        self.update = update["$set"]
        return {**self.existing, **self.update}


class FakeFaqCollection:
    def __init__(self):
        self.inserted = []
        self.delete_query = None

    async def update_one(self, query, update):
        pass

    async def insert_one(self, document):
        from types import SimpleNamespace
        from bson import ObjectId

        self.inserted.append(document)
        return SimpleNamespace(inserted_id=ObjectId())

    async def delete_many(self, query):
        self.delete_query = query


class OfficeLandingPublishSyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_save_updates_public_snapshot_for_published_landing(self):
        collection = FakeOfficeLandingCollection(
            {"key": "office_landing", "status": "PUBLISHED", "version": 3}
        )
        payload = {
            "key": "office_landing",
            "hero_image_url": "/api/public/marketing-media/new-banner",
        }

        with patch.object(
            WorkspaceService,
            "office_landing_col",
            new_callable=PropertyMock,
            return_value=collection,
        ):
            await WorkspaceService().upsert_office_landing(
                payload, {"email": "admin@example.com"}
            )

        self.assertEqual(collection.update["published_snapshot"], payload)
        self.assertEqual(collection.update["published_version"], 4)
        self.assertIsNone(collection.update["draft_snapshot"])

    async def test_save_keeps_unpublished_landing_as_draft(self):
        collection = FakeOfficeLandingCollection(
            {"key": "office_landing", "status": "DRAFT", "version": 1}
        )
        payload = {
            "key": "office_landing",
            "hero_image_url": "/api/public/marketing-media/draft-banner",
        }

        with patch.object(
            WorkspaceService,
            "office_landing_col",
            new_callable=PropertyMock,
            return_value=collection,
        ):
            await WorkspaceService().upsert_office_landing(
                payload, {"email": "admin@example.com"}
            )

        self.assertEqual(collection.update["draft_snapshot"], payload)
        self.assertNotIn("published_snapshot", collection.update)

    async def test_save_strips_read_only_fields_and_synchronizes_faqs(self):
        collection = FakeOfficeLandingCollection(
            {"key": "office_landing", "status": "PUBLISHED", "version": 3}
        )
        faq_collection = FakeFaqCollection()
        payload = {
            "key": "office_landing",
            "created_at": "from-get-response",
            "status": "PUBLISHED",
            "version": 3,
            "hero_title": "Office",
            "faqs": [{"id": "faq-new", "question": " Giá thuê? ", "answer": " Liên hệ. "}],
        }

        with patch.object(
            WorkspaceService, "office_landing_col", new_callable=PropertyMock, return_value=collection
        ), patch.object(
            WorkspaceService, "faqs_col", new_callable=PropertyMock, return_value=faq_collection
        ):
            await WorkspaceService().upsert_office_landing(payload, {"email": "admin@example.com"})

        self.assertNotIn("created_at", collection.raw_update["$set"])
        self.assertNotIn("status", collection.raw_update["$set"])
        self.assertFalse(set(collection.raw_update["$set"]) & set(collection.raw_update["$setOnInsert"]))
        self.assertEqual(faq_collection.inserted[0]["question"], "Giá thuê?")
        self.assertEqual(faq_collection.inserted[0]["entity_type"], "OFFICE_LANDING")
        self.assertIsNotNone(faq_collection.delete_query)

class HiddenWorkspacePageTests(unittest.IsolatedAsyncioTestCase):
    async def test_hidden_coworking_is_not_returned_publicly(self):
        collection = FakeOfficeLandingCollection(
            {"key": "singleton_location", "status": "HIDDEN", "version": 2}
        )
        with patch.object(WorkspaceService, "coworking_col", new_callable=PropertyMock, return_value=collection):
            with self.assertRaises(HTTPException) as caught:
                await WorkspaceService().get_public_coworking()
        self.assertEqual(caught.exception.status_code, 404)

    async def test_hidden_office_landing_is_not_returned_publicly(self):
        collection = FakeOfficeLandingCollection(
            {"key": "office_landing", "status": "HIDDEN", "version": 2}
        )
        with patch.object(WorkspaceService, "office_landing_col", new_callable=PropertyMock, return_value=collection):
            with self.assertRaises(HTTPException) as caught:
                await WorkspaceService().get_public_office_landing()
        self.assertEqual(caught.exception.status_code, 404)

if __name__ == "__main__":
    unittest.main()
