from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.api.deps import get_optional_current_user, require_permissions
from app.modules.content.media.service import marketing_media_service
from app.modules.website.workspaces.schemas import (
    CoworkingContentUpsert,
    OfficeBuildingCreateUpdate,
    OfficeLandingContentUpsert,
    OfficeUnitCreateUpdate,
    PricingPlanCreateUpdate,
    SeatTypeCreateUpdate,
    WorkspaceFAQCreateUpdate,
    WorkspaceTransitionRequest,
)
from app.modules.website.workspaces.service import workspace_service

public_router = APIRouter(prefix="/workspaces", tags=["Public Workspaces"])
protected_router = APIRouter(prefix="/website/workspaces", tags=["Website Workspaces"])


# ==========================================
# PUBLIC FLOW
# ==========================================

@public_router.get("/availability")
async def get_public_workspace_availability():
    return await workspace_service.get_public_availability()

@public_router.get("/coworking")
async def get_public_coworking():
    # Draft preview is protected by the permission-aware admin endpoint.
    return await workspace_service.get_public_coworking()


@public_router.get("/office/landing")
async def get_public_office_landing(
    preview: bool = Query(False),
    current_user: dict | None = Depends(get_optional_current_user),
):
    if preview and current_user:
        permissions = set(current_user.get("permissions") or [])
        if "*" in permissions or "website.workspaces.read" in permissions:
            return await workspace_service.get_admin_office_landing(preview=True)
    return await workspace_service.get_public_office_landing()


