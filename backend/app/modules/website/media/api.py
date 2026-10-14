import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pymongo import ReturnDocument

from app.api.deps import require_permissions
from app.db.mongodb import get_database
from app.modules.content.media.service import marketing_media_service
from app.modules.website.media.schemas import MediaUpdate

router = APIRouter(prefix="/website/media", tags=["Website Media"])
WEBSITE_NAMESPACES = {"website", "website-pages", "website-branding", "website-global", "website-seed"}
GENERIC_ALT = {"hình ảnh", "hinh anh", "banner", "photo", "image", "ảnh", "anh"}


def validate_alt(value: str) -> str:
    normalized = " ".join(value.split())
    if len(normalized) < 10 or len(normalized) > 180 or normalized.casefold() in GENERIC_ALT:
        raise HTTPException(status_code=422, detail={"code": "MEDIA_ALT_REQUIRED", "message": "Alt text phải mô tả rõ hình ảnh, từ 10 đến 180 ký tự."})
    return normalized


def serialize(document: dict) -> dict:
    result = dict(document)
    result["id"] = str(result.pop("_id"))
    result.pop("local_path", None)
    result.pop("object_key", None)
    for variant in (result.get("variants") or {}).values():
        variant.pop("local_path", None)
        variant.pop("object_key", None)
    result["url"] = f"/api/public/marketing-media/{result['id']}"
    return result


@router.get("")
async def list_media(
    page: int = Query(1, ge=1), limit: int = Query(48, ge=1, le=100),
    search: str | None = None, status: str | None = None, used: bool | None = None,
    current_user: dict = Depends(require_permissions("website.media.read")),
):
    query: dict = {"namespace": {"$in": sorted(WEBSITE_NAMESPACES)}}
    query["lifecycle_status"] = status or {"$ne": "DELETED"}
    if search:
        safe = re.escape(search.strip()[:100])
        query["$or"] = [{"display_name": {"$regex": safe, "$options": "i"}}, {"alt_text": {"$regex": safe, "$options": "i"}}, {"original_filename": {"$regex": safe, "$options": "i"}}]
    if used is True:
        query["references.0"] = {"$exists": True}
    elif used is False:
        query["references.0"] = {"$exists": False}
    collection = get_database()["media_assets"]
    total = await collection.count_documents(query)
    documents = await collection.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(length=limit)
    return {"items": [serialize(item) for item in documents], "total": total, "page": page, "limit": limit}


@router.post("/upload", status_code=201)
async def upload_media(
    file: UploadFile = File(...), alt_text: str = Form(...), display_name: str | None = Form(None),
    caption: str | None = Form(None), credit: str | None = Form(None),
    current_user: dict = Depends(require_permissions("website.media.upload")),
):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=422, detail={"code": "MEDIA_TYPE_NOT_ALLOWED"})
    alt = validate_alt(alt_text)
    result = await marketing_media_service.store("website", file, str(current_user.get("account_id") or current_user.get("id")), 20 * 1024 * 1024, alt)
    technical_name = (display_name or file.filename or "Ảnh website").strip()[:160]
    await get_database()["media_assets"].update_one({"_id": result["id"]}, {"$set": {"display_name": technical_name, "caption": caption, "credit": credit}})
    document = await get_database()["media_assets"].find_one({"_id": result["id"]})
    return serialize(document)


@router.patch("/{media_id}")
async def update_media(media_id: str, payload: MediaUpdate, current_user: dict = Depends(require_permissions("website.media.update"))):
    document = await get_database()["media_assets"].find_one_and_update(
        {"_id": media_id, "namespace": {"$in": sorted(WEBSITE_NAMESPACES)}, "lifecycle_status": {"$ne": "DELETED"}},
        {"$set": {**payload.model_dump(), "alt_text": validate_alt(payload.alt_text)}},
        return_document=ReturnDocument.AFTER,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy hình ảnh")
    return serialize(document)


@router.get("/{media_id}/usage")
async def media_usage(media_id: str, current_user: dict = Depends(require_permissions("website.media.read"))):
    document = await get_database()["media_assets"].find_one({"_id": media_id, "namespace": {"$in": sorted(WEBSITE_NAMESPACES)}})
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy hình ảnh")
    return {"id": media_id, "references": document.get("references") or []}


@router.post("/{media_id}/archive")
async def archive_media(media_id: str, current_user: dict = Depends(require_permissions("website.media.delete"))):
    document = await get_database()["media_assets"].find_one({"_id": media_id, "namespace": {"$in": sorted(WEBSITE_NAMESPACES)}})
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy hình ảnh")
    if document.get("references"):
        raise HTTPException(status_code=409, detail={"code": "MEDIA_IN_USE", "references": document["references"]})
    await get_database()["media_assets"].update_one({"_id": media_id}, {"$set": {"lifecycle_status": "ARCHIVED"}})
    return {"success": True}


@router.post("/{media_id}/restore")
async def restore_media(media_id: str, current_user: dict = Depends(require_permissions("website.media.update"))):
    result = await get_database()["media_assets"].update_one({"_id": media_id, "namespace": {"$in": sorted(WEBSITE_NAMESPACES)}, "lifecycle_status": "ARCHIVED"}, {"$set": {"lifecycle_status": "ACTIVE"}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy hình ảnh đã lưu trữ")
    return {"success": True}


@router.delete("/{media_id}", status_code=204)
async def delete_media(media_id: str, current_user: dict = Depends(require_permissions("website.media.delete"))):
    document = await get_database()["media_assets"].find_one({"_id": media_id, "namespace": {"$in": sorted(WEBSITE_NAMESPACES)}, "lifecycle_status": "ARCHIVED"})
    if not document:
        raise HTTPException(status_code=409, detail={"code": "MEDIA_MUST_BE_ARCHIVED"})
    if document.get("references"):
        raise HTTPException(status_code=409, detail={"code": "MEDIA_IN_USE"})
    await get_database()["media_assets"].update_one({"_id": media_id}, {"$set": {"lifecycle_status": "DELETED"}})
    return Response(status_code=204)
