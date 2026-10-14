from datetime import datetime, timezone

from pymongo import ASCENDING, DESCENDING


_WORKFLOW_FIELDS = {
    "workflow_status",
    "publication_status",
    "quality_status",
    "published_at",
    "published_by",
    "published_version",
    "rejection_reason",
    "version",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
}


def _legacy_payload(document: dict) -> dict:
    return {
        key: value
        for key, value in document.items()
        if key != "_id" and key not in _WORKFLOW_FIELDS
    }


async def _backfill_legacy_marketing_documents(db) -> None:
    """Adopt pre-workflow documents without overwriting current drafts."""
    now = datetime.now(timezone.utc)
    specifications = (
        ("projects", "project_drafts", "project_id"),
        ("articles", "article_drafts", "article_id"),
    )
    missing_workflow = {
        "$or": [
            {"workflow_status": {"$exists": False}},
            {"publication_status": {"$exists": False}},
            {"quality_status": {"$exists": False}},
        ]
    }
    for root_name, draft_name, foreign_key in specifications:
        async for document in db[root_name].find(missing_workflow):
            if root_name == "projects":
                published = bool(document.get("is_published"))
            else:
                published = str(document.get("status") or "").casefold() == "published"
            fields = {
                "workflow_status": document.get("workflow_status") or (
                    "PUBLISHED" if published else "DRAFT"
                ),
                "publication_status": document.get("publication_status") or (
                    "PUBLISHED" if published else "NEVER_PUBLISHED"
                ),
                "quality_status": document.get("quality_status") or "LEGACY",
                "version": int(document.get("version") or 1),
                "updated_at": document.get("updated_at") or now,
            }
            # Create the recoverable draft first. If the process stops here,
            # the root still matches missing_workflow and the next run can
            # safely retry. Updating the root first could permanently skip a
            # missing draft after a partial migration.
            await db[draft_name].update_one(
                {foreign_key: str(document["_id"])},
                {
                    "$setOnInsert": {
                        foreign_key: str(document["_id"]),
                        "payload": _legacy_payload(document),
                        "version": fields["version"],
                        "updated_by": document.get("updated_by")
                        or document.get("created_by")
                        or document.get("author_id"),
                        "created_at": document.get("created_at") or now,
                        "updated_at": fields["updated_at"],
                    }
                },
                upsert=True,
            )
            await db[root_name].update_one(
                {"_id": document["_id"]},
                {"$set": fields},
            )


async def ensure_marketing_indexes(db) -> None:
    await db["projects"].create_index("slug", unique=True)
    await db["projects"].create_index(
        [("is_published", ASCENDING), ("_id", DESCENDING)],
        name="idx_projects_public_listing",
    )
    await db["projects"].create_index(
        [("is_published", ASCENDING), ("is_featured", ASCENDING), ("_id", DESCENDING)],
        name="idx_projects_public_featured",
    )
    await db["projects"].create_index(
        [("workflow_status", ASCENDING), ("updated_at", DESCENDING)],
        name="idx_projects_workflow",
    )
    await db["project_drafts"].create_index("project_id", unique=True)
    await db["project_revisions"].create_index(
        [("project_id", ASCENDING), ("version", DESCENDING)],
        unique=True,
    )
    await db["articles"].create_index("slug", unique=True)
    await db["articles"].create_index(
        [("status", ASCENDING), ("published_at", DESCENDING)],
        name="idx_articles_public_listing",
    )
    await db["articles"].create_index(
        [("status", ASCENDING), ("category", ASCENDING), ("published_at", DESCENDING)],
        name="idx_articles_public_category",
    )
    await db["articles"].create_index(
        [("author_id", ASCENDING), ("updated_at", DESCENDING)],
        name="idx_articles_author_updated",
    )
    await db["articles"].create_index(
        [("editor_owner_id", ASCENDING), ("updated_at", DESCENDING)],
        name="idx_articles_editor_owner_updated",
    )
    await db["articles"].create_index(
        [("ownership_status", ASCENDING), ("updated_at", DESCENDING)],
        name="idx_articles_ownership_status",
    )
    await db["articles"].create_index(
        [("is_provisional", ASCENDING), ("created_at", ASCENDING)],
        name="idx_articles_provisional_cleanup",
    )
    await db["article_drafts"].create_index("article_id", unique=True)
    await db["article_drafts"].create_index(
        "payload.slug",
        unique=True,
        partialFilterExpression={"payload.slug": {"$type": "string"}},
        name="uq_article_draft_slug",
    )
    await db["article_revisions"].create_index(
        [("article_id", ASCENDING), ("version", DESCENDING)],
        unique=True,
        name="uq_article_revision_version",
    )
    await db["marketing_redirects"].create_index(
        [("entity_type", ASCENDING), ("old_slug", ASCENDING)], unique=True
    )
    await db["marketing_idempotency"].create_index("identity", unique=True)
    await db["marketing_idempotency"].create_index("expires_at", expireAfterSeconds=0)
    await db["marketing_idempotency"].create_index(
        [("state", ASCENDING), ("lease_until", ASCENDING)],
        name="idx_marketing_idempotency_lease",
    )
    await db["marketing_outbox"].create_index(
        [("status", ASCENDING), ("available_at", ASCENDING)]
    )
    await db["article_view_logs"].create_index(
        "created_at", expireAfterSeconds=1800, name="idx_article_views_ttl"
    )
    await db["media_assets"].create_index(
        [("lifecycle_status", ASCENDING), ("orphaned_at", ASCENDING)],
        name="idx_marketing_media_orphan_cleanup",
    )
    await db["article_view_logs"].create_index(
        [("article_id", ASCENDING), ("viewer_hash", ASCENDING)],
        unique=True,
        name="idx_article_views_unique_viewer",
    )
    await _backfill_legacy_marketing_documents(db)
