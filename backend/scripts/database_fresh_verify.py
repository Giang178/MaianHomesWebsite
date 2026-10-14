# ruff: noqa: E402
"""Prove that a first deployment uses the website-only fresh baseline."""

import asyncio
import json
import os

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from scripts.verify_website_bootstrap import (
    FRESH_BOOTSTRAP_SOURCE,
    WEBSITE_BOOTSTRAP_PROFILE,
    verify_database,
)


async def verify_fresh_database(database) -> dict:
    result = await verify_database(database)
    if not result["ok"]:
        failed = ", ".join(
            name for name, passed in result["checks"].items() if not passed
        )
        raise RuntimeError(f"Website-only baseline is invalid: {failed}")

    expected_email = (os.getenv("CEO_EMAIL") or "").strip().casefold()
    if not expected_email:
        raise RuntimeError("CEO_EMAIL is required for fresh database verification")

    marker = await database["system_bootstrap"].find_one({"_id": "current"})
    if (
        not marker
        or marker.get("source") != FRESH_BOOTSTRAP_SOURCE
        or marker.get("profile") != WEBSITE_BOOTSTRAP_PROFILE
    ):
        raise RuntimeError("Database was not created by the website-only fresh bootstrap")

    ceo = await database["user_accounts"].find_one(
        {
            "normalized_email": expected_email,
            "role": "CEO",
            "is_protected": True,
            "is_active": True,
        }
    )
    if not ceo or await database["user_accounts"].count_documents({}) != 1:
        raise RuntimeError(
            "Fresh database must contain exactly the configured CEO account"
        )

    return {
        **result,
        "ceo_email": expected_email,
        "user_accounts": 1,
        "unexpected_nonempty_collections": len(result["forbidden_collections"]),
    }


async def main() -> None:
    await connect_to_mongo()
    try:
        result = await verify_fresh_database(db_manager.db)
        print(json.dumps(result, ensure_ascii=False))
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
