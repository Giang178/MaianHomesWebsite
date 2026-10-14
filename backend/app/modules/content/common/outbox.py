from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db.mongodb import get_database


async def enqueue(
    event_type: str,
    payload: dict[str, Any],
    *,
    session=None,
) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Cơ sở dữ liệu chưa được khởi tạo")
    event_id = uuid4().hex
    now = datetime.now(timezone.utc)
    await db["marketing_outbox"].insert_one(
        {
            "event_id": event_id,
            "event_type": event_type,
            "payload": payload,
            "status": "PENDING",
            "attempts": 0,
            "available_at": now,
            "created_at": now,
            "updated_at": now,
        },
        session=session,
    )
    return event_id

