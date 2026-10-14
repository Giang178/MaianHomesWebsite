from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.db.mongodb import get_database
from app.modules.identity.templates import ensure_event_type


async def enqueue_account_event(
    event_type: str,
    payload: dict,
    *,
    event_id: str | None = None,
    session=None,
) -> str:
    """Publish an account event without coupling producers to the HR module."""
    normalized = ensure_event_type(event_type)
    identity = event_id or uuid4().hex
    now = datetime.now(timezone.utc)
    kwargs = {"session": session} if session is not None else {}
    await get_database()["hr_outbox"].update_one(
        {"event_id": identity},
        {
            "$setOnInsert": {
                "event_id": identity,
                "version": 1,
                "event_type": normalized,
                "payload": dict(payload),
                "status": "PENDING",
                "attempts": 0,
                "available_at": now,
                "locked_until": datetime.min.replace(tzinfo=timezone.utc),
                "created_at": now,
                "updated_at": now,
            }
        },
        upsert=True,
        **kwargs,
    )
    return identity
