import hashlib
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import uuid4

from bson import Binary, ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.api.deps import require_permissions
from app.api.deps_idempotency import get_optional_idempotency_key
from app.core.config import settings
from app.core.security import get_real_client_ip, limiter
from app.core.upload_security import scan_stream, validate_declared_upload
from app.db.mongodb import get_database
from app.modules.content.seo_geo.html_sanitizer import sanitize_marketing_html
from app.modules.content.common.outbox import enqueue
from app.modules.website.common.transactions import session_kwargs, website_transaction
from app.modules.website.recruitment.schemas import JobPayload, JobTransition

public_router = APIRouter(prefix="/jobs", tags=["Public Website Recruitment"])
protected_router = APIRouter(prefix="/website/recruitment", tags=["Website Recruitment"])
applications_router = APIRouter(prefix="/website/applications", tags=["Website Applications"])

RESUME_TYPES = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_RESUME_SIZE = 10 * 1024 * 1024
APPLICATION_EMAIL_RE = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")


def serialize(document: dict, *, public: bool = False) -> dict:
    result = dict(document)
    result["id"] = str(result.pop("_id"))
    result.pop("resume_content", None)
    if public:
        result.pop("version", None)
    return result


def clean_job(payload: JobPayload) -> dict:
    values = payload.model_dump(exclude={"expected_version"})
    for field in ("description_html", "requirements_html", "benefits_html"):
        values[field] = sanitize_marketing_html(values.get(field) or "")
    return values


