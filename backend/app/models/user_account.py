"""
UserAccount Model - Maian Homes 2.0 Standalone Identity
======================================================
Decoupled completely from internal HR, employee models, and organizational departments.
Directly manages authentication, credentials, and RBAC roles:
- CEO: Protected bootstrap owner account.
- ADMIN: Website administration, CMS, lead exports, and account governance.
- MARKETING: Website management, project creation, news, media, and SEO/GEO.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.models.base import MongoBaseModel


class UserRole(str, Enum):
    CEO = "CEO"
    ADMIN = "ADMIN"
    MARKETING = "MARKETING"

    @classmethod
    def normalize(cls, role: Any) -> str:
        if not role:
            return cls.MARKETING.value
        val = role.value if hasattr(role, "value") else str(role)
        val = val.upper()
        if val == "CEO":
            return cls.CEO.value
        if val == "ADMIN":
            return cls.ADMIN.value
        if val == "MARKETING":
            return cls.MARKETING.value
        return val


class AccountStatus(str, Enum):
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    DISABLED = "DISABLED"
    PENDING_SETUP = "PENDING_SETUP"


class UserAccount(MongoBaseModel):
    email: str
    normalized_email: str | None = None
    password_hash: str = ""
    full_name: str = ""
    phone: str | None = None
    avatar_url: str | None = None
    role: str = UserRole.MARKETING.value
    permissions: list[str] = Field(default_factory=list)
    status: str = AccountStatus.ACTIVE.value
    is_active: bool = True
    is_protected: bool = False  # True for primary bootstrap ADMIN — cannot be locked/deleted

    must_change_password: bool = False
    token_version: int = 1
    last_login_at: datetime | None = None
    last_login_ip: str | None = None
    created_by: str | None = None

    @property
    def account_status(self) -> str:
        return self.status


# --- Pydantic DTO Schemas ---

class UserAccountCreateAdmin(BaseModel):
    email: str
    full_name: str
    phone: str | None = None
    role: UserRole = UserRole.MARKETING
    permissions: list[str] = Field(default_factory=list)


class UserAccountResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str | None = None
    avatar_url: str | None = None
    role: str
    permissions: list[str] = Field(default_factory=list)
    status: str
    is_active: bool
    must_change_password: bool = False
    created_at: datetime | None = None
    last_login_at: datetime | None = None


class UserAccountCreatedResponse(UserAccountResponse):
    pass


class UserAccountUpdateAdmin(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    role: UserRole | None = None
    status: AccountStatus | None = None
    is_active: bool | None = None
    permissions: list[str] | None = None


class UserProfileUpdate(BaseModel):
    """Mass-assignment safe: standard users can only edit their own display details."""
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    avatar_url: str | None = Field(default=None, max_length=2048)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
