# ruff: noqa: E402
"""Read-only verification for the canonical website-only database baseline."""

import asyncio
import json

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from scripts.verify_website_bootstrap import verify_database


async def main() -> None:
    await connect_to_mongo()
    try:
        result = await verify_database(db_manager.db)
        print(json.dumps(result, ensure_ascii=False))
        if not result["ok"]:
            raise SystemExit(1)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
