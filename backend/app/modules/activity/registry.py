from __future__ import annotations

import re

MODULE_LABELS = {
    "AUTH": "XÃ¡c thá»±c",
    "MARKETING": "Marketing",
    "PUBLIC": "KÃªnh cÃ´ng khai",
    "SYSTEM": "Há»‡ thá»‘ng",
}

CATEGORY_LABELS = {
    "AUTH": "XÃ¡c thá»±c",
    "SECURITY": "Báº£o máº­t",
    "DATA_CHANGE": "Thay Ä‘á»•i dá»¯ liá»‡u",
    "DATA_ACCESS": "Truy cáº­p dá»¯ liá»‡u",
    "BUSINESS": "Nghiá»‡p vá»¥",
    "ADMIN": "Quáº£n trá»‹",
    "SYSTEM": "Há»‡ thá»‘ng",
    "AUDIT": "Kiá»ƒm toÃ¡n",
    "REVISION": "PhiÃªn báº£n",
    "BUSINESS_ACTIVITY": "Hoáº¡t Ä‘á»™ng nghiá»‡p vá»¥",
}

RESULT_LABELS = {
    "SUCCESS": "ThÃ nh cÃ´ng",
    "FAILURE": "Tháº¥t báº¡i",
    "DENIED": "Bá»‹ tá»« chá»‘i",
}

SEVERITY_LABELS = {
    "INFO": "ThÃ´ng tin",
    "NOTICE": "ÄÃ¡ng chÃº Ã½",
    "WARNING": "Cáº£nh bÃ¡o",
    "CRITICAL": "NghiÃªm trá»ng",
}

EVENT_LABELS = {
    "LOGIN_SUCCESS": "ÄÄƒng nháº­p thÃ nh cÃ´ng",
    "LOGIN_FAILED": "ÄÄƒng nháº­p tháº¥t báº¡i",
    "LOGOUT": "ÄÄƒng xuáº¥t",
    "CREATE": "Táº¡o má»›i",
    "UPDATE": "Cáº­p nháº­t",
    "DELETE": "XÃ³a",
    "DOWNLOAD": "Táº£i dá»¯ liá»‡u",
    "DATA_EXPORTED": "Xuáº¥t dá»¯ liá»‡u",
    "ACTIVITY_LOGS_EXPORTED": "Xuáº¥t nháº­t kÃ½ hoáº¡t Ä‘á»™ng",
    "LOGS_PURGE_REQUESTED": "YÃªu cáº§u xÃ³a nháº­t kÃ½ cÅ©",
    "LOGS_PURGED": "ÄÃ£ xÃ³a nháº­t kÃ½ cÅ©",
    "LOGS_PURGE_FAILED": "XÃ³a nháº­t kÃ½ cÅ© tháº¥t báº¡i",
    "ROLE_CHANGED": "Thay Ä‘á»•i vai trÃ²",
    "STATUS_CHANGED": "Thay Ä‘á»•i tráº¡ng thÃ¡i",
    "SESSION_REVOKED": "Thu há»“i phiÃªn",
    "ALL_SESSIONS_REVOKED": "Thu há»“i toÃ n bá»™ phiÃªn",
    "SESSIONS_REVOKED": "Thu há»“i cÃ¡c phiÃªn",
    "PASSWORD_CHANGE_REQUIRED": "YÃªu cáº§u Ä‘á»•i máº­t kháº©u",
    "PASSWORD_RESET_REQUESTED": "YÃªu cáº§u Ä‘áº·t láº¡i máº­t kháº©u",
    "PASSWORD_RESET_COMPLETED": "HoÃ n táº¥t Ä‘áº·t láº¡i máº­t kháº©u",
    "FIRST_LOGIN_PASSWORD_CHANGED": "Äá»•i máº­t kháº©u láº§n Ä‘áº§u",
    "ACCOUNT_CREATED": "Táº¡o tÃ i khoáº£n",
    "ACCOUNT_SECURITY_LOCKED": "KhÃ³a báº£o máº­t",
    "ACCOUNT_DISABLED": "VÃ´ hiá»‡u hÃ³a tÃ i khoáº£n",
    "ACCOUNT_RESTORED": "KhÃ´i phá»¥c tÃ i khoáº£n",
    "IDENTITY_POLICY_UPDATED": "Cáº­p nháº­t chÃ­nh sÃ¡ch Ä‘á»‹nh danh",
    "IDENTITY_EMAIL_TEMPLATE_UPDATED": "Cáº­p nháº­t máº«u email Ä‘á»‹nh danh",
    "IDENTITY_EMAIL_TEMPLATE_TEST_SENT": "Gá»­i thá»­ email Ä‘á»‹nh danh",
    "IDENTITY_EMAIL_TEMPLATE_TEST_FAILED": "Gá»­i thá»­ email Ä‘á»‹nh danh tháº¥t báº¡i",
    "EMAIL_SETTINGS_UPDATED": "Cáº­p nháº­t email há»‡ thá»‘ng",
    "EMAIL_TEST_SENT": "Gá»­i thá»­ email há»‡ thá»‘ng",
    "EMAIL_TEST_FAILED": "Gá»­i thá»­ email há»‡ thá»‘ng tháº¥t báº¡i",
    "SYSTEM_HEALTH_CHECK_RUN": "Kiá»ƒm tra sá»©c khá»e há»‡ thá»‘ng",
    "API_MUTATION": "Thao tÃ¡c thay Ä‘á»•i qua API",
}

