from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.api.deps import require_permissions
from app.api.deps_idempotency import get_optional_idempotency_key
from app.core.config import settings
from app.core.security import get_client_fingerprint, limiter
from app.modules.website.inquiries.schemas import (
    LeadSubmissionResponse,
    WebsiteLeadCreate,
    WebsiteLeadExport,
    WebsiteLeadStatusUpdate,
)
from app.modules.website.inquiries.service import website_lead_service

public_router = APIRouter(prefix="/leads", tags=["Public Website Leads"])
protected_router = APIRouter(prefix="/website/leads", tags=["Website Leads"])


@public_router.post("", response_model=LeadSubmissionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(lambda: settings.PUBLIC_LEAD_RATE_LIMIT)
@limiter.limit(lambda: settings.PUBLIC_LEAD_FINGERPRINT_RATE_LIMIT, key_func=get_client_fingerprint)
async def create_website_lead(
    request: Request,
    payload: WebsiteLeadCreate,
    idempotency_key: str | None = Depends(get_optional_idempotency_key),
):
    result = await website_lead_service.create(payload, idempotency_key, request)
    return LeadSubmissionResponse(reference_id=result["reference_id"])


@protected_router.get("")
async def list_website_leads(
    status_value: str | None = Query(None, alias="status"),
    source: str | None = None,
    form_id: str | None = None,
    project_id: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_permissions("website.leads.read")),
):
    query = website_lead_service.query(
        status=status_value, source=source, form_id=form_id, project_id=project_id,
        search=search, date_from=date_from, date_to=date_to,
    )
    return await website_lead_service.list(query, page, limit)


@protected_router.get("/counts")
async def get_lead_counts(
    current_user: dict = Depends(require_permissions("website.leads.read")),
):
    return await website_lead_service.get_counts()


@protected_router.patch("/{lead_id}/status")
async def update_website_lead_status(
    lead_id: str,
    payload: WebsiteLeadStatusUpdate,
    current_user: dict = Depends(require_permissions("website.leads.update")),
):
    return await website_lead_service.update_status(lead_id, payload.status, payload.expected_version, current_user)


@protected_router.post("/export")
async def export_website_leads(
    payload: WebsiteLeadExport,
    current_user: dict = Depends(require_permissions("website.leads.export")),
):
    query = website_lead_service.query(
        ids=payload.ids, status=payload.status, source=payload.source, form_id=payload.form_id,
        project_id=payload.project_id, date_from=payload.date_from, date_to=payload.date_to,
    )
    content, media_type, filename = await website_lead_service.export(query, payload.format, current_user)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "X-Content-Type-Options": "nosniff"},
    )


@protected_router.get("/{lead_id}/images/zip")
async def download_lead_images_zip(
    lead_id: str,
    current_user: dict = Depends(require_permissions("website.leads.read")),
):
    content, filename = await website_lead_service.download_lead_images(lead_id)
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "X-Content-Type-Options": "nosniff"},
    )

