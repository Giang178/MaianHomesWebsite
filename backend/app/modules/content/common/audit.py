from app.modules.activity.service import record_event
from app.modules.content.common.enums import actor_id, role_value


async def record_audit(
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    actor: dict,
    previous: dict | None = None,
    current: dict | None = None,
    note: str | None = None,
    metadata: dict | None = None,
    session=None,
) -> None:
    event_metadata = dict(metadata or {})
    if note:
        event_metadata["note"] = note
    await record_event(
        action,
        module="MARKETING",
        category="AUDIT",
        actor={**actor, "id": actor_id(actor), "role": role_value(actor)},
        target_type=entity_type.upper(),
        target_id=entity_id,
        before=previous,
        after=current,
        metadata=event_metadata,
        session=session,
        extra={"entity_type": entity_type.upper(), "entity_id": entity_id, "action": action},
    )
