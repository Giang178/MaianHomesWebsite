"""
BaseService - Maian Homes Core Service Layer
=============================================
Provides generic CRUD operations for all MongoDB collections.

CEO Protection
--------------
CEO accounts (role=CEO or is_protected=True or CEO email) are IMMUTABLE at the service
layer. Any `update` or `delete` call that targets a protected document will:
  1. Raise an HTTPException 403.
  2. Write a BLOCKED entry to system_logs via AuditService.

This means even a direct MongoDB-aware developer calling base.update() or
base.delete() cannot bypass this guard without modifying this file.
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, TypeVar

from bson import ObjectId
from fastapi import HTTPException, status
from pydantic import BaseModel

from app.db.mongodb import get_database

logger = logging.getLogger(__name__)

ModelType = TypeVar("ModelType", bound=BaseModel)

# Collections whose documents can carry the is_protected flag or require automated auditing
PROTECTED_COLLECTIONS = {"user_accounts"}

# Role value that is always considered protected regardless of the flag
PROTECTED_ROLE_VALUE = "CEO"


def _is_doc_protected(doc: dict | None) -> bool:
    """Return True if this document must never be mutated or deleted."""
    if doc is None:
        return False
    if doc.get("is_protected", False):
        return True
    role = doc.get("role")
    if getattr(role, "value", role) == PROTECTED_ROLE_VALUE:
        return True
    from app.core.config import settings
    if doc.get("email") and doc.get("email") == getattr(settings, "CEO_EMAIL", None):
        return True
    return False


class BaseService:
    def __init__(self, collection_name: str, model: type[ModelType]):
        self.collection_name = collection_name
        self.model = model

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Cơ sở dữ liệu chưa được khởi tạo")
        return db[self.collection_name]

    async def get(self, id: str) -> ModelType | None:
        if not ObjectId.is_valid(id):
            return None
        doc = await self.collection.find_one({"_id": ObjectId(id)})
        if doc:
            return self.model(**doc)
        return None

    async def get_multi(
        self, skip: int = 0, limit: int = 100, query: dict[str, Any] | None = None
    ) -> list[ModelType]:
        if query is None:
            query = {}
        cursor = self.collection.find(query).skip(skip).limit(limit)
        results = []
        async for doc in cursor:
            results.append(self.model(**doc))
        return results

    async def get_multi_cursor(
        self, cursor_id: str | None = None, limit: int = 100, query: dict[str, Any] | None = None
    ) -> list[ModelType]:
        if query is None:
            query = {}
        if cursor_id:
            if not ObjectId.is_valid(cursor_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Con trỏ phân trang (cursor) không hợp lệ")
            # Sort by _id descending (-1), so next page has smaller _id
            query["_id"] = {"$lt": ObjectId(cursor_id)}            
        # If cursor_id is provided, sort descending. Otherwise, also sort descending to start from newest.
        cursor = self.collection.find(query).sort("_id", -1).limit(limit)
        results = []
        async for doc in cursor:
            results.append(self.model(**doc))
        return results

    async def create(
        self,
        obj_in: ModelType | dict[str, Any],
        *,
        actor_email: str | None = None,
        actor_role: str | None = None,
        audit_message: str | None = None,
    ) -> ModelType:
        obj_dict = obj_in if isinstance(obj_in, dict) else obj_in.model_dump()
        if "_id" in obj_dict:
            del obj_dict["_id"]
        if "id" in obj_dict:
            del obj_dict["id"]

        now = datetime.now(timezone.utc)
        obj_dict.update({"created_at": now, "updated_at": now})

        result = await self.collection.insert_one(obj_dict)
        doc = await self.collection.find_one({"_id": result.inserted_id})
        
        # Tự động ghi nhận audit log cho thao tác tạo mới (CREATE)
        if doc and self.collection_name in PROTECTED_COLLECTIONS:
            await self._audit_log("CREATE", str(result.inserted_id), actor_email, actor_role, None, doc, message=audit_message)
            
        return self.model(**doc)

    async def update(
        self,
        id: str,
        obj_in: ModelType | dict[str, Any],
        *,
        actor_email: str | None = None,
        actor_role: str | None = None,
        audit_message: str | None = None,
    ) -> ModelType | None:
        if not ObjectId.is_valid(id):
            return None

        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        if "_id" in update_data:
            del update_data["_id"]
        if "id" in update_data:
            del update_data["id"]

        update_data["updated_at"] = datetime.now(timezone.utc)

        # --- CEO Protection (targeted): only block changes to role or is_protected ---
        if self.collection_name in PROTECTED_COLLECTIONS:
            existing = await self.collection.find_one({"_id": ObjectId(id)})
            if _is_doc_protected(existing):
                IMMUTABLE_FIELDS = {"role", "is_protected"}
                attempted_dangerous = []
                for field in (IMMUTABLE_FIELDS & set(update_data.keys())):
                    if update_data[field] != existing.get(field):
                        attempted_dangerous.append(field)
                
                if attempted_dangerous:
                    await self._audit_block(id, f"update({attempted_dangerous})", actor_email, actor_role, existing)
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=(
                            f"Không thể thay đổi trường bảo vệ của tài khoản CEO: "
                            f"{', '.join(attempted_dangerous)}."
                        ),
                    )

        # Snapshot before state for audit
        before_doc = await self.collection.find_one({"_id": ObjectId(id)})

        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(id)},
            {"$set": update_data},
            return_document=True,
        )

        # Write audit log for sensitive collections
        if result and self.collection_name in PROTECTED_COLLECTIONS:
            await self._audit_log("UPDATE", id, actor_email, actor_role, before_doc, result, message=audit_message)

        if result:
            return self.model(**result)
        return None

    async def delete(
        self,
        id: str,
        *,
        actor_email: str | None = None,
        actor_role: str | None = None,
        audit_message: str | None = None,
    ) -> bool:
        if not ObjectId.is_valid(id):
            return False

        # --- CEO Protection ---
        if self.collection_name in PROTECTED_COLLECTIONS:
            existing = await self.collection.find_one({"_id": ObjectId(id)})
            if _is_doc_protected(existing):
                await self._audit_block(id, "delete", actor_email, actor_role, existing)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Tài khoản CEO được bảo vệ. Không thể xóa.",
                )
            if existing:
                await self._audit_log("DELETE", id, actor_email, actor_role, existing, None, message=audit_message)

        result = await self.collection.delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0

    # ------------------------------------------------------------------ #
    # Private helpers                                                    #
    # ------------------------------------------------------------------ #

    async def _audit_log(
        self,
        action: str,
        document_id: str,
        actor_email: str | None,
        actor_role: str | None,
        before: dict | None,
        after: dict | None,
        message: str | None = None,
    ) -> None:
        try:
            from app.models.audit import AuditAction
            from app.modules.activity.audit import audit_service
            await audit_service.log(
                collection=self.collection_name,
                document_id=document_id,
                action=AuditAction(action),
                actor_email=actor_email,
                actor_role=actor_role,
                before=self._sanitize(before),
                after=self._sanitize(after),
                message=message or f"{action} on {self.collection_name} [{document_id}]",
            )
        except Exception as e:
            logger.error(f"Failed to create audit log for {self.collection_name} [{document_id}]: {e}", exc_info=True)

    async def _audit_block(
        self,
        document_id: str,
        attempted_action: str,
        actor_email: str | None,
        actor_role: str | None,
        existing: dict | None,
    ) -> None:
        try:
            from app.models.audit import AuditAction
            from app.modules.activity.audit import audit_service
            await audit_service.log(
                collection=self.collection_name,
                document_id=document_id,
                action=AuditAction.BLOCKED,
                actor_email=actor_email,
                actor_role=actor_role,
                before=self._sanitize(existing),
                after=None,
                message=(
                    f"BLOCKED: Attempted {attempted_action} on protected CEO account "
                    f"[{document_id}] by {actor_email or 'unknown'}"
                ),
            )
        except Exception as e:
            logger.error(f"Failed to create audit log for {self.collection_name} [{document_id}]: {e}", exc_info=True)

    @staticmethod
    def _sanitize(doc: dict | None) -> dict | None:
        """Làm sạch và chuyển đổi đệ quy các đối tượng BSON (ObjectId, datetime...) thành chuỗi an toàn, che thông tin nhạy cảm."""
        if doc is None:
            return None

        def _clean_val(key: str, val: Any) -> Any:
            if any(sensitive in str(key).lower() for sensitive in ["password", "token", "secret", "cvv"]):
                return "[REDACTED]"
            if val is None:
                return None
            if isinstance(val, dict):
                return {str(k): _clean_val(str(k), v) for k, v in val.items()}
            if isinstance(val, (list, tuple, set)):
                return [_clean_val(f"{key}[]", item) for item in val]
            if isinstance(val, (datetime, date)):
                return val.isoformat()
            if isinstance(val, ObjectId):
                return str(val)
            if isinstance(val, Decimal):
                return float(val)
            if not isinstance(val, (str, int, float, bool)):
                return str(val)
            return val

        return {str(k): _clean_val(str(k), v) for k, v in doc.items()}
