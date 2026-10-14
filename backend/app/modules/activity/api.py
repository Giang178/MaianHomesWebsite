from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.api.deps import get_current_user
from app.modules.activity.schemas import PurgeRequest
from app.modules.activity.service import activity_event_service

router = APIRouter(prefix="/activity-events", tags=["Activity Events"])


def role_of(user: dict) -> str:
    value = user.get("role")
    return str(getattr(value, "value", value or "")).upper()


def activity_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if role_of(current_user) not in {"CEO", "ADMIN"}:
        raise HTTPException(
            status_code=403,
            detail={"code": "ACTIVITY_ACCESS_DENIED", "message": "Chỉ CEO hoặc Admin được xem nhật ký hoạt động."},
        )
    return current_user


def ensure_aware(value: datetime | None, field: str) -> datetime | None:
    if value is not None and value.tzinfo is None:
        raise HTTPException(status_code=422, detail={"code": "TIMEZONE_REQUIRED", "field": field})
    return value


def filters(
    cursor: str | None = None,
    q: str | None = None,
    event_type: str | None = None,
    department: str | None = None,
    result: str | None = None,
    module: str | None = None,
    category: str | None = None,
    severity: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    ip_address: str | None = None,
    request_id: str | None = None,
    session_id: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict:
    start, end = ensure_aware(start, "start"), ensure_aware(end, "end")
    if start and end and start > end:
        raise HTTPException(status_code=422, detail={"code": "INVALID_DATE_RANGE"})
    return {
        "cursor": cursor, "q": q, "event_type": event_type, "department": department,
        "result": result, "module": module, "category": category, "severity": severity,
        "target_type": target_type, "target_id": target_id, "ip_address": ip_address,
        "request_id": request_id, "session_id": session_id, "start": start, "end": end,
    }


@router.get("")
async def list_events(
    limit: int = Query(50, ge=1, le=100),
    event_filters: dict = Depends(filters),
    _: dict = Depends(activity_admin),
):
    return await activity_event_service.list(limit=limit, **event_filters)


@router.get("/metadata")
async def metadata(_: dict = Depends(activity_admin)):
    return await activity_event_service.get_metadata()


@router.get("/export")
async def export_events(
    event_filters: dict = Depends(filters),
    current_user: dict = Depends(activity_admin),
):
    event_filters.pop("cursor", None)
    content = await activity_event_service.export_csv(actor=current_user, **event_filters)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="activity-events.csv"'},
    )


@router.get("/purge-preview")
async def purge_preview(_: dict = Depends(activity_admin)):
    return await activity_event_service.purge_preview()


@router.post("/purge")
async def purge_events(payload: PurgeRequest, current_user: dict = Depends(activity_admin)):
    return await activity_event_service.purge(
        preview_token=payload.preview_token,
        reason=payload.reason,
        confirmation=payload.confirmation,
        actor=current_user,
    )


@router.get("/{event_id}")
async def event_detail(event_id: str, _: dict = Depends(activity_admin)):
    return await activity_event_service.detail(event_id)
