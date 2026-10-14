from datetime import datetime, timedelta, timezone

import httpx
from pymongo import ReturnDocument

from app.core.config import settings
from app.db.mongodb import get_database
from app.modules.notifications.registry import emit_notification


async def _revalidate_public_content(event_type: str, payload: dict) -> None:
    if not event_type.endswith(("APPROVE", "PUBLISH", "UNPUBLISH", "ARCHIVE", "RESTORE", "CLOSE")):
        return
    if not settings.MARKETING_REVALIDATE_URL:
        raise RuntimeError("URL revalidate Marketing chưa được cấu hình")

    if "_TEAM_" in event_type:
        entity = "TEAM"
    elif "_RECRUITMENT_" in event_type:
        entity = "JOB"
    elif "_COMPANY_KNOWLEDGE_" in event_type:
        entity = "COMPANY_KNOWLEDGE"
    elif "_BRANDING_" in event_type:
        entity = "BRANDING"
    elif "_PAGE_" in event_type:
        entity = "PAGE"
    else:
        entity = "ARTICLE" if "_ARTICLE_" in event_type else "PROJECT"
    headers = {
        "x-marketing-revalidate-secret": settings.MARKETING_REVALIDATE_SECRET,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            settings.MARKETING_REVALIDATE_URL,
            headers=headers,
            json={"entity": entity, "slug": payload.get("slug"), "old_slug": payload.get("old_slug"), "page_key": payload.get("page_key")},
        )
        response.raise_for_status()



def _admin_link(event_type: str) -> str:
    if "_ARTICLE_" in event_type:
        return "/admin/articles"
    if "_COMPANY_KNOWLEDGE_" in event_type:
        return "/admin/content/company"
    if "_PAGE_" in event_type:
        return "/admin/content"
    return "/admin/projects"


async def process_one() -> bool:
    db = get_database()
    now = datetime.now(timezone.utc)
    event = await db["marketing_outbox"].find_one_and_update(
        {
            "$or": [
                {"status": "PENDING", "available_at": {"$lte": now}},
                {
                    "status": "PROCESSING",
                    "locked_at": {"$lte": now - timedelta(minutes=5)},
                },
            ]
        },
        {"$set": {"status": "PROCESSING", "locked_at": now}},
        sort=[("created_at", 1)],
        return_document=ReturnDocument.AFTER,
    )
    if not event:
        return False
    try:
        event_type = event["event_type"]
        payload = event.get("payload", {})
        if event_type.endswith("PUBLISH") and payload.get(
            "author_id"
        ):
            await emit_notification(
                "MARKETING_STATUS_CHANGED",
                {"subject_type": "MARKETING_CONTENT", "subject_id": payload.get("entity_id"),
                 "subject_name": payload.get("title") or payload.get("name"), "module": "MARKETING",
                 "link": _admin_link(event_type)},
                recipient_account_ids=(payload["author_id"],), event_id=str(event.get("event_id") or event["_id"]),
            )

        await _revalidate_public_content(event_type, payload)
        await db["marketing_outbox"].update_one(
            {"_id": event["_id"]},
            {"$set": {"status": "COMPLETED", "updated_at": now}},
        )
    except Exception as exc:
        payload = event.get("payload", {})
        if str(event.get("event_type") or "").endswith("PUBLISH"):
            await emit_notification(
                "MARKETING_PUBLISH_FAILED",
                {"subject_type": "MARKETING_CONTENT", "subject_id": payload.get("entity_id"),
                 "subject_name": payload.get("title") or payload.get("name"), "module": "MARKETING",
                 "link": _admin_link(event_type)},
                recipient_account_ids=(payload.get("author_id"),) if payload.get("author_id") else (),
                recipient_roles=("ADMIN", "CEO"),
                event_id=f"{event.get('event_id') or event['_id']}:FAILED",
            )
        attempts = int(event.get("attempts", 0)) + 1
        await db["marketing_outbox"].update_one(
            {"_id": event["_id"]},
            {
                "$set": {
                    "status": "DEAD" if attempts >= 8 else "PENDING",
                    "available_at": now + timedelta(seconds=min(900, 2**attempts)),
                    "last_error": str(exc)[:1000],
                    "updated_at": now,
                },
                "$inc": {"attempts": 1},
            },
        )
    return True
