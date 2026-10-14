from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from app.api.deps import require_permissions
from app.db.mongodb import get_database
from app.modules.content.common.outbox import enqueue
from app.modules.website.branding.constants import (
    DEFAULT_ZALO_OA_ID,
    DEFAULT_ZALO_OA_URL,
)
from app.modules.website.branding.schemas import BrandingPayload, BrandingPublish
from app.modules.website.pages.service import website_page_service

protected_router = APIRouter(prefix="/website/branding", tags=["Website Branding"])
public_router = APIRouter(tags=["Public Website Branding"])


def serialize(document: dict | None) -> dict:
    if not document:
        return {}
    result = dict(document)
    result.pop("_id", None)
    return result


async def public_snapshot() -> dict:
    document = await get_database()["website_settings"].find_one({"_id": "global"})
    snapshot = dict((document or {}).get("published_snapshot") or {})
    if document:
        snapshot["published_version"] = document.get("published_version")
        snapshot["published_at"] = document.get("published_at")
    oa_id = snapshot.get("zalo_oa_id") or DEFAULT_ZALO_OA_ID
    zalo_url = snapshot.get("zalo_url")
    if not zalo_url or re.search(r"zalo\.me/(?:\+?84|0)\d{8,11}$", zalo_url):
        zalo_url = f"https://zalo.me/{oa_id}"
    snapshot["zalo_oa_id"] = oa_id
    snapshot["zalo_url"] = zalo_url
    return snapshot


@public_router.get("/site-settings")
async def get_public_site_settings():
    return await public_snapshot()


@public_router.get("/contact-settings")
async def get_public_contact_settings():
    data = await public_snapshot()
    phone = data.get("phone") or None
    email = data.get("email") or None
    configured_oa_id = data.get("zalo_oa_id") or None
    zalo_oa_id = configured_oa_id or DEFAULT_ZALO_OA_ID
    raw_zalo_url = data.get("zalo_url")
    if raw_zalo_url and re.search(r"zalo\.me/(?:\+?84|0)\d{8,11}$", raw_zalo_url):
        raw_zalo_url = None
    zalo_url = (raw_zalo_url or f"https://zalo.me/{zalo_oa_id}") if configured_oa_id else DEFAULT_ZALO_OA_URL
    return {
        "phone": phone,
        "phone_href": f"tel:{''.join(char for char in phone if char.isdigit() or char == '+')}" if phone else None,
        "zalo_oa_id": zalo_oa_id,
        "zalo_url": zalo_url,
        "messenger_url": data.get("messenger_url") or None,
        "email": email,
        "email_href": f"mailto:{email}" if email else None,
        "address": data.get("address") or None,
        "working_hours": (data.get("footer") or {}).get("working_hours") or None,
        "social_links": data.get("social_links") or {},
    }


@protected_router.get("")
async def get_branding(current_user: dict = Depends(require_permissions("website.branding.read"))):
    return serialize(await get_database()["website_settings"].find_one({"_id": "global"}))


@protected_router.get("/preview")
async def preview_branding(current_user: dict = Depends(require_permissions("website.branding.read"))):
    document = await get_database()["website_settings"].find_one({"_id": "global"})
    return dict((document or {}).get("draft") or {})


@protected_router.get("/versions")
async def branding_versions(current_user: dict = Depends(require_permissions("website.branding.read"))):
    documents = await get_database()["website_setting_versions"].find({}).sort("version", -1).limit(50).to_list(50)
    return {"items": [serialize(item) for item in documents]}


@protected_router.put("")
async def update_branding(payload: BrandingPayload, current_user: dict = Depends(require_permissions("website.branding.update"))):
    now = datetime.now(timezone.utc)
    values = payload.model_dump(exclude={"expected_version"})
    query: dict = {"_id": "global"}
    current = await get_database()["website_settings"].find_one(query)
    if current and payload.expected_version is not None:
        query["version"] = payload.expected_version
    update_op: dict = {
        "$set": {"draft": values, "status": "DRAFT", "updated_at": now, "updated_by": current_user.get("account_id")},
        "$inc": {"version": 1},
    }
    if not current:
        update_op["$setOnInsert"] = {"created_at": now}

    document = await get_database()["website_settings"].find_one_and_update(
        query,
        update_op,
        upsert=not current,
        return_document=ReturnDocument.AFTER,
    )
    if not document:
        raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
    await website_page_service.sync_references("BRANDING:GLOBAL:DRAFT", website_page_service.media_ids(values))
    return serialize(document)


@protected_router.post("/publish")
async def publish_branding(payload: BrandingPublish, current_user: dict = Depends(require_permissions("website.branding.publish"))):
    now = datetime.now(timezone.utc)
    current = await get_database()["website_settings"].find_one({"_id": "global", "version": payload.expected_version})
    if not current:
        raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
    draft = current.get("draft") or {}
    media_errors = await website_page_service.validate_media(draft)
    if media_errors:
        raise HTTPException(status_code=422, detail={"code": "PUBLISH_VALIDATION_FAILED", "errors": media_errors})
    published_version = int(current.get("published_version") or 0) + 1
    await get_database()["website_setting_versions"].insert_one({
        "version": published_version, "snapshot": draft, "created_at": now,
        "created_by": current_user.get("account_id"),
    })
    document = await get_database()["website_settings"].find_one_and_update(
        {"_id": "global", "version": payload.expected_version},
        {"$set": {"published_snapshot": draft, "published_version": published_version, "status": "PUBLISHED", "published_at": now, "published_by": current_user.get("account_id"), "updated_at": now}, "$inc": {"version": 1}},
        return_document=ReturnDocument.AFTER,
    )
    await website_page_service.sync_references(f"BRANDING:GLOBAL:PUBLISHED:{published_version}", website_page_service.media_ids(draft))
    await enqueue("WEBSITE_BRANDING_PUBLISH", {
        "entity_id": "global",
        "published_version": published_version,
        "author_id": current_user.get("account_id"),
    })
    return serialize(document)


@protected_router.post("/unpublish")
async def unpublish_branding(payload: BrandingPublish, current_user: dict = Depends(require_permissions("website.branding.publish"))):
    document = await get_database()["website_settings"].find_one_and_update(
        {"_id": "global", "version": payload.expected_version},
        {"$set": {"status": "UNPUBLISHED", "updated_at": datetime.now(timezone.utc)}, "$inc": {"version": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not document:
        raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
    return serialize(document)
