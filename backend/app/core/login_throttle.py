"""Account-scoped login throttling layered on top of the IP limiter."""

from __future__ import annotations

import hashlib
import logging

from fastapi import HTTPException, status

from app.core.runtime_clients import get_redis_client

logger = logging.getLogger(__name__)

FAILURE_LIMIT = 5
WINDOW_SECONDS = 15 * 60
_RECORD_FAILURE_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""


def _key(email: str) -> str:
    normalized = email.strip().casefold().encode("utf-8")
    digest = hashlib.sha256(normalized).hexdigest()
    return f"auth:login-failures:{digest}"


async def ensure_account_login_allowed(email: str) -> None:
    """Reject an account after repeated failures, regardless of source IP."""
    try:
        redis = get_redis_client()
        value = await redis.get(_key(email))
        if value is None or int(value) < FAILURE_LIMIT:
            return
        retry_after = max(1, await redis.ttl(_key(email)))
    except Exception:
        # The independent IP limiter remains active. Production readiness also
        # requires Redis, so a Redis outage is surfaced without taking login
        # completely offline.
        logger.warning("account_login_throttle_check_failed", exc_info=True)
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "ACCOUNT_LOGIN_RATE_LIMITED",
            "message": "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.",
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


async def record_account_login_failure(email: str) -> None:
    """Atomically count a failed credential check and start a bounded window."""
    try:
        redis = get_redis_client()
        key = _key(email)
        count = int(
            await redis.eval(_RECORD_FAILURE_SCRIPT, 1, key, WINDOW_SECONDS)
        )
        if count < FAILURE_LIMIT:
            return
        retry_after = max(1, await redis.ttl(key))
    except Exception:
        logger.warning("account_login_throttle_record_failed", exc_info=True)
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "ACCOUNT_LOGIN_RATE_LIMITED",
            "message": "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.",
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


async def clear_account_login_failures(email: str) -> None:
    try:
        await get_redis_client().delete(_key(email))
    except Exception:
        logger.warning("account_login_throttle_clear_failed", exc_info=True)
