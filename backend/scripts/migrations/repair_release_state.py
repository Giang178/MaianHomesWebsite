"""Dry-run/apply repair for single-session and crash-safe lease fields."""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timedelta, timezone

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.system.common.indexes import ensure_system_indexes
from app.modules.content.common.indexes import ensure_marketing_indexes

MIGRATION_ID = "2026-08-single-session-leases-v1"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def active_session_duplicates(database) -> list[dict]:
    pipeline = [
        {"$match": {"revoked_at": None}},
        {
            "$group": {
                "_id": {
                    "employee_id": "$employee_id",
                    "purpose": {"$ifNull": ["$purpose", "ACCESS"]},
                },
                "count": {"$sum": 1},
                "session_ids": {"$push": "$_id"},
            }
        },
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"_id.employee_id": 1, "_id.purpose": 1}},
    ]
    return await database["auth_sessions"].aggregate(pipeline).to_list(None)


async def run(*, apply: bool, database=None) -> dict:
    database = database if database is not None else db_manager.db
    duplicates = await active_session_duplicates(database)
    report = {
        "migration": MIGRATION_ID,
        "mode": "apply" if apply else "dry-run",
        "duplicate_groups": len(duplicates),
        "duplicate_sessions": sum(item["count"] - 1 for item in duplicates),
        "sessions_without_purpose": await database["auth_sessions"].count_documents(
            {
                "$or": [{"purpose": {"$exists": False}}, {"purpose": None}],
            }
        ),
        "active_sessions_without_key": await database["auth_sessions"].count_documents(
            {
                "revoked_at": None,
                "$or": [
                    {"active_key": {"$exists": False}},
                    {"active_key": None},
                ],
            }
        ),
        "activity_processing_without_lease": await database[
            "activity_event_outbox"
        ].count_documents(
            {
                "status": "PROCESSING",
                "$or": [
                    {"locked_until": {"$exists": False}},
                    {"locked_until": None},
                ],
            }
        ),
        "marketing_idempotency_without_lease": await database[
            "marketing_idempotency"
        ].count_documents(
            {
                "state": "PROCESSING",
                "$or": [
                    {"lease_until": {"$exists": False}},
                    {"lease_until": None},
                ],
            }
        ),
        "website_idempotency_without_lease": await database[
            "website_idempotency"
        ].count_documents(
            {
                "state": "PROCESSING",
                "$or": [
                    {"lease_until": {"$exists": False}},
                    {"lease_until": None},
                ],
            }
        ),
    }
    if not apply:
        return report

    now = utcnow()
    await database["auth_sessions"].update_many(
        {"$or": [{"purpose": {"$exists": False}}, {"purpose": None}]},
        {"$set": {"purpose": "ACCESS"}},
    )
    revoked = 0
    for group in duplicates:
        identity = group["_id"]
        session_query = {
            "employee_id": identity["employee_id"],
            "revoked_at": None,
        }
        if identity["purpose"] == "ACCESS":
            session_query["$or"] = [
                {"purpose": "ACCESS"},
                {"purpose": {"$exists": False}},
                {"purpose": None},
            ]
        else:
            session_query["purpose"] = identity["purpose"]
        sessions = (
            await database["auth_sessions"]
            .find(session_query)
            .sort([("logged_in_at", -1), ("_id", -1)])
            .to_list(None)
        )
        stale_ids = [item["_id"] for item in sessions[1:]]
        if stale_ids:
            result = await database["auth_sessions"].update_many(
                {"_id": {"$in": stale_ids}, "revoked_at": None},
                {
                    "$set": {
                        "revoked_at": now,
                        "revoke_reason": "Release migration: single-session repair",
                        "purge_at": now + timedelta(days=90),
                    }
                },
            )
            revoked += result.modified_count

    active_sessions = database["auth_sessions"].find({"revoked_at": None})
    async for active_session in active_sessions:
        purpose = active_session.get("purpose") or "ACCESS"
        await database["auth_sessions"].update_one(
            {"_id": active_session["_id"], "revoked_at": None},
            {
                "$set": {
                    "purpose": purpose,
                    "active_key": f"{active_session.get('employee_id')}:{purpose}",
                }
            },
        )

    unlocked = datetime.min.replace(tzinfo=timezone.utc)
    await database["activity_event_outbox"].update_many(
        {
            "status": "PROCESSING",
            "$or": [
                {"locked_until": {"$exists": False}},
                {"locked_until": None},
            ],
        },
        {"$set": {"locked_until": unlocked}},
    )
    for collection_name in ("marketing_idempotency", "website_idempotency"):
        await database[collection_name].update_many(
            {
                "state": "PROCESSING",
                "$or": [
                    {"lease_until": {"$exists": False}},
                    {"lease_until": None},
                ],
            },
            {"$set": {"lease_until": now - timedelta(seconds=1)}},
        )
    await ensure_marketing_indexes(database)
    await ensure_system_indexes(database)
    await database["release_migrations"].update_one(
        {"_id": MIGRATION_ID},
        {"$set": {"completed_at": now, "report": report}},
        upsert=True,
    )
    report["revoked_sessions"] = revoked
    report["remaining_duplicate_groups"] = len(
        await active_session_duplicates(database)
    )
    return report


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply additive repairs; default mode is read-only.",
    )
    args = parser.parse_args()
    await connect_to_mongo()
    try:
        print(json.dumps(await run(apply=args.apply), default=str, indent=2))
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
