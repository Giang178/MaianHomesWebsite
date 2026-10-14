import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import bcrypt
from bson import ObjectId
from fastapi import HTTPException, status
from pydantic import BaseModel
from pymongo import ReturnDocument
from pymongo.errors import ConnectionFailure

from app.core.blocking_work import run_bcrypt
from app.models.user_account import UserAccount
from app.db.base_service import BaseService, _is_doc_protected

logger = logging.getLogger(__name__)


class UserAccountService(BaseService):
    """Authentication persistence service for Maian Homes 2.0."""

    def __init__(self):
        super().__init__(collection_name="user_accounts", model=UserAccount)

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except (ValueError, TypeError):
            return False

    async def hash_password_async(self, password: str) -> str:
        """Hash without blocking the request worker's asyncio event loop."""
        return await run_bcrypt(self.hash_password, password)

    async def verify_password_async(self, password: str, password_hash: str) -> bool:
        """Verify without blocking unrelated requests on the same event loop."""
        return await run_bcrypt(self.verify_password, password, password_hash)

    async def _find_one_resilient(self, query: dict) -> dict | None:
        for attempt in range(2):
            try:
                return await self.collection.find_one(query)
            except ConnectionFailure:
                if attempt == 1:
                    raise
                logger.warning("Lỗi kết nối MongoDB tạm thời khi tải tài khoản; đang thử lại")
                await asyncio.sleep(0.2)
        return None

    async def get_by_email(self, email: str) -> UserAccount | None:
        normalized = email.strip().lower()
        document = await self._find_one_resilient(
            {"$or": [{"normalized_email": normalized}, {"email": normalized}]}
        )
        return self._parse_account(document, f"email {normalized}")

    async def get_by_account_id(self, account_id: str) -> UserAccount | None:
        if ObjectId.is_valid(account_id):
            document = await self._find_one_resilient({"_id": ObjectId(account_id)})
            if document:
                return self._parse_account(document, f"account {account_id}")
        document = await self._find_one_resilient({"employee_id": account_id})
        return self._parse_account(document, f"employee/account {account_id}")

    async def get_by_employee_id(self, employee_id: str) -> UserAccount | None:
        return await self.get_by_account_id(employee_id)

    def _parse_account(self, document: dict | None, reference: str) -> UserAccount | None:
        if not document:
            return None
        try:
            return self.model(**document)
        except Exception as exc:
            logger.error("Dữ liệu tài khoản không hợp lệ cho %s; quyền truy cập bị từ chối: %s", reference, exc)
            return None

    async def authenticate(self, email: str, password: str) -> dict[str, Any] | None:
        account = await self.get_by_email(email)
        if not account or not await self.verify_password_async(password, account.password_hash):
            return None
        raw_status = getattr(account, "status", None) or getattr(account, "account_status", "ACTIVE")
        account_status = raw_status.value if hasattr(raw_status, "value") else str(raw_status)
        locked_until = getattr(account, "locked_until", None)
        if account_status == "LOCKED" and locked_until and locked_until <= datetime.now(timezone.utc):
            await self.collection.update_one(
                {"_id": account.id, "$or": [{"status": "LOCKED"}, {"account_status": "LOCKED"}], "locked_until": {"$lte": datetime.now(timezone.utc)}},
                {"$set": {"status": "ACTIVE", "account_status": "ACTIVE", "is_active": True, "updated_at": datetime.now(timezone.utc)},
                 "$unset": {"locked_until": "", "security_lock_reason": ""}},
            )
            if hasattr(account, "status"):
                account.status = "ACTIVE"
            account.is_active = True
            account_status = "ACTIVE"
        if account_status == "PENDING_APPROVAL":
            raise HTTPException(status_code=403, detail="Tài khoản đang chờ phê duyệt.")
        if not account.is_active or account_status == "LOCKED":
            raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa.")
        if account_status != "ACTIVE":
            raise HTTPException(status_code=403, detail=f"Tài khoản không thể đăng nhập: {account_status}")
        role_val = getattr(account.role, "value", account.role)
        return {
            "id": str(account.id),
            "account_id": str(account.id),
            "employee_id": getattr(account, "employee_id", None) or str(account.id),
            "email": account.email,
            "full_name": getattr(account, "full_name", "") or "",
            "role": role_val,
            "permissions": list(getattr(account, "permissions", []) or []),
            "is_active": account.is_active,
            "token_version": getattr(account, "token_version", 1),
            "must_change_password": bool(getattr(account, "must_change_password", False)),
            "temporary_password_expires_at": getattr(account, "temporary_password_expires_at", None),
        }

    async def update(self, id: str, obj_in: Any, **kwargs) -> UserAccount | None:
        update_data = obj_in.model_dump(exclude_unset=True) if isinstance(obj_in, BaseModel) else dict(obj_in or {})
        update_data.pop("token_version", None)
        identifier = ObjectId(id) if ObjectId.is_valid(id) else id
        existing = await self.collection.find_one({"_id": identifier})
        if not existing:
            return None
        if _is_doc_protected(existing):
            changed = [field for field in ("role", "is_protected")
                       if field in update_data and update_data[field] != existing.get(field)]
            if changed:
                await self._audit_block(id, f"update({changed})", kwargs.get("actor_email"),
                                        kwargs.get("actor_role"), existing)
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                    detail="Không thể thay đổi trường bảo vệ của tài khoản CEO/ADMIN.")
        update_document: dict = {"$inc": {"token_version": 1}}
        if update_data:
            update_document["$set"] = update_data
        result = await self.collection.find_one_and_update(
            {"_id": identifier}, update_document, return_document=ReturnDocument.AFTER,
        )
        if not result:
            return None
        await self._audit_log("UPDATE", id, kwargs.get("actor_email"), kwargs.get("actor_role"),
                              existing, result, message=kwargs.get("audit_message"))
        from app.api.deps import invalidate_auth_cache
        if result.get("employee_id"):
            invalidate_auth_cache(result["employee_id"])
        return self.model(**result)

    async def delete_by_employee_id(self, employee_id: str, *, actor_email: str | None = None,
                                    actor_role: str | None = None) -> bool:
        existing = await self.collection.find_one({"employee_id": employee_id})
        if not existing:
            return False
        if _is_doc_protected(existing):
            await self._audit_block(str(existing.get("_id")), "delete", actor_email, actor_role, existing)
            raise HTTPException(status_code=403, detail="Không thể xóa tài khoản quản trị được bảo vệ.")
        return await self.delete(
            id=str(existing["_id"]), actor_email=actor_email, actor_role=actor_role,
            audit_message=f"Deleted user account [{employee_id}]",
        )


account_service = UserAccountService()
