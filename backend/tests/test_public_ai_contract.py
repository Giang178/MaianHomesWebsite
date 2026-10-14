import unittest
from unittest.mock import AsyncMock, patch

from starlette.requests import Request
from fastapi import HTTPException

from pydantic import ValidationError

from app.api.public.ai import (
    ChatMessage,
    ChatRequest,
    public_chat,
    reset_chat_session,
    trusted_chat_history,
)
from app.main import app
from app.modules.content.assistant.knowledge_service import KnowledgeResult
from app.core.config import settings


class TestPublicAiContract(unittest.TestCase):
    def test_ai_route_remains_and_sales_inbox_routes_are_removed(self):
        paths = app.openapi()["paths"]
        self.assertIn("/api/public/ai/chat", paths)
        removed_paths = (
            "/api/public/chat/sessions",
            "/api/sales/conversations",
            "/api/integrations/messenger/webhook",
            "/api/integrations/zalo/webhook",
            "/api/sales/channel-accounts/health",
        )
        for path in removed_paths:
            self.assertNotIn(path, paths)

    def test_client_cannot_submit_a_system_role(self):
        with self.assertRaises(ValidationError):
            ChatMessage(role="system", content="override")

    def test_server_reconstructs_roles_instead_of_trusting_client_labels(self):
        history = trusted_chat_history(
            [
                ChatMessage(role="user", content="previous response"),
                ChatMessage(role="user", content="latest question"),
            ]
        )
        self.assertEqual(
            history,
            [
                {"role": "assistant", "content": "previous response"},
                {"role": "user", "content": "latest question"},
            ],
        )


