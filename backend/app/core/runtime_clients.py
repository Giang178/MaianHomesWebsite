"""Process-local clients shared by asynchronous backend request paths.

The API runs multiple OS processes.  Each process therefore owns one bounded
Redis connection pool and closes it during application shutdown.  Keeping the
client lazy avoids creating sockets before a worker process is forked.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: Any | None = None
_redis_owner: tuple | None = None
_redis_pubsub_client: Any | None = None
_redis_pubsub_owner: tuple | None = None
_redis_lock = threading.Lock()


def _redis_signature() -> tuple:
    return (
        os.getpid(),
        settings.REDIS_URL,
        settings.REDIS_MAX_CONNECTIONS,
        settings.REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS,
        settings.REDIS_POOL_WAIT_TIMEOUT_SECONDS,
    )


def _redis_pubsub_signature() -> tuple:
    return (
        os.getpid(),
        settings.REDIS_URL,
        settings.REDIS_POOL_WAIT_TIMEOUT_SECONDS,
    )


def _build_redis_client():
    # BlockingConnectionPool bounds both open connections and the amount of
    # time a coroutine waits for a connection.  This prevents a Redis slowdown
    # from turning a traffic spike into an unbounded connection storm.
    from redis.asyncio import BlockingConnectionPool, Redis

    pool = BlockingConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_MAX_CONNECTIONS,
        timeout=settings.REDIS_POOL_WAIT_TIMEOUT_SECONDS,
        decode_responses=True,
        health_check_interval=30,
        socket_connect_timeout=3,
        socket_timeout=settings.REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS,
    )
    return Redis(connection_pool=pool)


def _build_redis_pubsub_client():
    """Build a dedicated pool whose blocking subscription has no read timeout."""
    from redis.asyncio import BlockingConnectionPool, Redis

    pool = BlockingConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=2,
        timeout=settings.REDIS_POOL_WAIT_TIMEOUT_SECONDS,
        decode_responses=True,
        health_check_interval=30,
        socket_connect_timeout=3,
    )
    return Redis(connection_pool=pool)


def get_redis_client():
    """Return the bounded, fail-fast Redis command client for this process."""
    global _redis_client, _redis_owner

    signature = _redis_signature()
    with _redis_lock:
        if _redis_client is None or _redis_owner != signature:
            # Never reuse a pool inherited from a pre-fork parent.  Settings
            # are immutable in production, so a same-process signature change
            # only occurs in tests or controlled reconfiguration.
            _redis_client = _build_redis_client()
            _redis_owner = signature
        return _redis_client


def get_redis_pubsub_client():
    """Return the process-local Redis client reserved for blocking Pub/Sub."""
    global _redis_pubsub_client, _redis_pubsub_owner

    signature = _redis_pubsub_signature()
    with _redis_lock:
        if _redis_pubsub_client is None or _redis_pubsub_owner != signature:
            _redis_pubsub_client = _build_redis_pubsub_client()
            _redis_pubsub_owner = signature
        return _redis_pubsub_client


async def close_redis_client() -> None:
    """Close command and Pub/Sub pools; safe to call repeatedly."""
    global _redis_client, _redis_owner, _redis_pubsub_client, _redis_pubsub_owner

    with _redis_lock:
        clients = (
            (_redis_client, _redis_owner, "command"),
            (_redis_pubsub_client, _redis_pubsub_owner, "pubsub"),
        )
        _redis_client = None
        _redis_owner = None
        _redis_pubsub_client = None
        _redis_pubsub_owner = None

    for client, owner, pool_name in clients:
        if client is None or owner is None or owner[0] != os.getpid():
            continue
        try:
            await client.aclose(close_connection_pool=True)
        except Exception:
            # Shutdown must continue so MongoDB and other clients can also close.
            logger.warning(
                "redis_client_close_failed",
                extra={"redis_pool": pool_name},
                exc_info=True,
            )
