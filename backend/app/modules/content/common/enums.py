from enum import Enum


class WorkflowStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class PublicationStatus(str, Enum):
    NEVER_PUBLISHED = "NEVER_PUBLISHED"
    PUBLISHED = "PUBLISHED"
    UNPUBLISHED = "UNPUBLISHED"
    ARCHIVED = "ARCHIVED"


class MarketingAction(str, Enum):
    PUBLISH = "publish"
    UNPUBLISH = "unpublish"
    ARCHIVE = "archive"
    RESTORE = "restore"


MANAGER_ROLES = {"ADMIN", "CEO", "MARKETING", "MARKETING_MANAGER"}
MARKETING_ROLES = MANAGER_ROLES | {"MARKETING_STAFF"}


def role_value(actor: dict) -> str:
    role = actor.get("role", "")
    return getattr(role, "value", str(role)).split(".")[-1].upper()


def actor_id(actor: dict) -> str:
    return str(
        actor.get("account_id")
        or actor.get("employee_id")
        or actor.get("id")
        or actor.get("_id")
        or ""
    )

