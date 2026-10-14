import pytest
from fastapi import HTTPException

from app.modules.content.common.enums import MarketingAction
from app.modules.content.workflow.policies import (
    assert_can_edit,
    assert_transition_allowed,
)


PROJECT = {
    "created_by": "editor-1",
    "workflow_status": "DRAFT",
    "publication_status": "NEVER_PUBLISHED",
}


def actor(actor_id: str, permissions: list[str]) -> dict:
    return {
        "id": actor_id,
        "role": "MARKETING",
        "permissions": permissions,
    }


def transition(document: dict, action: MarketingAction, current_actor: dict) -> None:
    assert_transition_allowed(
        document,
        action,
        current_actor,
        update_permission="website.projects.update",
        publish_permission="website.projects.publish",
        delete_permission="website.projects.delete",
    )


def test_role_name_does_not_override_explicit_empty_permissions():
    admin_without_grants = actor("admin-1", [])
    admin_without_grants["role"] = "ADMIN"

    with pytest.raises(HTTPException) as caught:
        transition(PROJECT, MarketingAction.PUBLISH, admin_without_grants)

    assert caught.value.status_code == 403
    assert caught.value.detail["required_permissions"] == ["website.projects.publish"]


def test_publish_permission_controls_publication_actions():
    publisher = actor("publisher-1", ["website.projects.publish"])
    transition(PROJECT, MarketingAction.PUBLISH, publisher)

    transition(PROJECT, MarketingAction.PUBLISH, publisher)


def test_publish_requires_publish_permission():
    with pytest.raises(HTTPException) as missing_grant:
        transition(PROJECT, MarketingAction.PUBLISH, actor("editor-1", []))
    assert missing_grant.value.status_code == 403


def test_delete_permission_controls_archive_and_publishers_can_edit_any_draft():
    deleter = actor("deleter-1", ["website.projects.delete"])
    transition(PROJECT, MarketingAction.ARCHIVE, deleter)

    publisher = actor("publisher-1", ["website.projects.publish"])
    assert_can_edit(PROJECT, publisher, publish_permission="website.projects.publish")
