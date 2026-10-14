from fastapi import HTTPException


ALLOWED_TRANSITIONS = {

    "publish": {"DRAFT", "IN_REVIEW", "UNPUBLISHED"},
    "unpublish": {"DRAFT", "IN_REVIEW", "PUBLISHED"},
    "archive": {"DRAFT", "IN_REVIEW", "PUBLISHED", "UNPUBLISHED"},
    "rollback": {"DRAFT", "IN_REVIEW", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"},
}


def transition_allowed(status: str, action: str) -> bool:
    return status in ALLOWED_TRANSITIONS.get(action, set())


def actor_id(actor: dict) -> str:
    return str(actor.get("account_id") or actor.get("id") or "")


def ensure_permission(actor: dict, permission: str) -> None:
    granted = set(actor.get("permissions") or [])
    if "*" not in granted and permission not in granted:
        raise HTTPException(status_code=403, detail={
            "code": "PERMISSION_DENIED",
            "message": "Tai khoan khong co quyen thuc hien thao tac nay.",
            "required_permissions": [permission],
        })


def publication_issues(draft: dict) -> list[dict]:
    issues: list[dict] = []
    required = {
        "full_name": "Can nhap ho ten.",
        "slug": "Can nhap slug.",
        "position": "Can nhap chuc vu.",
        "headline": "Can nhap tieu de gioi thieu.",
        "short_bio": "Can nhap mo ta ngan.",
        "about": "Can nhap noi dung Ve toi.",
        "avatar_media_id": "Can tai anh chan dung cho ho so.",
        "avatar_alt_text": "Can nhap mo ta Alt cho anh chan dung.",
        "seo_title": "Can nhap SEO title.",
        "seo_description": "Can nhap SEO description.",
    }
    for field, message in required.items():
        if not str(draft.get(field) or "").strip():
            issues.append({"code": "FIELD_REQUIRED", "field": field, "message": message})
    if int(draft.get("years_experience") or 0) <= 0:
        issues.append({"code": "EXPERIENCE_REQUIRED", "field": "years_experience", "message": "Can nhap so nam kinh nghiem."})
    if not draft.get("specialties"):
        issues.append({"code": "SPECIALTY_REQUIRED", "field": "specialties", "message": "Can it nhat mot chuyen mon."})
    if draft.get("profile_type") == "BROKER" and not draft.get("project_ids"):
        issues.append({"code": "PROJECT_REQUIRED", "field": "project_ids", "message": "Nha moi gioi can it nhat mot du an."})
    if not draft.get("consent_confirmed"):
        issues.append({"code": "CONSENT_REQUIRED", "field": "consent_confirmed", "message": "Can xac nhan quyen cong khai noi dung va hinh anh."})
    if draft.get("avatar_alt_text") and len(str(draft["avatar_alt_text"]).strip()) < 10:
        issues.append({"code": "AVATAR_ALT_LENGTH", "field": "avatar_alt_text", "message": "Alt text anh chan dung can it nhat 10 ky tu."})
    seo_title = str(draft.get("seo_title") or "")
    seo_description = str(draft.get("seo_description") or "")
    if seo_title and not 30 <= len(seo_title) <= 60:
        issues.append({"code": "SEO_TITLE_LENGTH", "field": "seo_title", "message": "SEO title can tu 30 den 60 ky tu."})
    if seo_description and not 120 <= len(seo_description) <= 160:
        issues.append({"code": "SEO_DESCRIPTION_LENGTH", "field": "seo_description", "message": "SEO description can tu 120 den 160 ky tu."})
    return issues
