import asyncio
import json
import logging
import re
import secrets
from time import monotonic, perf_counter
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.config import settings
from app.core.metrics import observe_ai
from app.core.runtime_clients import get_redis_client
from app.core.security import limiter
from app.modules.content.assistant.grounded_service import (
    detect_language,
    generate_grounded_answer,
)
from app.modules.content.assistant.knowledge_service import (
    chat_knowledge_service,
    fallback_message,
    unavailable_message,
)

logger = logging.getLogger("api_diagnostics")

router = APIRouter(prefix="/ai", tags=["Public AI"])

_LOCAL_LANGUAGE_LOCK_TTL_SECONDS = 1800
_local_language_locks: dict[str, tuple[str, float]] = {}


def _local_session_fallback_enabled() -> bool:
    return (
        settings.ENVIRONMENT == "development"
        and settings.MAYA_LOCAL_SESSION_FALLBACK_ENABLED
    )


def _local_language_get(session_id: str) -> str | None:
    stored = _local_language_locks.get(session_id)
    if stored is None:
        return None
    language, expires_at = stored
    if expires_at <= monotonic():
        _local_language_locks.pop(session_id, None)
        return None
    return language


def _local_language_set(session_id: str, language: str) -> None:
    _local_language_locks[session_id] = (
        language,
        monotonic() + _LOCAL_LANGUAGE_LOCK_TTL_SECONDS,
    )


def _local_language_delete(session_id: str) -> None:
    _local_language_locks.pop(session_id, None)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"] = Field(
        ..., description="Client display role; server reconstructs trusted conversation roles"
    )
    content: str = Field(..., min_length=1, max_length=2000, description="Message content")

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=10)
    language: Literal["vi", "en"] | None = None
    session_id: str | None = Field(default=None, min_length=16, max_length=128)

    @model_validator(mode="after")
    def validate_total_content(self):
        if sum(len(message.content) for message in self.messages) > 8000:
            raise ValueError("CHAT_CONTEXT_TOO_LARGE")
        return self


@router.delete("/chat/session/{session_id}")
@limiter.limit("20/minute")
async def reset_chat_session(request: Request, session_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", session_id):
        raise HTTPException(status_code=422, detail="INVALID_CHAT_SESSION")
    try:
        await get_redis_client().delete(f"maya:language:{session_id}")
    except Exception:
        if _local_session_fallback_enabled():
            _local_language_delete(session_id)
            logger.warning("maya_language_lock_delete_using_local_fallback")
            return {"status": "ok"}
        logger.warning("maya_language_lock_delete_failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "MAYA_SESSION_UNAVAILABLE"},
        )
    return {"status": "ok"}


def trusted_chat_history(messages: list[ChatMessage]) -> list[dict]:
    history = messages[-10:]
    if history[-1].role != "user":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The latest chat message must be from the user",
        )
    result: list[dict] = []
    for offset, message in enumerate(reversed(history)):
        role = "user" if offset % 2 == 0 else "assistant"
        result.append({"role": role, "content": message.content.strip()})
    result.reverse()
    return result

