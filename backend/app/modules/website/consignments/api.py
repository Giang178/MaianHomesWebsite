import json

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import ValidationError

from app.api.deps_idempotency import get_optional_idempotency_key
from app.core.security import limiter
from app.modules.content.media.service import marketing_media_service
from app.modules.website.inquiries.schemas import WebsiteLeadCreate
from app.modules.website.inquiries.service import website_lead_service

router = APIRouter(prefix="/consignments", tags=["Public Website Consignments"])
MAX_PUBLIC_IMAGES = 8
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def to_lead(data: dict) -> WebsiteLeadCreate:
    if not isinstance(data, dict):
        raise ValueError("Consignment payload must be an object")
    owner = data.get("owner") if isinstance(data.get("owner"), dict) else {}
    prop = data.get("property") if isinstance(data.get("property"), dict) else {}
    cust_notes = str(prop.get("notes") or prop.get("description") or "").strip()
    note = json.dumps({"owner_role": owner.get("role"), "property": prop}, ensure_ascii=False, default=str)
    try:
        return WebsiteLeadCreate(
            customer_name=str(owner.get("name") or "").strip(),
            phone=str(owner.get("phone") or "").strip(),
            email=owner.get("email") or None,
            source="CONSIGNMENT",
            type="CONSIGNMENT",
            form_id="consignment",
            page_key="consignment",
            page_url="/ky-gui",
            note=note,
            message=cust_notes or None,
            structured_details={"owner_role": owner.get("role"), "property": prop},
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_CONSIGNMENT",
                "message": "Thông tin ký gửi không hợp lệ.",
                "errors": exc.errors(),
            },
        ) from exc


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute")
async def create_consignment(
    request: Request,
    payload: dict,
    idempotency_key: str | None = Depends(get_optional_idempotency_key),
):
    result = await website_lead_service.create(to_lead(payload), idempotency_key, request)
    return {"id": result["reference_id"], "status": "NEW", "message": "Yêu cầu ký gửi đã được tiếp nhận"}


@router.post("/with-images", status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute")
async def create_consignment_with_images(
    request: Request,
    payload: str = Form(...),
    files: list[UploadFile] | None = File(None),
    idempotency_key: str | None = Depends(get_optional_idempotency_key),
):
    uploads = files or []
    if not 3 <= len(uploads) <= MAX_PUBLIC_IMAGES:
        raise HTTPException(status_code=422, detail="Vui lòng tải từ 3 đến 8 ảnh bất động sản.")
    try:
        data = json.loads(payload)
        lead_payload = to_lead(data)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Thông tin ký gửi không hợp lệ.") from exc
    result = await website_lead_service.create(lead_payload, idempotency_key, request)
    lead_id = result["reference_id"]
    lead = await website_lead_service.collection.find_one({"_id": ObjectId(lead_id)})
    existing_ids = list((lead or {}).get("consignment_media_ids") or [])
    if existing_ids:
        return {"id": lead_id, "status": "NEW", "image_count": len(existing_ids), "message": "Yêu cầu ký gửi đã được tiếp nhận"}
    media_ids: list[str] = []
    try:
        for upload in uploads:
            media = await marketing_media_service.store(
                "consignments", upload, "website", MAX_UPLOAD_BYTES
            )
            media_ids.append(media["id"])
        await website_lead_service.collection.update_one(
            {"_id": ObjectId(lead_id)},
            {"$set": {"consignment_media_ids": media_ids}},
        )
        # Ensure media_assets keep active references to this consignment lead.
        from app.db.mongodb import get_database
        await get_database()["media_assets"].update_many(
            {"_id": {"$in": media_ids}},
            {"$addToSet": {"references": f"CONSIGNMENT:{lead_id}"}, "$set": {"lifecycle_status": "ACTIVE"}},
        )
    except Exception:
        await website_lead_service.rollback_create(
            lead_id, idempotency_key, media_ids
        )
        raise
    return {"id": lead_id, "status": "NEW", "image_count": len(media_ids), "message": "Yêu cầu ký gửi đã được tiếp nhận"}
