import asyncio
import json
import threading
import unittest
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from botocore.exceptions import ClientError, EndpointConnectionError
from pydantic import ValidationError
from pymongo.errors import AutoReconnect

from app import main as main_module
from app.core import notification_bus, runtime_clients, worker_health
from app.core.config import Settings, settings
from app.db import mongodb
from app.infrastructure.object_storage import (
    StorageCapacityError,
    StorageObjectNotFoundError,
    StorageService,
    StorageUnavailableError,
)


class CapacityConfigurationTests(unittest.TestCase):
    def test_fail_fast_timeout_and_concurrency_knobs_are_bounded(self):
        invalid_values = (
            ("REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS", 0),
            ("REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS", 31),
            ("REDIS_POOL_WAIT_TIMEOUT_SECONDS", 0),
            ("REDIS_POOL_WAIT_TIMEOUT_SECONDS", 31),
            ("MONGODB_SERVER_SELECTION_TIMEOUT_MS", 499),
            ("MONGODB_SERVER_SELECTION_TIMEOUT_MS", 30001),
            ("MONGODB_CONNECT_TIMEOUT_MS", 499),
            ("MONGODB_CONNECT_TIMEOUT_MS", 30001),
            ("MONGODB_SOCKET_TIMEOUT_MS", 999),
            ("MONGODB_SOCKET_TIMEOUT_MS", 120001),
            ("MONGODB_WAIT_QUEUE_TIMEOUT_MS", 99),
            ("MONGODB_WAIT_QUEUE_TIMEOUT_MS", 30001),
            ("S3_MAX_CONCURRENCY", 0),
            ("S3_MAX_CONCURRENCY", 257),
            ("S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS", 0),
            ("S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS", 31),
        )
        for field, value in invalid_values:
            with self.subTest(field=field, value=value), self.assertRaises(
                ValidationError
            ):
                Settings(
                    _env_file=None,
                    ENVIRONMENT="development",
                    DEPLOYMENT_TIER="development",
                    LOAD_TEST_TARGET_MARKER="",
                    SECRET_KEY="local-test-secret",
                    **{field: value},
                )


class RedisPoolIsolationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await runtime_clients.close_redis_client()

    async def asyncTearDown(self):
        await runtime_clients.close_redis_client()

    async def test_command_pool_is_fail_fast_but_pubsub_has_no_read_timeout(self):
        command_pool = object()
        pubsub_pool = object()
        command_client = object()
        pubsub_client = object()

        with patch(
            "redis.asyncio.BlockingConnectionPool.from_url",
            side_effect=(command_pool, pubsub_pool),
        ) as build_pool, patch(
            "redis.asyncio.Redis",
            side_effect=(command_client, pubsub_client),
        ) as build_client:
            self.assertIs(runtime_clients._build_redis_client(), command_client)
            self.assertIs(
                runtime_clients._build_redis_pubsub_client(), pubsub_client
            )

        command_kwargs = build_pool.call_args_list[0].kwargs
        pubsub_kwargs = build_pool.call_args_list[1].kwargs
        self.assertEqual(
            command_kwargs["socket_timeout"],
            settings.REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS,
        )
        self.assertEqual(
            command_kwargs["timeout"], settings.REDIS_POOL_WAIT_TIMEOUT_SECONDS
        )
        self.assertEqual(
            command_kwargs["max_connections"], settings.REDIS_MAX_CONNECTIONS
        )
        self.assertNotIn("socket_timeout", pubsub_kwargs)
        self.assertEqual(
            pubsub_kwargs["timeout"], settings.REDIS_POOL_WAIT_TIMEOUT_SECONDS
        )
        self.assertEqual(pubsub_kwargs["max_connections"], 2)
        self.assertEqual(
            [call.kwargs["connection_pool"] for call in build_client.call_args_list],
            [command_pool, pubsub_pool],
        )

    async def test_shutdown_closes_command_and_pubsub_pools_once(self):
        command_client = MagicMock()
        command_client.aclose = AsyncMock()
        pubsub_client = MagicMock()
        pubsub_client.aclose = AsyncMock()

        with patch.object(
            runtime_clients, "_build_redis_client", return_value=command_client
        ), patch.object(
            runtime_clients,
            "_build_redis_pubsub_client",
            return_value=pubsub_client,
        ):
            self.assertIs(runtime_clients.get_redis_client(), command_client)
            self.assertIs(
                runtime_clients.get_redis_pubsub_client(), pubsub_client
            )
            await runtime_clients.close_redis_client()
            await runtime_clients.close_redis_client()

        command_client.aclose.assert_awaited_once_with(
            close_connection_pool=True
        )
        pubsub_client.aclose.assert_awaited_once_with(
            close_connection_pool=True
        )

    async def test_notification_subscriber_uses_the_dedicated_client(self):
        async def cancelled_listener():
            raise asyncio.CancelledError
            yield {}

        pubsub = MagicMock()
        pubsub.subscribe = AsyncMock()
        pubsub.listen.return_value = cancelled_listener()
        pubsub.aclose = AsyncMock()
        pubsub_client = MagicMock()
        pubsub_client.pubsub.return_value = pubsub

        with patch.object(
            notification_bus,
            "get_redis_pubsub_client",
            return_value=pubsub_client,
        ) as get_pubsub, self.assertRaises(asyncio.CancelledError):
            await notification_bus.notification_subscriber_loop()

        get_pubsub.assert_called_once_with()
        pubsub.subscribe.assert_awaited_once_with(settings.NOTIFICATIONS_CHANNEL)
        pubsub.aclose.assert_awaited_once_with()


