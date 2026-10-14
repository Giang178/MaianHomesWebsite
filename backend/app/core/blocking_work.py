from __future__ import annotations

import asyncio
import logging
import os
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import TypeVar

from app.core.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T")

_bcrypt_executor: ThreadPoolExecutor | None = None
_bcrypt_owner: tuple[int, int] | None = None
_bcrypt_lock = threading.Lock()


def _get_bcrypt_executor() -> ThreadPoolExecutor:
    global _bcrypt_executor, _bcrypt_owner

    signature = (os.getpid(), settings.BCRYPT_MAX_WORKERS)
    with _bcrypt_lock:
        if _bcrypt_executor is None or _bcrypt_owner != signature:
            previous = _bcrypt_executor
            previous_owner = _bcrypt_owner
            _bcrypt_executor = ThreadPoolExecutor(
                max_workers=settings.BCRYPT_MAX_WORKERS,
                thread_name_prefix="bcrypt",
            )
            _bcrypt_owner = signature
            if previous is not None and previous_owner and previous_owner[0] == os.getpid():
                previous.shutdown(wait=False, cancel_futures=True)
        return _bcrypt_executor


async def run_bcrypt(function: Callable[..., T], *args) -> T:
    """Run bcrypt work on its own bounded process-local executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        _get_bcrypt_executor(),
        partial(function, *args),
    )


async def close_bcrypt_executor() -> None:
    """Stop accepting bcrypt work and cancel queued jobs during shutdown."""
    global _bcrypt_executor, _bcrypt_owner

    with _bcrypt_lock:
        executor = _bcrypt_executor
        owner = _bcrypt_owner
        _bcrypt_executor = None
        _bcrypt_owner = None
    if executor is None or owner is None or owner[0] != os.getpid():
        return
    try:
        executor.shutdown(wait=False, cancel_futures=True)
    except Exception:
        logger.warning("bcrypt_executor_close_failed", exc_info=True)
