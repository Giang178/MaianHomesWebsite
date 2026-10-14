from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import HTTPException

DEFAULT_TEMPLATES: dict[str, tuple[str, str]] = {
    "ACCOUNT_CREATED": (
        "Thông tin tài khoản Maian Homes",
        "<p>Xin chào {{employee_name}},</p>"
        "<p>Email đăng nhập: <strong>{{email}}</strong></p>"
        "<p>Mật khẩu tạm: <strong>{{temporary_password}}</strong></p>"
        "<p>Hết hạn sau {{expires_hours}} giờ. "
        '<a href="{{login_url}}">Đăng nhập và đổi mật khẩu</a>.</p>',
    ),
    "ACCOUNT_APPROVED": (
        "Tài khoản đã được duyệt",
        "<p>Tài khoản {{email}} đã được duyệt.</p>"
        "<p>Mật khẩu tạm: <strong>{{temporary_password}}</strong></p>"
        '<p><a href="{{login_url}}">Đăng nhập và đổi mật khẩu</a></p>',
    ),
    "PASSWORD_RESET": (
        "Đặt lại mật khẩu Maian Homes",
        "<p>Liên kết hết hạn sau {{expires_minutes}} phút.</p>"
        '<p><a href="{{reset_url}}">Đặt lại mật khẩu</a></p>',
    ),
    "ACCOUNT_EMAIL_CHANGED": (
        "Email đăng nhập đã thay đổi",
        "<p>Email đăng nhập đã đổi từ {{old_email}} thành {{new_email}}.</p>",
    ),
    "PASSWORD_CHANGED": (
        "Mật khẩu đã thay đổi",
        "<p>Mật khẩu của tài khoản {{email}} vừa được thay đổi.</p>",
    ),
    "ACCOUNT_LOCKED": (
        "Tài khoản đã bị khóa",
        "<p>Tài khoản {{email}} đã bị khóa.</p>",
    ),
    "ACCOUNT_UNLOCKED": (
        "Tài khoản đã được mở khóa",
        "<p>Tài khoản {{email}} đã được mở khóa.</p>",
    ),
}

ALLOWED_PLACEHOLDERS: dict[str, frozenset[str]] = {
    "ACCOUNT_CREATED": frozenset({
        "employee_name", "email", "temporary_password", "expires_hours", "login_url",
    }),
    "ACCOUNT_APPROVED": frozenset({
        "employee_name", "email", "temporary_password", "expires_hours", "login_url",
    }),
    "PASSWORD_RESET": frozenset({"email", "reset_url", "expires_minutes"}),
    "ACCOUNT_EMAIL_CHANGED": frozenset({"email", "old_email", "new_email"}),
    "PASSWORD_CHANGED": frozenset({"email"}),
    "ACCOUNT_LOCKED": frozenset({"email"}),
    "ACCOUNT_UNLOCKED": frozenset({"email"}),
}

SAMPLE_VALUES: dict[str, dict[str, object]] = {
    "ACCOUNT_CREATED": {
        "employee_name": "Nhân viên thử nghiệm",
        "email": "employee@example.com",
        "temporary_password": "Example-Only-123!",
        "expires_hours": 24,
    },
    "ACCOUNT_APPROVED": {
        "employee_name": "Nhân viên thử nghiệm",
        "email": "employee@example.com",
        "temporary_password": "Example-Only-123!",
        "expires_hours": 24,
    },
    "PASSWORD_RESET": {
        "email": "employee@example.com",
        "expires_minutes": 15,
    },
    "ACCOUNT_EMAIL_CHANGED": {
        "email": "new-email@example.com",
        "old_email": "old-email@example.com",
        "new_email": "new-email@example.com",
    },
    "PASSWORD_CHANGED": {"email": "employee@example.com"},
    "ACCOUNT_LOCKED": {"email": "employee@example.com"},
    "ACCOUNT_UNLOCKED": {"email": "employee@example.com"},
}

PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")
ALLOWED_TAGS = {
    "p", "br", "strong", "em", "u", "s", "blockquote", "ul", "ol", "li",
    "h2", "h3", "h4", "a", "span", "hr", "code", "pre",
}
VOID_TAGS = {"br", "hr"}
ALLOWED_ATTRIBUTES = {"a": {"href", "title", "target", "rel"}, "span": {"class"}}


ACCESS_URL_PLACEHOLDERS = {
    'ACCOUNT_CREATED': 'login_url',
    'ACCOUNT_APPROVED': 'login_url',
    'PASSWORD_RESET': 'reset_url',
}


def _safe_url(value: str) -> bool:
    if value.startswith(("/", "#")):
        return True
    return urlparse(value).scheme in {"http", "https", "mailto", "tel"}


