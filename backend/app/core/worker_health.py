"""Shared worker heartbeat used by production readiness checks."""

import asyncio
import logging
import socket
from datetime import datetime, timezone
from uuid import uuid4

from pymongo.errors import PyMongoError

from app.core.config import settings
from app.core.release_identity import baked_image_revision
from app.db.mongodb import db_manager

logger = logging.getLogger(__name__)

_HEARTBEAT_RETRY_BASE_SECONDS = 1
_HEARTBEAT_RETRY_MAX_SECONDS = 15


async def heartbeat_loop(worker_name: str, interval_seconds: int = 30) -> None:
    instance_id = f"{socket.gethostname()}-{uuid4().hex[:10]}"
    started_at = datetime.now(timezone.utc)
    image_revision = baked_image_revision()
    heartbeat_id = f"{worker_name}:{instance_id}"
    consecutive_failures = 0
    try:
        while True:
            now = datetime.now(timezone.utc)
            try:
                await db_manager.db["system_worker_heartbeats"].update_one(
                    {"_id": heartbeat_id},
                    {
                        "$set": {
                            "worker_name": worker_name,
                            "instance_id": instance_id,
                            "release": settings.APP_RELEASE,
                            "image_revision": image_revision,
                            "deployment_tier": settings.DEPLOYMENT_TIER,
                            "deployment_instance_id": settings.DEPLOYMENT_INSTANCE_ID,
                            "started_at": started_at,
                            "status": "running",
                            "updated_at": now,
                        }
                    },
                    upsert=True,
                )
            except PyMongoError as exc:
                consecutive_failures += 1
                retry_seconds = min(
                    _HEARTBEAT_RETRY_MAX_SECONDS,
                    _HEARTBEAT_RETRY_BASE_SECONDS
                    * (2 ** min(consecutive_failures - 1, 4)),
                )
                logger.warning(
                    "worker_heartbeat_write_failed",
                    extra={
                        "worker_name": worker_name,
                        "exception_type": type(exc).__name__,
                        "retry_seconds": retry_seconds,
                    },
                )
                await asyncio.sleep(retry_seconds)
                continue

            consecutive_failures = 0
            await asyncio.sleep(interval_seconds)
    except asyncio.CancelledError:
        try:
            await db_manager.db["system_worker_heartbeats"].update_one(
                {"_id": heartbeat_id, "instance_id": instance_id},
                {"$set": {"status": "stopped", "updated_at": datetime.now(timezone.utc)}},
            )
        except PyMongoError as exc:
            logger.warning(
                "worker_heartbeat_stop_write_failed",
                extra={
                    "worker_name": worker_name,
                    "exception_type": type(exc).__name__,
                },
            )
        raise
