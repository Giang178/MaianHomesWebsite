import asyncio
import html
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
from bson import ObjectId
from pymongo import ReturnDocument

from app.core.config import settings
from app.db.mongodb import db_manager
from app.modules.activity.service import record_activity
from app.modules.identity.credentials import decrypt_payload
from app.modules.identity.jobs.credential_cleanup import cleanup_expired_credentials
from app.modules.identity.service import identity_service
from app.modules.identity.templates import DEFAULT_TEMPLATES
from app.modules.system.settings.service import system_settings_service
from app.modules.notifications.registry import emit_notification, render_notification
from app.infrastructure.email_delivery import send_email

logger = logging.getLogger("identity_outbox")

PUBLIC_TEAM_REVALIDATION_EVENTS = {
    "PUBLIC_STAFF_PROFILE_PUBLISH",
    "PUBLIC_STAFF_PROFILE_ARCHIVE",
    "EMPLOYEE_OFFBOARDED",
    "EMPLOYEE_PERSONAL_DATA_REMOVED",
}

# Automated email is intentionally limited to account access and security.
# ACCOUNT_CREATED, ACCOUNT_APPROVED and PASSWORD_RESET use the encrypted
# credential queue below; the normal HR delivery queue must never duplicate them.
ACCOUNT_CREDENTIAL_EMAIL_EVENTS = frozenset({"ACCOUNT_CREATED", "ACCOUNT_APPROVED"})
PASSWORD_RESET_EMAIL_EVENT = "PASSWORD_RESET"
ACCOUNT_ALERT_EMAIL_EVENTS = frozenset({
    "PASSWORD_CHANGED",
    "ACCOUNT_LOCKED",
    "ACCOUNT_UNLOCKED",
})

TITLES = {
    "EMPLOYEE_ONBOARDED": "Hoàn tất tiếp nhận nhân sự mới",
    "EMPLOYEE_PERSONAL_DATA_REMOVED": "Tài khoản và dữ liệu cá nhân của nhân sự đã bị xóa",
    "EMPLOYEE_OFFBOARDED": "Hoàn tất thủ tục nghỉ việc",
    "OFFBOARDING_STALLED": "Thủ tục nghỉ việc cần chú ý",
    "JOB_APPROVAL_REQUIRED": "Tin tuyển dụng chờ phê duyệt",
    "JOB_STATUS_CHANGED": "Trạng thái tin tuyển dụng đã thay đổi",
    "CANDIDATE_APPLIED": "Nhận được hồ sơ ứng tuyển mới",
    "CANDIDATE_ONBOARDED": "Hoàn tất tiếp nhận ứng viên trúng tuyển",
    "CANDIDATE_STATUS_CHANGED": "Trạng thái ứng viên đã thay đổi",
    "INTERVIEW_SCHEDULED": "Đã lên lịch phỏng vấn",
    "INTERVIEW_REMINDER_24H": "Phỏng vấn sẽ bắt đầu trong vòng 24 giờ tới",
    "INTERVIEW_REMINDER_30M": "Phỏng vấn sẽ bắt đầu trong vòng 30 phút tới",
    "EMPLOYEE_MANAGER_MISSING": "Hồ sơ nhân sự cần có quản lý trực tiếp",
    "ACCOUNT_LOCKED": "Tài khoản đã bị khóa",
    "ACCOUNT_UNLOCKED": "Tài khoản đã được mở khóa",
    "PASSWORD_CHANGED": "Mật khẩu đã thay đổi",
    "HR_CONFIGURATION_UPDATED": "Cấu hình HR đã thay đổi",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def retry_at(attempts: int) -> datetime:
    return utcnow() + timedelta(seconds=min(900, 2 ** min(max(attempts, 1), 9)))


async def revalidate_public_team(event: dict) -> None:
    event_type = str(event.get("event_type") or "")
    if event_type not in PUBLIC_TEAM_REVALIDATION_EVENTS:
        return
    payload = dict(event.get("payload") or {})
    if not payload.get("slug") and payload.get("employee_id"):
        profile = await db_manager.db["public_staff_profiles"].find_one(
            {"employee_id": str(payload["employee_id"])},
            {"public_snapshot.slug": 1},
        )
        payload["slug"] = str(((profile or {}).get("public_snapshot") or {}).get("slug") or "")
    if not settings.MARKETING_REVALIDATE_URL:
        raise RuntimeError("URL revalidate nội dung public chưa được cấu hình")
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            settings.MARKETING_REVALIDATE_URL,
            headers={"x-marketing-revalidate-secret": settings.MARKETING_REVALIDATE_SECRET},
            json={
                "entity": "TEAM",
                "slug": payload.get("slug") or None,
                "old_slug": payload.get("old_slug") or None,
            },
        )
        response.raise_for_status()


