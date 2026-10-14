# ruff: noqa: E402
"""Create and verify the canonical website-only database baseline.

The production path is intentionally fresh-only. It never adopts, drops, or
rewrites a populated database and is safe to rerun after a completed bootstrap.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

from fastapi import HTTPException

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.identity.policies import validate_password
from app.modules.identity.service import DEFAULT_POLICY
from scripts.bootstrap_website import bootstrap_database
from scripts.verify_website_bootstrap import verify_database


BOOTSTRAP_COLLECTION = "system_bootstrap"
BOOTSTRAP_ID = "current"
FRESH_BOOTSTRAP_SOURCE = "fresh-bootstrap"
WEBSITE_BOOTSTRAP_PROFILE = "website-only-v1"
BOOTSTRAP_MODES = {"auto", "fresh-only"}


def _configured_value(name: str) -> str:
    value = (os.getenv(name) or str(getattr(settings, name, "") or "")).strip()
    if not value:
        raise RuntimeError(f"{name} must be configured for the one-time database bootstrap")
    return value


def _validate_password(password: str) -> None:
    try:
        validate_password(password, DEFAULT_POLICY)
    except HTTPException as exc:
        raise RuntimeError("CEO_BOOTSTRAP_PASSWORD does not satisfy the password policy") from exc


def _bootstrap_mode() -> str:
    mode = (os.getenv("DATABASE_BOOTSTRAP_MODE") or "auto").strip().casefold()
    if mode not in BOOTSTRAP_MODES:
        raise RuntimeError("DATABASE_BOOTSTRAP_MODE must be one of: auto, fresh-only")
    if settings.ENVIRONMENT.casefold() == "production" and mode != "fresh-only":
        raise RuntimeError("Production DATABASE_BOOTSTRAP_MODE must be fresh-only")
    return mode


async def _completed_marker(database) -> dict[str, Any] | None:
    return await database[BOOTSTRAP_COLLECTION].find_one(
        {"_id": BOOTSTRAP_ID, "status": "complete"}
    )


async def _assert_empty(database) -> None:
    populated: dict[str, int] = {}
    for name in await database.list_collection_names():
        if name.startswith("system."):
            continue
        count = await database[name].estimated_document_count()
        if count:
            populated[name] = count
    if populated:
        details = ", ".join(
            f"{name}={count}" for name, count in sorted(populated.items())
        )
        raise RuntimeError(
            "Fresh-only bootstrap requires an empty database; existing data was preserved: "
            + details
        )


async def verify_baseline(database, *, require_marker: bool = True) -> dict:
    """Compatibility entrypoint used by deployment and integration checks."""
    result = await verify_database(database, require_marker=require_marker)
    if not result["ok"]:
        failed = ", ".join(
            name for name, passed in result["checks"].items() if not passed
        )
        raise RuntimeError(f"Website-only database verification failed: {failed}")
    return {
        **result,
        "status": "ok",
        "protected_ceo_accounts": 1,
    }


async def bootstrap(database) -> dict:
    _bootstrap_mode()
    marker = await _completed_marker(database)
    if marker:
        if (
            marker.get("source") != FRESH_BOOTSTRAP_SOURCE
            or marker.get("profile") != WEBSITE_BOOTSTRAP_PROFILE
        ):
            raise RuntimeError(
                "Fresh-only deployment refuses a database with a foreign bootstrap marker"
            )
        await bootstrap_database(database)
        return {**(await verify_baseline(database)), "already_initialized": True}

    await _assert_empty(database)

    _configured_value("CEO_EMAIL")
    _configured_value("CEO_FULL_NAME")
    _configured_value("CEO_PHONE")
    password = _configured_value("CEO_BOOTSTRAP_PASSWORD")
    _validate_password(password)

    await bootstrap_database(database)
    return {**(await verify_baseline(database)), "already_initialized": False}


async def main() -> None:
    await connect_to_mongo()
    try:
        result = await bootstrap(db_manager.db)
        print(
            "Website database baseline ready: "
            f"pages={result['pages']}, accounts={result['accounts']}, "
            f"already_initialized={result['already_initialized']}"
        )
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
