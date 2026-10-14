# ruff: noqa: E402
"""Read-only production gate for CMS content completeness.

This check never seeds or rewrites marketing content. It only reports the fields
that must be supplied through the admin CMS before a public page is published.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager


def _value_at(document: dict[str, Any], path: str) -> Any:
    value: Any = document
    for key in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _missing(document: dict[str, Any], fields: tuple[str, ...]) -> list[str]:
    return [field for field in fields if not str(_value_at(document, field) or "").strip()]


async def verify_cms_content(database) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []

    coworking = await database["workspace_coworking"].find_one(
        {"key": "singleton_location"}
    )
    if not coworking:
        issues.append({"entity": "coworking", "issue": "missing_document"})
    elif coworking.get("status") == "PUBLISHED":
        missing = _missing(
            coworking,
            (
                "hero.title",
                "hero.subtitle",
                "location.address",
                "seo_metadata.title",
                "seo_metadata.description",
            ),
        )
        if missing:
            issues.append({"entity": "coworking", "issue": "missing_fields", "fields": missing})

    office_landing = await database["workspace_office_landing"].find_one(
        {"key": "office_landing"}
    )
    if not office_landing:
        issues.append({"entity": "office_landing", "issue": "missing_document"})
    elif office_landing.get("status") == "PUBLISHED":
        missing = _missing(
            office_landing,
            (
                "hero_title",
                "hero_subtitle",
                "intro_title",
                "intro_description",
                "seo_metadata.title",
                "seo_metadata.description",
            ),
        )
        if missing:
            issues.append({"entity": "office_landing", "issue": "missing_fields", "fields": missing})

    published_buildings = await database["workspace_office_buildings"].find(
        {"status": "PUBLISHED"},
        {"name": 1, "slug": 1, "address": 1, "district": 1, "building_grade": 1, "seo_metadata": 1},
    ).to_list(1000)
    for building in published_buildings:
        missing = _missing(
            building,
            (
                "name",
                "slug",
                "address",
                "district",
                "building_grade",
                "seo_metadata.title",
                "seo_metadata.description",
            ),
        )
        if missing:
            issues.append(
                {
                    "entity": "office_building",
                    "id": str(building.get("_id") or building.get("slug") or "unknown"),
                    "issue": "missing_fields",
                    "fields": missing,
                }
            )

    return {
        "ok": not issues,
        "published_buildings": len(published_buildings),
        "issues": issues,
    }


async def main() -> None:
    await connect_to_mongo()
    try:
        result = await verify_cms_content(db_manager.db)
        print(json.dumps(result, ensure_ascii=False))
        if not result["ok"]:
            raise SystemExit(1)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
