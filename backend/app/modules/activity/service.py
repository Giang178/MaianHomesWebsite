from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import io
import json
import logging
import os
import re
import unicodedata
import uuid
from contextvars import ContextVar, Token
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.db.mongodb import get_database
from app.modules.activity.registry import (
    infer_severity,
    normalize_category,
    normalize_code,
    normalize_event_type,
    normalize_module,
    normalize_result,
    registry_metadata,
)

from app.modules.activity.schemas import (
    ActivityEventDocument,
    ActorSnapshot,
    ChangeSnapshot,
    RequestContext,
    TargetSnapshot,
)

logger = logging.getLogger(__name__)

COLLECTION = "activity_events"
OUTBOX_COLLECTION = "activity_event_outbox"
PURGE_AGE_DAYS = 180
RETENTION_DAYS = PURGE_AGE_DAYS  # Compatibility only; there is no TTL retention.
EXPORT_LIMIT = 50_000
PURGE_CONFIRMATION = "XOA NHAT KY TREN 180 NGAY"
MAX_EVENT_BYTES = 512_000

_REQUEST_CONTEXT: ContextVar[dict[str, Any]] = ContextVar("activity_context", default={})
SENSITIVE_KEYS = {
    "password", "password_hash", "temporary_password", "smtp_password", "app_password",
    "token", "access_token", "refresh_token", "cookie", "secret", "ciphertext", "nonce",
    "authorization", "api_key", "client_secret", "request_body", "response_body", "file_content",
}
SENSITIVE_KEYS.update(key.strip().casefold() for key in os.getenv("SENSITIVE_LOG_KEYS", "").split(",") if key.strip())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def set_activity_request_context(**values: Any) -> Token:
    current = dict(_REQUEST_CONTEXT.get())
    current.update({key: value for key, value in values.items() if value is not None})
    return _REQUEST_CONTEXT.set(current)


def reset_activity_request_context(token: Token | None = None) -> None:
    _REQUEST_CONTEXT.reset(token) if token is not None else _REQUEST_CONTEXT.set({})


def _sensitive_key(key: str) -> bool:
    normalized = key.casefold().replace("-", "_")
    return normalized in SENSITIVE_KEYS or any(marker in normalized for marker in (
        "password", "token", "cookie", "authorization", "client_secret", "api_key", "ciphertext", "nonce",
    ))


def redact(value: Any, *, _depth: int = 0) -> Any:
    if _depth >= 6:
        return "[TRUNCATED]"
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= 100:
                result["_truncated"] = True
                break
            text_key = str(key)[:200]
            result[text_key] = "[REDACTED]" if _sensitive_key(text_key) else redact(item, _depth=_depth + 1)
        return result
    if isinstance(value, (list, tuple, set)):
        items = list(value)
        result = [redact(item, _depth=_depth + 1) for item in items[:100]]
        return result + (["[TRUNCATED]"] if len(items) > 100 else [])
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, str):
        return value if len(value) <= 4000 else f"{value[:4000]}…[TRUNCATED]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:4000]


def device_from_user_agent(user_agent: str) -> dict[str, str]:
    value = (user_agent or "Unknown")[:1000]
    browser = next((name for pattern, name in (
        (r"Edg/[\d.]+", "Microsoft Edge"), (r"Chrome/[\d.]+", "Google Chrome"),
        (r"Firefox/[\d.]+", "Mozilla Firefox"), (r"Version/[\d.]+.*Safari/", "Safari"),
    ) if re.search(pattern, value)), "Unknown")
    operating_system = next((name for marker, name in (
        ("Windows", "Windows"), ("Android", "Android"), ("iPhone", "iOS"),
        ("iPad", "iPadOS"), ("Mac OS X", "macOS"), ("Linux", "Linux"),
    ) if marker in value), "Unknown")
    return {"user_agent": value, "browser": browser, "operating_system": operating_system,
            "device": "Mobile" if any(item in value for item in ("Mobile", "Android", "iPhone")) else "Desktop"}


def _search_text(*values: Any) -> str:
    raw = " ".join(str(value or "") for value in values).casefold()
    return unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")[:2000]


