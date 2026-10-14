from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database

LEASE_DURATION = timedelta(minutes=5)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def execute_once(
    *,
    key: str,
    scope: str,
    actor_id: str,
    operation: Callable[[], Awaitable[Any]],
    reclaimable: bool = True,
) -> Any:
    db = get_database()
    if db is None:
        raise RuntimeError("Cơ sở dữ liệu chưa được khởi tạo")
    collection = db["website_idempotency"]
    identity = f"{scope}:{actor_id}:{key}"
    owner = uuid4().hex
    now = utcnow()
    existing = await collection.find_one({"identity": identity})
    if existing and existing.get("state") == "COMPLETED":
        return existing.get("result")
    try:
        await collection.insert_one(
            {
                "identity": identity,
                "state": "PROCESSING",
                "lease_owner": owner,
                "lease_until": now + LEASE_DURATION,
                "created_at": now,
                "expires_at": now + timedelta(hours=24),
            }
        )
    except DuplicateKeyError as exc:
        if not reclaimable:
            existing = await collection.find_one({"identity": identity})
            if existing and existing.get("state") == "COMPLETED":
                return existing.get("result")
            raise HTTPException(
                status_code=409,
                detail={"code": "IDEMPOTENCY_RECOVERY_REQUIRED"},
            ) from exc
        claimed = await collection.find_one_and_update(
            {
                "identity": identity,
                "state": "PROCESSING",
                "$or": [
                    {"lease_until": {"$lt": now}},
                    {"lease_until": None},
                    {"lease_until": {"$exists": False}},
                ],
            },
            {
                "$set": {
                    "lease_owner": owner,
                    "lease_until": now + LEASE_DURATION,
                    "reclaimed_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not claimed:
            existing = await collection.find_one({"identity": identity})
            if existing and existing.get("state") == "COMPLETED":
                return existing.get("result")
            raise HTTPException(
                status_code=409,
                detail={"code": "IDEMPOTENCY_IN_PROGRESS"},
            ) from exc
    try:
        result = await operation()
        updated = await collection.update_one(
            {"identity": identity, "state": "PROCESSING", "lease_owner": owner},
            {
                "$set": {
                    "state": "COMPLETED",
                    "result": result,
                    "updated_at": utcnow(),
                },
                "$unset": {"lease_owner": "", "lease_until": ""},
            },
        )
        if updated.modified_count != 1:
            raise HTTPException(
                status_code=409, detail={"code": "IDEMPOTENCY_LEASE_LOST"}
            )
        return result
    except Exception:
        await collection.delete_one(
            {"identity": identity, "state": "PROCESSING", "lease_owner": owner}
        )
        raise


async def execute_mutation_once(
    *,
    key: str,
    scope: str,
    actor: dict,
    operation: Callable[[], Awaitable[Any]],
    reclaimable: bool = True,
) -> Any:
    normalized = key.strip()
    if len(normalized) < 8 or len(normalized) > 128:
        raise HTTPException(status_code=422, detail={"code": "INVALID_IDEMPOTENCY_KEY"})
    actor_id = str(
        actor.get("employee_id") or actor.get("id") or actor.get("account_id") or ""
    )
    kwargs = {"reclaimable": False} if not reclaimable else {}
    return await execute_once(
        key=normalized,
        scope=scope,
        actor_id=actor_id,
        operation=operation,
        **kwargs,
    )
