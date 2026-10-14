from __future__ import annotations

import logging
import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.core.notification_bus import notification_event, publish_notification
from app.db.mongodb import get_database

logger = logging.getLogger(__name__)
UNKNOWN_SUBJECT = "nội dung liên quan"


@dataclass(frozen=True)
class NotificationTemplate:
    title: str
    message: str


TEMPLATES: dict[str, NotificationTemplate] = {
    "MARKETING_REVIEW_REQUIRED": NotificationTemplate("Nội dung Marketing chờ duyệt", "Nội dung {subject_name} đang chờ phê duyệt."),
    "MARKETING_STATUS_CHANGED": NotificationTemplate("Trạng thái nội dung đã thay đổi", "Nội dung {subject_name} đã được cập nhật trạng thái."),
    "MARKETING_PUBLISH_FAILED": NotificationTemplate("Xuất bản nội dung thất bại", "Không thể xuất bản nội dung {subject_name}."),
    "IT_SECURITY_ANOMALY": NotificationTemplate("Phát hiện bất thường bảo mật", "Hệ thống phát hiện bất thường liên quan đến {subject_name}."),
    "IT_PRODUCTION_INCIDENT": NotificationTemplate("Sự cố production nghiêm trọng", "Sự cố nghiêm trọng đang ảnh hưởng đến {subject_name}."),
    "ACCOUNT_LOCKED": NotificationTemplate("Tài khoản đã bị khóa", "Tài khoản của {subject_name} đã bị khóa."),
    "ACCOUNT_UNLOCKED": NotificationTemplate("Tài khoản đã được mở khóa", "Tài khoản của {subject_name} đã được mở khóa."),
    "PASSWORD_CHANGED": NotificationTemplate("Mật khẩu đã thay đổi", "Mật khẩu của {subject_name} đã được thay đổi."),
    "EMPLOYEE_ONBOARDED": NotificationTemplate("Hoàn tất tiếp nhận nhân sự", "Quy trình tiếp nhận {subject_name} đã hoàn tất."),
    "EMPLOYEE_OFFBOARDED": NotificationTemplate("Hoàn tất nghỉ việc", "Quy trình nghỉ việc của {subject_name} đã hoàn tất."),
    "JOB_APPROVAL_REQUIRED": NotificationTemplate("Tin tuyển dụng chờ duyệt", "Tin tuyển dụng {subject_name} đang chờ phê duyệt."),
    "JOB_STATUS_CHANGED": NotificationTemplate("Trạng thái tin tuyển dụng đã thay đổi", "Tin tuyển dụng {subject_name} đã được cập nhật."),
    "CANDIDATE_APPLIED": NotificationTemplate("Có ứng viên mới", "Đã nhận hồ sơ ứng tuyển của {subject_name}."),
    "CANDIDATE_STATUS_CHANGED": NotificationTemplate("Trạng thái ứng viên đã thay đổi", "Hồ sơ ứng viên {subject_name} đã được cập nhật."),
    "INTERVIEW_SCHEDULED": NotificationTemplate("Đã lên lịch phỏng vấn", "Lịch phỏng vấn với {subject_name} đã được tạo."),
    "INTERVIEW_REMINDER_24H": NotificationTemplate("Nhắc lịch phỏng vấn", "Buổi phỏng vấn với {subject_name} sẽ bắt đầu trong vòng 24 giờ."),
    "INTERVIEW_REMINDER_30M": NotificationTemplate("Nhắc lịch phỏng vấn", "Buổi phỏng vấn với {subject_name} sẽ bắt đầu trong vòng 30 phút."),
    "EMPLOYEE_MANAGER_MISSING": NotificationTemplate("Thiếu quản lý trực tiếp", "Hồ sơ của {subject_name} chưa có quản lý trực tiếp."),
    "HR_ESCALATION_CRITICAL": NotificationTemplate("Vấn đề nhân sự nghiêm trọng", "Vấn đề liên quan đến {subject_name} đã được leo thang."),
    "ACCOUNT_CREATED": NotificationTemplate("Tài khoản đã được tạo", "Tài khoản truy cập của {subject_name} đã được tạo."),
    "ACCOUNT_APPROVED": NotificationTemplate("Tài khoản đã được duyệt", "Tài khoản truy cập của {subject_name} đã được phê duyệt."),
    "ACCOUNT_REJECTED": NotificationTemplate("Yêu cầu tài khoản bị từ chối", "Yêu cầu tạo tài khoản của {subject_name} đã bị từ chối."),
    "ACCOUNT_ROLE_CHANGED": NotificationTemplate("Quyền truy cập đã thay đổi", "Quyền truy cập của {subject_name} đã được cập nhật."),
    "ACCOUNT_SESSIONS_REVOKED": NotificationTemplate("Phiên đăng nhập đã bị thu hồi", "Các phiên đăng nhập của {subject_name} đã được thu hồi."),
    "PASSWORD_RESET_REQUESTED": NotificationTemplate("Đã yêu cầu đặt lại mật khẩu", "Yêu cầu đặt lại mật khẩu của {subject_name} đã được ghi nhận."),
    "EMPLOYEE_IDENTITY_UPDATED": NotificationTemplate("Thông tin đăng nhập đã cập nhật", "Email đăng nhập của {subject_name} đã được cập nhật."),
    "EMPLOYEE_PROFILE_UPDATED": NotificationTemplate("Hồ sơ cá nhân đã cập nhật", "Hồ sơ cá nhân của {subject_name} đã được cập nhật."),
    "EMPLOYEE_ADMIN_PROFILE_UPDATED": NotificationTemplate("Hồ sơ nhân sự đã cập nhật", "Hồ sơ nhân sự của {subject_name} đã được cập nhật bởi quản trị viên."),
    "EMPLOYEE_AVATAR_UPDATED": NotificationTemplate("Ảnh đại diện đã cập nhật", "Ảnh đại diện của {subject_name} đã được cập nhật."),
    "EMPLOYEE_OFFBOARDING_RESTORED": NotificationTemplate("Tài khoản nhân sự đã khôi phục", "Quy trình nghỉ việc của {subject_name} đã được hủy và tài khoản đã khôi phục."),
    "EMPLOYEE_PERSONAL_DATA_REMOVED": NotificationTemplate("Dữ liệu cá nhân đã được xóa", "Dữ liệu cá nhân của {subject_name} đã được xóa theo quy trình nghỉ việc."),
    "CANDIDATE_ONBOARDED": NotificationTemplate("Ứng viên đã được tiếp nhận", "Ứng viên {subject_name} đã được chuyển thành nhân viên."),
    "CANDIDATE_RESUME_UPDATED": NotificationTemplate("Hồ sơ ứng viên đã cập nhật", "CV của ứng viên {subject_name} đã được cập nhật."),
    "CANDIDATE_STATUS_CORRECTED": NotificationTemplate("Trạng thái ứng viên đã hoàn tác", "Trạng thái hồ sơ của ứng viên {subject_name} đã được hoàn tác."),
    "INTERVIEW_CHANGED": NotificationTemplate("Lịch phỏng vấn đã thay đổi", "Lịch phỏng vấn với {subject_name} đã được cập nhật."),
    "INTERVIEW_FEEDBACK_ADDED": NotificationTemplate("Đã có đánh giá phỏng vấn", "Buổi phỏng vấn với {subject_name} vừa có đánh giá mới."),
    "JOB_DRAFT_CREATED": NotificationTemplate("Đã tạo bản nháp tuyển dụng", "Bản nháp tin tuyển dụng {subject_name} đã được tạo."),
    "JOB_DRAFT_UPDATED": NotificationTemplate("Bản nháp tuyển dụng đã cập nhật", "Bản nháp tin tuyển dụng {subject_name} đã được cập nhật."),
    "JOB_DUPLICATED": NotificationTemplate("Đã nhân bản tin tuyển dụng", "Tin tuyển dụng {subject_name} đã được nhân bản."),
    "PUBLIC_STAFF_PROFILE_PUBLISH": NotificationTemplate("Hồ sơ công khai đã xuất bản", "Hồ sơ công khai của {subject_name} đã được xuất bản."),
    "PUBLIC_STAFF_PROFILE_ARCHIVE": NotificationTemplate("Hồ sơ công khai đã lưu trữ", "Hồ sơ công khai của {subject_name} đã được lưu trữ."),
    "HR_CONFIGURATION_UPDATED": NotificationTemplate("Cấu hình Nhân sự đã thay đổi", "Cấu hình nghiệp vụ Nhân sự vừa được cập nhật."),
    "MANAGER_REVIEW_REQUIRED": NotificationTemplate("Nội dung cần quản lý xem xét", "Có nội dung liên quan đến {subject_name} đang chờ quản lý xem xét."),
}

