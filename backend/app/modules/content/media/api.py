import mimetypes
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse

from app.modules.content.common.dependencies import marketing_user
from app.modules.content.common.enums import actor_id
from app.modules.content.media.service import marketing_media_service
from app.api.deps import require_permissions
from app.db.mongodb import get_database

STATIC_PUBLIC_DIR = Path(
    os.getenv("STATIC_PUBLIC_DIR") or (Path(__file__).resolve().parents[5] / "frontend" / "public")
)

protected_router = APIRouter(
    prefix="/marketing-media",
    tags=["Marketing Media"],
)
public_router = APIRouter(
    prefix="/marketing-media",
    tags=["Public Marketing Media"],
)


@protected_router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    namespace: str = Query("general", pattern=r"^[a-z0-9-]{2,40}$"),
    current_user: dict = marketing_user,
):
    return await marketing_media_service.store(
        namespace,
        file,
        actor_id(current_user),
        20 * 1024 * 1024,
    )


@public_router.get("/{file_id}")
async def read_media(
    file_id: str,
    variant: str | None = Query(
        None,
        pattern=r"^(thumbnail|medium|large)_(webp|avif)$",
    ),
):
    document = await get_database()["media_assets"].find_one(
        {"_id": file_id, "lifecycle_status": "ACTIVE"},
        {"original_url": 1},
    )
    original_url = str((document or {}).get("original_url") or "")
    if original_url.startswith("/images/"):
        static_file = (STATIC_PUBLIC_DIR / original_url.lstrip("/")).resolve()
        if static_file.is_file():
            mime_type, _ = mimetypes.guess_type(str(static_file))
            return FileResponse(
                static_file,
                media_type=mime_type or "image/png",
                headers={"Cache-Control": "public, max-age=3600"},
            )
        return RedirectResponse(original_url, status_code=307, headers={"Cache-Control": "public, max-age=3600"})
    stream, metadata = await marketing_media_service.open_stream(file_id, variant)
    return StreamingResponse(
        stream,
        media_type=metadata["content_type"],
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": f'"{metadata["checksum"]}"',
            "X-Content-Type-Options": "nosniff",
            "Content-Length": str(metadata["size"]),
        },
    )


@protected_router.get("")
async def list_media(
    namespace: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_permissions("website.media.read")),
):
    query = {"lifecycle_status": {"$ne": "DELETED"}}
    if namespace:
        query["namespace"] = namespace
    documents = await get_database()["media_assets"].find(
        query,
        {"local_path": 0, "object_key": 0, "variants.local_path": 0, "variants.object_key": 0},
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    items = []
    for document in documents:
        media_id = str(document.pop("_id"))
        items.append({
            **document,
            "id": media_id,
            "url": f"/api/public/marketing-media/{media_id}",
            "original_filename": document.get("original_filename") or f"media-{media_id[:8]}",
            "alt_text": (
                str(document.get("alt_text") or "").strip()
                or f"Hình ảnh website Maian Homes {media_id[:8]}"
            ),
        })
    return {"items": items}