async def smtp_enabled() -> bool:
    return await system_settings_service.smtp_available()


def _notification_link(event_type: str) -> str:
    if event_type.startswith("CANDIDATE_"):
        return "/admin/recruitment"
    if event_type.startswith("INTERVIEW_"):
        return "/admin/recruitment"
    if event_type.startswith("JOB_"):
        return "/admin/recruitment"
    if "OFFBOARDING" in event_type or event_type == "EMPLOYEE_PERSONAL_DATA_REMOVED":
        return "/admin/accounts"
    if event_type.startswith("PUBLIC_STAFF_PROFILE_"):
        return "/admin/team"
    if event_type == "MARKETING_CONTENT_OWNERSHIP_TRANSFERRED":
        return "/admin/articles"
    if event_type == "HR_CONFIGURATION_UPDATED":
        return "/admin/system"
    if event_type.startswith(("ACCOUNT_", "PASSWORD_")):
        return "/admin/profile"
    return "/admin"


def _subject_type(event_type: str) -> str:
    for prefix, value in (
        ("CANDIDATE_", "CANDIDATE"), ("INTERVIEW_", "INTERVIEW"),
        ("JOB_", "JOB_POSTING"), ("ACCOUNT_", "USER_ACCOUNT"),
        ("PASSWORD_", "USER_ACCOUNT"), ("EMPLOYEE_", "EMPLOYEE"),
        ("OFFBOARDING_", "EMPLOYEE"), ("PUBLIC_STAFF_", "EMPLOYEE"),
    ):
        if event_type.startswith(prefix):
            return value
    return "HR_RECORD"


async def _find_document(collection: str, value: object, projection: dict) -> dict | None:
    raw = str(value or "")
    if not raw:
        return None
    query: dict = {"_id": ObjectId(raw)} if ObjectId.is_valid(raw) else {"_id": raw}
    if collection == "employees":
        query = {"$or": [query, {"employee_code": raw}]}
    return await db_manager.db[collection].find_one(query, projection)


async def _notification_context(event_type: str, payload: dict) -> dict:
    """Resolve readable subject data even when producers only enqueue identifiers."""
    subject_name = (
        payload.get("subject_name") or payload.get("employee_name")
        or payload.get("candidate_name") or payload.get("job_title")
    )
    employee_id = payload.get("employee_id")
    candidate_id = payload.get("candidate_id")
    job_id = payload.get("job_id")

    interview = None
    if payload.get("interview_id"):
        interview = await _find_document(
            "interviews", payload["interview_id"],
            {"candidate_id": 1, "candidate_name": 1},
        )
        if interview:
            candidate_id = candidate_id or interview.get("candidate_id")
            subject_name = subject_name or interview.get("candidate_name")

    if not employee_id and payload.get("account_id"):
        account = await _find_document(
            "user_accounts", payload["account_id"], {"employee_id": 1}
        )
        employee_id = (account or {}).get("employee_id")


    if not employee_id and "OFFBOARDING" in event_type and payload.get("document_id"):
        case = await _find_document(
            "employee_offboarding_cases", payload["document_id"], {"employee_id": 1}
        )
        employee_id = (case or {}).get("employee_id")

    if candidate_id and not subject_name:
        candidate = await _find_document("candidates", candidate_id, {"full_name": 1})
        subject_name = (candidate or {}).get("full_name")
    if job_id and not subject_name:
        job = await _find_document("job_postings", job_id, {"title": 1})
        subject_name = (job or {}).get("title")
    if employee_id and not subject_name:
        employee = await _find_document("employees", employee_id, {"full_name": 1})
        subject_name = (employee or {}).get("full_name")

    if not subject_name:
        if event_type.startswith("CANDIDATE_"):
            subject_name = "ứng viên liên quan"
        elif event_type.startswith("JOB_"):
            subject_name = "tin tuyển dụng liên quan"
        elif event_type.startswith("INTERVIEW_"):
            subject_name = "ứng viên liên quan"
        else:
            subject_name = "nhân sự liên quan"

    subject_id = next((str(payload[key]) for key in (
        "candidate_id", "interview_id", "job_id",
        "account_id", "employee_id", "document_id",
    ) if payload.get(key)), None)
    return {"subject_type": _subject_type(event_type), "subject_id": subject_id,
            "subject_name": str(subject_name), "actor_name": payload.get("actor_name"),
            "module": "SYSTEM", "link": payload.get("link") or _notification_link(event_type)}

