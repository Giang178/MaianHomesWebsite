from fastapi import APIRouter, Depends

from app.api.deps import require_permissions
from app.modules.website.pages.schemas import PageTransition, WebsitePageUpsert
from app.modules.website.pages.service import PAGE_KEYS, serialize, website_page_service
from app.modules.website.pages.definitions import admin_definitions

protected_router = APIRouter(prefix="/website/pages", tags=["Website Pages"])
public_router = APIRouter(prefix="/pages", tags=["Public Website Pages"])


@public_router.get("/{page_key}")
async def get_public_page(page_key: str):
    return await website_page_service.public(page_key)


@protected_router.get("")
async def list_pages(current_user: dict = Depends(require_permissions("website.pages.read"))):
    documents = await website_page_service.pages.find().sort("page_key", 1).to_list(length=len(PAGE_KEYS))
    return {"items": [serialize(item) for item in documents]}


@protected_router.get("/definitions")
async def get_page_definitions(current_user: dict = Depends(require_permissions("website.pages.read"))):
    return {"items": admin_definitions()}


@protected_router.get("/{page_key}")
async def get_page(page_key: str, current_user: dict = Depends(require_permissions("website.pages.read"))):
    return await website_page_service.get(page_key)


@protected_router.get("/{page_key}/preview")
async def preview_page(page_key: str, current_user: dict = Depends(require_permissions("website.pages.read"))):
    return await website_page_service.preview(page_key)


@protected_router.get("/{page_key}/versions")
async def page_versions(page_key: str, current_user: dict = Depends(require_permissions("website.pages.read"))):
    return await website_page_service.list_versions(page_key)


@protected_router.put("/{page_key}")
async def upsert_page(page_key: str, payload: WebsitePageUpsert, current_user: dict = Depends(require_permissions("website.pages.update"))):
    return await website_page_service.upsert(page_key, payload.model_dump(), current_user)


@protected_router.post("/{page_key}/transition")
async def transition_page(page_key: str, payload: PageTransition, current_user: dict = Depends(require_permissions("website.pages.publish"))):
    return await website_page_service.transition(page_key, payload.action, payload.expected_version, current_user, payload.target_version, payload.note)
