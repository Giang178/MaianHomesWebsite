import logging
from typing import Any

from app.modules.activity.service import activity_event_service, record_event

logger = logging.getLogger("audit_engine")


class AuditLogService:
    """Legacy call facade that writes immutable audit events."""

    COLLECTION = "activity_events"

    @property
    def collection(self):
        return activity_event_service.collection

    async def create_log(self, entry: dict[str, Any]) -> None:
        action = entry.get("action")
        if hasattr(action, "value"):
            action = action.value
        metadata = dict(entry.get("metadata") or {})
        if entry.get("message"):
            metadata.setdefault("message", entry.get("message"))
        extra = {"collection": entry.get("collection"), "action": str(action or "AUDIT")}
        extra.update(entry.get("extra") or {})
        await record_event(
            str(action or "AUDIT"),
            module=str(entry.get("module") or "SYSTEM"),
            category="AUDIT",
            actor={"email": entry.get("actor_email"), "role": entry.get("actor_role")},
            target_type=entry.get("collection"),
            target_id=str(entry.get("document_id") or "") or None,
            ip_address=entry.get("ip_address"),
            before=entry.get("before") or entry.get("before_snapshot"),
            after=entry.get("after") or entry.get("after_snapshot"),
            metadata=metadata,
            event_key=entry.get("outbox_event_id"),
            extra=extra,
        )
        logger.info("Audit event created: [%s] on '%s'", action, entry.get("collection"))

    async def log(self, *args, **kwargs) -> None:
        if len(args) >= 2 or "collection" in kwargs:
            await self.create_log({
                "collection": kwargs.get("collection") or args[0],
                "action": kwargs.get("action") or args[1],
                "document_id": kwargs.get("document_id") or (args[2] if len(args) > 2 else None),
                "actor_email": kwargs.get("actor_email") or (args[3] if len(args) > 3 else None),
                "actor_role": kwargs.get("actor_role") or (args[4] if len(args) > 4 else None),
                "before": kwargs.get("before") or kwargs.get("before_snapshot"),
                "after": kwargs.get("after") or kwargs.get("after_snapshot"),
                "message": kwargs.get("message"), "metadata": kwargs.get("metadata"),
                "extra": kwargs.get("extra"), "ip_address": kwargs.get("ip_address"),
            })
        elif len(args) == 1 and isinstance(args[0], dict):
            await self.create_log(args[0])
        else:
            await self.create_log(kwargs)


audit_service = AuditLogService()