@public_router.get("/office")
async def list_public_buildings(
    district: str | None = None,
    area_min: float | None = None,
    area_max: float | None = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
    budget_band: str | None = None,
    area_band: str | None = None,
    grade: str | None = None,
    availability: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    return await workspace_service.list_public_buildings(
        district=district,
        area_min=area_min,
        area_max=area_max,
        budget_min=budget_min,
        budget_max=budget_max,
        budget_band=budget_band,
        area_band=area_band,
        grade=grade,
        availability=availability,
        search=search,
        page=page,
        limit=limit,
    )


@public_router.get("/office/{slug}")
async def get_public_building_detail(
    slug: str,
    preview: bool = Query(False),
    current_user: dict | None = Depends(get_optional_current_user),
):
    if preview and current_user:
        permissions = set(current_user.get("permissions") or [])
        if "*" in permissions or "website.workspaces.read" in permissions:
            return await workspace_service.get_preview_building_by_slug(slug)
    return await workspace_service.get_public_building_by_slug(slug)


# ==========================================
# PROTECTED ADMIN FLOW
# ==========================================

@protected_router.get("/overview")
async def get_overview_stats(current_user: dict = Depends(require_permissions("website.workspaces.read"))):
    return await workspace_service.get_overview_stats()


# --- Coworking Management ---
@protected_router.get("/coworking")
async def get_admin_coworking(
    preview: bool = Query(False),
    current_user: dict = Depends(require_permissions("website.workspaces.read")),
):
    return await workspace_service.get_admin_coworking(preview=preview)


@protected_router.put("/coworking")
async def upsert_coworking(
    payload: CoworkingContentUpsert,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.upsert_coworking(payload.model_dump(), current_user)


@protected_router.post("/coworking/transition")
async def transition_coworking(
    payload: WorkspaceTransitionRequest,
    current_user: dict = Depends(require_permissions("website.workspaces.publish")),
):
    return await workspace_service.transition_coworking(
        action=payload.action,
        expected_version=payload.expected_version,
        current_user=current_user,
        note=payload.note,
    )


# Seat Types
@protected_router.get("/coworking/seat-types")
async def list_seat_types(current_user: dict = Depends(require_permissions("website.workspaces.read"))):
    return await workspace_service.list_seat_types()


@protected_router.post("/coworking/seat-types", status_code=status.HTTP_201_CREATED)
async def create_seat_type(
    payload: SeatTypeCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.create_seat_type(payload.model_dump(), current_user)


@protected_router.put("/coworking/seat-types/{seat_type_id}")
async def update_seat_type(
    seat_type_id: str,
    payload: SeatTypeCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.update_seat_type(seat_type_id, payload.model_dump(), current_user)


@protected_router.delete("/coworking/seat-types/{seat_type_id}")
async def delete_seat_type(
    seat_type_id: str,
    current_user: dict = Depends(require_permissions("website.workspaces.delete")),
):
    return await workspace_service.delete_seat_type(seat_type_id, current_user)


# Pricing Plans
@protected_router.get("/coworking/plans")
async def list_pricing_plans(current_user: dict = Depends(require_permissions("website.workspaces.read"))):
    return await workspace_service.list_pricing_plans()


@protected_router.post("/coworking/plans", status_code=status.HTTP_201_CREATED)
async def create_pricing_plan(
    payload: PricingPlanCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.create_pricing_plan(payload.model_dump(), current_user)


@protected_router.put("/coworking/plans/{plan_id}")
async def update_pricing_plan(
    plan_id: str,
    payload: PricingPlanCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.update_pricing_plan(plan_id, payload.model_dump(), current_user)


@protected_router.delete("/coworking/plans/{plan_id}")
async def delete_pricing_plan(
    plan_id: str,
    current_user: dict = Depends(require_permissions("website.workspaces.delete")),
):
    return await workspace_service.delete_pricing_plan(plan_id, current_user)


# --- Office Landing ---
@protected_router.get("/office/landing")
async def get_admin_office_landing(
    preview: bool = Query(False),
    current_user: dict = Depends(require_permissions("website.workspaces.read")),
):
    return await workspace_service.get_admin_office_landing(preview=preview)


@protected_router.put("/office/landing")
async def upsert_office_landing(
    payload: dict,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    validated = OfficeLandingContentUpsert.from_input(payload)
    return await workspace_service.upsert_office_landing(validated.model_dump(), current_user)


@protected_router.post("/office/landing/transition")
async def transition_office_landing(
    payload: WorkspaceTransitionRequest,
    current_user: dict = Depends(require_permissions("website.workspaces.publish")),
):
    return await workspace_service.transition_office_landing(
        action=payload.action,
        expected_version=payload.expected_version,
        current_user=current_user,
        note=payload.note,
    )


# --- Office Buildings ---
@protected_router.get("/office/buildings")
async def list_admin_buildings(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    current_user: dict = Depends(require_permissions("website.workspaces.read")),
):
    return await workspace_service.list_admin_buildings(page=page, limit=limit, search=search, status=status_filter)


@protected_router.post("/office/buildings", status_code=status.HTTP_201_CREATED)
async def create_building(
    payload: OfficeBuildingCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.create_building(
        payload.model_dump(mode="json"), current_user
    )


@protected_router.get("/office/buildings/{building_id}")
async def get_admin_building(
    building_id: str,
    preview: bool = Query(False),
    current_user: dict = Depends(require_permissions("website.workspaces.read")),
):
    return await workspace_service.get_admin_building(building_id, preview=preview)


@protected_router.put("/office/buildings/{building_id}")
async def update_building(
    building_id: str,
    payload: OfficeBuildingCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.update_building(
        building_id,
        payload.model_dump(mode="json"),
        current_user,
        expected_version=payload.expected_version,
    )


@protected_router.post("/office/buildings/{building_id}/transition")
async def transition_building(
    building_id: str,
    payload: WorkspaceTransitionRequest,
    current_user: dict = Depends(require_permissions("website.workspaces.publish")),
):
    return await workspace_service.transition_building(
        building_id,
        payload.action,
        payload.expected_version,
        current_user,
    )

@protected_router.delete("/office/buildings/{building_id}")
async def delete_building(
    building_id: str,
    current_user: dict = Depends(require_permissions("website.workspaces.delete")),
):
    return await workspace_service.delete_building(building_id, current_user)


# --- Office Units ---
@protected_router.get("/office/buildings/{building_id}/units")
async def list_building_units(
    building_id: str,
    current_user: dict = Depends(require_permissions("website.workspaces.read")),
):
    return await workspace_service.list_units(building_id, public_only=False)


@protected_router.post("/office/units", status_code=status.HTTP_201_CREATED)
async def create_unit(
    payload: OfficeUnitCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.create_unit(
        payload.model_dump(mode="json"), current_user
    )


@protected_router.put("/office/units/{unit_id}")
async def update_unit(
    unit_id: str,
    payload: OfficeUnitCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.update_unit(
        unit_id, payload.model_dump(mode="json"), current_user
    )


@protected_router.delete("/office/units/{unit_id}")
async def delete_unit(
    unit_id: str,
    current_user: dict = Depends(require_permissions("website.workspaces.delete")),
):
    return await workspace_service.delete_unit(unit_id, current_user)


# --- Workspace FAQs ---
@protected_router.get("/faqs")
async def list_faqs(
    entity_type: str = Query("COWORKING"),
    entity_id: str = Query("singleton_location"),
    current_user: dict = Depends(require_permissions("website.workspaces.read")),
):
    return await workspace_service.list_faqs(entity_type, entity_id, public_only=False)


@protected_router.post("/faqs", status_code=status.HTTP_201_CREATED)
async def create_faq(
    payload: WorkspaceFAQCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.create_faq(payload.model_dump(), current_user)


@protected_router.put("/faqs/{faq_id}")
async def update_faq(
    faq_id: str,
    payload: WorkspaceFAQCreateUpdate,
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    return await workspace_service.update_faq(faq_id, payload.model_dump(), current_user)


@protected_router.delete("/faqs/{faq_id}")
async def delete_faq(
    faq_id: str,
    current_user: dict = Depends(require_permissions("website.workspaces.delete")),
):
    return await workspace_service.delete_faq(faq_id, current_user)


# --- SEO / GEO Audit Dashboard ---
@protected_router.get("/seo-geo/audit")
async def audit_seo_geo(current_user: dict = Depends(require_permissions("website.workspaces.read"))):
    return await workspace_service.audit_seo_geo()


# --- Media Upload Endpoint ---
@protected_router.post("/upload")
async def upload_workspace_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permissions("website.workspaces.update")),
):
    user_id = str(current_user.get("id") or current_user.get("sub") or "admin")
    return await marketing_media_service.store(
        "workspaces", file, user_id, 50 * 1024 * 1024
    )
