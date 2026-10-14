"""Project persistence models.

ProjectF1 remains imported from the legacy location during the compatibility
window. Workflow-only documents live in this module.
"""
from typing import Any

from pydantic import BaseModel, Field

from app.models.project import ProjectF1, ProjectStatus, ProjectUpdate


class ProjectDraftDocument(BaseModel):
    project_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    version: int = 1
    updated_by: str = ""


class ProjectRevisionDocument(BaseModel):
    project_id: str
    version: int
    payload: dict[str, Any] = Field(default_factory=dict)
    published_by: str = ""


__all__ = [
    "ProjectDraftDocument",
    "ProjectF1",
    "ProjectRevisionDocument",
    "ProjectStatus",
    "ProjectUpdate",
]

