
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from app.api.deps import require_permissions

from app.modules.content.common.enums import actor_id
from app.modules.content.media.service import marketing_media_service
from app.modules.content.projects.schemas import (
    ProjectAdminResponse,
    ProjectCreateRequest,
    ProjectDraftUpdate,
    ProjectValidationRequest,
)
from app.modules.content.seo_geo.schemas import ValidationReport
from app.modules.content.projects.service import project_application_service
from app.modules.content.workflow.schemas import TransitionRequest

router = APIRouter(prefix="/projects", tags=["Protected Marketing Projects"])
project_reader = Depends(require_permissions("website.projects.read"))
project_creator = Depends(require_permissions("website.projects.create"))
project_editor = Depends(require_permissions("website.projects.update"))
project_deleter = Depends(require_permissions("website.projects.delete"))
project_media_editor = Depends(require_permissions(
    "website.projects.create", "website.projects.update", require_all=False
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



@router.post("/upload")
async def upload_project_image(
    file: UploadFile = File(...), current_user: dict = project_media_editor
):
    return await marketing_media_service.store(
        "projects", file, actor_id(current_user), 50 * 1024 * 1024
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProjectAdminResponse)
async def create_project(project_in: ProjectCreateRequest, current_user: dict = project_creator):
    return await project_application_service.create(project_in, current_user)


@router.post("/validate", response_model=ValidationReport)
async def validate_project(
    project_in: ProjectValidationRequest,
    current_user: dict = project_media_editor,
):
    return project_application_service.validate(project_in.model_dump())


@router.get("")
async def list_projects(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    cursor: str | None = Query(None),
    workflow_status: str | None = None,
    publication_status: str | None = None,
    current_user: dict = project_reader,
):
    skip = _cursor_skip(cursor, skip)
    result = await project_application_service.list(
        current_user, skip, limit, workflow_status, publication_status
    )
    response.headers["X-Total-Count"] = str(result["total"])
    items = result["data"]
    return {"items": items, "data": items, "next_cursor": str(skip + limit) if skip + len(items) < result["total"] else None, "total": result["total"]}


@router.get("/{project_id}", response_model=ProjectAdminResponse)
async def get_project(project_id: str, current_user: dict = project_reader):
    return await project_application_service.detail(project_id, current_user)


@router.patch("/{project_id}", response_model=ProjectAdminResponse)
async def update_project(
    project_id: str,
    project_in: ProjectDraftUpdate,
    current_user: dict = project_editor,
):
    return await project_application_service.update(project_id, project_in, current_user)


@router.post("/{project_id}/transition")
async def transition_project(
    project_id: str,
    transition: TransitionRequest,
    current_user: dict = project_reader,
):
    return await project_application_service.transition(project_id, transition, current_user)


@router.get("/{project_id}/revisions")
async def list_project_revisions(
    project_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None),
    current_user: dict = project_reader,
):
    skip = _cursor_skip(cursor, skip)
    items, total = await project_application_service.revisions(
        project_id, current_user, skip, limit
    )
    return {
        "items": items,
        "data": items,
        "next_cursor": str(skip + limit) if skip + len(items) < total else None,
        "total": total,
    }


@router.delete("/{project_id}")
async def archive_project(
    project_id: str,
    expected_version: int = Query(..., ge=1),
    idempotency_key: str = Query(..., min_length=8, max_length=128),
    current_user: dict = project_deleter,
):
    transition = TransitionRequest(
        action="archive",
        expected_version=expected_version,
        idempotency_key=idempotency_key,
    )
    return await project_application_service.transition(project_id, transition, current_user)


@router.delete("/{project_id}/permanent")
async def delete_project_permanently(
    project_id: str,
    expected_version: int = Query(..., ge=1),
    idempotency_key: str = Query(..., min_length=8, max_length=128),
    current_user: dict = project_deleter,
):
    return await project_application_service.delete_permanently(
        project_id,
        expected_version,
        idempotency_key,
        current_user,
    )