def actor_identity_snapshot(actor: dict) -> dict[str, str | None]:
    return {
        "department": str(actor.get("department") or "") or None,
        "actor_name": str(actor.get("name") or actor.get("full_name") or "") or None,
        "employee_code": str(actor.get("employee_code") or "") or None,
    }

def _event_key(module: str, category: str, event_type: str, target_type: str | None, target_id: str | None,
               request_id: str | None, explicit: str | None) -> str:
    if explicit:
        return str(explicit)[:256]
    raw = "|".join((module, category, event_type, target_type or "", target_id or "", request_id or uuid.uuid4().hex))
    return hashlib.sha256(raw.encode()).hexdigest()


def _diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    return {key: {"before": before.get(key), "after": after.get(key)}
            for key in sorted(set(before) | set(after)) if before.get(key) != after.get(key)}


def _sign_payload(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    encoded = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    signature = hmac.new(settings.SECRET_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def _verify_payload(token: str) -> dict[str, Any]:
    try:
        encoded, supplied = token.split(".", 1)
        expected = hmac.new(settings.SECRET_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(supplied, expected):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if int(payload["exp"]) < int(utcnow().timestamp()):
            raise ValueError
        return payload
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_SIGNED_TOKEN"}) from exc


def _encode_cursor(occurred_at: datetime, object_id: ObjectId) -> str:
    return _sign_payload({"purpose": "activity-cursor", "at": occurred_at.astimezone(timezone.utc).isoformat(),
                          "id": str(object_id), "exp": int((utcnow() + timedelta(days=7)).timestamp())})


def _decode_cursor(cursor: str) -> tuple[datetime, ObjectId]:
    try:
        payload = _verify_payload(cursor)
        if payload.get("purpose") != "activity-cursor":
            raise ValueError
        occurred_at = datetime.fromisoformat(payload["at"])
        return (occurred_at if occurred_at.tzinfo else occurred_at.replace(tzinfo=timezone.utc), ObjectId(payload["id"]))
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_CURSOR"}) from exc


async def _build_document(event_type: str, *, module: str, category: str, actor: dict | None, result: str,
    severity: str | None, source: str, target_type: str | None, target_id: str | None,
    department: str | None, ip_address: str | None, user_agent: str | None, session_id: str | None,
    request_id: str | None, metadata: dict | None, before: dict | None, after: dict | None,
    snapshot: dict | None, event_key: str | None, session, extra: dict | None) -> dict[str, Any]:
    actor = actor or {}
    context = _REQUEST_CONTEXT.get()
    module_code = normalize_module(module)
    type_code = normalize_event_type(event_type)
    result_code = normalize_result(result)
    category_code = normalize_category(category)
    severity_code = normalize_code(severity or infer_severity(type_code, result_code), field="severity")
    if severity_code not in {"INFO", "NOTICE", "WARNING", "CRITICAL"}:
        raise ValueError("severity is not registered")
    request_object = context.get("request")
    if target_type != "API_RESOURCE" and request_object is not None:
        request_object.state.activity_business_recorded = True
    ip_address = ip_address or context.get("ip_address")
    user_agent = user_agent or context.get("user_agent")
    request_id = request_id or context.get("request_id")
    session_id = session_id or actor.get("session_id") or context.get("session_id")
    employee_id = str(actor.get("employee_id") or actor.get("id") or "") or None
    account_id = str(actor.get("account_id") or actor.get("id") or actor.get("employee_id") or "") or None
    identity = actor_identity_snapshot(actor)
    role = actor.get("role")
    role_value = str(getattr(role, "value", role or "")) or None
    actor_type = "SYSTEM" if not actor and source == "SYSTEM" else "ANONYMOUS" if not actor else "ACCOUNT"
    safe_metadata = redact(metadata or {})
    if extra:
        blocked = {"_id", "event_key", "occurred_at", "received_at", "module", "category",
                   "event_type", "result", "severity", "source", "actor", "request", "target", "change"}
        safe_metadata["extensions"] = redact({key: value for key, value in extra.items() if key not in blocked})
    safe_before, safe_after = redact(before or {}), redact(after or {})
    if snapshot:
        safe_metadata["snapshot"] = redact(snapshot)
    device = device_from_user_agent(user_agent or "") if user_agent else {}
    target_label = safe_metadata.get("target_name") or safe_metadata.get("target_email")
    if not target_label and target_id:
        try:
            if target_type == "USER_ACCOUNT":
                account_query = {"_id": ObjectId(target_id)} if ObjectId.is_valid(target_id) else {"account_id": target_id}
                account_doc = await get_database()["user_accounts"].find_one(
                    account_query, {"full_name": 1, "email": 1}, session=session,
                )
                if account_doc:
                    target_label = account_doc.get("full_name") or account_doc.get("email")
            elif target_type == "JOB_POSTING":
                job_query = {"_id": ObjectId(target_id)} if ObjectId.is_valid(target_id) else {"job_id": target_id}
                job_doc = await get_database()["job_postings"].find_one(
                    job_query, {"title": 1}, session=session,
                )
                if job_doc and job_doc.get("title"):
                    target_label = job_doc["title"]
            elif target_type in {"LEAD", "WEBSITE_LEAD"}:
                lead_query = {"_id": ObjectId(target_id)} if ObjectId.is_valid(target_id) else {"reference_id": target_id}
                lead_doc = await get_database()["website_leads"].find_one(
                    lead_query, {"customer_name": 1}, session=session,
                )
                if lead_doc and lead_doc.get("customer_name"):
                    target_label = lead_doc["customer_name"]
        except Exception:
            logger.exception(
                "Không thể làm giàu tên đối tượng nhật ký",
                extra={"target_type": target_type, "target_id": target_id},
            )
    if target_id and not target_label:
        logger.warning("Nhật ký thiếu tên đối tượng", extra={"target_type": target_type, "target_id": target_id})
    actor_snapshot = ActorSnapshot(
        type=actor_type, account_id=account_id, employee_id=employee_id, email=actor.get("email"),
        name=identity["actor_name"] or actor.get("name"), employee_code=identity["employee_code"] or actor.get("employee_code"),
        role=role_value, department=department or identity["department"])
    now = utcnow()
    document = ActivityEventDocument(
        event_key=_event_key(module_code, category_code, type_code, target_type, target_id, request_id, event_key),
        occurred_at=now, received_at=now, module=module_code, category=category_code,
        event_type=type_code, result=result_code, severity=severity_code, source=normalize_code(source, field="source"),
        actor=actor_snapshot,
        request=RequestContext(request_id=request_id, session_id=session_id, method=context.get("method"),
            route=context.get("route"), ip_address=ip_address, user_agent=device.get("user_agent"),
            browser=device.get("browser"), operating_system=device.get("operating_system"), device=device.get("device")),
        target=TargetSnapshot(type=target_type, id=target_id, label=str(target_label) if target_label else None),
        change=ChangeSnapshot(before=safe_before, after=safe_after, diff=_diff(safe_before, safe_after)),
        metadata=safe_metadata,
        actor_search=_search_text(actor_snapshot.email, actor_snapshot.employee_id, actor_snapshot.account_id,
                                  actor_snapshot.name, actor_snapshot.employee_code, target_id, target_label, request_id, ip_address),
    ).model_dump()
    if len(json.dumps(redact(document), default=str, ensure_ascii=False).encode()) > MAX_EVENT_BYTES:
        document["metadata"], document["change"] = {"truncated": True, "reason": "EVENT_SIZE_LIMIT"}, {"before": {}, "after": {}, "diff": {}}
    return document


async def record_event(event_type: str, *, module: str, category: str = "BUSINESS", actor: dict | None = None,
    result: str = "SUCCESS", severity: str | None = None, source: str = "APPLICATION",
    target_type: str | None = None, target_id: str | None = None, department: str | None = None,
    ip_address: str | None = None, user_agent: str | None = None, session_id: str | None = None,
    request_id: str | None = None, metadata: dict | None = None, before: dict | None = None,
    after: dict | None = None, snapshot: dict | None = None, event_key: str | None = None,
    session=None, extra: dict | None = None) -> str:
    document = await _build_document(event_type, module=module, category=category, actor=actor, result=result,
        severity=severity, source=source, target_type=target_type, target_id=target_id, department=department,
        ip_address=ip_address, user_agent=user_agent, session_id=session_id, request_id=request_id,
        metadata=metadata, before=before, after=after, snapshot=snapshot, event_key=event_key, session=session, extra=extra)
    kwargs = {"session": session} if session is not None else {}
    try:
        event_id = str((await get_database()[COLLECTION].insert_one(document, **kwargs)).inserted_id)
        from app.core.metrics import observe_activity_write
        observe_activity_write("direct", "success")
        return event_id
    except DuplicateKeyError:
        existing = await get_database()[COLLECTION].find_one({"event_key": document["event_key"]}, {"_id": 1}, **kwargs)
        if existing:
            from app.core.metrics import observe_activity_write
            observe_activity_write("direct", "deduplicated")
            return str(existing["_id"])
        raise
    except Exception:
        from app.core.metrics import observe_activity_write
        observe_activity_write("direct", "failure")
        raise


async def enqueue_event(event_type: str, *, module: str, category: str = "BUSINESS", actor: dict | None = None,
    result: str = "SUCCESS", severity: str | None = None, source: str = "APPLICATION",
    target_type: str | None = None, target_id: str | None = None, department: str | None = None,
    ip_address: str | None = None, user_agent: str | None = None, session_id: str | None = None,
    request_id: str | None = None, metadata: dict | None = None, before: dict | None = None,
    after: dict | None = None, snapshot: dict | None = None, event_key: str | None = None,
    session=None, extra: dict | None = None) -> str:
    document = await _build_document(event_type, module=module, category=category, actor=actor, result=result,
        severity=severity, source=source, target_type=target_type, target_id=target_id, department=department,
        ip_address=ip_address, user_agent=user_agent, session_id=session_id, request_id=request_id,
        metadata=metadata, before=before, after=after, snapshot=snapshot, event_key=event_key, session=session, extra=extra)
    outbox = {"event_key": document["event_key"], "event": document, "status": "PENDING", "attempts": 0,
              "available_at": utcnow(), "created_at": utcnow(), "last_error": None,
              "locked_until": datetime.min.replace(tzinfo=timezone.utc)}
    try:
        outbox_id = str((await get_database()[OUTBOX_COLLECTION].insert_one(outbox)).inserted_id)
        from app.core.metrics import observe_activity_write
        observe_activity_write("outbox", "queued")
        return outbox_id
    except DuplicateKeyError:
        existing = await get_database()[OUTBOX_COLLECTION].find_one({"event_key": document["event_key"]}, {"_id": 1})
        from app.core.metrics import observe_activity_write
        observe_activity_write("outbox", "deduplicated")
        return str(existing["_id"])


async def record_activity(event_type: str, *, actor: dict | None = None, result: str = "SUCCESS",
    target_type: str | None = None, target_id: str | None = None, department: str | None = None,
    ip_address: str | None = None, user_agent: str | None = None, session_id: str | None = None,
    request_id: str | None = None, metadata: dict | None = None, session=None) -> str:
    return await record_event(event_type, module="SYSTEM", category="SECURITY", actor=actor, result=result,
        target_type=target_type, target_id=target_id, department=department, ip_address=ip_address,
        user_agent=user_agent, session_id=session_id, request_id=request_id, metadata=metadata, session=session)


def serialize_event(document: dict[str, Any], *, detail: bool = True) -> dict[str, Any]:
    value = redact(dict(document))
    value["id"] = str(value.pop("_id"))
    actor, request, target, change = value.get("actor", {}), value.get("request", {}), value.get("target", {}), value.get("change", {})
    value.update({"actor_id": actor.get("employee_id") or actor.get("account_id"), "actor_email": actor.get("email"),
        "actor_role": actor.get("role"), "actor_name": actor.get("name"), "employee_code": actor.get("employee_code"),
        "department": actor.get("department"), "target_type": target.get("type"), "target_id": target.get("id"),
        "ip_address": request.get("ip_address"), "browser": request.get("browser"), "device": request.get("device"),
        "operating_system": request.get("operating_system"), "session_id": request.get("session_id"),
        "request_id": request.get("request_id"), "before": change.get("before", {}), "after": change.get("after", {}),
        "created_at": value.get("occurred_at")})
    if not detail:
        value.pop("change", None)
        value.pop("before", None)
        value.pop("after", None)
        metadata = value.get("metadata") or {}
        value["metadata"] = {key: metadata[key] for key in list(metadata)[:12]}
    return value


class ActivityEventService:
    @property
    def collection(self):
        return get_database()[COLLECTION]

    def build_query(self, *, cursor: str | None = None, q: str | None = None, event_type: str | None = None,
        user: str | None = None, department: str | None = None, result: str | None = None,
        module: str | None = None, category: str | None = None, severity: str | None = None,
        target_type: str | None = None, target_id: str | None = None, ip_address: str | None = None,
        request_id: str | None = None, session_id: str | None = None,
        start: datetime | None = None, end: datetime | None = None) -> dict[str, Any]:
        query: dict[str, Any] = {}
        if cursor:
            at, object_id = _decode_cursor(cursor)
            query["$or"] = [{"occurred_at": {"$lt": at}}, {"occurred_at": at, "_id": {"$lt": object_id}}]
        for field, value in (("event_type", event_type), ("actor.department", department), ("result", result),
            ("module", module), ("category", category), ("severity", severity), ("target.type", target_type),
            ("target.id", target_id), ("request.ip_address", ip_address), ("request.request_id", request_id),
            ("request.session_id", session_id)):
            if value:
                if isinstance(value, str):
                    value = value.strip()
                query[field] = str(value).upper() if field in {"event_type", "result", "module", "category", "severity"} else value
        search = (q or user or "").strip()
        if search:
            query["actor_search"] = {"$regex": re.escape(_search_text(search)), "$options": "i"}
        if start or end:
            query["occurred_at"] = {}
            if start:
                query["occurred_at"]["$gte"] = start
            if end:
                query["occurred_at"]["$lte"] = end
        return query

    async def list(self, *, limit: int = 50, **filters: Any) -> dict[str, Any]:
        items = await self.collection.find(self.build_query(**filters)).sort([("occurred_at", -1), ("_id", -1)]).limit(limit + 1).to_list(limit + 1)
        has_more, items = len(items) > limit, items[:limit]
        return {"items": [serialize_event(item, detail=False) for item in items],
                "next_cursor": _encode_cursor(items[-1]["occurred_at"], items[-1]["_id"]) if has_more and items else None,
                "count": len(items)}

    async def detail(self, event_id: str) -> dict[str, Any]:
        if not ObjectId.is_valid(event_id):
            raise HTTPException(status_code=404, detail={"code": "ACTIVITY_EVENT_NOT_FOUND"})
        document = await self.collection.find_one({"_id": ObjectId(event_id)})
        if not document:
            raise HTTPException(status_code=404, detail={"code": "ACTIVITY_EVENT_NOT_FOUND"})
        return serialize_event(document)

    async def get_metadata(self) -> dict[str, Any]:
        return registry_metadata([value for value in await self.collection.distinct("event_type") if value])

    async def export_csv(self, *, actor: dict[str, Any], **filters: Any) -> bytes:
        documents = await self.collection.find(self.build_query(**filters)).sort([("occurred_at", -1), ("_id", -1)]).limit(EXPORT_LIMIT + 1).to_list(EXPORT_LIMIT + 1)
        if len(documents) > EXPORT_LIMIT:
            raise HTTPException(status_code=422, detail={"code": "ACTIVITY_EXPORT_LIMIT", "limit": EXPORT_LIMIT})
        output, columns = io.StringIO(), ("id", "occurred_at", "module", "category", "event_type", "result", "severity",
            "actor_email", "actor_name", "actor_role", "target_type", "target_id", "ip_address", "request_id", "session_id")
        writer = csv.writer(output)
        writer.writerow(columns)

        def _sanitize_csv_cell(val: Any) -> Any:
            if val is None:
                return ""
            if isinstance(val, str) and val and val[0] in ("=", "+", "-", "@", "\t", "\r"):
                return f"'{val}"
            return val

        for document in documents:
            event = serialize_event(document, detail=False)
            writer.writerow([_sanitize_csv_cell(event.get(key, "")) for key in columns])
        await record_event("ACTIVITY_LOGS_EXPORTED", module="SYSTEM", category="DATA_ACCESS", actor=actor,
            target_type="ACTIVITY_EVENT", metadata={"filters": redact(filters), "row_count": len(documents)})
        return ("\ufeff" + output.getvalue()).encode("utf-8")

    async def purge_preview(self) -> dict[str, Any]:
        cutoff = utcnow() - timedelta(days=PURGE_AGE_DAYS)
        query = {"occurred_at": {"$lt": cutoff}}
        total = await self.collection.count_documents(query)
        modules = {item["_id"]: item["count"] async for item in self.collection.aggregate([
            {"$match": query}, {"$group": {"_id": "$module", "count": {"$sum": 1}}}])}
        oldest = await self.collection.find_one(query, sort=[("occurred_at", 1)], projection={"occurred_at": 1})
        newest = await self.collection.find_one(query, sort=[("occurred_at", -1)], projection={"occurred_at": 1})
        token = _sign_payload({"purpose": "activity-purge", "cutoff": cutoff.isoformat(), "count": total,
                               "exp": int((utcnow() + timedelta(minutes=10)).timestamp())})
        return {"cutoff": cutoff, "eligible_count": total, "oldest_at": (oldest or {}).get("occurred_at"),
                "newest_at": (newest or {}).get("occurred_at"), "modules": modules, "preview_token": token,
                "confirmation_text": PURGE_CONFIRMATION}

    async def purge(self, *, preview_token: str, reason: str, confirmation: str, actor: dict[str, Any]) -> dict[str, Any]:
        if confirmation.strip() != PURGE_CONFIRMATION:
            raise HTTPException(status_code=422, detail={"code": "PURGE_CONFIRMATION_MISMATCH"})
        payload = _verify_payload(preview_token)
        if payload.get("purpose") != "activity-purge":
            raise HTTPException(status_code=400, detail={"code": "INVALID_PURGE_PREVIEW_TOKEN"})
        preview_cutoff = datetime.fromisoformat(payload["cutoff"])
        safe_cutoff = min(preview_cutoff, utcnow() - timedelta(days=PURGE_AGE_DAYS))
        operation_id = uuid.uuid4().hex
        await record_event("LOGS_PURGE_REQUESTED", module="SYSTEM", category="ADMIN", actor=actor, severity="CRITICAL",
            target_type="ACTIVITY_EVENT", target_id=operation_id,
            metadata={"reason": reason, "cutoff": safe_cutoff, "preview_count": payload.get("count")})
        try:
            result = await self.collection.delete_many({"occurred_at": {"$lt": safe_cutoff}})
            from app.core.metrics import observe_activity_purge
            observe_activity_purge("success")
            await record_event("LOGS_PURGED", module="SYSTEM", category="ADMIN", actor=actor, severity="CRITICAL",
                target_type="ACTIVITY_EVENT", target_id=operation_id,
                metadata={"reason": reason, "cutoff": safe_cutoff, "deleted_count": result.deleted_count})
        except Exception as exc:
            from app.core.metrics import observe_activity_purge
            observe_activity_purge("failure")
            await record_event("LOGS_PURGE_FAILED", module="SYSTEM", category="ADMIN", actor=actor, result="FAILURE",
                severity="CRITICAL", target_type="ACTIVITY_EVENT", target_id=operation_id,
                metadata={"reason": reason, "cutoff": safe_cutoff, "error_type": type(exc).__name__})
            raise
        return {"deleted_count": result.deleted_count, "cutoff": safe_cutoff,
                "message": f"Đã xóa {result.deleted_count} nhật ký cũ hơn 180 ngày."}


activity_event_service = ActivityEventService()
