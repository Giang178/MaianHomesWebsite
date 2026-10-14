from __future__ import annotations

import base64
import re
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from pymongo import ReturnDocument

from app.core.config import settings
from app.db.mongodb import get_database
from app.modules.activity.service import record_activity
from app.modules.identity.templates import (
    sanitize_template as sanitize_identity_template,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_placeholder_smtp_credential(value: str) -> bool:
    normalized = (value or "").strip().casefold()
    return normalized.startswith(("your-smtp-", "replace-smtp-"))


def _key() -> bytes:
    raw = settings.CREDENTIAL_ENCRYPTION_KEY.strip()
    if not raw:
        raise HTTPException(status_code=503, detail={"code": "EMAIL_ENCRYPTION_KEY_MISSING"})
    try:
        value = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"code": "EMAIL_ENCRYPTION_KEY_INVALID"}) from exc
    if len(value) != 32:
        raise HTTPException(status_code=503, detail={"code": "EMAIL_ENCRYPTION_KEY_INVALID"})
    return value


def encrypt_password(password: str) -> tuple[str, str]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = secrets.token_bytes(12)
    encrypted = AESGCM(_key()).encrypt(nonce, password.encode(), b"it-email-settings")
    return base64.urlsafe_b64encode(nonce).decode(), base64.urlsafe_b64encode(encrypted).decode()


def decrypt_password(document: dict) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return AESGCM(_key()).decrypt(
        base64.urlsafe_b64decode(document["password_nonce"]),
        base64.urlsafe_b64decode(document["password_ciphertext"]),
        b"it-email-settings",
    ).decode()


def public_email(document: dict | None) -> dict:
    document = document or {}
    return {
        "host": document.get("host", "smtp.gmail.com"),
        "port": int(document.get("port", 587)),
        "username": document.get("username", ""),
        "from_name": document.get("from_name", "Maian Homes"),
        "from_email": document.get("from_email", document.get("username", "")),
        "start_tls": bool(document.get("start_tls", True)),
        "password_configured": bool(document.get("password_ciphertext")),
        "verified_at": document.get("verified_at").isoformat() if document.get("verified_at") else None,
        "version": int(document.get("version", 1)),
        "updated_at": document.get("updated_at").isoformat() if document.get("updated_at") else None,
    }


def contact_settings_view(document: dict | None) -> dict:
    document = document or {}
    return {
        "phone": document.get("phone"),
        "zalo_url": document.get("zalo_url"),
        "messenger_url": document.get("messenger_url"),
        "email": document.get("email"),
        "version": int(document.get("version", 1)),
        "updated_at": document.get("updated_at").isoformat() if document.get("updated_at") else None,
    }


def public_contact_settings(document: dict | None) -> dict:
    document = document or {}
    phone = document.get("phone") or None
    email = document.get("email") or None
    phone_digits = re.sub(r"\D", "", phone) if phone else None
    zalo_url = document.get("zalo_url") or (f"https://zalo.me/{phone_digits}" if phone_digits else None)
    return {
        "phone": phone,
        "phone_href": f"tel:{phone}" if phone else None,
        "zalo_url": zalo_url,
        "messenger_url": document.get("messenger_url") or None,
        "email": email,
        "email_href": f"mailto:{email}" if email else None,
    }


def sanitize_template(subject: str, body: str) -> tuple[str, str]:
    return sanitize_identity_template("ACCOUNT_CREATED", subject, body)


