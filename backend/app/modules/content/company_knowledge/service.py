from datetime import datetime, timezone
import logging

from fastapi import HTTPException
from pymongo import ReturnDocument

from app.db.mongodb import get_database
from app.modules.content.common.audit import record_audit
from app.modules.content.common.enums import MANAGER_ROLES, actor_id, role_value
from app.modules.content.common.idempotency import execute_once
from app.modules.content.common.outbox import enqueue
from app.modules.content.company_knowledge.schemas import CompanyKnowledgeTransition, CompanyKnowledgeUpdate

logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CompanyKnowledgeService:
    DOCUMENT_ID = "company_profile"

    @property
    def collection(self):
        return get_database()["company_knowledge"]

    async def admin_view(self) -> dict:
        document = await self.collection.find_one({"_id": self.DOCUMENT_ID})
        if not document:
            return {"id": self.DOCUMENT_ID, "version": 1, "workflow_status": "DRAFT", "publication_status": "NEVER_PUBLISHED", "draft": {"company_name": "Maian Homes"}, "published": None}
        document["id"] = str(document.pop("_id"))
        return document

    async def published(self) -> dict | None:
        document = await self.collection.find_one({"_id": self.DOCUMENT_ID, "publication_status": "PUBLISHED", "published": {"$type": "object"}}, {"published": 1, "published_at": 1, "published_version": 1, "version": 1})
        return ({**document.get("published", {}), "published_at": document.get("published_at"), "published_version": document.get("published_version", document.get("version", 1))} if document else None)

    async def update(self, request: CompanyKnowledgeUpdate, actor: dict) -> dict:
        owner = actor_id(actor)

        async def operation():
            now = utcnow()
            existing = await self.collection.find_one({"_id": self.DOCUMENT_ID})
            if not existing and request.expected_version != 1:
                raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
            query = {"_id": self.DOCUMENT_ID, **({"version": request.expected_version} if existing else {})}
            updated = await self.collection.find_one_and_update(query, {"$set": {"draft": request.payload.model_dump(mode="json"), "workflow_status": "DRAFT", "updated_at": now, "updated_by": owner}, "$setOnInsert": {"created_at": now, "created_by": owner, "publication_status": "NEVER_PUBLISHED", "version": 0}, "$inc": {"version": 1}}, upsert=not bool(existing), return_document=ReturnDocument.AFTER)
            if not updated:
                raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
            await record_audit(entity_type="COMPANY_KNOWLEDGE", entity_id=self.DOCUMENT_ID, action="update_draft", actor=actor, previous=existing, current=updated)
            return await self.admin_view()

        return await execute_once(key=request.idempotency_key, scope="company-knowledge:update", actor_id=owner, operation=operation)

    async def transition(self, request: CompanyKnowledgeTransition, actor: dict) -> dict:
        if request.action in {"publish", "unpublish"} and role_value(actor) not in MANAGER_ROLES:
            raise HTTPException(status_code=403, detail={"code": "MARKETING_MANAGER_REQUIRED"})
        owner = actor_id(actor)
        idempotency_identity = f"company-knowledge:{request.action}:{owner}:{request.idempotency_key}"
        stored = await get_database()["marketing_idempotency"].find_one(
            {"identity": idempotency_identity, "state": "COMPLETED"}, {"result": 1}
        )
        if stored and stored.get("result") is not None:
            return stored["result"]
        document = await self.collection.find_one({"_id": self.DOCUMENT_ID})
        if not document:
            raise HTTPException(status_code=404, detail={"code": "COMPANY_KNOWLEDGE_NOT_FOUND"})
        if int(document.get("version", 1)) != request.expected_version:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT", "current_version": document.get("version")})
        if request.action == "publish" and not document.get("draft"):
            raise HTTPException(status_code=422, detail={"code": "COMPANY_KNOWLEDGE_DRAFT_REQUIRED"})
        async def operation():
            now = utcnow()
            fields: dict = {"updated_at": now, "updated_by": owner}
            if request.action == "publish":
                fields.update({"workflow_status": "PUBLISHED", "publication_status": "PUBLISHED", "published": document["draft"], "published_at": now, "published_version": int(document.get("published_version", 0)) + 1, "published_by": owner, "rejection_reason": None})
            else:
                fields["publication_status"] = "UNPUBLISHED"
            updated = await self.collection.find_one_and_update({"_id": self.DOCUMENT_ID, "version": request.expected_version}, {"$set": fields, "$inc": {"version": 1}}, return_document=ReturnDocument.AFTER)
            if not updated:
                raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
            await record_audit(entity_type="COMPANY_KNOWLEDGE", entity_id=self.DOCUMENT_ID, action=request.action, actor=actor, previous=document, current=updated, note=request.note)
            from app.modules.content.assistant.knowledge_service import invalidate_chat_knowledge_cache
            await invalidate_chat_knowledge_cache()
            if request.action in {"publish", "unpublish"}:
                try:
                    await enqueue(
                        f"MARKETING_COMPANY_KNOWLEDGE_{request.action.upper()}",
                        {"entity_id": self.DOCUMENT_ID, "actor_id": owner},
                    )
                except Exception:
                    # The database transition is already durable. Public reads
                    # still expire within five minutes if the outbox is down.
                    logger.exception("company_knowledge_revalidation_enqueue_failed")
            return await self.admin_view()

        return await execute_once(key=request.idempotency_key, scope=f"company-knowledge:{request.action}", actor_id=owner, operation=operation)


company_knowledge_service = CompanyKnowledgeService()