EVENT_TYPE_ALIASES = {
    "DOWNLOADED": "DOWNLOAD",
    "FAILED_LOGIN": "LOGIN_FAILED",
}

RESULT_ALIASES = {
    "FAILED": "FAILURE",
    "ERROR": "FAILURE",
    "FORBIDDEN": "DENIED",
}

_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{1,79}$")


def normalize_code(value: str, *, field: str) -> str:
    code = str(value or "").strip().upper().replace("-", "_").replace(" ", "_")
    if not _CODE_PATTERN.fullmatch(code):
        raise ValueError(f"{field} must be an uppercase registry code")
    return code


def normalize_event_type(value: str) -> str:
    code = normalize_code(value, field="event_type")
    return EVENT_TYPE_ALIASES.get(code, code)


def normalize_result(value: str) -> str:
    code = normalize_code(value or "SUCCESS", field="result")
    code = RESULT_ALIASES.get(code, code)
    if code not in RESULT_LABELS:
        raise ValueError("result is not registered")
    return code


def normalize_category(value: str) -> str:
    code = normalize_code(value or "BUSINESS", field="category")
    if code not in CATEGORY_LABELS:
        raise ValueError("category is not registered")
    return code


def normalize_module(value: str) -> str:
    code = normalize_code(value, field="module")
    if code not in MODULE_LABELS:
        # Modules are an extensible registry because deployments can add domains.
        MODULE_LABELS[code] = code
    return code


def infer_severity(event_type: str, result: str) -> str:
    if event_type in {"LOGS_PURGED", "ACCOUNT_SECURITY_LOCKED", "ACCOUNT_DISABLED", "DELETE"}:
        return "CRITICAL"
    if result in {"FAILURE", "DENIED"} or event_type in {"LOGIN_FAILED", "LOGS_PURGE_FAILED"}:
        return "WARNING"
    if event_type in {"ROLE_CHANGED", "DATA_EXPORTED", "ACTIVITY_LOGS_EXPORTED"}:
        return "NOTICE"
    return "INFO"


def registry_metadata(event_types: list[str] | None = None) -> dict:
    all_event_types = sorted(set(EVENT_LABELS) | set(event_types or []))
    return {
        "modules": [{"value": key, "label": value} for key, value in sorted(MODULE_LABELS.items())],
        "categories": [{"value": key, "label": value} for key, value in sorted(CATEGORY_LABELS.items())],
        "results": [{"value": key, "label": value} for key, value in RESULT_LABELS.items()],
        "severities": [{"value": key, "label": value} for key, value in SEVERITY_LABELS.items()],
        "event_types": [
            {"value": key, "label": EVENT_LABELS.get(key, "HÃ nh Ä‘á»™ng chÆ°a phÃ¢n loáº¡i")}
            for key in all_event_types
        ],
    }