class SystemSettingsService:
    @property
    def collection(self):
        return get_database()["system_settings"]

    async def email_document(self) -> dict | None:
        return await self.collection.find_one({"_id": "company_email"})

    async def email(self) -> dict:
        return public_email(await self.email_document())

    async def contact_document(self) -> dict | None:
        return await self.collection.find_one({"_id": "website_contact"})

    async def contact(self) -> dict:
        return contact_settings_view(await self.contact_document())

    async def public_contact(self) -> dict:
        return public_contact_settings(await self.contact_document())

    def _environment_smtp_config(self) -> dict | None:
        if not (settings.SMTP_USER and settings.SMTP_PASSWORD) or any(
            _is_placeholder_smtp_credential(value)
            for value in (settings.SMTP_USER, settings.SMTP_PASSWORD)
        ):
            return None
        return {
            "host": settings.SMTP_HOST,
            "port": settings.SMTP_PORT,
            "username": settings.SMTP_USER,
            "password": settings.SMTP_PASSWORD,
            "from_name": settings.SMTP_FROM_NAME,
            "from_email": settings.SMTP_FROM_EMAIL or settings.SMTP_USER,
            "start_tls": settings.SMTP_START_TLS,
            "source": "environment",
        }

    async def smtp_config(self, *, require_verified: bool = False) -> dict:
        document = await self.email_document()
        if document and document.get("password_ciphertext"):
            if require_verified and not document.get("verified_at"):
                raise HTTPException(status_code=503, detail={
                    "code": "COMPANY_EMAIL_NOT_VERIFIED",
                    "message": "Gmail công ty chưa được kiểm tra thành công.",
                })
            return {
                **public_email(document),
                "password": decrypt_password(document),
                "source": "database",
            }
        environment = self._environment_smtp_config()
        if environment:
            if require_verified:
                raise HTTPException(status_code=503, detail={
                    "code": "COMPANY_EMAIL_NOT_VERIFIED",
                    "message": "Cấu hình SMTP từ môi trường chưa được xác minh.",
                })
            return environment
        raise HTTPException(status_code=503, detail={
            "code": "COMPANY_EMAIL_NOT_CONFIGURED",
            "message": "Chưa cấu hình email hệ thống để gửi tài khoản.",
        })

    async def smtp_available(self) -> bool:
        try:
            await self.smtp_config()
            return True
        except HTTPException:
            return False

    async def update_email(self, payload: dict, actor: dict) -> dict:
        payload = dict(payload)
        expected_version = int(payload.pop("expected_version"))
        reason = str(payload.pop("reason")).strip()
        password = str(payload.pop("app_password", "") or "").replace(" ", "")
        changes = {
            "host": str(payload.get("host") or "smtp.gmail.com").strip(),
            "port": int(payload.get("port") or 587),
            "username": str(payload.get("username") or "").strip().lower(),
            "from_name": str(payload.get("from_name") or "Maian Homes").strip(),
            "from_email": str(payload.get("from_email") or payload.get("username") or "").strip().lower(),
            "start_tls": bool(payload.get("start_tls", True)),
            "updated_at": utcnow(),
            "updated_by": actor.get("email"),
            "verified_at": None,
        }
        if not changes["username"] or "@" not in changes["username"]:
            raise HTTPException(status_code=422, detail={"code": "INVALID_SMTP_USERNAME"})
        if password:
            nonce, ciphertext = encrypt_password(password)
            changes.update({"password_nonce": nonce, "password_ciphertext": ciphertext})
        existing = await self.email_document()
        if not existing and expected_version != 1:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        if not existing and not password:
            raise HTTPException(status_code=422, detail={"code": "APP_PASSWORD_REQUIRED"})
        updated = await self.collection.find_one_and_update(
            {"_id": "company_email", **({"version": expected_version} if existing else {})},
            {
                "$set": changes,
                "$inc": {"version": 1},
                "$setOnInsert": {"created_at": utcnow()},
            },
            upsert=not bool(existing),
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        await record_activity(
            "EMAIL_SETTINGS_UPDATED", actor=actor, target_type="SYSTEM_SETTINGS",
            target_id="company_email",
            metadata={
                "fields": sorted(key for key in changes if "password" not in key),
                "reason": reason,
            },
        )
        return public_email(updated)

    async def update_contact(self, payload: dict, actor: dict) -> dict:
        payload = dict(payload)
        expected_version = int(payload.pop("expected_version"))
        reason = str(payload.pop("reason")).strip()
        changes = {
            "phone": payload.get("phone") or None,
            "zalo_url": payload.get("zalo_url") or None,
            "messenger_url": payload.get("messenger_url") or None,
            "email": payload.get("email") or None,
            "updated_at": utcnow(),
            "updated_by": actor.get("email"),
        }
        existing = await self.contact_document()
        changed_fields = sorted(
            field
            for field in ("phone", "zalo_url", "messenger_url", "email")
            if (existing or {}).get(field) != changes[field]
        )
        if not existing and expected_version != 1:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        updated = await self.collection.find_one_and_update(
            {"_id": "website_contact", **({"version": expected_version} if existing else {})},
            {
                "$set": changes,
                "$inc": {"version": 1},
                "$setOnInsert": {"created_at": utcnow()},
            },
            upsert=not bool(existing),
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        await record_activity(
            "PUBLIC_CONTACT_SETTINGS_UPDATED",
            actor=actor,
            target_type="SYSTEM_SETTINGS",
            target_id="website_contact",
            metadata={
                "fields": changed_fields,
                "reason": reason,
            },
        )
        from app.modules.content.assistant.knowledge_service import invalidate_chat_knowledge_cache
        await invalidate_chat_knowledge_cache()
        return contact_settings_view(updated)

    async def mark_verified(self, expected_version: int) -> dict:
        updated = await self.collection.find_one_and_update(
            {"_id": "company_email", "version": expected_version},
            {"$set": {"verified_at": utcnow()}, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        return public_email(updated)


system_settings_service = SystemSettingsService()
