import asyncio
import logging

from app.core.config import settings
from app.core.logging_config import configure_json_logging
from app.core.runtime_clients import close_redis_client
from app.core.worker_health import heartbeat_loop
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.modules.system.monitoring.service import monitoring_service

logger = logging.getLogger(__name__)


async def monitor_loop() -> None:
    while True:
        try:
            await monitoring_service.run()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Chu kỳ giám sát hệ thống thất bại")
        await asyncio.sleep(settings.SYSTEM_MONITOR_INTERVAL_SECONDS)


async def main() -> None:
    await connect_to_mongo()
    try:
        await asyncio.gather(monitor_loop(), heartbeat_loop("system-monitor-worker"))
    finally:
        if settings.S3_ENABLED:
            from app.infrastructure.object_storage import storage_service
            await storage_service.close()
        await close_redis_client()
        await close_mongo_connection()


if __name__ == "__main__":
    configure_json_logging()
    asyncio.run(main())
