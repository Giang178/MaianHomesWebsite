import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
from starlette.requests import Request

from app.api.session_validation import validate_session_identity
from app.modules.activity.outbox import process_next
from app.modules.website.common.idempotency import execute_once
from app.modules.identity.sessions.service import SessionService


def request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/public/auth/login",
            "headers": [(b"user-agent", b"test-agent")],
            "query_string": b"",
            "client": ("127.0.0.1", 1234),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


class CrashRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_activity_outbox_claims_expired_processing_with_owner_guard(self):
        now = datetime.now(timezone.utc)
        item = {
            "_id": "outbox-1",
            "event_key": "event-1",
            "event": {"event_key": "event-1"},
            "status": "PROCESSING",
            "attempts": 2,
            "available_at": now - timedelta(minutes=1),
            "locked_until": now - timedelta(seconds=1),
        }
        outbox = MagicMock()
        outbox.find_one_and_update = AsyncMock(return_value=item)
        outbox.update_one = AsyncMock(return_value=SimpleNamespace(modified_count=1))
        events = MagicMock()
        events.insert_one = AsyncMock()
        database = {
            "activity_event_outbox": outbox,
            "activity_events": events,
        }
        with (
            patch("app.modules.activity.outbox.get_database", return_value=database),
            patch("app.core.metrics.observe_activity_write"),
        ):
            self.assertTrue(await process_next())

        claim_query = outbox.find_one_and_update.await_args.args[0]
        self.assertIn("PROCESSING", claim_query["status"]["$in"])
        self.assertIn("$or", claim_query)
        completion_query = outbox.update_one.await_args.args[0]
        self.assertEqual(completion_query["status"], "PROCESSING")
        self.assertTrue(completion_query["locked_by"].startswith("activity_"))

    async def test_idempotency_reclaims_only_an_expired_lease(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(
            return_value={
                "identity": "scope:actor:key",
                "state": "PROCESSING",
            }
        )
        collection.insert_one = AsyncMock(side_effect=DuplicateKeyError("duplicate"))
        collection.find_one_and_update = AsyncMock(
            return_value={
                "identity": "scope:actor:key",
                "state": "PROCESSING",
            }
        )
        collection.update_one = AsyncMock(
            return_value=SimpleNamespace(modified_count=1)
        )
        operation = AsyncMock(return_value={"ok": True})
        with patch(
            "app.modules.website.common.idempotency.get_database",
            return_value={"website_idempotency": collection},
        ):
            result = await execute_once(
                key="request-key",
                scope="scope",
                actor_id="actor",
                operation=operation,
            )

        self.assertEqual(result, {"ok": True})
        reclaim_query = collection.find_one_and_update.await_args.args[0]
        self.assertEqual(reclaim_query["state"], "PROCESSING")
        self.assertIn("$or", reclaim_query)
        completion_query = collection.update_one.await_args.args[0]
        self.assertIn("lease_owner", completion_query)

    async def test_external_side_effect_is_never_replayed_after_a_crash(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(
            return_value={"identity": "scope:actor:key", "state": "PROCESSING"}
        )
        collection.insert_one = AsyncMock(side_effect=DuplicateKeyError("duplicate"))
        operation = AsyncMock()
        with patch(
            "app.modules.website.common.idempotency.get_database",
            return_value={"website_idempotency": collection},
        ):
            with self.assertRaises(HTTPException) as context:
                await execute_once(
                    key="request-key",
                    scope="email-test",
                    actor_id="actor",
                    operation=operation,
                    reclaimable=False,
                )

        self.assertEqual(
            context.exception.detail,
            {"code": "IDEMPOTENCY_RECOVERY_REQUIRED"},
        )
        operation.assert_not_awaited()


class SessionConsistencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_two_five_and_ten_logins_leave_exactly_one_active_session(self):
        class UniqueActiveCollection:
            def __init__(self):
                self.documents = []
                self.lock = asyncio.Lock()

            async def update_many(self, query, update):
                async with self.lock:
                    count = 0
                    for document in self.documents:
                        if (
                            document["employee_id"] == query["employee_id"]
                            and document["purpose"] == query["purpose"]
                            and document.get("revoked_at") is None
                        ):
                            document.update(update["$set"])
                            count += 1
                await asyncio.sleep(0)
                return SimpleNamespace(modified_count=count)

            async def insert_one(self, document):
                async with self.lock:
                    if any(
                        item.get("active_key") == document["active_key"]
                        and item.get("revoked_at") is None
                        for item in self.documents
                    ):
                        raise DuplicateKeyError("active session")
                    self.documents.append(dict(document))
                await asyncio.sleep(0)
                return SimpleNamespace(inserted_id=document["_id"])

        account = {
            "id": "account-1",
            "employee_id": "employee-1",
            "email": "employee@example.com",
            "role": "ADMIN",
            "token_version": 2,
        }
        for concurrency in (2, 5, 10):
            collection = UniqueActiveCollection()
            service = SessionService()
            with patch.object(
                SessionService,
                "collection",
                new=property(lambda _: collection),
            ):
                await asyncio.gather(
                    *(service.create(account, request()) for _ in range(concurrency)),
                    return_exceptions=True,
                )
            active = [
                item for item in collection.documents if item.get("revoked_at") is None
            ]
            self.assertEqual(len(active), 1, concurrency)

    async def test_concurrent_collision_retries_and_leaves_one_insert(self):
        service = SessionService()
        collection = MagicMock()
        collection.update_many = AsyncMock()
        collection.insert_one = AsyncMock(
            side_effect=[DuplicateKeyError("active session"), None]
        )
        account = {
            "id": "account-1",
            "employee_id": "employee-1",
            "email": "employee@example.com",
            "role": "ADMIN",
            "token_version": 2,
        }
        with patch.object(
            SessionService,
            "collection",
            new=property(lambda _: collection),
        ):
            session = await service.create(account, request())

        self.assertEqual(collection.insert_one.await_count, 2)
        self.assertEqual(collection.update_many.await_count, 2)
        self.assertEqual(session["employee_id"], "account-1")
        self.assertEqual(session["purpose"], "ACCESS")
        self.assertEqual(session["active_key"], "account-1:ACCESS")

    async def test_shared_validation_rejects_revoked_session(self):
        account = SimpleNamespace(
            id="account-1",
            employee_id="employee-1",
            role="ADMIN",
            account_status="ACTIVE",
            is_active=True,
            token_version=3,
        )
        with (
            patch(
                "app.api.session_validation.account_service.get_by_employee_id",
                AsyncMock(return_value=account),
            ),
            patch(
                "app.api.session_validation.session_service.validate",
                AsyncMock(side_effect=HTTPException(status_code=401)),
            ),
        ):
            with self.assertRaises(HTTPException):
                await validate_session_identity(
                    {
                        "id": "employee-1",
                        "role": "ADMIN",
                        "token_version": 3,
                        "session_id": "revoked-session",
                    }
                )


if __name__ == "__main__":
    unittest.main()
