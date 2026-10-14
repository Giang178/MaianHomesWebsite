
from pydantic import BaseModel, Field

from app.modules.content.common.enums import MarketingAction


class TransitionRequest(BaseModel):
    action: MarketingAction
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=128)
    note: str | None = Field(default=None, max_length=2000)
    override_warning_codes: list[str] = Field(default_factory=list)


class WorkflowMetadata(BaseModel):
    workflow_status: str
    publication_status: str
    version: int
    published_version: int = 0
    rejection_reason: str | None = None

