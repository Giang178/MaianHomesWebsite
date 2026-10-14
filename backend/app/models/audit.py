from enum import Enum


class AuditAction(str, Enum):
    """Actions recorded by the shared activity/audit service."""

    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    LOGIN = "LOGIN"
    BLOCKED = "BLOCKED"