def normalize_access_url(value: str | None) -> str | None:
    normalized = (value or '').strip()
    if not normalized:
        return None
    parsed = urlparse(normalized)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_EMAIL_ACCESS_URL'})
    return normalized


def access_url_with_token(value: str, token: str) -> str:
    parsed = urlparse(value)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query['token'] = token
    return urlunparse(parsed._replace(query=urlencode(query)))


class _EmailHtmlSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output: list[str] = []
        self.stack: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag not in ALLOWED_TAGS:
            return
        clean_attrs: list[str] = []
        for name, value in attrs:
            name = name.lower()
            if value is None or name not in ALLOWED_ATTRIBUTES.get(tag, set()):
                continue
            if name == "href" and not _safe_url(value):
                continue
            if tag == "a" and name == "target" and value != "_blank":
                continue
            clean_attrs.append(f'{name}="{html.escape(value, quote=True)}"')
        if tag == "a" and any(name == "target" and value == "_blank" for name, value in attrs):
            clean_attrs.append('rel="noopener noreferrer"')
        suffix = (" " + " ".join(clean_attrs)) if clean_attrs else ""
        self.output.append(f"<{tag}{suffix}>")
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in VOID_TAGS or tag not in ALLOWED_TAGS or tag not in self.stack:
            return
        while self.stack:
            current = self.stack.pop()
            self.output.append(f"</{current}>")
            if current == tag:
                break

    def handle_data(self, data: str) -> None:
        self.output.append(html.escape(data))

    def handle_entityref(self, name: str) -> None:
        self.output.append(f"&{name};")

    def close(self) -> None:
        super().close()
        while self.stack:
            self.output.append(f"</{self.stack.pop()}>")


def _sanitize_html(value: str) -> str:
    parser = _EmailHtmlSanitizer()
    parser.feed(value or "")
    parser.close()
    return "".join(parser.output)


def ensure_event_type(event_type: str) -> str:
    normalized = event_type.strip().upper()
    if normalized not in DEFAULT_TEMPLATES:
        raise HTTPException(status_code=404, detail={"code": "IDENTITY_TEMPLATE_NOT_FOUND"})
    return normalized


def sanitize_template(event_type: str, subject: str, body: str) -> tuple[str, str]:
    event_type = ensure_event_type(event_type)
    allowed = ALLOWED_PLACEHOLDERS[event_type]
    unsupported = set(PLACEHOLDER_PATTERN.findall(subject + body)) - allowed
    if unsupported:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNSUPPORTED_EMAIL_PLACEHOLDER",
                "placeholders": sorted(unsupported),
            },
        )
    clean_subject = subject.strip()
    if any(char in clean_subject for char in ("\r", "\n")):
        raise HTTPException(status_code=422, detail={"code": "UNSAFE_EMAIL_SUBJECT"})
    markers: dict[str, str] = {}
    prepared = body
    for key in allowed:
        if not key.endswith("_url"):
            continue
        marker = f"https://template.invalid/__{key.upper()}__"
        markers[marker] = f"{{{{{key}}}}}"
        prepared = re.sub(r"\{\{\s*" + re.escape(key) + r"\s*\}\}", marker, prepared)
    clean_body = _sanitize_html(prepared)
    for marker, placeholder in markers.items():
        clean_body = clean_body.replace(marker, placeholder)
    if not clean_subject:
        raise HTTPException(status_code=422, detail={"code": "EMPTY_EMAIL_SUBJECT"})
    if not clean_body.strip():
        raise HTTPException(status_code=422, detail={"code": "EMPTY_EMAIL_TEMPLATE"})
    return clean_subject, clean_body


def render_template(event_type: str, template: dict, values: dict) -> tuple[str, str]:
    event_type = ensure_event_type(event_type)
    default_subject, default_body = DEFAULT_TEMPLATES[event_type]
    subject, body = sanitize_template(
        event_type,
        str(template.get("subject") or default_subject),
        str(template.get("html_body") or default_body),
    )
    for key in ALLOWED_PLACEHOLDERS[event_type]:
        value = html.escape(str(values.get(key, "")), quote=True)
        pattern = r"\{\{\s*" + re.escape(key) + r"\s*\}\}"
        subject = re.sub(pattern, value, subject)
        body = re.sub(pattern, value, body)
    subject = subject.replace("\r", " ").replace("\n", " ")
    return subject, body


def sample_values(event_type: str, recipient: str) -> dict:
    event_type = ensure_event_type(event_type)
    return {**SAMPLE_VALUES[event_type], "email": recipient}