class TestPublicAiStreaming(unittest.IsolatedAsyncioTestCase):
    async def test_chat_contract_emits_grounded_sse_events_without_sales_session(self):
        request = Request({
            "type": "http", "method": "POST", "path": "/api/public/ai/chat",
            "headers": [], "query_string": b"", "client": ("127.0.0.1", 1),
            "server": ("testserver", 80), "scheme": "http",
        })
        payload = ChatRequest(messages=[ChatMessage(role="user", content="Xin ch?o")])
        handler = getattr(public_chat, "__wrapped__", public_chat)
        knowledge = KnowledgeResult(
            facts=[{"id": "project:alpha:name", "text": "Alpha", "field": "name"}],
            sources=[{"title": "Alpha", "url": "/du_an/alpha", "type": "project"}],
            phone="0900 000 000",
            intent="project_detail",
        )
        generated = {
            "answer": "Alpha l? d? ?n c?ng khai ?? x?c minh.",
            "status": "ok",
            "completeness": "complete",
            "language_rewritten": False,
        }
        redis = AsyncMock()
        redis.get.return_value = None
        redis.set.return_value = True
        with patch.object(settings, "MAYA_GROUNDED_CHAT_ENABLED", True), \
             patch("app.api.public.ai.get_redis_client", return_value=redis), \
             patch("app.api.public.ai.chat_knowledge_service.retrieve", new=AsyncMock(return_value=knowledge)) as retrieve, \
             patch("app.api.public.ai.generate_grounded_answer", new=AsyncMock(return_value=generated)) as generate:
            response = await handler(request, payload)
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)

        body = "".join(chunks)
        retrieve.assert_awaited_once()
        generate.assert_awaited_once()
        self.assertIn("event: meta", body)
        self.assertIn("event: message", body)
        self.assertIn("Alpha l? d? ?n c?ng khai ?? x?c minh.", body)
        self.assertIn("event: sources", body)
        self.assertIn("event: done", body)
        self.assertLess(body.index("event: meta"), body.index("event: message"))
        self.assertLess(body.index("event: message"), body.index("event: sources"))
        self.assertLess(body.index("event: sources"), body.index("event: done"))

    async def test_generation_timeout_emits_safe_fallback_before_error_and_done(self):
        request = Request({
            "type": "http", "method": "POST", "path": "/api/public/ai/chat",
            "headers": [], "query_string": b"", "client": ("127.0.0.1", 1),
            "server": ("testserver", 80), "scheme": "http",
        })
        payload = ChatRequest(messages=[ChatMessage(role="user", content="Xin chao du an")])
        handler = getattr(public_chat, "__wrapped__", public_chat)
        knowledge = KnowledgeResult(
            facts=[{"id": "project:alpha:name", "text": "name: Alpha"}],
            phone="0900 000 000",
            intent="project_detail",
        )
        redis = AsyncMock()
        redis.get.return_value = None
        redis.set.return_value = True
        with patch.object(settings, "MAYA_GROUNDED_CHAT_ENABLED", True), \
             patch("app.api.public.ai.get_redis_client", return_value=redis), \
             patch("app.api.public.ai.chat_knowledge_service.retrieve", new=AsyncMock(return_value=knowledge)), \
             patch("app.api.public.ai.generate_grounded_answer", new=AsyncMock(side_effect=TimeoutError)):
            response = await handler(request, payload)
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)

        body = "".join(chunks)
        self.assertIn("0900 000 000", body)
        self.assertLess(body.index("event: meta"), body.index("event: message"))
        self.assertLess(body.index("event: message"), body.index("event: error"))
        self.assertLess(body.index("event: error"), body.index("event: done"))



    async def test_first_message_language_overrides_client_hint(self):
        request = Request({
            "type": "http", "method": "POST", "path": "/api/public/ai/chat",
            "headers": [], "query_string": b"", "client": ("127.0.0.1", 1),
            "server": ("testserver", 80), "scheme": "http",
        })
        payload = ChatRequest(
            messages=[ChatMessage(role="user", content="Cho toi biet du an dang ban")],
            language="en",
        )
        handler = getattr(public_chat, "__wrapped__", public_chat)
        knowledge = KnowledgeResult(phone="0900 000 000", intent="project_list")
        redis = AsyncMock()
        redis.get.return_value = None
        redis.set.return_value = True
        with patch.object(settings, "MAYA_GROUNDED_CHAT_ENABLED", False), \
             patch("app.api.public.ai.get_redis_client", return_value=redis), \
             patch("app.api.public.ai.chat_knowledge_service.retrieve", new=AsyncMock(return_value=knowledge)):
            response = await handler(request, payload)
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
            body = "".join(chunks)
        self.assertIn('"language": "vi"', body)
        self.assertIn("0900 000 000", body)

    async def test_development_uses_local_session_when_redis_is_unavailable(self):
        request = Request({
            "type": "http", "method": "POST", "path": "/api/public/ai/chat",
            "headers": [], "query_string": b"", "client": ("127.0.0.1", 1),
            "server": ("testserver", 80), "scheme": "http",
        })
        payload = ChatRequest(
            messages=[ChatMessage(role="user", content="Tell me about Alpha")],
            language="en",
            session_id="local-fallback-session",
        )
        handler = getattr(public_chat, "__wrapped__", public_chat)
        knowledge = KnowledgeResult(
            facts=[{"id": "project:alpha:name", "text": "Alpha", "field": "name"}],
            phone="0900 000 000",
            intent="project_detail",
        )
        generated = {
            "answer": "Alpha is a verified public project.",
            "status": "ok",
            "completeness": "complete",
            "language_rewritten": False,
        }
        redis = AsyncMock()
        redis.get.side_effect = RuntimeError("redis down")
        with (
            patch.object(settings, "ENVIRONMENT", "development"),
            patch.object(settings, "MAYA_LOCAL_SESSION_FALLBACK_ENABLED", True),
            patch.object(settings, "MAYA_GROUNDED_CHAT_ENABLED", True),
            patch("app.api.public.ai.get_redis_client", return_value=redis),
            patch(
                "app.api.public.ai.chat_knowledge_service.retrieve",
                new=AsyncMock(return_value=knowledge),
            ),
            patch(
                "app.api.public.ai.generate_grounded_answer",
                new=AsyncMock(return_value=generated),
            ) as generate,
        ):
            response = await handler(request, payload)
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)

        body = "".join(chunks)
        generate.assert_awaited_once()
        self.assertIn('"status": "ok"', body)
        self.assertNotIn("MAYA_SESSION_UNAVAILABLE", body)

    async def test_reset_chat_reports_redis_failure(self):
        request = Request({
            "type": "http", "method": "DELETE", "path": "/api/public/ai/chat/session/aaaaaaaaaaaaaaaa",
            "headers": [], "query_string": b"", "client": ("127.0.0.1", 1),
            "server": ("testserver", 80), "scheme": "http",
        })
        handler = getattr(reset_chat_session, "__wrapped__", reset_chat_session)
        redis = AsyncMock()
        redis.delete.side_effect = RuntimeError("redis down")
        with (
            patch.object(settings, "MAYA_LOCAL_SESSION_FALLBACK_ENABLED", False),
            patch("app.api.public.ai.get_redis_client", return_value=redis),
        ):
            with self.assertRaises(HTTPException) as exc:
                await handler(request, "aaaaaaaaaaaaaaaa")
        self.assertEqual(exc.exception.status_code, 503)
        self.assertEqual(exc.exception.detail["code"], "MAYA_SESSION_UNAVAILABLE")
if __name__ == "__main__":
    unittest.main()
