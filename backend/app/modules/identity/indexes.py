from pymongo import ASCENDING, DESCENDING


async def ensure_identity_indexes(db) -> None:
    await db["identity_email_templates"].create_index(
        "event_type", unique=True, name="uq_identity_email_template_event",
    )
    await db["auth_sessions"].create_index(
        [("account_id", ASCENDING), ("logged_in_at", DESCENDING)],
        name="idx_auth_sessions_account_history",
    )
    await db["auth_sessions"].create_index(
        "active_key",
        unique=True,
        partialFilterExpression={"active_key": {"$type": "string"}, "revoked_at": None},
        name="uq_auth_sessions_single_active",
    )
    await db["auth_sessions"].create_index(
        "purge_at", expireAfterSeconds=0, name="ttl_auth_sessions",
    )

