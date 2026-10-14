import hashlib
import json

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile

from app.api.deps import get_current_active_user, require_permissions
from app.modules.content.common.enums import actor_id
from app.modules.content.media.service import marketing_media_service
from app.modules.website.team.policies import ensure_permission
from app.modules.website.team.schemas import TeamProfilePayload, TeamTransition
from app.modules.website.team.service import team_service

protected_router = APIRouter(prefix="/website/staff", tags=["Website Team"])
public_router = APIRouter(prefix="/team", tags=["Public Team"])


def cache_public(response: Response, payload: object) -> None:
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    response.headers["ETag"] = f'"{hashlib.sha256(encoded).hexdigest()}"'
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"


@public_router.get("")
async def list_team_profiles(
    response: Response,
    q: str | None = None,
    home: bool | None = None,
    featured: bool | None = None,
    limit: int = Query(24, ge=1, le=100),
    cursor: str | None = None,
):
    result = await team_service.public_list(q=q, home=home, featured=featured, limit=limit, cursor=cursor)
    cache_public(response, result)
    return result


@public_router.get("/{slug}")
async def get_team_profile(slug: str, response: Response):
    result = await team_service.public_detail(slug)
    cache_public(response, result)
    return result


@protected_router.get("")
async def list_team_profiles_admin(
    status: str | None = None,
    q: str | None = None,
    current_user: dict = Depends(require_permissions("website.staff.read")),
):
    return await team_service.list_admin(status=status, q=q)


@protected_router.get("/options")
async def team_options(current_user: dict = Depends(require_permissions("website.staff.read"))):
    return await team_service.options()


@protected_router.post("/avatar")
async def upload_team_avatar(
    file: UploadFile = File(...),
    alt_text: str = Form(..., min_length=10, max_length=300),
    current_user: dict = Depends(
        require_permissions("website.staff.create", "website.staff.update", require_all=False)
    ),
):
    result = await marketing_media_service.store(
        "staff-profiles",
        file,
        actor_id(current_user),
        20 * 1024 * 1024,
    )
    await team_service.set_media_alt_text(result["id"], alt_text)
    return result


@protected_router.get("/{profile_id}")
async def get_staff(profile_id: str, current_user: dict = Depends(require_permissions("website.staff.read"))):
    return await team_service.detail(profile_id)


@protected_router.post("", status_code=201)
async def create_team_profile(payload: TeamProfilePayload, current_user: dict = Depends(require_permissions("website.staff.create"))):
    return await team_service.create(payload.model_dump(), current_user)


@protected_router.put("/{profile_id}")
async def update_team_profile(profile_id: str, payload: TeamProfilePayload, current_user: dict = Depends(require_permissions("website.staff.update"))):
    return await team_service.update(profile_id, payload.model_dump(), current_user)


@protected_router.delete("/{profile_id}", status_code=204)
async def delete_team_profile(
    profile_id: str,
    expected_version: int = Query(..., ge=1),
    current_user: dict = Depends(require_permissions("website.staff.delete")),
):
    await team_service.delete(profile_id, expected_version, current_user)
    return Response(status_code=204)


@protected_router.get("/{profile_id}/preview")
async def preview_team_profile(profile_id: str, current_user: dict = Depends(require_permissions("website.staff.read"))):
    return await team_service.preview(profile_id)


@protected_router.get("/{profile_id}/versions")
async def team_profile_versions(profile_id: str, current_user: dict = Depends(require_permissions("website.staff.read"))):
    return await team_service.versions(profile_id)


@protected_router.post("/{profile_id}/transition")
async def transition_team_profile(
    profile_id: str,
    payload: TeamTransition,
    current_user: dict = Depends(get_current_active_user),
):
    required = "website.staff.archive" if payload.action == "archive" else "website.staff.publish"
    ensure_permission(current_user, required)
    return await team_service.transition(profile_id, payload.model_dump(), current_user)