CEO_EVENT_TYPES = {"MARKETING_PUBLISH_FAILED"}


def _clean_name(value: Any, fallback: str = UNKNOWN_SUBJECT) -> str:
    text = str(value or "").strip()
    if (not text or text.casefold() in {"đối tượng chưa xác định", "unknown"}
            or "@" in text or re.fullmatch(r"[0-9a-fA-F]{24}", text)):
        return fallback
    return text


def render_notification(event_type: str, payload: dict[str, Any]) -> tuple[str, str]:
    template = TEMPLATES.get(event_type)
    subject_name = _clean_name(payload.get("subject_name"))
    actor_name = _clean_name(payload.get("actor_name"), "hệ thống")
    if template is None:
        logger.error("notification_template_missing event_type=%s", event_type)
        return "Cập nhật hệ thống", "Hệ thống vừa ghi nhận một cập nhật mới."
    values = {"subject_name": subject_name, "actor_name": actor_name}
    return template.title.format(**values), template.message.format(**values)


async def _resolve_accounts(
    *,
    account_ids: Iterable[str],
    employee_ids: Iterable[str],
    roles: Iterable[str],
) -> list[dict[str, Any]]:
    db = get_database()
    clauses: list[dict[str, Any]] = []
    account_values = list(dict.fromkeys(str(value) for value in account_ids if value))
    employee_values = list(dict.fromkeys(str(value) for value in employee_ids if value))
    role_values = list(dict.fromkeys(str(value) for value in roles if value))
    if account_values:
        from bson import ObjectId
        valid_ids = [ObjectId(value) for value in account_values if ObjectId.is_valid(value)]
        if valid_ids:
            clauses.append({"_id": {"$in": valid_ids}})
    if employee_values:
        clauses.append({"employee_id": {"$in": employee_values}})
    if role_values:
        clauses.append({"role": {"$in": role_values}})
    if not clauses:
        return []
    accounts = await db["user_accounts"].find(
        {"$or": clauses, "is_active": True, "account_status": "ACTIVE"},
        {"employee_id": 1, "role": 1, "email": 1, "full_name": 1},
    ).to_list(length=None)
    for account in accounts:
        account["recipient_name"] = _clean_name(
            account.get("full_name") or account.get("email"),
            "Recipient",
        )
    return accounts


