
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from app.api.deps import require_permissions

from app.modules.content.articles.schemas import (
    ArticleCreateRequest,
    ArticleDraftBootstrapRequest,
    ArticleDraftUpdate,
)
from app.modules.content.articles.service import article_application_service
from app.modules.content.common.enums import actor_id
from app.modules.content.media.service import marketing_media_service
from app.modules.content.workflow.schemas import TransitionRequest

router = APIRouter(prefix="/articles", tags=["Protected Marketing Articles"])
article_reader = Depends(require_permissions("website.articles.read"))
article_creator = Depends(require_permissions("website.articles.create"))
article_editor = Depends(require_permissions("website.articles.update"))
article_publisher = Depends(require_permissions("website.articles.publish"))
article_deleter = Depends(require_permissions("website.articles.delete"))
article_media_editor = Depends(require_permissions(
    "website.articles.create", "website.articles.update", require_all=False
))


def _cursor_skip(cursor: str | None, fallback: int) -> int:
    if cursor is None:
        return fallback
    try:
        value = int(cursor)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "INVALID_CURSOR"}) from exc
    if value < 0:
        raise HTTPException(status_code=422, detail={"code": "INVALID_CURSOR"})
    return value


def _page(result: dict) -> dict:
    items = result.get("data", [])
    skip = int(result.get("skip", 0))
    limit = int(result.get("limit", len(items) or 1))
    total = int(result.get("total", len(items)))
    return {**result, "items": items, "next_cursor": str(skip + limit) if skip + len(items) < total else None}



@router.post("/upload-image")
async def upload_article_image(
    file: UploadFile = File(...), current_user: dict = article_media_editor
):
    return await marketing_media_service.store(
        "articles", file, actor_id(current_user), 20 * 1024 * 1024
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_article(article_in: ArticleCreateRequest, current_user: dict = article_creator):
    return await article_application_service.create(article_in, current_user)


@router.post("/drafts", status_code=status.HTTP_201_CREATED)
async def create_article_draft(
    request: ArticleDraftBootstrapRequest,
    current_user: dict = article_creator,
):
    return await article_application_service.create_provisional_draft(request, current_user)


@router.get("/my")
async def list_my_articles(
    status: str | None = None,
    category: str | None = None,
    q: str | None = Query(None, max_length=120),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    current_user: dict = article_reader,
):
    skip = _cursor_skip(cursor, skip)
    return _page(await article_application_service.list_admin(
        current_user, status, category, skip, limit, q
    ))


@router.get("/{article_id}")
async def get_article(article_id: str, current_user: dict = article_reader):
    return await article_application_service.detail(article_id, current_user)


@router.get("/{article_id}/revisions")
async def get_article_revisions(
    article_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    current_user: dict = article_reader,
):
    skip = _cursor_skip(cursor, skip)
    items, total = await article_application_service.revisions(article_id, current_user, skip, limit)
    return {"items": items, "next_cursor": str(skip + limit) if skip + len(items) < total else None, "total": total}


@router.get("/{article_id}/audit-logs")
async def get_article_audit_logs(
    article_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    current_user: dict = article_reader,
):
    skip = _cursor_skip(cursor, skip)
    items, total = await article_application_service.audit_logs(article_id, current_user, skip, limit)
    return {"items": items, "next_cursor": str(skip + limit) if skip + len(items) < total else None, "total": total}


@router.put("/{article_id}")
async def update_article(
    article_id: str,
    article_in: ArticleDraftUpdate,
    current_user: dict = article_editor,
):
    return await article_application_service.update(article_id, article_in, current_user)


@router.post("/{article_id}/transition")
async def transition_article(
    article_id: str,
    transition: TransitionRequest,
    current_user: dict = article_reader,
):
    return await article_application_service.transition(article_id, transition, current_user)


@router.delete("/{article_id}/permanent")
async def delete_article_permanently(
    article_id: str,
    expected_version: int = Query(..., ge=1),
    idempotency_key: str = Query(..., min_length=8, max_length=128),
    current_user: dict = article_deleter,
):
    return await article_application_service.delete_permanently(
        article_id,
        expected_version,
        idempotency_key,
        current_user,
    )
