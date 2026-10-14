from typing import Any

from pydantic import BaseModel, Field

from app.models.project import ProjectF1, ProjectUpdate
from app.modules.content.seo_geo.schemas import ValidationReport


class ProjectCreateRequest(ProjectF1):
    is_published: bool = False
    idempotency_key: str = Field(min_length=8, max_length=128)


class ProjectValidationRequest(ProjectF1):
    """A project draft payload validated without persistence metadata."""

    pass


class ProjectDraftUpdate(ProjectUpdate):
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=128)


class ProjectAdminResponse(BaseModel):
    project: dict[str, Any]
    live: dict[str, Any] | None = None
    validation: ValidationReport | None = None


class ProjectListResponse(BaseModel):
    data: list[dict[str, Any]]
    total: int
    skip: int
    limit: int

