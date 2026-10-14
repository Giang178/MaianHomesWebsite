import hashlib
import json

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from app.core.security import get_real_client_ip, limiter
from app.modules.content.articles.public_service import public_article_service

router = APIRouter(prefix="/articles", tags=["Public Articles"])


def _cache_headers(response: Response, payload) -> None:
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    response.headers["ETag"] = f'"{hashlib.sha256(encoded).hexdigest()}"'
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"


@router.get("", response_model=dict)
@limiter.limit("120/minute")
async def list_articles(
    request: Request,
    response: Response,
    category: str | None = None,
    project_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    result = await public_article_service.list(category, project_id, skip, limit)
    _cache_headers(response, result)
    return result


@router.get("/{slug}")
@limiter.limit("120/minute")
async def get_article(slug: str, request: Request, response: Response):
    result = await public_article_service.detail(slug)
    if not result:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại hoặc chưa công khai.")
    if result.get("redirect_to"):
        return RedirectResponse(
            url=f"/api/public/articles/{result['redirect_to']}",
            status_code=status.HTTP_301_MOVED_PERMANENTLY,
        )
    _cache_headers(response, result)
    return result


@router.post("/{slug}/track-view")
@limiter.limit("30/minute")
async def track_view(slug: str, request: Request):
    ip = get_real_client_ip(request)
    return await public_article_service.track_view(
        slug, ip=ip, user_agent=request.headers.get("User-Agent", "")
    )