@router.post("/chat")
@limiter.limit("20/minute")
async def public_chat(request: Request, payload: ChatRequest):
    """
    Public Chatbot Mái Đỏ (SSE Streaming)
    Sử dụng provider AI đã cấu hình cho khách truy cập vãng lai.
    """
    messages_dict = trusted_chat_history(payload.messages)
    session_id = payload.session_id or secrets.token_urlsafe(24)
    language_lock_key = f"maya:language:{session_id}"
    locked_language: str | None = None
    language_lock_available = True
    redis_language_lock_available = True
    try:
        locked_language = await get_redis_client().get(language_lock_key)
    except Exception:
        redis_language_lock_available = False
        if _local_session_fallback_enabled():
            locked_language = _local_language_get(session_id)
            logger.warning("maya_language_lock_read_using_local_fallback")
        else:
            language_lock_available = False
            logger.warning("maya_language_lock_read_failed", exc_info=True)
    detected_language = detect_language(
        next((message.content for message in payload.messages if message.role == "user"), payload.messages[-1].content)
    )
    # The first user message is authoritative. A client-supplied language is
    # accepted only as a continuity hint after a server-side lock exists.
    language = locked_language if locked_language in {"vi", "en"} else detected_language
    language_violation = bool(locked_language in {"vi", "en"} and payload.language and payload.language != locked_language)
    if locked_language not in {"vi", "en"}:
        if redis_language_lock_available:
            try:
                await get_redis_client().set(language_lock_key, language, ex=1800)
            except Exception:
                if _local_session_fallback_enabled():
                    _local_language_set(session_id, language)
                    logger.warning("maya_language_lock_write_using_local_fallback")
                else:
                    language_lock_available = False
                    logger.warning("maya_language_lock_write_failed", exc_info=True)
        elif _local_session_fallback_enabled():
            _local_language_set(session_id, language)

    def event(name: str, data: dict) -> str:
        return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def sse_event_generator():
        started = perf_counter()
        knowledge = None
        try:
            knowledge = await chat_knowledge_service.retrieve(messages_dict[-1]["content"])
            if not language_lock_available:
                observe_ai("public_chat", "unavailable", perf_counter() - started, ["language_lock_unavailable"], perf_counter() - started)
                yield event("meta", {"language": language, "session_id": session_id, "grounded": False, "status": "unavailable", "completeness": "missing"})
                yield event("message", {"content": unavailable_message(language, knowledge.phone)})
                yield event("error", {"code": "MAYA_SESSION_UNAVAILABLE", "status": "unavailable"})
                yield event("done", {"status": "unavailable"})
                return
            if language_violation:
                observe_ai("public_chat", "fallback", perf_counter() - started, ["language_violation"], perf_counter() - started)
                yield event("meta", {"language": language, "session_id": session_id, "grounded": False, "status": "fallback", "completeness": "missing"})
                yield event("message", {"content": fallback_message(language, knowledge.phone)})
                yield event("done", {"status": "fallback"})
                return
            if not settings.MAYA_GROUNDED_CHAT_ENABLED:
                observe_ai("public_chat", "unavailable", perf_counter() - started, ["feature_disabled"], perf_counter() - started)
                yield event("meta", {"language": language, "session_id": session_id, "grounded": False, "status": "unavailable", "completeness": "missing"})
                yield event("message", {"content": unavailable_message(language, knowledge.phone)})
                yield event("done", {"status": "unavailable"})
                return
            generated = await asyncio.wait_for(
                generate_grounded_answer(messages_dict, knowledge, language),
                timeout=30.0,
            )
            events = []
            if not knowledge.grounded:
                events.append("knowledge_miss")
            if generated.get("language_rewritten"):
                events.append("language_rewrite")
            reason = str(generated.get("reason") or "")
            if reason:
                events.append(reason)
            observe_ai("public_chat", generated["status"], perf_counter() - started, events, perf_counter() - started)
            meta_payload = {
                "language": language,
                "session_id": session_id,
                "grounded": knowledge.grounded,
                "status": generated["status"],
                "completeness": generated["completeness"],
                "reason": reason or None,
            }
            if getattr(knowledge, "high_intent", False):
                meta_payload["high_intent"] = True
            if getattr(knowledge, "suggested_action", None):
                meta_payload["suggested_action"] = knowledge.suggested_action
            yield event("meta", meta_payload)
            yield event("message", {"content": generated["answer"]})
            if knowledge.sources:
                yield event("sources", {"items": knowledge.sources[:3]})
            yield event("done", {"status": generated["status"]})
        except Exception as e:
            logger.exception("maya_sse_failed: %s", e)
            observe_ai("public_chat", "error", perf_counter() - started, time_to_first_seconds=perf_counter() - started)
            phone = knowledge.phone if knowledge is not None else None
            if not phone:
                try:
                    from app.modules.system.settings.service import (
                        system_settings_service,
                    )
                    phone = (await system_settings_service.public_contact()).get("phone")
                except Exception:
                    logger.warning("maya_fallback_contact_unavailable", exc_info=True)
            yield event("meta", {"language": language, "session_id": session_id, "grounded": False, "status": "unavailable", "completeness": "missing"})
            yield event("message", {"content": unavailable_message(language, phone)})
            yield event("error", {"code": "MAYA_UNAVAILABLE", "status": "unavailable"})
            yield event("done", {"status": "unavailable"})

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"},
    )