class WorkerHeartbeatIdentityTests(unittest.IsolatedAsyncioTestCase):
    async def test_heartbeat_identifies_exact_release_tier_and_container(self):
        collection = MagicMock()
        collection.update_one = AsyncMock()
        fake_database = {"system_worker_heartbeats": collection}
        fake_uuid = SimpleNamespace(hex="a" * 32)

        with patch.object(
            worker_health.db_manager, "db", fake_database
        ), patch.object(
            worker_health.socket, "gethostname", return_value="container-123"
        ), patch.object(
            worker_health, "uuid4", return_value=fake_uuid
        ), patch.object(
            worker_health, "baked_image_revision", return_value="abc1234"
        ), patch.object(
            worker_health.settings, "APP_RELEASE", "abc1234"
        ), patch.object(
            worker_health.settings, "DEPLOYMENT_TIER", "staging"
        ), patch.object(
            worker_health.settings, "DEPLOYMENT_INSTANCE_ID", "maian-staging"
        ), patch.object(
            worker_health.asyncio,
            "sleep",
            AsyncMock(side_effect=asyncio.CancelledError),
        ), self.assertRaises(
            asyncio.CancelledError
        ):
            await worker_health.heartbeat_loop("content-worker")

        running = collection.update_one.await_args_list[0].args[1]["$set"]
        self.assertEqual(running["instance_id"], "container-123-aaaaaaaaaa")
        self.assertEqual(running["release"], "abc1234")
        self.assertEqual(running["image_revision"], "abc1234")
        self.assertEqual(running["deployment_tier"], "staging")
        self.assertEqual(running["deployment_instance_id"], "maian-staging")
        self.assertEqual(running["status"], "running")
        self.assertIn("started_at", running)
        stopped = collection.update_one.await_args_list[1].args[1]["$set"]
        self.assertEqual(stopped["status"], "stopped")

    async def test_transient_heartbeat_write_retries_without_stopping_worker(self):
        collection = MagicMock()
        collection.update_one = AsyncMock(
            side_effect=(AutoReconnect("redacted-secret"), None, None)
        )
        fake_database = {"system_worker_heartbeats": collection}

        with patch.object(
            worker_health.db_manager, "db", fake_database
        ), patch.object(
            worker_health.asyncio,
            "sleep",
            AsyncMock(side_effect=(None, asyncio.CancelledError)),
        ) as sleep, patch.object(worker_health.logger, "warning") as warning, self.assertRaises(
            asyncio.CancelledError
        ):
            await worker_health.heartbeat_loop("content-worker", interval_seconds=30)

        self.assertEqual(collection.update_one.await_count, 3)
        self.assertEqual(sleep.await_args_list[0].args, (1,))
        self.assertEqual(sleep.await_args_list[1].args, (30,))
        warning.assert_called_once()
        self.assertEqual(
            warning.call_args.kwargs["extra"]["exception_type"], "AutoReconnect"
        )
        self.assertNotIn("redacted-secret", str(warning.call_args))

    async def test_stop_heartbeat_failure_does_not_mask_cancellation(self):
        collection = MagicMock()
        collection.update_one = AsyncMock(
            side_effect=(None, AutoReconnect("redacted-secret"))
        )
        fake_database = {"system_worker_heartbeats": collection}

        with patch.object(
            worker_health.db_manager, "db", fake_database
        ), patch.object(
            worker_health.asyncio,
            "sleep",
            AsyncMock(side_effect=asyncio.CancelledError),
        ), patch.object(worker_health.logger, "warning") as warning, self.assertRaises(
            asyncio.CancelledError
        ):
            await worker_health.heartbeat_loop("content-worker")

        warning.assert_called_once()
        self.assertEqual(
            warning.call_args.kwargs["extra"]["exception_type"], "AutoReconnect"
        )
        self.assertNotIn("redacted-secret", str(warning.call_args))


