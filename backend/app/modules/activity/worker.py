"""Dedicated production worker for the cross-domain activity outbox."""

import asyncio

from app.core.logging_config import configure_json_logging
from app.core.runtime_clients import close_redis_client
from app.core.worker_health import heartbeat_loop
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.modules.activity.outbox import run_worker


async def main() -> None:
    await connect_to_mongo()
    stop_event = asyncio.Event()
    try:
        await asyncio.gather(
            run_worker(stop_event),
            heartbeat_loop("activity-worker"),
        )
    finally:
        stop_event.set()
        await close_redis_client()
        await close_mongo_connection()


if __name__ == "__main__":
    configure_json_logging()
    asyncio.run(main())