def delivery_message(event: dict) -> tuple[str, str]:
    payload = event.get("payload") or {}
    event_type = event.get("event_type") or "HR_EVENT"
    notification_payload = {
        "subject_name": payload.get("subject_name") or payload.get("employee_name")
        or payload.get("candidate_name") or payload.get("job_title"),
        "actor_name": payload.get("actor_name"),
    }
    title, message = render_notification(event_type, notification_payload)
    return title, message


async def _recipient_targets(event: dict) -> list[tuple[str, str]]:
    payload = event.get("payload") or {}
    event_type = str(event.get("event_type") or "")
    explicit = list(dict.fromkeys(str(item) for item in (payload.get("interviewer_ids") or []) if item))
    if event_type == "MANAGER_REVIEW_REQUIRED" and payload.get("manager_employee_id"):
        return [("USER", str(payload["manager_employee_id"]))]
    if payload.get("employee_id") and event.get("event_type") not in {
        "OFFBOARDING_STALLED"
    }:
        explicit = [str(payload["employee_id"])]
    if explicit:
        return [("USER", item) for item in explicit]
    role = "ADMIN"
    if event.get("event_type") == "OFFBOARDING_STALLED":
        return [("ROLE", "ADMIN"), ("ROLE", "CEO")]
    return [("ROLE", role)]


async def _email_addresses(targets: list[tuple[str, str]]) -> list[str]:
    if not await smtp_enabled():
        return []
    clauses = []
    for kind, value in targets:
        clauses.append({"employee_id": value} if kind == "USER" else {"role": value})
    if not clauses:
        return []
    documents = await db_manager.db["user_accounts"].find(
        {"$or": clauses, "is_active": True}, {"email": 1}
    ).to_list(length=None)
    return list(dict.fromkeys(
        str(document.get("email") or "").strip().lower()
        for document in documents if document.get("email")
    ))

async def _email_recipients_for_event(
    event: dict,
    targets: list[tuple[str, str]],
) -> list[str]:
    event_type = str(event.get("event_type") or "")
    if event_type not in ACCOUNT_ALERT_EMAIL_EVENTS:
        return []

    recipients = await _email_addresses(targets)
    payload_email = str((event.get("payload") or {}).get("email") or "").strip().lower()
    # A locked account is inactive and is therefore absent from the normal
    # active-account lookup. Preserve its explicit address for the security alert.
    if event_type == "ACCOUNT_LOCKED" and payload_email:
        recipients.append(payload_email)
    return list(dict.fromkeys(recipients))


