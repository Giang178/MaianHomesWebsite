import base64
import json
import secrets
import string
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException

from app.core.config import settings
from app.db.mongodb import get_database
from app.modules.identity.service import identity_service
from app.modules.identity.accounts.service import account_service

def session_kwargs(session) -> dict:
    return {"session": session} if session is not None else {}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_temporary_password(length: int = 16, policy: dict | None = None) -> str:
    length = max(length, int((policy or {}).get("password_min_length", 8)))
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*_-+="
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(char.isupper() for char in value) and any(char.islower() for char in value)
                and any(char.isdigit() for char in value) and any(not char.isalnum() for char in value)):
            return value


def _decode_aes_key(raw: str) -> bytes:
    if not raw:
        raise RuntimeError("Yêu cầu có CREDENTIAL_ENCRYPTION_KEY")
    try:
        key = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
    except Exception as exc:
        raise RuntimeError("CREDENTIAL_ENCRYPTION_KEY phải là chuỗi base64 an toàn cho URL") from exc
    if len(key) != 32:
        raise RuntimeError("CREDENTIAL_ENCRYPTION_KEY phải được giải mã thành 32 byte")
    return key


def _aes_key(version: int | None = None) -> bytes:
    requested = int(version or settings.CREDENTIAL_ENCRYPTION_KEY_VERSION)
    if requested == settings.CREDENTIAL_ENCRYPTION_KEY_VERSION:
        return _decode_aes_key(settings.CREDENTIAL_ENCRYPTION_KEY.strip())
    try:
        previous = json.loads(settings.CREDENTIAL_DECRYPTION_KEYS or "{}")
        encoded = str(previous[str(requested)])
    except (ValueError, TypeError, KeyError) as exc:
        raise RuntimeError(f"Credential encryption key version {requested} is unavailable") from exc
    return _decode_aes_key(encoded)


def encrypt_payload(payload: dict) -> tuple[str, str]:
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError as exc:
        raise RuntimeError("Yêu cầu thư viện cryptography để gửi thông tin đăng nhập") from exc
    nonce = secrets.token_bytes(12)
    version = settings.CREDENTIAL_ENCRYPTION_KEY_VERSION
    aad = f"hr-credential-v{version}".encode("ascii")
    encrypted = AESGCM(_aes_key(version)).encrypt(nonce, json.dumps(payload).encode("utf-8"), aad)
    return base64.urlsafe_b64encode(nonce).decode(), base64.urlsafe_b64encode(encrypted).decode()


def decrypt_payload(document: dict) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = base64.urlsafe_b64decode(document["nonce"])
    encrypted = base64.urlsafe_b64decode(document["ciphertext"])
    version = int(document.get("key_version") or 1)
    aad = f"hr-credential-v{version}".encode("ascii")
    plain = AESGCM(_aes_key(version)).decrypt(nonce, encrypted, aad)
    return json.loads(plain.decode("utf-8"))


class CredentialService:
    @property
    def db(self):
        return get_database()

    async def ensure_recipient_enabled(self, email: str, *, reset: bool = False) -> None:
        enabled = settings.PASSWORD_RESET_ENABLED if reset else settings.ACCOUNT_CREDENTIAL_DELIVERY_ENABLED
        if not enabled:
            code = "PASSWORD_RESET_DISABLED" if reset else "ACCOUNT_CREDENTIAL_DELIVERY_DISABLED"
            message = (
                "Chức năng gửi link đặt lại mật khẩu chưa được bật."
                if reset
                else "Chức năng gửi thông tin đăng nhập chưa được bật."
            )
            raise HTTPException(status_code=503, detail={
                "code": code,
                "message": message,
            })
        if not reset:
            from app.modules.system.settings.service import system_settings_service
            await system_settings_service.smtp_config(require_verified=True)
        canary = settings.credential_canary_emails
        if canary and email.strip().casefold() not in canary:
            raise HTTPException(status_code=503, detail={
                "code": "CREDENTIAL_CANARY_RESTRICTED",
                "message": "Account is outside the credential canary",
            })

    async def activate_with_temporary_password(self, account: dict, *, event_type: str,
                                               session=None, expected_version: int | None = None) -> dict:
        await self.ensure_recipient_enabled(str(account.get("email") or ""))
        policy = await identity_service.get_policy()
        password = generate_temporary_password(policy=policy)
        access_url = await identity_service.configured_access_url(event_type)
        now = utcnow()
        expires_at = now + timedelta(hours=int(policy.get("temporary_password_hours", 24)))
        await self.db["hr_credential_deliveries"].update_many(
            {"account_id": str(account["_id"]), "status": {"$in": ["PENDING", "PROCESSING"]}},
            {"$set": {"status": "REVOKED", "updated_at": now},
             "$unset": {"nonce": "", "ciphertext": ""}}, **session_kwargs(session),
        )
        query = {"_id": account["_id"]}
        if expected_version is not None:
            query["version"] = expected_version
        update = await self.db["user_accounts"].find_one_and_update(
            query,
            {"$set": {"password_hash": await account_service.hash_password_async(password), "is_active": True,
                      "account_status": "ACTIVE", "must_change_password": True,
                      "temporary_password_expires_at": expires_at,
                      "credential_delivery_status": "PENDING", "updated_at": now},
             "$inc": {"version": 1, "token_version": 1}},
            return_document=True, **session_kwargs(session),
        )
        if not update:
            raise HTTPException(status_code=409, detail="Tài khoản đã thay đổi; vui lòng tải lại và thử lại")
        name = (account.get("full_name") or str(account.get("email", "")).split("@")[0]).strip()
        nonce, ciphertext = encrypt_payload({
            "employee_name": name, "email": account["email"], "temporary_password": password,
            "expires_hours": int(policy.get("temporary_password_hours", 24)),
            "login_url": access_url or "",
        })
        delivery_id = uuid4().hex
        await self.db["hr_credential_deliveries"].insert_one({
            "_id": delivery_id, "version": 1, "account_id": str(account["_id"]), "employee_id": account.get("employee_id"),
            "email": account["email"], "event_type": event_type, "nonce": nonce, "ciphertext": ciphertext,
            "key_version": settings.CREDENTIAL_ENCRYPTION_KEY_VERSION,
            "status": "PENDING", "attempts": 0, "available_at": now,
            "secret_expires_at": expires_at, "created_at": now, "updated_at": now,
        }, **session_kwargs(session))
        return update

    async def queue_reset_link(self, account: dict, token: str, expires_at: datetime,
                               *, session=None) -> str:
        await self.ensure_recipient_enabled(str(account.get("email") or ""), reset=True)
        policy = await identity_service.get_policy()
        reset_url = await identity_service.configured_access_url("PASSWORD_RESET", token=token)
        nonce, ciphertext = encrypt_payload({
            "email": account["email"], "reset_url": reset_url,
            "expires_minutes": int(policy.get("reset_link_minutes", 15)),
        })
        now = utcnow()
        delivery_id = uuid4().hex
        await self.db["hr_credential_deliveries"].insert_one({
            "_id": delivery_id, "version": 1, "account_id": str(account["_id"]), "employee_id": account.get("employee_id"),
            "email": account["email"], "event_type": "PASSWORD_RESET", "nonce": nonce,
            "ciphertext": ciphertext, "key_version": settings.CREDENTIAL_ENCRYPTION_KEY_VERSION,
            "status": "PENDING", "attempts": 0,
            "available_at": now, "secret_expires_at": expires_at, "created_at": now, "updated_at": now,
        }, **session_kwargs(session))
        return delivery_id


credential_service = CredentialService()
