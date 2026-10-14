import hashlib
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from app.core.security import limiter
from app.modules.content.projects.service import project_application_service

router = APIRouter(prefix="/projects", tags=["Public Projects"])


def _cache_headers(response: Response, payload) -> None:
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    response.headers["ETag"] = f'"{hashlib.sha256(encoded).hexdigest()}"'
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"


@router.get("", response_model=dict)
@limiter.limit("30/minute")
async def list_projects(
    request: Request,
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_featured: bool = Query(None),
    view: Literal["full", "summary"] = Query("full"),
):
    result = await project_application_service.public_list(
        skip,
        limit,
        is_featured,
        summary=view == "summary",
    )
    _cache_headers(response, result)
    return result


@router.get("/{id_or_slug}")
@limiter.limit("30/minute")
async def get_project(id_or_slug: str, request: Request, response: Response):
    result = await project_application_service.public_detail(id_or_slug)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy dự án hoặc dự án chưa được công bố.",
        )
    if result.get("redirect_to"):
        return RedirectResponse(
            url=f"/api/public/projects/{result['redirect_to']}",
            status_code=status.HTTP_301_MOVED_PERMANENTLY,
        )
    _cache_headers(response, result)
    return result

