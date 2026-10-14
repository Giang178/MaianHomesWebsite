import asyncio
import re
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from app.db.mongodb import get_database
from app.modules.activity.service import record_event, serialize_event


def admin_article_status(document: dict) -> str:
    publication = document.get("publication_status", "NEVER_PUBLISHED")
    if publication == "ARCHIVED":
        return "archived"
    if publication == "UNPUBLISHED":
        return "unpublished"
    if publication in {"NEVER_PUBLISHED", "UNPUBLISHED"}:
        return "draft"
    if publication == "PUBLISHED":
        return "published"
    return document.get("status", "draft")


class ArticleRepository:
    @property
    def db(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Cơ sở dữ liệu chưa được khởi tạo")
        return db

    async def root(self, article_id: str, *, session=None) -> dict | None:
        if not ObjectId.is_valid(article_id):
            return None
        return await self.db["articles"].find_one({"_id": ObjectId(article_id)}, session=session)

    async def draft(self, article_id: str, *, session=None) -> dict | None:
        return await self.db["article_drafts"].find_one({"article_id": article_id}, session=session)

    async def slug_exists(self, slug: str, exclude_id: str | None = None) -> bool:
        root_query: dict[str, Any] = {"slug": slug}
        if exclude_id and ObjectId.is_valid(exclude_id):
            root_query["_id"] = {"$ne": ObjectId(exclude_id)}
        if await self.db["articles"].find_one(root_query, {"_id": 1}):
            return True
        draft_query: dict[str, Any] = {"payload.slug": slug}
        if exclude_id:
            draft_query["article_id"] = {"$ne": exclude_id}
        return bool(await self.db["article_drafts"].find_one(draft_query, {"_id": 1}))

    async def create(self, payload: dict, metadata: dict, *, session=None) -> dict:
        now = datetime.now(timezone.utc)
        root = {**payload, **metadata, "status": "draft", "created_at": now, "updated_at": now}
        result = await self.db["articles"].insert_one(root, session=session)
        article_id = str(result.inserted_id)
        await self.db["article_drafts"].insert_one(
            {
                "article_id": article_id,
                "payload": payload,
                "version": 1,
                "updated_by": metadata["created_by"],
                "created_at": now,
                "updated_at": now,
            },
            session=session,
        )
        root["_id"] = result.inserted_id
        return root

    async def save_draft(
        self,
        article_id: str,
        payload: dict,
        expected_version: int,
        actor: str,
        is_provisional: bool = False,
        *,
        session=None,
    ) -> dict | None:
        now = datetime.now(timezone.utc)
        root = await self.db["articles"].find_one_and_update(
            {"_id": ObjectId(article_id), "version": expected_version if expected_version != 1 else {"$in": [1, None]}},
            {
                "$set": {
                    "workflow_status": "DRAFT",
                    "is_provisional": is_provisional,
                    "updated_by": actor,
                    "updated_at": now,
                    "rejection_reason": None,
                },
                "$inc": {"version": 1},
            },
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        if not root:
            return None
        await self.db["article_drafts"].update_one(
            {"article_id": article_id},
            {
                "$set": {
                    "payload": payload,
                    "version": root["version"],
                    "updated_by": actor,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            session=session,
        )
        return root

    async def update_workflow(
        self, article_id: str, expected_version: int, fields: dict, *, session=None
    ) -> dict | None:
        return await self.db["articles"].find_one_and_update(
            {"_id": ObjectId(article_id), "version": expected_version if expected_version != 1 else {"$in": [1, None]}},
            {"$set": fields, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
            session=session,
        )

    async def publish(
        self,
        article_id: str,
        expected_version: int,
        payload: dict,
        fields: dict,
        actor: str,
        *,
        session=None,
    ) -> dict | None:
        old = await self.root(article_id, session=session)
        now = datetime.now(timezone.utc)
        published_version = int((old or {}).get("published_version", 0)) + 1
        update = {
            **payload,
            **fields,
            "status": "published",
            "publication_status": "PUBLISHED",
            "published_version": published_version,
            "published_at": (old or {}).get("published_at") or now,
            "updated_by": actor,
            "updated_at": now,
        }
        root = await self.db["articles"].find_one_and_update(
            {"_id": ObjectId(article_id), "version": expected_version if expected_version != 1 else {"$in": [1, None]}},
            {"$set": update, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        if not root:
            return None
        await self.db["article_revisions"].insert_one(
            {
                "article_id": article_id,
                "version": published_version,
                "title": payload.get("title", ""),
                "sapo": payload.get("sapo", ""),
                "content": payload.get("content", ""),
                "gallery": payload.get("gallery", []),
                "updated_by_id": actor,
                "note": "Published revision",
                "created_at": now,
                "updated_at": now,
            },
            session=session,
        )
        await record_event(
            "ARTICLE_PUBLISHED",
            module="MARKETING",
            category="REVISION",
            actor={"id": actor},
            target_type="ARTICLE",
            target_id=article_id,
            snapshot={"version": published_version, "payload": payload},
            metadata={"note": "Published revision"},
            session=session,
            extra={"article_id": article_id, "version": published_version},
        )
        if old and old.get("slug") and old.get("slug") != payload.get("slug"):
            await self.db["marketing_redirects"].update_one(
                {"entity_type": "ARTICLE", "old_slug": old["slug"]},
                {
                    "$set": {"new_slug": payload["slug"], "updated_at": now},
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
                session=session,
            )
        return root

    async def list_admin(
        self,
        query: dict,
        skip: int,
        limit: int,
        search: str | None = None,
    ) -> tuple[list[dict], int]:
        effective_query = query
        if search and search.strip():
            pattern = re.escape(search.strip())
            draft_ids = await self.db["article_drafts"].distinct(
                "article_id",
                {
                    "$or": [
                        {"payload.title": {"$regex": pattern, "$options": "i"}},
                        {"payload.slug": {"$regex": pattern, "$options": "i"}},
                    ]
                },
            )
            object_ids = [ObjectId(value) for value in draft_ids if ObjectId.is_valid(value)]
            search_query = {
                "$or": [
                    {"title": {"$regex": pattern, "$options": "i"}},
                    {"slug": {"$regex": pattern, "$options": "i"}},
                    {"_id": {"$in": object_ids}},
                ]
            }
            effective_query = {"$and": [query, search_query]} if query else search_query
        total = await self.db["articles"].count_documents(effective_query)
        roots = await self.db["articles"].find(effective_query).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
        ids = [str(item["_id"]) for item in roots]
        drafts = {
            item["article_id"]: item
            for item in await self.db["article_drafts"].find({"article_id": {"$in": ids}}).to_list(max(1, len(ids)))
        }
        results = []
        for root in roots:
            article_id = str(root["_id"])
            item = {**root, **((drafts.get(article_id) or {}).get("payload") or {})}
            item["_id"] = root["_id"]
            item["version"] = root.get("version", 1)
            item["status"] = admin_article_status(root)
            results.append(item)
        return results, total

    async def public_list(self, query: dict, skip: int, limit: int) -> tuple[list[dict], int]:
        query = {**query, "status": "published", "publication_status": {"$ne": "ARCHIVED"}}
        projection = {
            "content": 0,
            "workflow_status": 0,
            "publication_status": 0,
            "created_by": 0,
            "updated_by": 0,
            "reviewed_by": 0,
            "rejection_reason": 0,
            "author_email": 0,
        }
        cursor = self.db["articles"].find(query, projection).sort("published_at", -1).skip(skip).limit(limit)
        total, items = await asyncio.gather(
            self.db["articles"].count_documents(query),
            cursor.to_list(limit),
        )
        return items, total

    async def public_by_slug(self, slug: str) -> dict | None:
        return await self.db["articles"].find_one(
            {"slug": slug, "status": "published", "publication_status": {"$ne": "ARCHIVED"}}
        )

    async def redirect_for_slug(self, slug: str) -> dict | None:
        return await self.db["marketing_redirects"].find_one(
            {"entity_type": "ARTICLE", "old_slug": slug}
        )

    async def related(self, article: dict, limit: int = 3) -> list[dict]:
        query = {
            "status": "published",
            "publication_status": {"$ne": "ARCHIVED"},
            "category": article.get("category"),
            "_id": {"$ne": article["_id"]},
        }
        projection = {
            "title": 1,
            "slug": 1,
            "category": 1,
            "sapo": 1,
            "published_at": 1,
            "featured_image_id": 1,
            "gallery": 1,
        }
        return await (
            self.db["articles"]
            .find(query, projection)
            .sort("published_at", -1)
            .limit(limit)
            .to_list(limit)
        )

    async def revisions(self, article_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
        query = {"article_id": article_id}
        total, items = await asyncio.gather(
            self.db["article_revisions"].count_documents(query),
            self.db["article_revisions"].find(query).sort("version", -1).skip(skip).limit(limit).to_list(limit),
        )
        return items, total

    async def public_revisions(self, article_id: str, limit: int = 20) -> list[dict]:
        projection = {"_id": 0, "version": 1, "note": 1, "created_at": 1}
        return await (
            self.db["article_revisions"]
            .find({"article_id": article_id}, projection)
            .sort("version", -1)
            .limit(limit)
            .to_list(limit)
        )

    async def audit_logs(self, article_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
        query = {"module": "MARKETING", "category": "AUDIT", "target.type": "ARTICLE", "target.id": article_id}
        items, total = await asyncio.gather(
            self.db["activity_events"].find(query).sort([("occurred_at", -1), ("_id", -1)]).skip(skip).limit(limit).to_list(limit),
            self.db["activity_events"].count_documents(query),
        )
        return [serialize_event(item) for item in items], total

    async def delete_archived(
        self,
        article_id: str,
        expected_version: int,
        *,
        session=None,
    ) -> dict | None:
        root = await self.db["articles"].find_one_and_delete(
            {
                "_id": ObjectId(article_id),
                "version": expected_version,
                "publication_status": "ARCHIVED",
            },
            session=session,
        )
        if not root:
            return None
        await self.db["article_drafts"].delete_many(
            {"article_id": article_id}, session=session
        )
        await self.db["article_revisions"].delete_many(
            {"article_id": article_id}, session=session
        )
        slug = root.get("slug")
        if slug:
            await self.db["marketing_redirects"].delete_many(
                {
                    "entity_type": "ARTICLE",
                    "$or": [{"old_slug": slug}, {"new_slug": slug}],
                },
                session=session,
            )
        return root


article_repository = ArticleRepository()
