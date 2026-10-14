"""Idempotently backfill optimistic-lock versions for consignment documents."""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager

MIGRATION_ID = "2026-08-consignment-version-v1"


async def run(*, apply: bool, database=None) -> dict:
    database = database if database is not None else db_manager.db
    collection = database["consignments"]
    query = {"version": {"$exists": False}}
    pending = await collection.count_documents(query)
    updated = 0
    if apply and pending:
        result = await collection.update_many(query, {"$set": {"version": 1}})
        updated = result.modified_count
    report = {
        "migration": MIGRATION_ID,
        "release": MIGRATION_ID,
        "mode": "apply" if apply else "dry-run",
        "before_count": pending,
        "pending": pending,
        "updated": updated,
        "after_missing_count": await collection.count_documents(query),
        "remaining": await collection.count_documents(query),
    }
    if apply and report["remaining"] == 0:
        await database["release_migrations"].update_one(
            {"_id": MIGRATION_ID},
            {"$set": {
                "status": "complete",
                "release": MIGRATION_ID,
                "completed_at": datetime.now(timezone.utc),
                "report": report,
            }},
            upsert=True,
        )
    return report


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill consignment optimistic-lock versions")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Write version=1 to legacy documents")
    mode.add_argument("--dry-run", action="store_true", help="Only report pending documents (default)")
    args = parser.parse_args()
    await connect_to_mongo()
    try:
        report = await run(apply=args.apply)
        print(report)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())