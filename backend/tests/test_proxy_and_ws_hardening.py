import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.api.ws import websocket_endpoint
from app.core.config import settings


class WebSocketAuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def test_query_token_is_ignored_when_compatibility_is_disabled(self):
        websocket = type("FakeWebSocket", (), {})()
        websocket.cookies = {}
        websocket.query_params = {"token": "must-not-be-read"}
        websocket.accept = AsyncMock()
        websocket.close = AsyncMock()

        with patch.object(settings, "NOTIFICATIONS_REALTIME_ENABLED", True), patch(
            "app.api.ws.notification_bus_ready", return_value=True
        ), patch.object(settings, "WS_ALLOW_QUERY_TOKEN", False), patch(
            "app.api.ws.verify_token"
        ) as verify:
            await websocket_endpoint(websocket)

        verify.assert_not_called()
        websocket.close.assert_awaited_once_with(
            code=1008,
            reason="Authentication required",
        )


class ProxyAndCollectionContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parents[2]

    def test_nginx_upgrade_header_is_conditional(self):
        for relative in (
            "infrastructure/nginx.conf",
            "infrastructure/nginx.production.conf",
        ):
            source = (self.root / relative).read_text(encoding="utf-8")
            self.assertIn("map $http_upgrade $connection_upgrade", source)
            self.assertIn("proxy_set_header Connection $connection_upgrade;", source)
            self.assertNotIn('proxy_set_header Connection "upgrade";', source)

    def test_next_proxy_does_not_force_connection_close(self):
        source = (
            self.root / "frontend/src/app/api/[...path]/route.ts"
        ).read_text(encoding="utf-8")
        self.assertNotIn("requestHeaders.set('Connection', 'close')", source)
        self.assertIn("requestHeaders.delete('connection')", source)

    def test_startup_indexes_match_website_only_runtime(self):
        source = (self.root / "backend/app/db/mongodb.py").read_text(encoding="utf-8")
        for index_initializer in (
            "ensure_identity_indexes",
            "ensure_marketing_indexes",
            "ensure_website_indexes",
        ):
            self.assertIn(f"await {index_initializer}(db_manager.db)", source)
        self.assertNotIn("ensure_hr_indexes", source)
        self.assertNotIn("ensure_sales_indexes", source)


if __name__ == "__main__":
    unittest.main()