class S3ConcurrencyGateTests(unittest.IsolatedAsyncioTestCase):
    async def test_stream_holds_the_gate_until_closed(self):
        service = StorageService()
        first_body = MagicMock()
        second_body = MagicMock()
        client = MagicMock()
        client.get_object.side_effect = (
            {"Body": first_body, "ContentLength": 1, "ContentType": "image/png"},
            {"Body": second_body, "ContentLength": 1, "ContentType": "image/png"},
        )

        with patch.object(settings, "S3_MAX_CONCURRENCY", 1), patch.object(
            settings, "S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS", 0.01
        ), patch.object(service, "_client", return_value=client):
            first_stream, _, _ = await service.open_stream("inventory/first.png")
            with self.assertRaises(StorageCapacityError):
                await service.open_stream("inventory/blocked.png")

            await first_stream.aclose()
            second_stream, _, _ = await service.open_stream(
                "inventory/second.png"
            )
            await second_stream.aclose()

        self.assertEqual(client.get_object.call_count, 2)
        first_body.close.assert_called_once_with()
        second_body.close.assert_called_once_with()

    async def test_cancelled_sdk_call_keeps_gate_until_thread_finishes(self):
        service = StorageService()
        started = threading.Event()
        release = threading.Event()
        cancelled_body = MagicMock()
        next_body = MagicMock()

        def get_object(**_kwargs):
            if not started.is_set():
                started.set()
                release.wait(timeout=2)
                return {
                    "Body": cancelled_body,
                    "ContentLength": 1,
                    "ContentType": "image/png",
                }
            return {
                "Body": next_body,
                "ContentLength": 1,
                "ContentType": "image/png",
            }

        client = MagicMock()
        client.get_object.side_effect = get_object

        try:
            with patch.object(settings, "S3_MAX_CONCURRENCY", 1), patch.object(
                settings, "S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS", 0.01
            ), patch.object(service, "_client", return_value=client):
                opening = asyncio.create_task(
                    service.open_stream("inventory/cancelled.png")
                )
                self.assertTrue(await asyncio.to_thread(started.wait, 1))
                opening.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await opening

                with self.assertRaises(StorageCapacityError):
                    await service.open_stream("inventory/still-busy.png")

                release.set()
                for _ in range(100):
                    if cancelled_body.close.called:
                        break
                    await asyncio.sleep(0.01)
                self.assertTrue(cancelled_body.close.called)

                next_stream, _, _ = await service.open_stream(
                    "inventory/after-cancel.png"
                )
                await next_stream.aclose()
        finally:
            release.set()

        next_body.close.assert_called_once_with()

    async def test_s3_not_found_and_outage_errors_are_distinct(self):
        cases = (
            (
                ClientError(
                    {
                        "Error": {"Code": "NoSuchKey", "Message": "missing"},
                        "ResponseMetadata": {"HTTPStatusCode": 404},
                    },
                    "GetObject",
                ),
                StorageObjectNotFoundError,
            ),
            (
                EndpointConnectionError(endpoint_url="http://object-storage"),
                StorageUnavailableError,
            ),
        )
        for sdk_error, expected_error in cases:
            with self.subTest(expected_error=expected_error.__name__):
                service = StorageService()
                client = MagicMock()
                client.get_object.side_effect = sdk_error
                with patch.object(
                    service, "_client", return_value=client
                ), self.assertRaises(expected_error):
                    await service.open_stream("inventory/file.png")


class MongoTimeoutConfigurationTests(unittest.IsolatedAsyncioTestCase):
    async def test_motor_client_receives_all_bounded_timeouts(self):
        client = MagicMock()
        client.admin.command = AsyncMock(return_value={"ok": 1})
        client.__getitem__.return_value = MagicMock()
        isolated_manager = mongodb.MongoDB()

        with patch.object(mongodb, "db_manager", isolated_manager), patch.object(
            mongodb, "AsyncIOMotorClient", return_value=client
        ) as build_client, patch.object(
            settings, "ENSURE_INDEXES_ON_STARTUP", False
        ):
            await mongodb.connect_to_mongo()
            await mongodb.close_mongo_connection()

        kwargs = build_client.call_args.kwargs
        self.assertEqual(
            kwargs["serverSelectionTimeoutMS"],
            settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        )
        self.assertEqual(
            kwargs["connectTimeoutMS"], settings.MONGODB_CONNECT_TIMEOUT_MS
        )
        self.assertEqual(
            kwargs["socketTimeoutMS"], settings.MONGODB_SOCKET_TIMEOUT_MS
        )
        self.assertEqual(
            kwargs["waitQueueTimeoutMS"],
            settings.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
        )
        client.close.assert_called_once_with()


class ReadinessIdentityTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _database():
        bootstrap = MagicMock()
        bootstrap.find_one = AsyncMock(
            return_value={"_id": "current", "status": "complete"}
        )
        queue = MagicMock()
        queue.count_documents = AsyncMock(return_value=0)
        queue.find_one = AsyncMock(return_value=None)
        database = MagicMock()
        database.command = AsyncMock(return_value={"ok": 1})
        database.__getitem__.side_effect = lambda name: (
            bootstrap if name == "system_bootstrap" else queue
        )
        return database

    async def _ready_payload(self, *, tier: str, marker: str):
        manager = SimpleNamespace(db=self._database(), client=MagicMock())
        overrides = {
            "ENVIRONMENT": "production",
            "DEPLOYMENT_TIER": tier,
            "DEPLOYMENT_INSTANCE_ID": "maian-staging" if tier == "staging" else "maian-production-primary",
            "APP_RELEASE": "release-sha-123",
            "LOAD_TEST_TARGET_MARKER": marker,
            "RATE_LIMIT_STORAGE_URI": "memory://",
            "NOTIFICATIONS_REALTIME_ENABLED": False,
            "S3_ENABLED": False,
            "OLLAMA_REQUIRED": False,
            "GEMINI_REQUIRED": False,
            "ACCOUNT_CREDENTIAL_DELIVERY_ENABLED": False,
            "PASSWORD_RESET_ENABLED": False,
            "WORKER_HEALTH_REQUIRED": False,
            "SYSTEM_MONITOR_REQUIRED": False,
        }
        with ExitStack() as stack:
            stack.enter_context(patch.object(mongodb, "db_manager", manager))
            for name, value in overrides.items():
                stack.enter_context(patch.object(settings, name, value))
            response = await main_module.health_ready()
        self.assertEqual(response.status_code, 200)
        return json.loads(response.body)

    async def test_staging_readiness_exposes_target_identity(self):
        payload = await self._ready_payload(
            tier="staging", marker="staging-capacity-target-2026"
        )
        self.assertEqual(payload["environment"], "production")
        self.assertEqual(payload["deployment_tier"], "staging")
        self.assertEqual(payload["deployment_instance_id"], "maian-staging")
        self.assertEqual(payload["release"], "release-sha-123")
        self.assertEqual(
            payload["load_test_marker"], "staging-capacity-target-2026"
        )

    async def test_production_readiness_never_echoes_a_marker(self):
        payload = await self._ready_payload(
            tier="production", marker="accidental-marker"
        )
        self.assertEqual(payload["deployment_tier"], "production")
        self.assertEqual(
            payload["deployment_instance_id"], "maian-production-primary"
        )
        self.assertEqual(payload["load_test_marker"], "")

    async def test_worker_readiness_query_is_scoped_to_deployment_instance(self):
        database = self._database()
        worker_collection = database["system_worker_heartbeats"]
        manager = SimpleNamespace(db=database, client=MagicMock())
        overrides = {
            "ENVIRONMENT": "production",
            "DEPLOYMENT_TIER": "production",
            "DEPLOYMENT_INSTANCE_ID": "maian-production-primary",
            "APP_RELEASE": "release-sha-123",
            "LOAD_TEST_TARGET_MARKER": "",
            "RATE_LIMIT_STORAGE_URI": "memory://",
            "NOTIFICATIONS_REALTIME_ENABLED": False,
            "S3_ENABLED": False,
            "OLLAMA_REQUIRED": False,
            "GEMINI_REQUIRED": False,
            "ACCOUNT_CREDENTIAL_DELIVERY_ENABLED": False,
            "PASSWORD_RESET_ENABLED": False,
            "WORKER_HEALTH_REQUIRED": True,
            "SYSTEM_MONITOR_REQUIRED": False,
            "MARKETING_EMBEDDED_JOBS": True,
        }
        with ExitStack() as stack:
            stack.enter_context(patch.object(mongodb, "db_manager", manager))
            for name, value in overrides.items():
                stack.enter_context(patch.object(settings, name, value))
            response = await main_module.health_ready()

        self.assertEqual(response.status_code, 503)
        worker_calls = [
            call
            for call in worker_collection.find_one.await_args_list
            if "deployment_instance_id" in call.args[0]
        ]
        self.assertEqual(len(worker_calls), 3)
        for call in worker_calls:
            query = call.args[0]
            self.assertEqual(
                query["deployment_instance_id"], "maian-production-primary"
            )


if __name__ == "__main__":
    unittest.main()