def make_job_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.replace("Đ", "D").replace("đ", "d"))
    ascii_value = "".join(character for character in normalized if unicodedata.category(character) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "vi-tri-tuyen-dung"


def public_job_is_expired(item: dict) -> bool:
    if str(item.get("status") or "").upper() in {"CLOSED", "EXPIRED"}:
        return True
    raw_deadline = item.get("deadline")
    if not raw_deadline:
        return False
    try:
        deadline = raw_deadline if isinstance(raw_deadline, datetime) else datetime.fromisoformat(
            str(raw_deadline).replace("Z", "+00:00")
        )
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return deadline <= datetime.now(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return False

async def unique_job_slug(title: str) -> str:
    base = make_job_slug(title)[:150]
    candidate = base
    suffix = 2
    while await get_database()["job_postings"].find_one({"slug": candidate}, {"_id": 1}):
        candidate = f"{base[: 159 - len(str(suffix))]}-{suffix}"
        suffix += 1
    return candidate


def publication_issues(draft: dict) -> list[dict]:
    issues: list[dict] = []
    required_text = {
        "title": "Can nhap ten vi tri.",
        "department": "Can chon phong ban.",
        "location": "Can nhap khu vuc lam viec.",
        "employment_type": "Can chon hinh thuc lam viec.",
        "short_description": "Can nhap mo ta ngan hien thi tren danh sach.",
    }
    for field, message in required_text.items():
        if not str(draft.get(field) or "").strip():
            issues.append({"code": "FIELD_REQUIRED", "field": field, "message": message})
    for field, message in (
        ("description_html", "Can nhap mo ta cong viec."),
        ("requirements_html", "Can nhap yeu cau ung vien."),
        ("benefits_html", "Can nhap quyen loi va dai ngo."),
    ):
        plain_text = re.sub(r"<[^>]+>", " ", str(draft.get(field) or ""))
        if not plain_text.strip():
            issues.append({"code": "CONTENT_REQUIRED", "field": field, "message": message})
    try:
        quantity = int(draft.get("quantity") or 0)
    except (TypeError, ValueError):
        quantity = 0
    if quantity < 1:
        issues.append({"code": "QUANTITY_REQUIRED", "field": "quantity", "message": "Chi tieu phai lon hon 0."})
    return issues


@public_router.get("")
async def list_public_jobs(
    response: Response,
    department: str | None = None,
    location: str | None = None,
    employment_type: str | None = None,
    q: str | None = Query(None, max_length=100),
    view: str = "full",
):
    query: dict = {"status": {"$in": ["PUBLISHED", "CLOSED"]}}
    if department and department not in {"Tất cả", "Táº¥t cáº£"}:
        query["published_snapshot.department"] = department
    if location and location not in {"Tất cả", "Táº¥t cáº£"}:
        query["published_snapshot.location"] = location
    if employment_type and employment_type not in {"Tất cả", "Táº¥t cáº£"}:
        query["published_snapshot.employment_type"] = employment_type
    if q:
        query["published_snapshot.title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    documents = await get_database()["job_postings"].find(query).sort([("status", 1), ("published_at", -1)]).to_list(length=500)
    items = []
    for document in documents:
        item = {**document.get("published_snapshot", {}), "status": document["status"], "created_at": document.get("created_at"), "updated_at": document.get("updated_at")}
        item["id"] = str(document["_id"])
        item["is_expired"] = public_job_is_expired(item)
        if view == "summary":
            for field in ("description_html", "requirements_html", "benefits_html", "address_detail"):
                item.pop(field, None)
        items.append(item)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return items


@public_router.get("/{slug}")
async def get_public_job(slug: str, response: Response):
    document = await get_database()["job_postings"].find_one({"published_snapshot.slug": slug, "status": {"$in": ["PUBLISHED", "CLOSED"]}})
    if not document:
        raise HTTPException(status_code=404, detail="Tin tuyển dụng không tồn tại.")
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    item = {**document["published_snapshot"], "id": str(document["_id"]), "status": document["status"], "created_at": document.get("created_at"), "updated_at": document.get("updated_at"), "published_at": document.get("published_at")}
    item["is_expired"] = public_job_is_expired(item)
    return item


@public_router.post("/{slug}/apply", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def apply_for_job(
    request: Request,
    slug: str,
    full_name: str = Form(...),
    email: str = Form(""),
    phone: str = Form(...),
    birth_year: int | None = Form(None),
    education: str | None = Form(None),
    school: str | None = Form(None),
    address: str | None = Form(None),
    resume: UploadFile | None = File(None),
    idempotency_key: str | None = Depends(get_optional_idempotency_key),
):
    job = await get_database()["job_postings"].find_one({"published_snapshot.slug": slug, "status": "PUBLISHED"})
    if not job:
        raise HTTPException(status_code=404, detail="Vị trí không tồn tại hoặc đã đóng.")
    name, normalized_email = full_name.strip(), email.strip().lower()
    normalized_phone = re.sub(r"[^0-9+]", "", phone)
    if normalized_phone.startswith("+84"):
        normalized_phone = "0" + normalized_phone[3:]
    elif normalized_phone.startswith("84"):
        normalized_phone = "0" + normalized_phone[2:]
    if (
        len(name) < 2
        or len(name) > 200
        or not re.fullmatch(r"0\d{8,11}", normalized_phone)
        or (normalized_email and (len(normalized_email) > 254 or not APPLICATION_EMAIL_RE.fullmatch(normalized_email)))
    ):
        raise HTTPException(status_code=422, detail="Thông tin ứng viên không hợp lệ.")
    if birth_year is not None and not 1900 <= birth_year <= datetime.now(timezone.utc).year:
        raise HTTPException(status_code=422, detail="Năm sinh không hợp lệ.")
    if education and len(education.strip()) > 200:
        raise HTTPException(status_code=422, detail="Trình độ học vấn không hợp lệ.")
    if school and len(school.strip()) > 500:
        raise HTTPException(status_code=422, detail="Thông tin trường học không hợp lệ.")
    if address and len(address.strip()) > 500:
        raise HTTPException(status_code=422, detail="Địa chỉ không hợp lệ.")
    file_values: dict = {}
    if resume and resume.filename:
        content = await resume.read(MAX_RESUME_SIZE + 1)
        if len(content) > MAX_RESUME_SIZE:
            raise HTTPException(status_code=413, detail="CV vượt quá 10MB.")
        stream = BytesIO(content)
        extension, mime = validate_declared_upload(stream, resume.filename, resume.content_type, RESUME_TYPES)
        await scan_stream(stream)
        file_values = {
            "resume_content": Binary(content),
            "resume_filename": re.sub(r"[^A-Za-z0-9._-]", "_", resume.filename)[:200],
            "resume_content_type": mime,
            "resume_extension": extension,
            "resume_size": len(content),
        }
    now = datetime.now(timezone.utc)
    fingerprint = hashlib.sha256(f"{get_real_client_ip(request)}:{request.headers.get('user-agent','')[:200]}".encode()).hexdigest()
    input_fingerprint = hashlib.sha256(json.dumps({
        "job_slug": slug,
        "full_name": name,
        "email": normalized_email,
        "phone": normalized_phone,
        "birth_year": birth_year,
        "education": education.strip() if education else None,
        "school": school.strip() if school else None,
        "address": address.strip() if address else None,
        "resume_sha256": hashlib.sha256(bytes(file_values["resume_content"])).hexdigest() if file_values.get("resume_content") else None,
    }, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    database = get_database()
    reservation_key = f"job-application:{idempotency_key}" if idempotency_key else None
    if reservation_key:
        try:
            await database["idempotency_records"].insert_one({
                "key": reservation_key,
                "fingerprint": input_fingerprint,
                "created_at": now,
                "expires_at": now + timedelta(hours=24),
            })
        except DuplicateKeyError:
            previous = await database["idempotency_records"].find_one({"key": reservation_key})
            if previous and previous.get("fingerprint") == input_fingerprint and previous.get("application_id"):
                return {
                    "submitted": True,
                    "message": "Hồ sơ đã được tiếp nhận.",
                    "request_id": previous.get("request_id") or str(previous["application_id"]),
                }
            raise HTTPException(status_code=409, detail="Idempotency-Key đã được sử dụng")
    application_id = ObjectId()
    outbox_id = ObjectId()
    request_id = uuid4().hex
    document = {
        "_id": application_id,
        "job_posting_id": str(job["_id"]), "job_slug": slug,
        "full_name": name, "email": normalized_email or None, "phone": normalized_phone,
        "birth_year": birth_year,
        "education": education.strip() if education else None,
        "school": school.strip() if school else None,
        "address": address.strip() if address else None,
        "status": "NEW", "submitted_at": now, "updated_at": now, "fingerprint_hash": fingerprint,
        **file_values,
    }
    try:
        async with website_transaction() as session:
            kwargs = session_kwargs(session)
            await database["job_applications"].insert_one(document, **kwargs)
            await database["outbox_events"].insert_one({
                "_id": outbox_id,
                "event_type": "JOB_APPLICATION_CREATED",
                "payload": {"application_id": str(application_id), "job_id": str(job["_id"])},
                "status": "PENDING",
                "created_at": now,
            }, **kwargs)
            if reservation_key:
                await database["idempotency_records"].update_one(
                    {"key": reservation_key},
                    {"$set": {
                        "application_id": str(application_id),
                        "request_id": request_id,
                        "status": "COMPLETED",
                        "completed_at": now,
                    }},
                    **kwargs,
                )
    except Exception:
        if not settings.MARKETING_TRANSACTIONS_ENABLED:
            await database["outbox_events"].delete_one({"_id": outbox_id})
            await database["job_applications"].delete_one({"_id": application_id})
        if reservation_key:
            await database["idempotency_records"].delete_one({
                "key": reservation_key,
                "application_id": {"$exists": False},
            })
        raise
    return {"submitted": True, "message": "Hồ sơ đã được tiếp nhận.", "request_id": request_id}


@protected_router.get("")
async def list_jobs(current_user: dict = Depends(require_permissions("website.recruitment.read"))):
    documents = await get_database()["job_postings"].find().sort("updated_at", -1).to_list(length=500)
    return {"items": [serialize(item) for item in documents]}


@protected_router.post("")
async def create_job(payload: JobPayload, current_user: dict = Depends(require_permissions("website.recruitment.create"))):
    now = datetime.now(timezone.utc)
    draft = clean_job(payload)
    draft["slug"] = await unique_job_slug(draft["title"])
    document = {"slug": draft["slug"], "draft": draft, "status": "DRAFT", "version": 1, "created_at": now, "updated_at": now, "created_by": current_user.get("account_id")}
    try:
        result = await get_database()["job_postings"].insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Slug tuyển dụng đã tồn tại.") from exc
    document["_id"] = result.inserted_id
    return serialize(document)


@protected_router.put("/{job_id}")
async def update_job(job_id: str, payload: JobPayload, current_user: dict = Depends(require_permissions("website.recruitment.update"))):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng.")
    query: dict = {"_id": ObjectId(job_id)}
    if payload.expected_version is not None:
        query["version"] = payload.expected_version
    draft = clean_job(payload)
    draft["slug"] = str((await get_database()["job_postings"].find_one({"_id": ObjectId(job_id)}, {"slug": 1}) or {}).get("slug") or await unique_job_slug(draft["title"]))
    document = await get_database()["job_postings"].find_one_and_update(query, {"$set": {"slug": draft["slug"], "draft": draft, "status": "DRAFT", "updated_at": datetime.now(timezone.utc), "updated_by": current_user.get("account_id")}, "$inc": {"version": 1}}, return_document=ReturnDocument.AFTER)
    if not document:
        raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
    return serialize(document)


@protected_router.post("/{job_id}/transition")
async def transition_job(job_id: str, payload: JobTransition, current_user: dict = Depends(require_permissions("website.recruitment.publish"))):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng.")
    current = await get_database()["job_postings"].find_one({"_id": ObjectId(job_id), "version": payload.expected_version})
    if not current:
        raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
    status_map = {"publish": "PUBLISHED", "unpublish": "UNPUBLISHED", "close": "CLOSED", "archive": "ARCHIVED"}
    now = datetime.now(timezone.utc)
    updates: dict = {"status": status_map[payload.action], "updated_at": now, "updated_by": current_user.get("account_id")}
    if payload.action == "publish":
        issues = publication_issues(current.get("draft") or {})
        if issues:
            raise HTTPException(status_code=422, detail={
                "code": "RECRUITMENT_CONTENT_INVALID",
                "message": "Tin tuyen dung con thieu noi dung bat buoc.",
                "errors": issues,
            })
        updates.update({"published_snapshot": current.get("draft") or {}, "published_at": now})
    document = await get_database()["job_postings"].find_one_and_update({"_id": ObjectId(job_id), "version": payload.expected_version}, {"$set": updates, "$inc": {"version": 1}}, return_document=ReturnDocument.AFTER)
    await enqueue(f"WEBSITE_RECRUITMENT_{payload.action.upper()}", {
        "entity_id": job_id,
        "slug": (current.get("draft") or {}).get("slug"),
        "old_slug": (current.get("published_snapshot") or {}).get("slug"),
        "title": (current.get("draft") or {}).get("title"),
        "author_id": current_user.get("account_id"),
    })
    return serialize(document)


@applications_router.get("")
async def list_applications(
    status_value: str | None = Query(None, alias="status"),
    current_user: dict = Depends(require_permissions("website.recruitment.read")),
):
    query = {"status": status_value} if status_value else {}
    documents = await get_database()["job_applications"].find(query, {"resume_content": 0, "fingerprint_hash": 0}).sort("submitted_at", -1).limit(500).to_list(length=500)
    return {"items": [serialize(item) for item in documents]}


@applications_router.get("/{application_id}/resume")
async def download_resume(application_id: str, current_user: dict = Depends(require_permissions("website.recruitment.read"))):
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ.")
    document = await get_database()["job_applications"].find_one({"_id": ObjectId(application_id)})
    if not document or not document.get("resume_content"):
        raise HTTPException(status_code=404, detail="Ứng viên không đính kèm CV.")
    return StreamingResponse(
        BytesIO(bytes(document["resume_content"])),
        media_type=document.get("resume_content_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{document.get("resume_filename", "resume")}"', "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"},
    )
