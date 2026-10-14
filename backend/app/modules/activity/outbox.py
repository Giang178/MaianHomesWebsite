from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database
from app.modules.activity.service import COLLECTION, OUTBOX_COLLECTION, utcnow

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 10
LEASE_SECONDS = 60
UNLOCKED_AT = datetime.min.replace(tzinfo=timezone.utc)


async def process_next() -> bool:
    now = utcnow()
    owner = f"activity_{uuid4().hex[:12]}"
    outbox = get_database()[OUTBOX_COLLECTION]
    item = await outbox.find_one_and_update(
        {
            "status": {"$in": ["PENDING", "RETRY", "PROCESSING"]},
            "available_at": {"$lte": now},
            "$or": [
                {"locked_until": {"$lt": now}},
                {"locked_until": None},
                {"locked_until": {"$exists": False}},
            ],
        },
        {
            "$set": {
                "status": "PROCESSING",
                "locked_by": owner,
                "locked_at": now,
                "locked_until": now + timedelta(seconds=LEASE_SECONDS),
            },
            "$inc": {"attempts": 1},
        },
        sort=[("available_at", 1), ("_id", 1)],
        return_document=ReturnDocument.AFTER,
    )
    if not item:
        return False
    try:
        try:
            await get_database()[COLLECTION].insert_one(item["event"])
        except DuplicateKeyError:
            pass
        await outbox.update_one(
            {"_id": item["_id"], "locked_by": owner, "status": "PROCESSING"},
            {
                "$set": {
                    "status": "DONE",
                    "completed_at": utcnow(),
                    "locked_until": UNLOCKED_AT,
                },
                "$unset": {"locked_by": "", "last_error": ""},
            },
        )
        from app.core.metrics import observe_activity_write

        observe_activity_write("outbox", "delivered")
    except Exception as exc:
        attempts = int(item.get("attempts", 1))
        terminal = attempts >= MAX_ATTEMPTS
        await outbox.update_one(
            {"_id": item["_id"], "locked_by": owner, "status": "PROCESSING"},
            {
                "$set": {
                    "status": "DEAD" if terminal else "RETRY",
                    "available_at": utcnow()
                    + timedelta(seconds=min(300, 2 ** min(attempts, 8))),
                    "last_error": type(exc).__name__,
                    "locked_until": UNLOCKED_AT,
                },
                "$unset": {"locked_by": ""},
            },
        )
        from app.core.metrics import observe_activity_write

        observe_activity_write("outbox", "dead" if terminal else "retry")
        logger.exception(
            "activity_outbox_delivery_failed",
            extra={"event_key": item.get("event_key"), "attempts": attempts},
        )
    return True


async def run_worker(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        processed = False
        try:
            processed = await process_next()
        except Exception:
            logger.exception("activity_outbox_worker_failed")
        if not processed:
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=2)
            except (asyncio.TimeoutError, TimeoutError):
                pass
