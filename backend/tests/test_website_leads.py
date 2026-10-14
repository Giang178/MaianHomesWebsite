"""Release contracts for the website-only lead-management surface."""

from app.main import app
from app.modules.website.inquiries.schemas import WebsiteLeadCreate
from app.modules.website.inquiries.service import safe_spreadsheet_value


def test_public_intake_and_admin_lead_operations_are_exposed():
    paths = app.openapi()["paths"]
    assert "post" in paths["/api/public/leads"]
    assert "get" in paths["/api/protected/website/leads"]
    assert "post" in paths["/api/protected/website/leads/export"]
    assert "patch" in paths["/api/protected/website/leads/{lead_id}/status"]


def test_retired_internal_routes_are_not_exposed():
    paths = set(app.openapi()["paths"])
    retired_prefixes = (
        "/api/protected/leads",
        "/api/protected/consignments",
        "/api/protected/sales-crm",
        "/api/protected/inventory",
    )
    assert not any(path.startswith(retired_prefixes) for path in paths)


def test_public_lead_contract_has_no_internal_assignment_state():
    lead = WebsiteLeadCreate(
        customer_name="Website visitor",
        phone="+84 901 234 567",
        source="WEBSITE",
        consent=True,
    )
    assert lead.phone == "0901234567"
    assert not hasattr(lead, "assigned_sales_id")
    assert not hasattr(lead, "pool_due_at")


def test_website_export_neutralizes_spreadsheet_formulas():
    for value in ("=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "\tformula", "\rformula"):
        assert safe_spreadsheet_value(value).startswith("'")
    assert safe_spreadsheet_value("plain text") == "plain text"
