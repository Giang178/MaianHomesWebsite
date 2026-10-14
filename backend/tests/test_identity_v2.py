"""Release contracts for standalone website identity and account governance."""

import pytest
from pydantic import ValidationError

from app.main import app
from app.models.user_account import (
    UserAccountCreateAdmin,
    UserProfileUpdate,
    UserRole,
)


def test_release_supports_only_website_account_roles():
    assert {role.value for role in UserRole} == {"CEO", "ADMIN", "MARKETING"}


def test_account_create_rejects_retired_department_roles():
    with pytest.raises(ValidationError):
        UserAccountCreateAdmin(
            email="legacy@example.com",
            full_name="Legacy role",
            role="CUSTOMER_MANAGER",
        )


def test_marketing_account_can_be_created_with_explicit_permissions():
    account = UserAccountCreateAdmin(
        email="marketing@example.com",
        full_name="Marketing",
        role=UserRole.MARKETING,
        permissions=["website.articles.read"],
    )
    assert account.role is UserRole.MARKETING
    assert account.permissions == ["website.articles.read"]


def test_profile_schema_blocks_role_and_permission_mass_assignment():
    assert set(UserProfileUpdate.model_fields) == {"full_name", "phone", "avatar_url"}
    profile = UserProfileUpdate.model_validate(
        {
            "full_name": "Editor",
            "role": "CEO",
            "permissions": ["*"],
        }
    )
    assert profile.model_dump() == {
        "full_name": "Editor",
        "phone": None,
        "avatar_url": None,
    }


def test_identity_routes_use_website_account_namespace():
    paths = app.openapi()["paths"]
    assert "/api/public/auth/login" in paths
    assert "/api/protected/website/accounts" in paths
    assert "/api/protected/website/accounts/{user_id}" in paths
    assert "/api/protected/users" not in paths
