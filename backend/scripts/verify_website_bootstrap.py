# ruff: noqa: E402
"""Read-only verification for the canonical website-only database baseline."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.identity.templates import DEFAULT_TEMPLATES
from app.modules.website.pages.service import PAGE_KEYS


BOOTSTRAP_ID = "current"
FRESH_BOOTSTRAP_SOURCE = "fresh-bootstrap"
WEBSITE_BOOTSTRAP_PROFILE = "website-only-v1"

FORBIDDEN_COLLECTIONS = {
    "employees",
    "attendance",
    "attendance_adjustments",
    "leave_requests",
    "leads",
    "lead_activities",
    "appointments",
    "consignments",
    "inventory",
}
# This collection is a retained platform primitive used by authentication,
# settings, and monitoring idempotency. Other `it_*` collections remain
# forbidden by the prefix guard below.
ALLOWED_TECHNICAL_COLLECTIONS = {"website_idempotency"}
FORBIDDEN_PREFIXES = ("sales_", "hr_", "it_")

REQUIRED_INDEXES = {
    "user_accounts": {"uq_account_email"},
    "identity_email_templates": {"uq_identity_email_template_event"},
    "auth_sessions": {"uq_auth_sessions_single_active", "ttl_auth_sessions"},
    "website_pages": {"uq_website_page_key"},
    "website_leads": {"idx_leads_submitted", "idx_leads_status"},
    "media_assets": {"idx_media_checksum", "idx_website_media_status"},
    "projects": {"idx_projects_public_listing", "idx_projects_workflow"},
    "articles": {"idx_articles_public_listing", "idx_articles_author_updated"},
    "article_drafts": {"uq_article_draft_slug"},
    "article_revisions": {"uq_article_revision_version"},
    "website_idempotency": {
        "uq_website_idempotency_identity",
        "ttl_website_idempotency",
        "idx_website_idempotency_lease",
    },
}


async def _indexes_complete(database) -> tuple[bool, dict[str, list[str]]]:
    missing: dict[str, list[str]] = {}
    for collection_name, required in REQUIRED_INDEXES.items():
        actual = set((await database[collection_name].index_information()).keys())
        absent = sorted(required - actual)
        if absent:
            missing[collection_name] = absent
    return not missing, missing


async def verify_database(database, *, require_marker: bool = True) -> dict:
    if database is None:
        raise RuntimeError("Database connection is not initialized")

    collections = set(await database.list_collection_names())
    accounts = await database["user_accounts"].find(
        {},
        {
            "role": 1,
            "status": 1,
            "is_active": 1,
            "is_protected": 1,
            "email": 1,
        },
    ).to_list(length=100)
    protected_ceos = [
        account
        for account in accounts
        if account.get("role") == "CEO"
        and account.get("status") == "ACTIVE"
        and account.get("is_active") is True
        and account.get("is_protected") is True
    ]
    invalid_roles = sorted(
        {
            str(account.get("role"))
            for account in accounts
            if account.get("role") not in {"CEO", "ADMIN", "MARKETING"}
        }
    )
    page_keys = set(await database["website_pages"].distinct("page_key"))
    bootstrap = await database["system_bootstrap"].find_one({"_id": BOOTSTRAP_ID})
    forbidden_collections = sorted(
        name
        for name in collections
        if (
            name in FORBIDDEN_COLLECTIONS
            or (name.startswith(FORBIDDEN_PREFIXES) and name not in ALLOWED_TECHNICAL_COLLECTIONS)
        )
    )
    template_count = await database["identity_email_templates"].count_documents(
        {"event_type": {"$in": list(DEFAULT_TEMPLATES)}}
    )
    indexes_complete, missing_indexes = await _indexes_complete(database)

    marker_valid = bool(
        bootstrap
        and bootstrap.get("status") == "complete"
        and bootstrap.get("source") == FRESH_BOOTSTRAP_SOURCE
        and bootstrap.get("profile") == WEBSITE_BOOTSTRAP_PROFILE
    )
    checks = {
        "bootstrap_complete": marker_valid if require_marker else True,
        "exactly_one_protected_ceo": len(protected_ceos) == 1,
        "roles_are_website_only": not invalid_roles,
        "identity_templates_complete": template_count == len(DEFAULT_TEMPLATES),
        "all_cms_pages_exist": PAGE_KEYS.issubset(page_keys),
        "website_settings_exist": (
            await database["website_settings"].count_documents({"_id": "global"})
        )
        == 1,
        "permission_presets_exist": (
            await database["permission_presets"].count_documents(
                {"_id": {"$in": ["ADMIN", "MARKETING"]}}
            )
        )
        == 2,
        "required_indexes_exist": indexes_complete,
        "no_department_collections": not forbidden_collections,
    }
    return {
        "database": database.name,
        "ok": all(checks.values()),
        "checks": checks,
        "accounts": len(accounts),
        "pages": len(page_keys),
        "invalid_roles": invalid_roles,
        "forbidden_collections": forbidden_collections,
        "missing_indexes": missing_indexes,
    }


async def verify() -> dict:
    await connect_to_mongo()
    return await verify_database(db_manager.db)


async def main() -> None:
    try:
        result = await verify()
        print(json.dumps(result, ensure_ascii=False))
        if not result["ok"]:
            raise SystemExit(1)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
