import asyncio
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from app.db.mongodb import get_database
from app.modules.activity.service import record_event
from app.modules.content.projects.mappers import (
    PUBLIC_PROJECT_FIELDS,
    PUBLIC_PROJECT_SUMMARY_FIELDS,
)


class ProjectRepository:
    @property
    def db(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Cơ sở dữ liệu chưa được khởi tạo")
        return db

    async def find_root(self, project_id: str, *, session=None) -> dict | None:
        if not ObjectId.is_valid(project_id):
            return None
        return await self.db["projects"].find_one({"_id": ObjectId(project_id)}, session=session)

    async def find_by_slug(self, slug: str, *, published_only: bool = False) -> dict | None:
        query: dict[str, Any] = {"slug": slug}
        if published_only:
            query["is_published"] = True
            query["publication_status"] = {"$ne": "ARCHIVED"}
        return await self.db["projects"].find_one(query)


    async def slug_exists(self, slug: str, exclude_id: str | None = None) -> bool:
        query: dict[str, Any] = {"slug": slug}
        if exclude_id and ObjectId.is_valid(exclude_id):
            query["_id"] = {"$ne": ObjectId(exclude_id)}
        if await self.db["projects"].find_one(query, {"_id": 1}):
            return True
        draft_query: dict[str, Any] = {"payload.slug": slug}
        if exclude_id:
            draft_query["project_id"] = {"$ne": exclude_id}
        return bool(await self.db["project_drafts"].find_one(draft_query, {"_id": 1}))

    async def create(self, payload: dict, metadata: dict, *, session=None) -> dict:
        now = datetime.now(timezone.utc)
        root = {
            **payload,
            **metadata,
            "is_published": False,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db["projects"].insert_one(root, session=session)
        project_id = str(result.inserted_id)
        await self.db["project_drafts"].insert_one(
            {
                "project_id": project_id,
                "payload": payload,
                "version": metadata["version"],
                "updated_by": metadata["created_by"],
                "created_at": now,
                "updated_at": now,
            },
            session=session,
        )
        root["_id"] = result.inserted_id
        return root

    async def get_draft(self, project_id: str, *, session=None) -> dict | None:
        return await self.db["project_drafts"].find_one({"project_id": project_id}, session=session)

    async def save_draft(
        self,
        project_id: str,
        payload: dict,
        expected_version: int,
        actor_id: str,
        *,
        session=None,
    ) -> dict | None:
        now = datetime.now(timezone.utc)
        root = await self.db["projects"].find_one_and_update(
            {"_id": ObjectId(project_id), "version": expected_version if expected_version != 1 else {"$in": [1, None]}},
            {
                "$set": {
                    "workflow_status": "DRAFT",
                    "updated_by": actor_id,
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
        await self.db["project_drafts"].update_one(
            {"project_id": project_id},
            {
                "$set": {
                    "payload": payload,
                    "version": root["version"],
                    "updated_by": actor_id,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            session=session,
        )
        return root

    async def update_workflow(
        self,
        project_id: str,
        expected_version: int,
        fields: dict,
        *,
        session=None,
    ) -> dict | None:
        return await self.db["projects"].find_one_and_update(
            {"_id": ObjectId(project_id), "version": expected_version if expected_version != 1 else {"$in": [1, None]}},
            {"$set": fields, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
            session=session,
        )

    async def publish(
        self,
        project_id: str,
        expected_version: int,
        payload: dict,
        fields: dict,
        actor_id: str,
        *,
        session=None,
    ) -> dict | None:
        old = await self.find_root(project_id, session=session)
        now = datetime.now(timezone.utc)
        published_version = int(old.get("published_version", 0)) + 1 if old else 1
        update = {
            **payload,
            **fields,
            "is_published": True,
            "published_version": published_version,
            "updated_by": actor_id,
            "updated_at": now,
        }
        root = await self.db["projects"].find_one_and_update(
            {"_id": ObjectId(project_id), "version": expected_version if expected_version != 1 else {"$in": [1, None]}},
            {"$set": update, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        if not root:
            return None
        await record_event(
            "PROJECT_PUBLISHED",
            module="MARKETING",
            category="REVISION",
            actor={"id": actor_id},
            target_type="PROJECT",
            target_id=project_id,
            snapshot={"version": published_version, "payload": payload},
            session=session,
            extra={"project_id": project_id, "version": published_version},
        )
        if old and old.get("slug") and old.get("slug") != payload.get("slug"):
            await self.db["marketing_redirects"].update_one(
                {"entity_type": "PROJECT", "old_slug": old["slug"]},
                {
                    "$set": {
                        "new_slug": payload.get("slug"),
                        "updated_at": now,
                    },
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
                session=session,
            )
        return root

    async def list_admin(
        self, query: dict, skip: int, limit: int
    ) -> tuple[list[dict], int]:
        total = await self.db["projects"].count_documents(query)
        roots = await (
            self.db["projects"].find(query).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
        )
        if not roots:
            return [], total
        ids = [str(item["_id"]) for item in roots]
        drafts = {
            item["project_id"]: item
            for item in await self.db["project_drafts"].find({"project_id": {"$in": ids}}).to_list(len(ids))
        }
        results = []
        for root in roots:
            project_id = str(root["_id"])
            draft = drafts.get(project_id)
            item = {**root, **((draft or {}).get("payload") or {})}
            item["_id"] = root["_id"]
            item["id"] = project_id
            item["version"] = root.get("version", 1)
            item["workflow_status"] = root.get("workflow_status", "DRAFT")
            item["publication_status"] = root.get("publication_status", "NEVER_PUBLISHED")
            item["is_published"] = root.get("is_published", False)
            results.append(item)
        return results, total

    async def list_public(
        self,
        skip: int,
        limit: int,
        is_featured: bool = None,
        *,
        summary: bool = False,
    ) -> tuple[list[dict], int]:
        query = {"is_published": True, "publication_status": {"$ne": "ARCHIVED"}}
        if is_featured is not None:
            query["is_featured"] = is_featured
        fields = PUBLIC_PROJECT_SUMMARY_FIELDS if summary else PUBLIC_PROJECT_FIELDS
        projection = {field: 1 for field in fields}
        projection["_id"] = 1
        if summary:
            projection.update({
                "images": {"$slice": 1},
                "hero_images": {"$slice": 1},
                "marketing_tags": {"$slice": 1},
            })
        cursor = self.db["projects"].find(query, projection).sort("_id", -1).skip(skip).limit(limit)
        total, items = await asyncio.gather(
            self.db["projects"].count_documents(query),
            cursor.to_list(limit),
        )
        return items, total

    async def redirect_for_slug(self, slug: str) -> dict | None:
        return await self.db["marketing_redirects"].find_one(
            {"entity_type": "PROJECT", "old_slug": slug}
        )

    async def revisions(self, project_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
        query = {"project_id": project_id}
        total, items = await asyncio.gather(
            self.db["project_revisions"].count_documents(query),
            self.db["project_revisions"].find(query).sort("version", -1).skip(skip).limit(limit).to_list(limit),
        )
        return items, total

    async def preserve_lead_project_context(
        self,
        project_id: str,
        project: dict,
        *,
        session=None,
    ) -> int:
        """Backfill immutable project identity for leads created before snapshots existed."""
        project_name = project.get("name")
        if not project_name:
            return 0
        result = await self.db["website_leads"].update_many(
            {
                "interest_project_id": project_id,
                "$or": [
                    {"interest_project_name": {"$exists": False}},
                    {"interest_project_name": None},
                    {"interest_project_name": ""},
                ],
            },
            {"$set": {
                "interest_project_name": project_name,
                "interest_project_slug": project.get("slug"),
            }},
            session=session,
        )
        return result.modified_count

    async def delete_archived(
        self,
        project_id: str,
        expected_version: int,
        *,
        session=None,
    ) -> dict | None:
        root = await self.db["projects"].find_one_and_delete(
            {
                "_id": ObjectId(project_id),
                "version": expected_version,
                "publication_status": "ARCHIVED",
            },
            session=session,
        )
        if not root:
            return None
        await self.db["project_drafts"].delete_many(
            {"project_id": project_id}, session=session
        )
        await self.db["project_revisions"].delete_many(
            {"project_id": project_id}, session=session
        )
        slug = root.get("slug")
        if slug:
            await self.db["marketing_redirects"].delete_many(
                {
                    "entity_type": "PROJECT",
                    "$or": [{"old_slug": slug}, {"new_slug": slug}],
                },
                session=session,
            )
        return root


project_repository = ProjectRepository()

