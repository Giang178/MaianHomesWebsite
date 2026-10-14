"""Release contracts for the website CMS surface."""

from app.main import app
from app.models.user_account import UserRole
from app.modules.identity.permissions.catalog import DEFAULT_MARKETING_PERMISSIONS


def test_public_and_protected_cms_routes_are_exposed():
    paths = app.openapi()["paths"]
    assert {"get"} <= set(paths["/api/public/projects"])
    assert {"get"} <= set(paths["/api/public/articles"])
    assert {"get", "post"} <= set(paths["/api/protected/projects"])
    assert {"post"} <= set(paths["/api/protected/articles"])


def test_cms_retains_review_and_publication_transitions():
    paths = app.openapi()["paths"]
    assert "post" in paths["/api/protected/projects/{project_id}/transition"]
    assert "post" in paths["/api/protected/articles/{article_id}/transition"]
    schemas = app.openapi()["components"]["schemas"]
    assert {"action", "expected_version", "idempotency_key"} <= set(
        schemas["TransitionRequest"]["required"]
    )


def test_marketing_preset_is_limited_to_current_website_permissions():
    assert set(DEFAULT_MARKETING_PERMISSIONS)
    assert all(permission.startswith("website.") for permission in DEFAULT_MARKETING_PERMISSIONS)
    assert "website.accounts.update" not in DEFAULT_MARKETING_PERMISSIONS


def test_retired_customer_manager_role_cannot_enter_cms_contract():
    assert "CUSTOMER_MANAGER" not in {role.value for role in UserRole}
