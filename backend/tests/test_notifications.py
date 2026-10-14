import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.api.protected.notifications import mark_all_notifications_read, repair_legacy_notification
from app.modules.notifications import registry
from app.modules.notifications.registry import emit_notification, render_notification


class _FakeCollection:
    def __init__(self): self.calls = []
    async def update_many(self, query, update):
        self.calls.append((query, update))
        return SimpleNamespace(modified_count=1)


class _DeliveryCollection:
    def __init__(self): self.documents = []
    async def update_one(self, query, update, upsert=False):
        self.documents.append((query, update["$setOnInsert"]))
        return SimpleNamespace(upserted_id=ObjectId())


class NotificationReadTests(unittest.IsolatedAsyncioTestCase):
    def test_registry_uses_name_and_never_internal_id_in_message(self):
        title, message = render_notification("MARKETING_STATUS_CHANGED", {"subject_name": "Customer Name", "subject_id": "507f1f77bcf86cd799439011"})
        self.assertTrue(title)
        self.assertIn("Customer Name", message)
        self.assertNotIn("507f1f77bcf86cd799439011", message)

    async def test_mark_all_scopes_to_canonical_account(self):
        collection = _FakeCollection()
        with patch("app.api.protected.notifications.notification_service", SimpleNamespace(collection=collection)):
            result = await mark_all_notifications_read({"account_id": "account-1"})
        self.assertEqual(result["modified_count"], 1)
        query, update = collection.calls[0]
        self.assertEqual(query["recipient_account_id"], "account-1")
        self.assertTrue(update["$set"]["is_read"])

    async def test_publish_failure_can_broadcast_to_ceo(self):
        resolver = AsyncMock(return_value=[])
        with patch.object(registry, "_resolve_accounts", resolver):
            await emit_notification("MARKETING_PUBLISH_FAILED", {"subject_name": "Khách hàng A"}, recipient_roles=("CEO",))
        self.assertEqual(resolver.await_args.kwargs["roles"], ["CEO"])

    async def test_one_idempotent_delivery_is_created_per_account(self):
        collection = _DeliveryCollection()
        accounts = [
            {"_id": ObjectId(), "recipient_name": "Nhân viên A"},
            {"_id": ObjectId(), "recipient_name": "Nhân viên B"},
        ]
        with (
            patch.object(registry, "get_database", return_value={"notifications": collection}),
            patch.object(registry, "_resolve_accounts", AsyncMock(return_value=accounts)),
            patch.object(registry, "publish_notification", AsyncMock()) as publish,
        ):
            created = await emit_notification("MARKETING_PUBLISH_FAILED", {"subject_name": "Khách hàng A"}, event_id="event-1")
        self.assertEqual(created, 2)
        self.assertEqual(len({item[1]["delivery_key"] for item in collection.documents}), 2)
        self.assertEqual(publish.await_count, 2)


    def test_generic_notification_is_repaired_for_display(self):
        repaired = repair_legacy_notification({
            "event_type": "MARKETING_PUBLISH_FAILED",
            "title": "Thông báo nghiệp vụ",
            "message": "Có cập nhật mới liên quan đến đối tượng chưa xác định.",
            "subject_type": "CANDIDATE",
            "subject_name": "đối tượng chưa xác định",
            "actor_name": "Hệ thống",
        })
        self.assertEqual(repaired["title"], registry.TEMPLATES["MARKETING_PUBLISH_FAILED"].title)
        self.assertNotIn("unknown", repaired["message"])

if __name__ == "__main__":
    unittest.main()