async def materialize_deliveries(event: dict) -> int:
    targets = await _recipient_targets(event)
    now = utcnow()
    count = 0
    clauses = [{"employee_id": value} if kind == "USER" else {"role": value} for kind, value in targets]
    accounts = []
    if clauses:
        accounts = await db_manager.db["user_accounts"].find(
            {"$or": clauses, "is_active": True, "account_status": "ACTIVE"},
            {"employee_id": 1},
        ).to_list(length=None)
    for account in accounts:
        recipient = str(account["_id"])
        delivery_id = f"{event['event_id']}:IN_APP:{recipient}"
        result = await db_manager.db["hr_outbox_deliveries"].update_one(
            {"_id": delivery_id},
            {"$setOnInsert": {
                "event_id": event["event_id"], "event_type": event.get("event_type"),
                "version": 1,
                "payload": event.get("payload") or {}, "channel": "IN_APP",
                "recipient_kind": "ACCOUNT", "recipient": recipient,
                "recipient_employee_id": str(account.get("employee_id") or ""), "status": "PENDING",
                "attempts": 0, "available_at": now,
                "lease_until": datetime.min.replace(tzinfo=timezone.utc),
                "created_at": now, "updated_at": now,
            }},
            upsert=True,
        )
        count += int(result.upserted_id is not None)
    email_recipients = await _email_recipients_for_event(event, targets)
    for email in email_recipients:
        delivery_id = f"{event['event_id']}:EMAIL:{email}"
        result = await db_manager.db["hr_outbox_deliveries"].update_one(
            {"_id": delivery_id},
            {"$setOnInsert": {
                "event_id": event["event_id"], "event_type": event.get("event_type"),
                "version": 1,
                "payload": event.get("payload") or {}, "channel": "EMAIL",
                "recipient_kind": "EMAIL", "recipient": email, "status": "PENDING",
                "attempts": 0, "available_at": now,
                "lease_until": datetime.min.replace(tzinfo=timezone.utc),
                "created_at": now, "updated_at": now,
            }},
            upsert=True,
        )
        count += int(result.upserted_id is not None)
    return count


async def _dispatch_events(limit: int) -> int:
    worker_id = f"hr_dispatch_{uuid4().hex[:10]}"
    dispatched = 0
    for _ in range(limit):
        now = utcnow()
        event = await db_manager.db["hr_outbox"].find_one_and_update(
            {"status": {"$in": ["PENDING", "PROCESSING"]}, "available_at": {"$lte": now},
             "$or": [{"locked_until": {"$lt": now}}, {"locked_until": None}]},
            {"$set": {"status": "PROCESSING", "locked_by": worker_id,
                      "locked_until": now + timedelta(seconds=60), "updated_at": now},
             "$inc": {"attempts": 1}},
            sort=[("available_at", 1), ("_id", 1)], return_document=ReturnDocument.AFTER,
        )
        if not event:
            break
        try:
            await revalidate_public_team(event)
            deliveries = await materialize_deliveries(event)
            finished = utcnow()
            await db_manager.db["hr_outbox"].update_one(
                {"_id": event["_id"], "locked_by": worker_id},
                {"$set": {"status": "DISPATCHED", "dispatched_at": finished,
                          "delivery_count": deliveries, "updated_at": finished},
                 "$unset": {"locked_by": "", "locked_until": "", "last_error": ""}},
            )
        except Exception as exc:
            attempts = int(event.get("attempts") or 1)
            await db_manager.db["hr_outbox"].update_one(
                {"_id": event["_id"], "locked_by": worker_id},
                {"$set": {"status": "DEAD" if attempts >= 10 else "PENDING",
                          "available_at": retry_at(attempts), "last_error": str(exc)[:1000],
                          "updated_at": utcnow()},
                 "$unset": {"locked_by": "", "locked_until": ""}},
            )
            logger.exception("Việc gửi outbox HR thất bại: %s", event.get("event_id"))
        dispatched += 1
    return dispatched


async def _deliver_in_app(delivery: dict) -> None:
    payload = delivery.get("payload") or {}
    notification_payload = await _notification_context(str(delivery.get("event_type") or "HR_EVENT"), payload)
    await emit_notification(
        str(delivery.get("event_type") or "HR_EVENT"),
        notification_payload,
        recipient_account_ids=(delivery["recipient"],), event_id=delivery["event_id"],
    )


