"""Idempotently backfill Marketing editing ownership and media references.

Run from the backend directory:
    python -m scripts.backfill_marketing_article_ownership

The migration does not rewrite article HTML or published article metadata.
"""

from __future__ import annotations

import asyncio
import json

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.content.common.indexes import ensure_marketing_indexes
from app.modules.content.media.service import marketing_media_service


async def migrate() -> dict[str, int]:
    db = db_manager.db
    await ensure_marketing_indexes(db)

    active_accounts = await db["user_accounts"].find(
        {"is_active": True, "account_status": "ACTIVE"},
        {"_id": 1, "employee_id": 1},
    ).to_list(length=None)
    active_owner_ids = {
        value
        for account in active_accounts
        for value in (str(account["_id"]), str(account.get("employee_id") or ""))
        if value
    }

    counters = {
        "scanned": 0,
        "ownership_backfilled": 0,
        "needs_assignment": 0,
        "media_references_synced": 0,
    }
    cursor = db["articles"].find({})
    async for article in cursor:
        counters["scanned"] += 1
        article_id = str(article["_id"])
        current_owner = str(article.get("editor_owner_id") or "")
        legacy_owner = str(article.get("created_by") or article.get("author_id") or "")
        candidate = current_owner or legacy_owner

        ownership_update: dict = {}
        if candidate and candidate in active_owner_ids:
            if current_owner != candidate or not article.get("ownership_status"):
                ownership_update = {
                    "editor_owner_id": candidate,
                    "ownership_status": "ACTIVE",
                }
        elif current_owner or legacy_owner or not article.get("ownership_status"):
            ownership_update = {
                "editor_owner_id": None,
                "ownership_status": "NEEDS_ASSIGNMENT",
            }

        if ownership_update:
            await db["articles"].update_one(
                {"_id": article["_id"]},
                {"$set": ownership_update},
            )
            counters["ownership_backfilled"] += 1
            if ownership_update["ownership_status"] == "NEEDS_ASSIGNMENT":
                counters["needs_assignment"] += 1

        draft = await db["article_drafts"].find_one(
            {"article_id": article_id},
            {"payload": 1},
        )
        effective_payload = {**article, **((draft or {}).get("payload") or {})}
        await marketing_media_service.sync_article_references(article_id, effective_payload)
        counters["media_references_synced"] += 1

    return counters


async def main() -> None:
    await connect_to_mongo()
    try:
        print(json.dumps(await migrate(), ensure_ascii=False))
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
