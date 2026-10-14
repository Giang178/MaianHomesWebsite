from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, Request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.security import get_real_client_ip
from app.db.mongodb import get_database
from app.modules.activity.service import device_from_user_agent, record_activity


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SessionService:
    @property
    def collection(self):
        return get_database()["auth_sessions"]

    async def create(self, account: dict, request: Request, *, purpose: str = "ACCESS") -> dict:
        principal_id = str(account.get("id") or account.get("_id") or account.get("account_id") or "")
        if not principal_id:
            raise HTTPException(status_code=401, detail="Tài khoản không hợp lệ.")
        user_agent = request.headers.get("user-agent", "Unknown")
        for attempt in range(3):
            now = utcnow()
            await self.collection.update_many(
                {"account_id": principal_id, "purpose": purpose, "revoked_at": None},
                {"$set": {"revoked_at": now, "revoke_reason": "Đăng nhập từ thiết bị mới", "purge_at": now + timedelta(days=90)}},
            )
            document = {
                "_id": uuid4().hex,
                "account_id": principal_id,
                "employee_id": principal_id,
                "active_key": f"{principal_id}:{purpose}",
                "email": account.get("email"),
                "role": str(getattr(account.get("role"), "value", account.get("role") or "")),
                "token_version": int(account.get("token_version", 1)),
                "version": 1,
                "purpose": purpose,
                "ip_address": get_real_client_ip(request),
                **device_from_user_agent(user_agent),
                "logged_in_at": now,
                "last_seen_at": now,
                "expires_at": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
                "revoked_at": None,
                "revoke_reason": None,
                "purge_at": now + timedelta(days=90),
            }
            try:
                await self.collection.insert_one(document)
                return document
            except DuplicateKeyError as exc:
                if attempt == 2:
                    raise HTTPException(status_code=409, detail={"code": "SESSION_SUPERSEDED"}) from exc
        raise HTTPException(status_code=409, detail={"code": "SESSION_SUPERSEDED"})

    async def validate(self, session_id: str, principal_id: str, token_version: int) -> dict:
        now = utcnow()
        document = await self.collection.find_one({
            "_id": session_id,
            "$or": [{"account_id": principal_id}, {"employee_id": principal_id}],
            "token_version": token_version,
            "revoked_at": None,
            "expires_at": {"$gt": now},
        })
        if not document:
            raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn hoặc bị thu hồi.")
        if (document.get("last_seen_at") or document.get("logged_in_at") or now) < now - timedelta(minutes=5):
            await self.collection.update_one({"_id": session_id}, {"$set": {"last_seen_at": now}})
        return document

    async def revoke(self, session_id: str, *, reason: str, actor: dict | None = None, **_: object) -> bool:
        now = utcnow()
        updated = await self.collection.find_one_and_update(
            {"_id": session_id, "revoked_at": None},
            {"$set": {"revoked_at": now, "revoke_reason": reason, "purge_at": now + timedelta(days=90)}, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if updated:
            await record_activity("SESSION_REVOKED", actor=actor, target_type="AUTH_SESSION", target_id=session_id, session_id=session_id, metadata={"reason": reason})
        return bool(updated)

    async def revoke_all(self, principal_id: str, *, reason: str, actor: dict | None = None, **_: object) -> int:
        now = utcnow()
        result = await self.collection.update_many(
            {"$or": [{"account_id": principal_id}, {"employee_id": principal_id}], "revoked_at": None},
            {"$set": {"revoked_at": now, "revoke_reason": reason, "purge_at": now + timedelta(days=90)}},
        )
        await record_activity("ALL_SESSIONS_REVOKED", actor=actor, target_type="USER_ACCOUNT", target_id=principal_id, metadata={"reason": reason, "session_count": result.modified_count})
        return result.modified_count


session_service = SessionService()
