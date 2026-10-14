from fastapi import HTTPException, status

from app.modules.content.common.enums import (
    MANAGER_ROLES,
    MARKETING_ROLES,
    MarketingAction,
    PublicationStatus,
    actor_id,
    role_value,
)


def has_permission(actor: dict, permission: str) -> bool:
    # Compatibility for legacy actors used by migrations/tests. Authenticated
    # website accounts always include a persisted permissions field, including
    # an explicit empty list when no capability is granted.
    if "permissions" not in actor:
        role = role_value(actor)
        return role in (MANAGER_ROLES if permission.endswith((".publish", ".delete")) else MARKETING_ROLES)
    granted = set(actor.get("permissions") or [])
    return "*" in granted or permission in granted


def assert_can_edit(document: dict, actor: dict, *, publish_permission: str | None = None) -> None:
    if document.get("publication_status") == PublicationStatus.ARCHIVED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nội dung đã lưu trữ. Hãy khôi phục trước khi chỉnh sửa.",
        )
    if publish_permission and has_permission(actor, publish_permission):
        return
    owner = (
        document.get("editor_owner_id")
        or document.get("created_by")
        or document.get("author_id")
    )
    if owner != actor_id(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản chỉ được sửa nội dung do mình tạo khi không có quyền xuất bản.",
        )


def assert_transition_allowed(
    document: dict,
    action: MarketingAction,
    actor: dict,
    *,
    update_permission: str = "website.projects.update",
    publish_permission: str = "website.projects.publish",
    delete_permission: str = "website.projects.delete",
) -> None:
    publication = document.get(
        "publication_status", PublicationStatus.NEVER_PUBLISHED.value
    )

    required_permission = (
        delete_permission
        if action in {MarketingAction.ARCHIVE, MarketingAction.RESTORE}
        else publish_permission
    )
    if not has_permission(actor, required_permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERMISSION_DENIED", "required_permissions": [required_permission]},
        )
    if action == MarketingAction.UNPUBLISH and publication != PublicationStatus.PUBLISHED.value:
        raise HTTPException(status_code=409, detail="Nội dung chưa được xuất bản.")
    if action == MarketingAction.ARCHIVE and publication == PublicationStatus.ARCHIVED.value:
        raise HTTPException(
            status_code=409,
            detail="Nội dung đã được lưu trữ.",
        )
    if action == MarketingAction.PUBLISH:
        if publication == PublicationStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=409,
                detail="Hãy khôi phục nội dung trước khi xuất bản.",
            )
    if action == MarketingAction.RESTORE and publication != PublicationStatus.ARCHIVED.value:
        raise HTTPException(status_code=409, detail="Nội dung chưa được lưu trữ.")
