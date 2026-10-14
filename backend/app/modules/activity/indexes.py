from pymongo import ASCENDING, DESCENDING

from app.modules.activity.service import COLLECTION, OUTBOX_COLLECTION


async def ensure_activity_indexes(db) -> None:
    events = db[COLLECTION]
    await events.create_index("event_key", unique=True, name="uq_activity_event_key")
    await events.create_index(
        [("occurred_at", DESCENDING), ("_id", DESCENDING)], name="idx_activity_cursor"
    )
    await events.create_index(
        [
            ("module", ASCENDING),
            ("category", ASCENDING),
            ("event_type", ASCENDING),
            ("result", ASCENDING),
            ("severity", ASCENDING),
            ("occurred_at", DESCENDING),
        ],
        name="idx_activity_taxonomy",
    )
    await events.create_index(
        [("actor.employee_id", ASCENDING), ("occurred_at", DESCENDING)],
        name="idx_activity_employee",
    )
    await events.create_index(
        [("actor.account_id", ASCENDING), ("occurred_at", DESCENDING)],
        name="idx_activity_account",
    )
    await events.create_index(
        [
            ("target.type", ASCENDING),
            ("target.id", ASCENDING),
            ("occurred_at", DESCENDING),
        ],
        name="idx_activity_target",
    )
    await events.create_index(
        [("request.request_id", ASCENDING), ("occurred_at", DESCENDING)],
        name="idx_activity_request",
    )
    await events.create_index(
        [("request.session_id", ASCENDING), ("occurred_at", DESCENDING)],
        name="idx_activity_session",
    )
    await events.create_index("actor_search", name="idx_activity_actor_search")

    outbox = db[OUTBOX_COLLECTION]
    await outbox.create_index(
        [
            ("status", ASCENDING),
            ("available_at", ASCENDING),
            ("locked_until", ASCENDING),
        ],
        name="idx_activity_outbox_lease",
    )
    await outbox.create_index(
        "event_key", unique=True, name="uq_activity_outbox_event_key"
    )
    await outbox.create_index(
        [("status", ASCENDING), ("available_at", ASCENDING)],
        name="idx_activity_outbox_pending",
    )