async def _deliver_email(delivery: dict) -> None:
    event_type = str(delivery.get("event_type") or "")
    if event_type not in ACCOUNT_ALERT_EMAIL_EVENTS:
        logger.info(
            "Skipped non-account email delivery", extra={"event_type": event_type}
        )
        return
    if event_type in DEFAULT_TEMPLATES:
        values = {**(delivery.get("payload") or {}), "email": delivery["recipient"]}
        title, body = await identity_service.render(event_type, values)
    else:
        title, message = delivery_message(delivery)
        body = f"<p>{html.escape(message)}</p>"
    if not await send_email(delivery["recipient"], title, body):
        raise RuntimeError("Gửi email SMTP thất bại")


async def _process_deliveries(limit: int) -> int:
    worker_id = f"hr_delivery_{uuid4().hex[:10]}"
    processed = 0
    for _ in range(limit):
        now = utcnow()
        delivery = await db_manager.db["hr_outbox_deliveries"].find_one_and_update(
            {"status": {"$in": ["PENDING", "PROCESSING"]}, "available_at": {"$lte": now},
             "$or": [{"lease_until": {"$lt": now}}, {"lease_until": None}]},
            {"$set": {"status": "PROCESSING", "lease_owner": worker_id,
                      "lease_until": now + timedelta(seconds=60), "last_attempt_at": now, "updated_at": now},
             "$inc": {"attempts": 1}},
            sort=[("available_at", 1), ("_id", 1)], return_document=ReturnDocument.AFTER,
        )
        if not delivery:
            break
        try:
            await db_manager.db["hr_outbox_deliveries"].update_one(
                {"_id": delivery["_id"], "lease_owner": worker_id},
                {"$set": {"lease_until": utcnow() + timedelta(seconds=60)}},
            )
            if delivery["channel"] == "IN_APP":
                await _deliver_in_app(delivery)
            elif delivery["channel"] == "EMAIL":
                await _deliver_email(delivery)
            else:
                raise RuntimeError(f"Unsupported HR delivery channel: {delivery['channel']}")
            sent_at = utcnow()
            await db_manager.db["hr_outbox_deliveries"].update_one(
                {"_id": delivery["_id"], "lease_owner": worker_id},
                {"$set": {"status": "SENT", "sent_at": sent_at, "last_sent_at": sent_at,
                          "updated_at": sent_at},
                 "$unset": {"lease_owner": "", "lease_until": "", "last_error": ""}},
            )
        except Exception as exc:
            attempts = int(delivery.get("attempts") or 1)
            await db_manager.db["hr_outbox_deliveries"].update_one(
                {"_id": delivery["_id"], "lease_owner": worker_id},
                {"$set": {"status": "DEAD" if attempts >= 10 else "PENDING",
                          "available_at": retry_at(attempts), "last_error": str(exc)[:1000],
                          "updated_at": utcnow()},
                 "$unset": {"lease_owner": "", "lease_until": ""}},
            )
            logger.exception("Gửi tin nhắn HR thất bại: %s", delivery.get("_id"))
        processed += 1
    return processed


