import asyncio
import logging

from app.core.runtime_clients import close_redis_client
from app.core.worker_health import heartbeat_loop
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.modules.content.jobs.outbox_worker import process_one

logger = logging.getLogger(__name__)


async def process_loop() -> None:
    while True:
        processed = await process_one()
        if not processed:
            await asyncio.sleep(2)


async def run() -> None:
    await connect_to_mongo()
    jobs = asyncio.create_task(process_loop())
    heartbeat = asyncio.create_task(heartbeat_loop("content-worker"))
    try:
        await asyncio.gather(jobs, heartbeat)
    finally:
        jobs.cancel()
        heartbeat.cancel()
        await asyncio.gather(jobs, heartbeat, return_exceptions=True)
        await close_redis_client()
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(run())
