from app.main import app
from app.modules.website.team.policies import publication_issues, transition_allowed
from app.modules.website.team.schemas import TeamProfilePayload
from app.modules.website.team.service import make_slug


def complete_payload() -> dict:
    return {
        "slug": "nguyen-an",
        "profile_type": "SPECIALIST",
        "full_name": "Nguyen An",
        "position": "Chuyen gia",
        "avatar_media_id": "seed-team-avatar",
        "avatar_alt_text": "Anh chan dung chuyen gia Nguyen An",
        "years_experience": 5,
        "headline": "Chuyen gia tu van bat dong san cao cap",
        "short_bio": "Dong hanh minh bach cung khach hang.",
        "about": "Kinh nghiem tu van va phan tich thi truong.",
        "specialties": [{"title": "Tu van dau tu", "description": "Phan tich hieu qua."}],
        "seo_title": "Nguyen An - Chuyen gia bat dong san",
        "seo_description": "Chuyen gia Nguyen An dong hanh cung khach hang trong cac quyet dinh bat dong san minh bach va hieu qua tren thi truong Viet Nam.",
        "consent_confirmed": True,
    }


def test_slug_is_generated_from_vietnamese_full_name():
    assert make_slug("Mai \u0110\u1ed7 Minh") == "mai-do-minh"
    assert TeamProfilePayload(full_name="Mai Ã„ÂÃ¡Â»â€” Minh").slug == ""


def test_team_profile_schema_supplies_safe_public_defaults():
    payload = TeamProfilePayload(**complete_payload()).model_dump()
    assert payload["specialties"][0]["title"] == "Tu van dau tu"
    assert payload["achievements"] == []
    assert payload["project_ids"] == []
    assert payload["satisfaction_rate"] == 0


def test_publish_gate_accepts_complete_specialist():
    assert publication_issues(complete_payload()) == []


def test_publish_gate_rejects_incomplete_profile():
    issues = publication_issues(TeamProfilePayload(slug="nguyen-an", full_name="Nguyen An").model_dump())
    fields = {item["field"] for item in issues}
    assert {"position", "headline", "short_bio", "about", "avatar_media_id", "avatar_alt_text", "years_experience", "specialties", "seo_title", "seo_description", "consent_confirmed"} <= fields


def test_status_transitions_publish_directly_without_approval_workflow():
    assert transition_allowed("DRAFT", "submit") is False
    assert transition_allowed("DRAFT", "publish") is True
    assert transition_allowed("IN_REVIEW", "publish") is True
    assert transition_allowed("PUBLISHED", "publish") is False
    assert transition_allowed("DRAFT", "unpublish") is True
    assert transition_allowed("ARCHIVED", "archive") is False



def test_openapi_exposes_complete_staff_management_contract():
    paths = app.openapi()["paths"]
    assert "/api/protected/website/staff/options" in paths
    assert "/api/protected/website/staff/avatar" in paths
    assert "/api/protected/website/staff/{profile_id}/preview" in paths
    assert "/api/protected/website/staff/{profile_id}/versions" in paths
    assert "/api/protected/website/staff/{profile_id}/transition" in paths
    assert "delete" in paths["/api/protected/website/staff/{profile_id}"]