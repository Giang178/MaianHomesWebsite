from datetime import datetime, timezone

from pydantic import BaseModel, Field


class MarketingMedia(BaseModel):
    id: str
    namespace: str
    original_filename: str
    content_type: str
    size: int
    checksum: str
    storage_backend: str
    object_key: str | None = None
    local_path: str | None = None
    uploaded_by: str
    alt_text: str = ""
    lifecycle_status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

