from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from pymongo import ReturnDocument

from app.db.mongodb import get_database
from app.modules.identity.templates import (
    ACCESS_URL_PLACEHOLDERS,
    ALLOWED_PLACEHOLDERS,
    DEFAULT_TEMPLATES,
    access_url_with_token,
    ensure_event_type,
    normalize_access_url,
    render_template,
    sanitize_template,
)

POLICY_COLLECTION = "identity_settings"
TEMPLATE_COLLECTION = "identity_email_templates"

DEFAULT_POLICY = {
    "_id": "account_security",
    "password_min_length": 8,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_digit": True,
    "require_special": True,
    "temporary_password_hours": 24,
    "reset_link_minutes": 15,
    "resend_cooldown_seconds": 60,
    "email_retry_limit": 10,
    "version": 1,
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_document(document: dict | None) -> dict | None:
    if document is None:
        return None
    result = dict(document)
    if "_id" in result:
        result["id"] = str(result.pop("_id"))
    for key, value in list(result.items()):
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    return result


class IdentityService:
    @property
    def db(self):
        return get_database()

    @property
    def policy_collection_name(self) -> str:
        return POLICY_COLLECTION

    @property
    def template_collection_name(self) -> str:
        return TEMPLATE_COLLECTION

    @property
    def policy_collection(self):
        return self.db[self.policy_collection_name]

    @property
    def template_collection(self):
        return self.db[self.template_collection_name]

    def ensure_mutations_available(self) -> None:
        return None

    async def seed_defaults(self) -> None:
        now = utcnow()
        await self.policy_collection.update_one(
            {"_id": "account_security"},
            {
                "$setOnInsert": {
                    "temporary_password_hours": DEFAULT_POLICY["temporary_password_hours"],
                    "reset_link_minutes": DEFAULT_POLICY["reset_link_minutes"],
                    "resend_cooldown_seconds": DEFAULT_POLICY["resend_cooldown_seconds"],
                    "email_retry_limit": DEFAULT_POLICY["email_retry_limit"],
                    "version": DEFAULT_POLICY["version"],
                    "created_at": now,
                },
                "$max": {"password_min_length": 8},
                "$set": {
                    "require_uppercase": True,
                    "require_lowercase": True,
                    "require_digit": True,
                    "require_special": True,
                    "updated_at": now,
                },
            },
            upsert=True,
        )
        for event_type, (subject, html_body) in DEFAULT_TEMPLATES.items():
            await self.template_collection.update_one(
                {"event_type": event_type},
                {
                    "$setOnInsert": {
                        "event_type": event_type,
                        "subject": subject,
                        "html_body": html_body,
                        "version": 1,
                        "created_at": now,
                        "updated_at": now,
                    }
                },
                upsert=True,
            )

    async def get_policy(self) -> dict:
        document = await self.policy_collection.find_one({"_id": "account_security"})
        if not document:
            await self.seed_defaults()
            document = await self.policy_collection.find_one({"_id": "account_security"})
        return serialize_document(document) or serialize_document(DEFAULT_POLICY)

    async def update_policy(
        self, *, expected_version: int, changes: dict, updated_by: str | None = None
    ) -> tuple[dict, dict]:
        self.ensure_mutations_available()
        allowed = set(DEFAULT_POLICY) - {"_id", "version"}
        normalized = {
            key: value for key, value in changes.items()
            if key in allowed and value is not None
        }
        if normalized.get("password_min_length", 8) < 8 or any(
            normalized.get(key) is False
            for key in ("require_uppercase", "require_lowercase", "require_digit", "require_special")
        ):
            raise HTTPException(status_code=422, detail={"code": "PASSWORD_POLICY_BASELINE_REQUIRED"})
        if not normalized:
            current = await self.get_policy()
            return current, {}
        current = await self.get_policy()
        updated = await self.policy_collection.find_one_and_update(
            {"_id": "account_security", "version": expected_version},
            {
                "$set": {
                    **normalized,
                    "updated_at": utcnow(),
                    "updated_by": updated_by,
                },
                "$inc": {"version": 1},
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        before = {key: current.get(key) for key in normalized}
        return serialize_document(updated), before

    async def list_templates(self) -> list[dict]:
        await self.seed_defaults()
        documents = await self.template_collection.find(
            {"event_type": {"$in": list(DEFAULT_TEMPLATES)}}
        ).sort("event_type", 1).to_list(length=None)
        result: list[dict] = []
        for document in documents:
            item = serialize_document(document) or {}
            event_type = str(item.get("event_type") or "")
            item["allowed_placeholders"] = sorted(ALLOWED_PLACEHOLDERS.get(event_type, set()))
            item["active"] = event_type != "ACCOUNT_EMAIL_CHANGED"
            result.append(item)
        return result

    async def get_template(self, event_type: str) -> dict:
        event_type = ensure_event_type(event_type)
        document = await self.template_collection.find_one({"event_type": event_type})
        if not document:
            await self.seed_defaults()
            document = await self.template_collection.find_one({"event_type": event_type})
        if not document:
            subject, html_body = DEFAULT_TEMPLATES[event_type]
            document = {
                "event_type": event_type,
                "subject": subject,
                "html_body": html_body,
                "version": 1,
            }
        item = serialize_document(document) or {}
        item["allowed_placeholders"] = sorted(ALLOWED_PLACEHOLDERS[event_type])
        item["active"] = event_type != "ACCOUNT_EMAIL_CHANGED"
        return item

    async def update_template(
        self,
        event_type: str,
        *,
        expected_version: int,
        subject: str,
        html_body: str,
        access_url: str | None = None,
        updated_by: str | None = None,
    ) -> tuple[dict, dict]:
        self.ensure_mutations_available()
        event_type = ensure_event_type(event_type)
        subject, html_body = sanitize_template(event_type, subject, html_body)
        current = await self.get_template(event_type)
        normalized_access_url = normalize_access_url(
            access_url if access_url is not None else current.get("access_url")
        )
        placeholder = ACCESS_URL_PLACEHOLDERS.get(event_type)
        uses_managed_url = bool(
            placeholder and f'{{{{{placeholder}}}}}' in subject + html_body
        )
        if uses_managed_url and not normalized_access_url:
            raise HTTPException(status_code=422, detail={'code': 'EMAIL_ACCESS_URL_REQUIRED'})
        if event_type == 'PASSWORD_RESET' and not uses_managed_url:
            raise HTTPException(
                status_code=422,
                detail={'code': 'RESET_URL_PLACEHOLDER_REQUIRED'},
            )
        updated = await self.template_collection.find_one_and_update(
            {"event_type": event_type, "version": expected_version},
            {
                "$set": {
                    "subject": subject,
                    "html_body": html_body,
                    "access_url": normalized_access_url,
                    "updated_at": utcnow(),
                    "updated_by": updated_by,
                },
                "$inc": {"version": 1},
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        item = serialize_document(updated) or {}
        item["allowed_placeholders"] = sorted(ALLOWED_PLACEHOLDERS[event_type])
        item["active"] = event_type != "ACCOUNT_EMAIL_CHANGED"
        return item, {
            "subject": current.get("subject"),
            "html_body": current.get("html_body"),
            "access_url": current.get("access_url"),
        }

    async def render(self, event_type: str, values: dict) -> tuple[str, str]:
        template = await self.get_template(event_type)
        return render_template(event_type, template, values)

    async def configured_access_url(self, event_type: str, *, token: str | None = None) -> str | None:
        event_type = ensure_event_type(event_type)
        placeholder = ACCESS_URL_PLACEHOLDERS.get(event_type)
        if not placeholder:
            return None
        template = await self.get_template(event_type)
        uses_managed_url = f'{{{{{placeholder}}}}}' in (
            str(template.get('subject') or '') + str(template.get('html_body') or '')
        )
        if not uses_managed_url:
            if event_type == 'PASSWORD_RESET':
                raise HTTPException(
                    status_code=503,
                    detail={'code': 'RESET_URL_PLACEHOLDER_REQUIRED'},
                )
            return None
        access_url = normalize_access_url(template.get('access_url'))
        if not access_url:
            from app.core.config import settings
            fallback_url = (
                settings.ADMIN_RESET_URL
                if event_type == 'PASSWORD_RESET'
                else settings.ADMIN_LOGIN_URL
            )
            access_url = normalize_access_url(fallback_url)
            
        if not access_url:
            raise HTTPException(status_code=503, detail={'code': 'EMAIL_ACCESS_URL_REQUIRED'})
        return access_url_with_token(access_url, token) if token else access_url

identity_service = IdentityService()