async def _process_credential_deliveries(limit: int) -> int:
    allowed_events: list[str] = []
    if settings.ACCOUNT_CREDENTIAL_DELIVERY_ENABLED:
        allowed_events.extend(sorted(ACCOUNT_CREDENTIAL_EMAIL_EVENTS))
    if settings.PASSWORD_RESET_ENABLED:
        allowed_events.append(PASSWORD_RESET_EMAIL_EVENT)
    if not allowed_events:
        return 0
    worker_id = f"hr_credential_{uuid4().hex[:10]}"
    processed = 0
    policy = await identity_service.get_policy()
    retry_limit = int(policy.get("email_retry_limit", 10))
    for _ in range(limit):
        now = utcnow()
        delivery = await db_manager.db["hr_credential_deliveries"].find_one_and_update(
            {"event_type": {"$in": allowed_events},
             "status": {"$in": ["PENDING", "PROCESSING"]}, "available_at": {"$lte": now},
             "secret_expires_at": {"$gt": now},
             "$or": [{"lease_until": {"$lt": now}}, {"lease_until": None}]},
            {"$set": {"status": "PROCESSING", "lease_owner": worker_id,
                      "lease_until": now + timedelta(seconds=60), "last_attempt_at": now, "updated_at": now},
             "$inc": {"attempts": 1}},
            sort=[("available_at", 1), ("_id", 1)], return_document=ReturnDocument.AFTER,
        )
        if not delivery:
            break
        try:
            secret = decrypt_payload(delivery)
            subject, body = await identity_service.render(delivery["event_type"], secret)
            if not await send_email(delivery["email"], subject, body):
                raise RuntimeError("Gửi thông tin đăng nhập SMTP thất bại")
            sent_at = utcnow()
            sent = await db_manager.db["hr_credential_deliveries"].update_one(
                {"_id": delivery["_id"], "lease_owner": worker_id, "status": "PROCESSING"},
                {"$set": {"status": "SENT", "sent_at": sent_at, "last_sent_at": sent_at,
                          "updated_at": sent_at},
                 "$unset": {"nonce": "", "ciphertext": "", "lease_owner": "", "lease_until": "", "last_error": ""}},
            )
            if sent.modified_count == 1:
                await record_activity(
                    "ACCOUNT_CREDENTIAL_EMAIL_SENT",
                    actor={"id": delivery.get("employee_id"), "email": delivery.get("email")},
                    target_type="USER_ACCOUNT", target_id=str(delivery.get("account_id") or ""),
                    metadata={"delivery_id": str(delivery["_id"])},
                )
            if sent.modified_count == 1 and delivery.get("account_id") and ObjectId.is_valid(delivery["account_id"]):
                await db_manager.db["user_accounts"].update_one(
                    {"_id": ObjectId(delivery["account_id"])},
                    {"$set": {"credential_delivery_status": "SENT", "credential_sent_at": sent_at}},
                )
        except Exception as exc:
            attempts = int(delivery.get("attempts") or 1)
            dead = attempts >= retry_limit
            failed = await db_manager.db["hr_credential_deliveries"].update_one(
                {"_id": delivery["_id"], "lease_owner": worker_id, "status": "PROCESSING"},
                {"$set": {"status": "DEAD" if dead else "PENDING",
                          "available_at": retry_at(attempts), "last_error": str(exc)[:1000],
                          "updated_at": utcnow()}, "$unset": {"lease_owner": "", "lease_until": ""}},
            )
            if failed.modified_count == 1 and delivery.get("account_id") and ObjectId.is_valid(delivery["account_id"]):
                await db_manager.db["user_accounts"].update_one(
                    {"_id": ObjectId(delivery["account_id"])},
                    {"$set": {"credential_delivery_status": "FAILED" if dead else "PENDING"}},
                )
            await record_activity(
                "ACCOUNT_CREDENTIAL_EMAIL_FAILED",
                actor={"id": delivery.get("employee_id"), "email": delivery.get("email")},
                result="FAILED", target_type="USER_ACCOUNT",
                target_id=str(delivery.get("account_id") or ""),
                metadata={"delivery_id": str(delivery["_id"]), "attempts": attempts},
            )
            logger.exception("Gửi thông tin đăng nhập HR thất bại: %s", delivery.get("_id"))
        processed += 1
    return processed


async def process_outbox_batch(limit: int = 200) -> int:
    dispatched = await _dispatch_events(limit)
    delivered = await _process_deliveries(limit)
    credentials = await _process_credential_deliveries(limit)
    await cleanup_expired_credentials()
    return dispatched + delivered + credentials


async def start_outbox_loop(interval_seconds: int = 2) -> None:
    while True:
        try:
            processed = await process_outbox_batch()
            await asyncio.sleep(0 if processed else interval_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Vòng lặp identity outbox thất bại")
            await asyncio.sleep(interval_seconds)