async def emit_notification(
    event_type: str,
    payload: dict[str, Any],
    *,
    recipient_account_ids: Iterable[str] = (),
    recipient_employee_ids: Iterable[str] = (),
    recipient_roles: Iterable[str] = (),
    event_id: str | None = None,
) -> int:
    """Resolve an event into one durable, idempotent delivery per active account."""
    db = get_database()
    event_id = event_id or uuid4().hex
    title, message = render_notification(event_type, payload)
    safe_roles = [str(role) for role in recipient_roles if role]
    if event_type not in CEO_EVENT_TYPES:
        safe_roles = [role for role in safe_roles if role != "CEO"]
    accounts = await _resolve_accounts(
        account_ids=recipient_account_ids,
        employee_ids=recipient_employee_ids,
        roles=safe_roles,
    )
    created = 0
    now = datetime.now(timezone.utc)
    for account in accounts:
        account_id = str(account["_id"])
        delivery_key = f"{event_id}:IN_APP:{account_id}"
        document = {
            "event_type": event_type,
            "recipient_account_id": account_id,
            "recipient_name": account["recipient_name"],
            "subject_type": str(payload.get("subject_type") or "SYSTEM"),
            "subject_id": str(payload.get("subject_id") or "") or None,
            "subject_name": _clean_name(payload.get("subject_name")),
            "actor_name": _clean_name(payload.get("actor_name"), "Hệ thống"),
            "title": title,
            "message": message,
            "module": str(payload.get("module") or "SYSTEM"),
            "link": payload.get("link"),
            "delivery_key": delivery_key,
            "is_read": False,
            "read_at": None,
            "created_at": now,
            "updated_at": now,
        }
        result = await db["notifications"].update_one(
            {"delivery_key": delivery_key}, {"$setOnInsert": document}, upsert=True
        )
        if result.upserted_id is not None:
            document["_id"] = result.upserted_id
            await publish_notification(notification_event(document, event_id))
            created += 1
    return created
