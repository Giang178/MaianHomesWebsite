from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.public.auth import get_allowed_paths_for_role
from app.main import app
from app.models.user_account import UserRole
from app.modules.website.consignments.api import to_lead
from app.modules.website.inquiries.schemas import WebsiteLeadCreate
from app.modules.identity.permissions.catalog import (
    DEFAULT_MARKETING_PERMISSIONS,
    WEBSITE_PERMISSIONS,
    normalize_permissions,
)


def test_only_supported_account_roles_remain():
    assert {role.value for role in UserRole} == {"CEO", "ADMIN", "MARKETING"}


def test_openapi_exposes_website_contract_without_department_routes():
    paths = set(app.openapi()["paths"])
    assert {
        "/api/public/projects",
        "/api/public/articles",
        "/api/public/team",
        "/api/public/contact-settings",
        "/api/public/site-settings",
        "/api/public/leads",
        "/api/public/consignments",
        "/api/public/jobs",
        "/api/protected/website/pages",
        "/api/protected/website/branding",
        "/api/protected/website/leads",
        "/api/protected/website/recruitment",
    } <= paths
    assert not any(path.startswith(("/api/protected/sales", "/api/protected/hr", "/api/protected/it")) for path in paths)


def test_allowed_admin_paths_are_derived_from_permissions():
    paths = get_allowed_paths_for_role(
        "MARKETING",
        ["website.pages.update", "website.media.upload", "website.analytics.read"],
    )
    assert "/admin/content" in paths
    assert "/admin/media" not in paths
    assert "/admin/analytics" in paths
    assert "/admin/leads" not in paths
    assert "/admin/accounts" not in paths
    assert "/admin" not in paths
    assert "/admin/marketing" not in paths


def test_system_email_permission_exposes_only_the_system_module():
    paths = get_allowed_paths_for_role("ADMIN", ["website.system.email.read"])
    assert paths == ["/admin/system"]

def test_ceo_paths_do_not_expose_deprecated_marketing_workspace():
    assert "/admin/marketing" not in get_allowed_paths_for_role("CEO")


def test_permission_catalog_covers_current_admin_modules():
    assert {"website.workspaces.read", "website.system.monitoring.read", "website.system.monitoring.run"} <= WEBSITE_PERMISSIONS


def test_permission_dependencies_are_added_transitively():
    assert set(normalize_permissions(["website.pages.publish"])) == {
        "website.pages.read", "website.pages.update", "website.pages.publish",
    }
    assert set(normalize_permissions(["website.system.monitoring.run"])) == {
        "website.system.monitoring.read", "website.system.monitoring.run",
    }


def test_marketing_preset_cannot_change_fixed_page_content_or_images():
    assert "website.pages.read" in DEFAULT_MARKETING_PERMISSIONS
    assert "website.pages.update" not in DEFAULT_MARKETING_PERMISSIONS
    assert "website.pages.publish" not in DEFAULT_MARKETING_PERMISSIONS
    assert not any(item.startswith(("website.branding.", "website.media.")) for item in DEFAULT_MARKETING_PERMISSIONS)
    assert {"website.seo.publish", "website.geo.publish"} <= set(DEFAULT_MARKETING_PERMISSIONS)


def test_public_lead_normalizes_phone_and_has_no_sales_assignment_fields():
    lead = WebsiteLeadCreate(customer_name=" Khách hàng ", phone="+84 969 105 059")
    assert lead.customer_name == "Khách hàng"
    assert lead.phone == "0969105059"
    assert not hasattr(lead, "assignee_id")
    assert not hasattr(lead, "sla_deadline")


def test_consignment_is_adapted_to_a_website_lead():
    lead = to_lead({
        "owner": {"name": "Chủ nhà", "phone": "0969105059", "email": "owner@example.com"},
        "property": {"address": "Quận 1", "transaction_type": "sale"},
    })
    assert lead.form_id == "consignment"
    assert lead.type == "CONSIGNMENT"
    assert lead.page_key == "consignment"

def test_malformed_consignment_input_returns_validation_error_not_server_exception():
    with pytest.raises(HTTPException) as invalid_owner:
        to_lead({"owner": {"name": "A", "phone": "not-a-phone"}, "property": {}})
    assert invalid_owner.value.status_code == 422

    with pytest.raises(ValueError):
        to_lead([])

def test_database_bootstrap_never_embeds_or_resets_default_passwords():
    source = (Path(__file__).parents[1] / "scripts" / "recreate_database.py").read_text(encoding="utf-8")
    assert "Maian@CEO2026" not in source
    assert "Maian@Admin2026" not in source
    assert "Maian@Mkt2026" not in source
    assert '"$setOnInsert": account_doc' in source
    assert '"must_change_password": True' in source
