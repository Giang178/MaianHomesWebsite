from datetime import datetime, timezone

from pydantic import Field

from .base import MongoBaseModel


class Notification(MongoBaseModel):
    event_type: str
    title: str
    message: str
    recipient_account_id: str
    recipient_name: str
    subject_type: str
    subject_id: str | None = None
    subject_name: str
    actor_name: str
    delivery_key: str
    is_read: bool = False
    read_at: datetime | None = None
    module: str = "SYSTEM"
    link: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
