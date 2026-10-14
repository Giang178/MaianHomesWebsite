import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.api import ws
from app.core import notification_bus
from app.core.config import settings
from app.core.sockets import ConnectionManager


class WebSocketAvailabilityTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _websocket():
        return SimpleNamespace(
            cookies={"access_token": "token"},
            query_params={},
            accept=AsyncMock(),
            close=AsyncMock(),
        )

    async def test_realtime_disabled_closes_normally_before_authentication(self):
        websocket = self._websocket()
        with patch.object(settings, "NOTIFICATIONS_REALTIME_ENABLED", False), patch.object(
            ws, "verify_token"
        ) as verify:
            await ws.websocket_endpoint(websocket)

        verify.assert_not_called()
        websocket.accept.assert_awaited_once_with()
        websocket.close.assert_awaited_once_with(
            code=1000,
            reason="Realtime disabled",
        )

    async def test_unavailable_notification_bus_closes_with_retryable_code(self):
        websocket = self._websocket()
        with patch.object(settings, "NOTIFICATIONS_REALTIME_ENABLED", True), patch.object(
            ws, "notification_bus_ready", return_value=False
        ), patch.object(ws, "verify_token") as verify:
            await ws.websocket_endpoint(websocket)

        verify.assert_not_called()
        websocket.accept.assert_awaited_once_with()
        websocket.close.assert_awaited_once_with(
            code=notification_bus.NOTIFICATION_BUS_RETRY_CLOSE_CODE,
            reason=notification_bus.NOTIFICATION_BUS_RETRY_CLOSE_REASON,
        )


class ConnectionManagerResilienceTests(unittest.IsolatedAsyncioTestCase):
    async def test_close_all_closes_every_socket_and_clears_indexes(self):
        manager = ConnectionManager()
        first = MagicMock()
        first.accept = AsyncMock()
        first.close = AsyncMock()
        second = MagicMock()
        second.accept = AsyncMock()
        second.close = AsyncMock(side_effect=RuntimeError("already closed"))
        await manager.connect(first, "MARKETING_STAFF", "account-1")
        await manager.connect(second, "MARKETING_MANAGER", "account-2")

        await manager.close_all(code=1013, reason="retry")

        first.close.assert_awaited_once_with(code=1013, reason="retry")
        second.close.assert_awaited_once_with(code=1013, reason="retry")
        self.assertEqual(manager.active_connections, {})
        self.assertEqual(manager.user_connections, {})
        self.assertEqual(manager.connection_identity, {})


class NotificationSubscriberResilienceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        notification_bus._set_notification_bus_ready(False)

    async def asyncTearDown(self):
        notification_bus._set_notification_bus_ready(False)

    async def test_subscriber_failure_marks_bus_unready_and_closes_local_sockets(self):
        async def failing_messages():
            self.assertTrue(notification_bus.notification_bus_ready())
            raise ConnectionError("redis connection lost")
            yield  # pragma: no cover - makes this an async generator

        pubsub = SimpleNamespace(
            subscribe=AsyncMock(),
            listen=lambda: failing_messages(),
            aclose=AsyncMock(),
        )
        client = SimpleNamespace(pubsub=MagicMock(return_value=pubsub))

        async def assert_unready_before_close(*, code, reason):
            self.assertFalse(notification_bus.notification_bus_ready())
            self.assertEqual(code, notification_bus.NOTIFICATION_BUS_RETRY_CLOSE_CODE)
            self.assertEqual(reason, notification_bus.NOTIFICATION_BUS_RETRY_CLOSE_REASON)

        close_all = AsyncMock(side_effect=assert_unready_before_close)
        with patch.object(settings, "NOTIFICATIONS_REALTIME_ENABLED", True), patch.object(
            notification_bus, "get_redis_pubsub_client", return_value=client
        ), patch.object(notification_bus.manager, "close_all", close_all), patch.object(
            notification_bus.logger, "exception"
        ), patch.object(
            notification_bus.asyncio,
            "sleep",
            new=AsyncMock(side_effect=asyncio.CancelledError),
        ):
            with self.assertRaises(asyncio.CancelledError):
                await notification_bus.notification_subscriber_loop()

        pubsub.subscribe.assert_awaited_once_with(settings.NOTIFICATIONS_CHANNEL)
        pubsub.aclose.assert_awaited_once_with()
        close_all.assert_awaited_once_with(
            code=notification_bus.NOTIFICATION_BUS_RETRY_CLOSE_CODE,
            reason=notification_bus.NOTIFICATION_BUS_RETRY_CLOSE_REASON,
        )
        self.assertFalse(notification_bus.notification_bus_ready())


if __name__ == "__main__":
    unittest.main()
