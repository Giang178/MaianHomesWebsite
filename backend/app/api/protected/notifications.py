from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pymongo import ReturnDocument

from app.api.deps import get_current_user
from app.models.notification import Notification
from app.modules.notifications.registry import render_notification
from app.modules.notifications.service import notification_service

router = APIRouter(prefix="/notifications", tags=["Protected Notifications"])
SUBJECT_FALLBACKS = {
    "EMPLOYEE": "nhân sự liên quan",
    "USER_ACCOUNT": "nhân sự liên quan",
    "CANDIDATE": "ứng viên liên quan",
    "INTERVIEW": "ứng viên liên quan",
    "JOB_POSTING": "tin tuyển dụng liên quan",
    "WEBSITE_LEAD": "khách hàng liên quan",
    "MARKETING_CONTENT": "nội dung Marketing liên quan",
}


def repair_legacy_notification(document: dict) -> dict:
    title = str(document.get("title") or "")
    message = str(document.get("message") or "")
    if title != "Thông báo nghiệp vụ" and "đối tượng chưa xác định" not in message:
        return document
    subject_name = str(document.get("subject_name") or "").strip()
    if not subject_name or subject_name == "đối tượng chưa xác định":
        subject_name = SUBJECT_FALLBACKS.get(str(document.get("subject_type") or ""), "nội dung liên quan")
    repaired_title, repaired_message = render_notification(
        str(document.get("event_type") or ""),
        {"subject_name": subject_name, "actor_name": document.get("actor_name")},
    )
    return {**document, "title": repaired_title, "message": repaired_message,
            "subject_name": subject_name}


def _account_id(current_user: dict) -> str:
    value = current_user.get("account_id")
    if not value:
        raise HTTPException(status_code=403, detail="Không xác định được tài khoản nhận thông báo.")
    return str(value)


@router.get("", response_model=list[Notification])
async def list_notifications(
    response: Response,
    cursor: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    query: dict = {"recipient_account_id": _account_id(current_user)}
    if cursor:
        if not ObjectId.is_valid(cursor):
            raise HTTPException(status_code=400, detail="Con trỏ phân trang không hợp lệ.")
        query["_id"] = {"$lt": ObjectId(cursor)}
    documents = await notification_service.collection.find(query).sort("_id", -1).limit(limit + 1).to_list(limit + 1)
    has_more = len(documents) > limit
    documents = documents[:limit]
    if has_more and documents:
        response.headers["X-Next-Cursor"] = str(documents[-1]["_id"])
    return [Notification(**repair_legacy_notification(document)) for document in documents]


@router.patch("/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    result = await notification_service.collection.update_many(
        {
            "recipient_account_id": _account_id(current_user),
            "is_read": {"$ne": True},
            "created_at": {"$gte": now - timedelta(days=180)},
        },
        {"$set": {"is_read": True, "read_at": now, "updated_at": now}},
    )
    return {"message": "Đã đánh dấu tất cả thông báo là đã đọc.", "modified_count": result.modified_count}


@router.patch("/{id}/read", response_model=Notification)
async def mark_notification_read(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Mã thông báo không hợp lệ.")
    now = datetime.now(timezone.utc)
    document = await notification_service.collection.find_one_and_update(
        {"_id": ObjectId(id), "recipient_account_id": _account_id(current_user)},
        {"$set": {"is_read": True, "read_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo.")
    return Notification(**document)
