from pymongo import ASCENDING, DESCENDING

from app.modules.activity.indexes import ensure_activity_indexes


async def ensure_system_indexes(db) -> None:
    await ensure_activity_indexes(db)
    await db["auth_sessions"].create_index(
        [
            ("employee_id", ASCENDING),
            ("revoked_at", ASCENDING),
            ("expires_at", DESCENDING),
        ],
        name="idx_auth_sessions_employee_active",
    )
    await db["auth_sessions"].create_index(
        "active_key",
        unique=True,
        partialFilterExpression={
            "active_key": {"$type": "string"},
            "revoked_at": None,
        },
        name="uq_auth_sessions_single_active",
    )
    await db["auth_sessions"].create_index(
        [("account_id", ASCENDING), ("logged_in_at", DESCENDING)],
        name="idx_auth_sessions_account_history",
    )
    await db["auth_sessions"].create_index(
        "purge_at",
        expireAfterSeconds=0,
        name="ttl_auth_sessions",
    )
    await db["system_health_snapshots"].create_index(
        "generated_at",
        name="idx_system_health_generated",
    )
    await db["system_health_snapshots"].create_index(
        "purge_at",
        expireAfterSeconds=0,
        name="ttl_system_health",
    )
