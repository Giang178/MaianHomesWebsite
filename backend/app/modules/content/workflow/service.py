from datetime import datetime, timezone

from app.modules.content.common.enums import (
    MarketingAction,
    PublicationStatus,
    WorkflowStatus,
)
from app.modules.content.workflow.policies import assert_transition_allowed


def transition_fields(
    document: dict,
    action: MarketingAction,
    actor: dict,
    note: str | None,
    *,
    update_permission: str,
    publish_permission: str,
    delete_permission: str,
) -> dict:
    assert_transition_allowed(
        document,
        action,
        actor,
        update_permission=update_permission,
        publish_permission=publish_permission,
        delete_permission=delete_permission,
    )
    now = datetime.now(timezone.utc)
    fields: dict = {"updated_at": now}
    if action == MarketingAction.PUBLISH:
        fields.update(
            workflow_status=WorkflowStatus.PUBLISHED.value,
            publication_status=PublicationStatus.PUBLISHED.value,
            rejection_reason=None,
        )
    elif action == MarketingAction.UNPUBLISH:
        fields["publication_status"] = PublicationStatus.UNPUBLISHED.value
    elif action == MarketingAction.ARCHIVE:
        fields["publication_status"] = PublicationStatus.ARCHIVED.value
    elif action == MarketingAction.RESTORE:
        fields["publication_status"] = PublicationStatus.UNPUBLISHED.value
    return fields

