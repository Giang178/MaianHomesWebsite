import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from bson import ObjectId
from fastapi import HTTPException

from app.modules.identity.policies import validate_effective_password
from app.core.config import settings
from app.db.mongodb import get_database
from app.modules.identity.accounts.service import account_service
from app.modules.identity.invitations.secrets import encrypt_secret_payload


def utcnow():
    return datetime.now(timezone.utc)


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def setup_url(token: str) -> str:
    parts = urlsplit(settings.ADMIN_SETUP_URL)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["token"] = token
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


class InvitationService:
    GENERIC_RESET_RESPONSE = "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi."

    async def issue(self, account_id: str, actor: dict) -> dict:
        if not settings.ACCOUNT_CREDENTIAL_DELIVERY_ENABLED:
            raise HTTPException(status_code=503, detail={
                "code": "ACCOUNT_CREDENTIAL_DELIVERY_DISABLED",
                "message": "Chức năng gửi thư cấp tài khoản chưa được bật.",
            })
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
        db = get_database()
        account = await db["user_accounts"].find_one({"_id": ObjectId(account_id)})
        if not account:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
        if account.get("role") == "CEO" or account.get("is_protected"):
            raise HTTPException(status_code=403, detail="Không thể cấp lại tài khoản CEO được bảo vệ")
        if account.get("status") != "PENDING_SETUP":
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "ACCOUNT_NOT_PENDING_SETUP",
                    "message": "Chỉ có thể gửi thư cho hồ sơ đang chờ thiết lập.",
                },
            )
        now = utcnow()
        raw_token = secrets.token_urlsafe(48)
        digest = token_hash(raw_token)
        await db["account_invitations"].update_many(
            {"account_id": account_id, "used_at": None, "revoked_at": None},
            {"$set": {"revoked_at": now, "updated_at": now}},
        )
        await db["account_invitations"].insert_one({
            "account_id": account_id, "email": account.get("email"), "token_hash": digest,
            "expires_at": now + timedelta(hours=48), "used_at": None, "revoked_at": None,
            "created_by": actor.get("account_id") or actor.get("id"), "created_at": now, "updated_at": now,
        })
        expires_at = now + timedelta(hours=48)
        encrypted = encrypt_secret_payload({"setup_url": setup_url(raw_token)})
        await db["outbox_events"].insert_one({
            "event_type": "ACCOUNT_INVITATION", "status": "PENDING", "attempts": 0,
            "available_at": now, "created_at": now, "updated_at": now,
            "secret": encrypted, "secret_expires_at": expires_at,
            "payload": {
                "account_id": account_id, "email": account.get("email"),
                "full_name": account.get("full_name"),
                "expires_hours": 48,
            },
        })
        await db["user_accounts"].update_one(
            {"_id": account["_id"]},
            {"$set": {"status": "PENDING_SETUP", "is_active": False, "invitation_queued_at": now, "updated_at": now}, "$inc": {"token_version": 1}},
        )
        return {"success": True, "status": "PENDING_SETUP", "delivery_queued": True}

    async def complete(self, raw_token: str, password: str) -> dict:
        await validate_effective_password(password)
        db = get_database()
        now = utcnow()
        invitation = await db["account_invitations"].find_one_and_update({
            "token_hash": token_hash(raw_token), "used_at": None, "revoked_at": None,
            "expires_at": {"$gt": now},
        }, {"$set": {"used_at": now, "updated_at": now}}, return_document=True)
        if not invitation:
            raise HTTPException(status_code=400, detail="Link cấp tài khoản không hợp lệ hoặc đã hết hạn")
        account_id = invitation.get("account_id")
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Link cấp tài khoản không hợp lệ")
        password_hash = await account_service.hash_password_async(password)
        account = await db["user_accounts"].find_one_and_update(
            {"_id": ObjectId(account_id), "status": "PENDING_SETUP"},
            {"$set": {"password_hash": password_hash, "status": "ACTIVE", "is_active": True, "activated_at": now, "updated_at": now}, "$inc": {"token_version": 1}},
            return_document=True,
        )
        if not account:
            raise HTTPException(status_code=409, detail="Tài khoản không còn ở trạng thái chờ cấp")
        await db["account_invitations"].update_many({"account_id": account_id, "used_at": None, "revoked_at": None}, {"$set": {"revoked_at": now, "updated_at": now}})
        return {"success": True, "message": "Tài khoản đã được kích hoạt"}

    async def request_reset(self, email: str) -> dict:
        if not settings.PASSWORD_RESET_ENABLED:
            return {"message": self.GENERIC_RESET_RESPONSE}
        db = get_database()
        normalized = email.strip().casefold()
        account = await db["user_accounts"].find_one({
            "normalized_email": normalized, "status": "ACTIVE", "is_active": True,
        })
        if not account:
            return {"message": self.GENERIC_RESET_RESPONSE}
        now = utcnow()
        account_id = str(account["_id"])
        raw_token = secrets.token_urlsafe(48)
        await db["account_invitations"].update_many(
            {"account_id": account_id, "purpose": "PASSWORD_RESET", "used_at": None, "revoked_at": None},
            {"$set": {"revoked_at": now, "updated_at": now}},
        )
        await db["account_invitations"].insert_one({
            "account_id": account_id, "email": account.get("email"), "purpose": "PASSWORD_RESET",
            "token_hash": token_hash(raw_token), "expires_at": now + timedelta(minutes=30),
            "used_at": None, "revoked_at": None, "created_at": now, "updated_at": now,
        })
        parts = urlsplit(settings.ADMIN_RESET_URL)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query["token"] = raw_token
        reset_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
        expires_at = now + timedelta(minutes=30)
        encrypted = encrypt_secret_payload({"setup_url": reset_url})
        await db["outbox_events"].insert_one({
            "event_type": "PASSWORD_RESET", "status": "PENDING", "attempts": 0,
            "available_at": now, "created_at": now, "updated_at": now,
            "secret": encrypted, "secret_expires_at": expires_at,
            "payload": {
                "account_id": account_id, "email": account.get("email"),
                "full_name": account.get("full_name"),
                "expires_minutes": 30,
            },
        })
        return {"message": self.GENERIC_RESET_RESPONSE}

    async def reset_password(self, raw_token: str, password: str) -> dict:
        if not settings.PASSWORD_RESET_ENABLED:
            raise HTTPException(status_code=503, detail={
                "code": "PASSWORD_RESET_DISABLED",
                "message": "Chức năng đặt lại mật khẩu chưa được bật.",
            })
        await validate_effective_password(password)
        db = get_database()
        now = utcnow()
        invitation = await db["account_invitations"].find_one_and_update({
            "token_hash": token_hash(raw_token), "purpose": "PASSWORD_RESET",
            "used_at": None, "revoked_at": None, "expires_at": {"$gt": now},
        }, {"$set": {"used_at": now, "updated_at": now}}, return_document=True)
        if not invitation or not ObjectId.is_valid(invitation.get("account_id")):
            raise HTTPException(status_code=400, detail="Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
        password_hash = await account_service.hash_password_async(password)
        result = await db["user_accounts"].update_one(
            {"_id": ObjectId(invitation["account_id"]), "status": "ACTIVE", "is_active": True},
            {
                "$set": {
                    "password_hash": password_hash,
                    "must_change_password": False,
                    "password_changed_at": now,
                    "updated_at": now,
                },
                "$unset": {"temporary_password": "", "temporary_password_expires_at": ""},
                "$inc": {"token_version": 1},
            },
        )
        if result.matched_count != 1:
            raise HTTPException(status_code=400, detail="Tài khoản không còn khả dụng.")
        await db["account_invitations"].update_many(
            {"account_id": invitation["account_id"], "purpose": "PASSWORD_RESET", "used_at": None, "revoked_at": None},
            {"$set": {"revoked_at": now, "updated_at": now}},
        )
        await db["auth_sessions"].update_many(
            {"$or": [
                {"account_id": invitation["account_id"]},
                {"employee_id": invitation["account_id"]},
            ], "revoked_at": None},
            {"$set": {"revoked_at": now, "revoke_reason": "Đặt lại mật khẩu"}},
        )
        return {"success": True, "message": "Đặt lại mật khẩu thành công."}


invitation_service = InvitationService()
