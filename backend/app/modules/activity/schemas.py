from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ActorSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["ACCOUNT", "ANONYMOUS", "SYSTEM"] = "ACCOUNT"
    account_id: str | None = None
    employee_id: str | None = None
    email: str | None = None
    name: str | None = None
    employee_code: str | None = None
    role: str | None = None
    department: str | None = None


class RequestContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str | None = None
    session_id: str | None = None
    method: str | None = None
    route: str | None = None
    ip_address: str | None = None
    user_agent: str | None = Field(default=None, max_length=1000)
    browser: str | None = None
    operating_system: str | None = None
    device: str | None = None


class TargetSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str | None = None
    id: str | None = None
    label: str | None = Field(default=None, max_length=300)


class ChangeSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    before: dict[str, Any] = Field(default_factory=dict)
    after: dict[str, Any] = Field(default_factory=dict)
    diff: dict[str, Any] = Field(default_factory=dict)


class ActivityEventDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_key: str = Field(min_length=8, max_length=256)
    occurred_at: datetime
    received_at: datetime
    module: str
    category: str
    event_type: str
    result: str
    severity: str
    source: str = "APPLICATION"
    actor: ActorSnapshot
    request: RequestContext
    target: TargetSnapshot
    change: ChangeSnapshot
    metadata: dict[str, Any] = Field(default_factory=dict)
    actor_search: str = Field(default="", max_length=2000)

    @field_validator("module", "category", "event_type", "result", "severity", "source")
    @classmethod
    def uppercase_codes(cls, value: str) -> str:
        return value.upper()


class PurgeRequest(BaseModel):
    preview_token: str = Field(min_length=20)
    reason: str = Field(min_length=10, max_length=500)
    confirmation: str


class PurgeResult(BaseModel):
    deleted_count: int
    cutoff: datetime
    message: str
