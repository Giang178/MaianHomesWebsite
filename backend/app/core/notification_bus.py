"""Redis-backed fan-out for notification WebSockets across API workers."""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import suppress
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.core.runtime_clients import get_redis_client, get_redis_pubsub_client
from app.core.sockets import manager

logger = logging.getLogger("notification_bus")

NOTIFICATION_BUS_RETRY_CLOSE_CODE = 1013
NOTIFICATION_BUS_RETRY_CLOSE_REASON = "Realtime temporarily unavailable"
_notification_subscriber_ready = False


def notification_bus_ready() -> bool:
    """Return whether this process can receive cross-worker notifications."""
    return bool(settings.NOTIFICATIONS_REALTIME_ENABLED and _notification_subscriber_ready)


def _set_notification_bus_ready(ready: bool) -> bool:
    global _notification_subscriber_ready

    was_ready = _notification_subscriber_ready
    _notification_subscriber_ready = ready
    return was_ready


def notification_event(document: dict[str, Any], event_id: str | None = None) -> dict[str, Any]:
    notification_id = document.get("id") or document.get("_id")
    created_at = document.get("created_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    public_payload = {
        "type": "notification",
        "event_id": event_id or document.get("outbox_event_id") or uuid4().hex,
        "id": str(notification_id) if notification_id is not None else "",
        "title": document.get("title") or "Thông báo hệ thống",
        "message": document.get("message") or "",
        "module": document.get("module") or "SYSTEM",
        "link": document.get("link"),
        "created_at": created_at,
        "is_read": bool(document.get("is_read", False)),
    }
    return {
        "recipient_account_id": document.get("recipient_account_id"),
        "payload": public_payload,
    }


async def dispatch_notification(event: dict[str, Any]) -> None:
    payload = event.get("payload")
    if not isinstance(payload, dict):
        return
    recipient_account_id = event.get("recipient_account_id")
    if recipient_account_id:
        await manager.send_personal_message(payload, str(recipient_account_id))


async def publish_notification(event: dict[str, Any]) -> None:
    if not settings.NOTIFICATIONS_REALTIME_ENABLED:
        await dispatch_notification(event)
        return
    await get_redis_client().publish(
        settings.NOTIFICATIONS_CHANNEL,
        json.dumps(event, ensure_ascii=False, default=str),
    )


async def notification_subscriber_loop() -> None:
    """Subscribe forever; Redis outages do not terminate the API process."""
    delay = 1
    while True:
        pubsub = None
        subscriber_failed = False
        try:
            pubsub = get_redis_pubsub_client().pubsub(
                ignore_subscribe_messages=True
            )
            await pubsub.subscribe(settings.NOTIFICATIONS_CHANNEL)
            _set_notification_bus_ready(True)
            logger.info("Kết nối thông báo đã sẵn sàng")
            delay = 1
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    event = json.loads(message.get("data") or "{}")
                    await dispatch_notification(event)
                except Exception:
                    logger.exception("Gửi sự kiện thông báo thất bại")
            subscriber_failed = True
            logger.error("Kết nối đăng ký nhận thông báo đã kết thúc")
        except asyncio.CancelledError:
            raise
        except Exception:
            subscriber_failed = True
            logger.exception("Lỗi đăng ký nhận thông báo")
        finally:
            was_ready = _set_notification_bus_ready(False)
            if pubsub is not None:
                with suppress(Exception):
                    await pubsub.aclose()
            if subscriber_failed and was_ready:
                await manager.close_all(
                    code=NOTIFICATION_BUS_RETRY_CLOSE_CODE,
                    reason=NOTIFICATION_BUS_RETRY_CLOSE_REASON,
                )
        if subscriber_failed:
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)


def start_notification_subscriber() -> asyncio.Task | None:
    _set_notification_bus_ready(False)
    if not settings.NOTIFICATIONS_REALTIME_ENABLED:
        return None
    return asyncio.create_task(
        notification_subscriber_loop(), name="notification-subscriber"
    )


async def stop_notification_subscriber(task: asyncio.Task | None) -> None:
    if task is None:
        _set_notification_bus_ready(False)
        return
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    _set_notification_bus_ready(False)
