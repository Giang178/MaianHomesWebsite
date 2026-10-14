import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, call, patch

from fastapi import HTTPException, WebSocketDisconnect
from pydantic import ValidationError

from app.api import ws
from app.core import blocking_work, notification_bus, runtime_clients
from app.core.config import Settings, settings
from app.modules.content.media.api import read_media
from app.modules.content.media.service import (
    MarketingMediaService,
    marketing_media_service,
)
from app.infrastructure.object_storage import StorageService
from app.modules.identity.accounts.service import account_service


class RuntimeConfigurationTests(unittest.TestCase):
    def test_websocket_recheck_interval_is_bounded(self):
        for value in (14, 301):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                Settings(
                    ENVIRONMENT="development",
                    SECRET_KEY="local-test-secret",
                    WS_SESSION_RECHECK_SECONDS=value,
                )

    def test_runtime_pool_sizes_are_bounded(self):
        for field, value in (
            ("REDIS_MAX_CONNECTIONS", 7),
            ("S3_MAX_POOL_CONNECTIONS", 9),
            ("BCRYPT_MAX_WORKERS", 0),
        ):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                Settings(
                    ENVIRONMENT="development",
                    SECRET_KEY="local-test-secret",
                    **{field: value},
                )


class RedisRuntimeClientTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await runtime_clients.close_redis_client()

    async def asyncTearDown(self):
        await runtime_clients.close_redis_client()

    async def test_one_client_is_reused_and_closed_once_per_process(self):
        client = MagicMock()
        client.aclose = AsyncMock()
        with patch.object(runtime_clients, "_build_redis_client", return_value=client) as build:
            self.assertIs(runtime_clients.get_redis_client(), client)
            self.assertIs(runtime_clients.get_redis_client(), client)
            build.assert_called_once_with()

            await runtime_clients.close_redis_client()
            await runtime_clients.close_redis_client()

        client.aclose.assert_awaited_once_with(close_connection_pool=True)

    async def test_notification_publish_reuses_runtime_client(self):
        client = MagicMock()
        client.publish = AsyncMock(return_value=1)
        client.aclose = AsyncMock()
        event = {"recipient_account_id": "account-1", "payload": {"type": "notification"}}
        with patch.object(settings, "NOTIFICATIONS_REALTIME_ENABLED", True), patch.object(
            notification_bus, "get_redis_client", return_value=client
        ):
            await notification_bus.publish_notification(event)

        client.publish.assert_awaited_once()
        client.aclose.assert_not_awaited()


class StorageRuntimeClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_s3_client_is_reused_and_shutdown_is_idempotent(self):
        service = StorageService()
        client = MagicMock()
        with patch("boto3.client", return_value=client) as create_client:
            self.assertIs(service._client(), client)
            self.assertIs(service._client(), client)
            create_client.assert_called_once()
            self.assertEqual(
                create_client.call_args.kwargs["config"].max_pool_connections,
                settings.S3_MAX_POOL_CONNECTIONS,
            )

            await service.close()
            await service.close()

        client.close.assert_called_once_with()

    async def test_s3_stream_does_not_buffer_entire_object_and_closes_body(self):
        service = StorageService()
        body = MagicMock()
        body.read.side_effect = [b"first", b"second", b""]
        client = MagicMock()
        client.get_object.return_value = {
            "Body": body,
            "ContentLength": 11,
            "ContentType": "image/webp",
        }
        with patch.object(service, "_client", return_value=client):
            stream, length, content_type = await service.open_stream(
                "inventory/file.webp", chunk_size=5
            )
            content = b"".join([chunk async for chunk in stream])

        self.assertEqual(content, b"firstsecond")
        self.assertEqual(length, 11)
        self.assertEqual(content_type, "image/webp")
        body.close.assert_called_once_with()


class MarketingMediaStreamingTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_s3_media_uses_streaming_storage_contract(self):
        service = MarketingMediaService()
        document = {
            "_id": "a" * 32,
            "lifecycle_status": "ACTIVE",
            "storage_backend": "S3",
            "object_key": "marketing/projects/source.webp",
            "content_type": "image/webp",
            "size": 11,
            "checksum": "checksum-1",
        }
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=document)

        async def source_chunks():
            yield b"first"
            yield b"second"

        with patch(
            "app.modules.content.media.service.get_database",
            return_value={"media_assets": collection},
        ), patch(
            "app.modules.content.media.service.storage_service.open_stream",
            new=AsyncMock(return_value=(source_chunks(), 11, "image/webp")),
        ) as open_stream, patch(
            "app.modules.content.media.service.storage_service.get_bytes",
            new=AsyncMock(),
        ) as get_bytes:
            stream, metadata = await service.open_stream(document["_id"])
            content = b"".join([chunk async for chunk in stream])

        self.assertEqual(content, b"firstsecond")
        self.assertEqual(metadata["size"], 11)
        open_stream.assert_awaited_once_with(document["object_key"])
        get_bytes.assert_not_awaited()

    async def test_public_media_keeps_cache_headers_with_streaming_response(self):
        async def chunks():
            yield b"image"

        metadata = {
            "content_type": "image/webp",
            "size": 5,
            "checksum": "checksum-1",
        }
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        with patch(
            "app.modules.content.media.api.get_database",
            return_value={"media_assets": collection},
        ), patch.object(
            marketing_media_service,
            "open_stream",
            new=AsyncMock(return_value=(chunks(), metadata)),
        ):
            response = await read_media("a" * 32, None)

        self.assertEqual(response.media_type, "image/webp")
        self.assertEqual(response.headers["content-length"], "5")
        self.assertEqual(
            response.headers["cache-control"],
            "public, max-age=31536000, immutable",
        )
        self.assertEqual(response.headers["etag"], '"checksum-1"')
        self.assertEqual(
            b"".join([chunk async for chunk in response.body_iterator]),
            b"image",
        )


class PasswordOffloadTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await blocking_work.close_bcrypt_executor()

    async def asyncTearDown(self):
        await blocking_work.close_bcrypt_executor()

    async def test_bcrypt_executor_is_bounded_and_reused(self):
        with patch.object(settings, "BCRYPT_MAX_WORKERS", 2):
            first = blocking_work._get_bcrypt_executor()
            second = blocking_work._get_bcrypt_executor()
            self.assertIs(first, second)
            self.assertEqual(first._max_workers, 2)

            await blocking_work.close_bcrypt_executor()

        self.assertTrue(first._shutdown)

    async def test_bcrypt_hashing_is_offloaded(self):
        with patch(
            "app.modules.identity.accounts.service.run_bcrypt",
            new=AsyncMock(return_value="hash"),
        ) as run_bcrypt:
            self.assertEqual(await account_service.hash_password_async("plain"), "hash")

        args = run_bcrypt.await_args.args
        self.assertTrue(callable(args[0]))
        self.assertEqual(args[1:], ("plain",))

    async def test_bcrypt_verification_is_offloaded(self):
        with patch(
            "app.modules.identity.accounts.service.run_bcrypt",
            new=AsyncMock(return_value=True),
        ) as run_bcrypt:
            self.assertTrue(await account_service.verify_password_async("plain", "hash"))

        args = run_bcrypt.await_args.args
        self.assertTrue(callable(args[0]))
        self.assertEqual(args[1:], ("plain", "hash"))

    async def test_authenticate_uses_async_password_verification(self):
        account = SimpleNamespace(
            id="account-1",
            employee_id="employee-1",
            email="person@example.com",
            role="ADMIN",
            is_active=True,
            account_status="ACTIVE",
            locked_until=None,
            token_version=3,
            must_change_password=False,
            temporary_password_expires_at=None,
            password_hash="hash",
        )
        with patch.object(
            account_service, "get_by_email", new=AsyncMock(return_value=account)
        ), patch.object(
            account_service, "verify_password_async", new=AsyncMock(return_value=True)
        ) as verify:
            result = await account_service.authenticate("person@example.com", "plain")

        self.assertEqual(result["employee_id"], "employee-1")
        verify.assert_awaited_once_with("plain", "hash")


class WebSocketRevalidationTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _identity(current: dict) -> dict:
        return {**current, "account_id": "account-1", "role": "ADMIN"}

    async def test_ping_before_deadline_does_not_revalidate_session(self):
        websocket = SimpleNamespace(
            cookies={"access_token": "token"},
            query_params={},
            receive_text=AsyncMock(
                side_effect=['{"type":"ping"}', WebSocketDisconnect()]
            ),
            send_json=AsyncMock(),
            close=AsyncMock(),
        )
        validate = AsyncMock(side_effect=self._identity)
        with patch.object(ws, "verify_token", return_value={
            "sub": "employee-1",
            "email": "person@example.com",
            "role": "ADMIN",
            "token_version": 1,
            "sid": "session-1",
        }), patch.object(settings, "NOTIFICATIONS_REALTIME_ENABLED", True), patch.object(
            ws, "notification_bus_ready", return_value=True
        ), patch.object(ws, "validate_session_identity", validate), patch.object(
            ws.manager, "connect", new=AsyncMock()
        ), patch.object(ws.manager, "disconnect"), patch.object(
            settings, "NOTIFICATIONS_REALTIME_CANARY_IDS", ""
        ), patch.object(settings, "WS_SESSION_RECHECK_SECONDS", 60):
            await ws.websocket_endpoint(websocket)

        self.assertEqual(validate.await_count, 1)
        self.assertEqual(
            websocket.send_json.await_args_list,
            [call({"type": "ready"}), call({"type": "pong"})],
        )

    async def test_revoked_session_is_closed_on_recheck_deadline(self):
        async def wait_for_message():
            await asyncio.sleep(1)
            return '{"type":"ping"}'

        websocket = SimpleNamespace(
            cookies={"access_token": "token"},
            query_params={},
            receive_text=wait_for_message,
            send_json=AsyncMock(),
            close=AsyncMock(),
        )
        validate = AsyncMock(
            side_effect=[
                self._identity({
                    "id": "employee-1",
                    "session_id": "session-1",
                    "token_version": 1,
                }),
                HTTPException(status_code=401, detail="revoked"),
            ]
        )
        with patch.object(ws, "verify_token", return_value={
            "sub": "employee-1",
            "email": "person@example.com",
            "role": "ADMIN",
            "token_version": 1,
            "sid": "session-1",
        }), patch.object(settings, "NOTIFICATIONS_REALTIME_ENABLED", True), patch.object(
            ws, "notification_bus_ready", return_value=True
        ), patch.object(ws, "validate_session_identity", validate), patch.object(
            ws.manager, "connect", new=AsyncMock()
        ), patch.object(ws.manager, "disconnect"), patch.object(
            settings, "NOTIFICATIONS_REALTIME_CANARY_IDS", ""
        ), patch.object(settings, "WS_SESSION_RECHECK_SECONDS", 0.01):
            await ws.websocket_endpoint(websocket)

        self.assertEqual(validate.await_count, 2)
        websocket.close.assert_awaited_once_with(
            code=1008, reason="Session revoked"
        )


if __name__ == "__main__":
    unittest.main()
