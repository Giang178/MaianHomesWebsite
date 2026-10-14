from datetime import datetime, timedelta, timezone

from app.main import app
from app.modules.website.recruitment.api import make_job_slug, public_job_is_expired, publication_issues
from app.modules.website.recruitment.schemas import JobPayload


def complete_job() -> dict:
    return {
        "title": "Chuyên viên Marketing",
        "department": "Marketing",
        "location": "TP. Hồ Chí Minh",
        "employment_type": "Full-time",
        "quantity": 2,
        "short_description": "Phụ trách hoạt động truyền thông và nội dung thương hiệu.",
        "description_html": "<ul><li>Lập kế hoạch nội dung</li></ul>",
        "requirements_html": "<ul><li>Có kinh nghiệm Marketing</li></ul>",
        "benefits_html": "<ul><li>Thu nhập cạnh tranh</li></ul>",
    }


def test_job_slug_is_generated_from_vietnamese_title():
    assert make_job_slug("Chuyên viên Đầu tư") == "chuyen-vien-dau-tu"
    assert JobPayload(title="Chuyên viên Đầu tư").slug == ""


def test_complete_job_matches_public_detail_contract():
    assert publication_issues(complete_job()) == []


def test_publish_gate_rejects_empty_public_sections():
    fields = {issue["field"] for issue in publication_issues(JobPayload(title="Marketing").model_dump())}
    assert {"department", "location", "short_description", "description_html", "requirements_html", "benefits_html"} <= fields


def test_openapi_exposes_create_update_and_transition_routes():
    paths = app.openapi()["paths"]
    assert "post" in paths["/api/protected/website/recruitment"]
    assert "put" in paths["/api/protected/website/recruitment/{job_id}"]
    assert "post" in paths["/api/protected/website/recruitment/{job_id}/transition"]


def test_public_expiry_is_resolved_by_backend_and_bad_dates_are_safe() -> None:
    now = datetime.now(timezone.utc)
    assert public_job_is_expired({"status": "PUBLISHED", "deadline": now - timedelta(days=1)})
    assert not public_job_is_expired({"status": "PUBLISHED", "deadline": "not-a-date"})
    assert public_job_is_expired({"status": "CLOSED"})
