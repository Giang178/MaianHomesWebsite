from datetime import datetime, timezone
import re
import unicodedata

from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database
from app.modules.activity.service import record_event
from app.modules.content.common.outbox import enqueue
from app.modules.website.team.policies import actor_id, publication_issues, transition_allowed
from app.modules.website.team.repository import team_repository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def make_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.replace("\u0110", "D").replace("\u0111", "d"))
    ascii_value = "".join(character for character in normalized if unicodedata.category(character) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "ho-so"


def serialize(document: dict | None) -> dict | None:
    if document is None:
        return None
    result = dict(document)
    result["id"] = str(result.pop("_id"))
    return result


class TeamService:
    repository = team_repository

    @staticmethod
    def media_url(media_id: str | None) -> str:
        return f"/api/public/marketing-media/{media_id}" if media_id else ""

    async def unique_slug(self, full_name: str) -> str:
        base = make_slug(full_name)[:150]
        candidate = base
        suffix = 2
        while await self.repository.profiles.find_one({"slug": candidate}, {"_id": 1}):
            candidate = f"{base[: 159 - len(str(suffix))]}-{suffix}"
            suffix += 1
        return candidate

    async def validate_references(self, draft: dict, *, for_publish: bool = False) -> list[dict]:
        issues: list[dict] = []
        media_id = draft.get("avatar_media_id")
        if media_id:
            media = await get_database()["media_assets"].find_one({"_id": media_id, "lifecycle_status": "ACTIVE"}, {"_id": 1})
            if not media:
                issues.append({"code": "MEDIA_NOT_FOUND", "field": "avatar_media_id", "message": "Anh chan dung khong ton tai hoac da bi khoa."})
        ids = [ObjectId(value) for value in draft.get("project_ids") or [] if ObjectId.is_valid(value)]
        if ids:
            query: dict = {"_id": {"$in": ids}}
            if for_publish:
                query.update({"is_published": True, "publication_status": {"$ne": "ARCHIVED"}})
            found = {str(item["_id"]) async for item in get_database()["projects"].find(query, {"_id": 1})}
            for missing in sorted(set(draft.get("project_ids") or []) - found):
                issues.append({"code": "PROJECT_NOT_AVAILABLE", "field": "project_ids", "message": f"Du an {missing} khong san sang de hien thi."})
        return issues

    async def hydrate(self, source: dict) -> dict:
        result = dict(source or {})
        media_id = result.get("avatar_media_id")
        result["avatar_url"] = self.media_url(media_id)
        ids = [ObjectId(value) for value in result.pop("project_ids", []) if ObjectId.is_valid(value)]
        projects = await get_database()["projects"].find(
            {"_id": {"$in": ids}, "is_published": True, "publication_status": {"$ne": "ARCHIVED"}},
            {"name": 1, "slug": 1, "location": 1, "status": 1, "price_range": 1, "image": 1, "logo_url": 1, "images": {"$slice": 1}, "hero_images": {"$slice": 1}},
        ).to_list(50) if ids else []
        mapping = {str(item["_id"]): item for item in projects}
        result["projects"] = [{
            "id": value,
            "name": mapping[value].get("name", ""),
            "slug": mapping[value].get("slug", ""),
            "location": mapping[value].get("location"),
            "status": mapping[value].get("status"),
            "price_range": mapping[value].get("price_range"),
            "image": mapping[value].get("image"),
            "logo_url": mapping[value].get("logo_url"),
            "images": mapping[value].get("images") or [],
            "hero_images": mapping[value].get("hero_images") or [],
        } for value in [str(item) for item in ids] if value in mapping]
        defaults = {
            "profile_type": "SPECIALIST", "position": "", "phone": None, "email": None,
            "years_experience": 0, "headline": "", "short_bio": "", "about": "",
            "quote": None, "specialties": [], "achievements": [], "customers_served": 0,
            "deals_completed": 0, "satisfaction_rate": 0, "linkedin_url": None,
            "show_on_home": False, "is_featured": False, "allow_detail_view": True,
            "display_order": 100, "seo_title": None, "seo_description": None,
        }
        for key, value in defaults.items():
            if result.get(key) is None:
                result[key] = value
        return result

    async def list_admin(self, status: str | None = None, q: str | None = None) -> dict:
        safe_q = re.escape(q.strip()) if q and q.strip() else None
        docs = await self.repository.list_admin(status=status, q=safe_q)
        return {"items": [serialize(item) for item in docs]}

    async def detail(self, profile_id: str) -> dict:
        doc = await self.repository.get(profile_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Khong tim thay ho so")
        return serialize(doc) or {}

    async def options(self) -> dict:
        projects = await get_database()["projects"].find(
            {"is_published": True, "publication_status": {"$ne": "ARCHIVED"}},
            {"name": 1, "slug": 1, "location": 1, "image": 1},
        ).sort("name", 1).limit(500).to_list(500)
        return {
            "projects": [{"id": str(item["_id"]), **{key: item.get(key) for key in ("name", "slug", "location", "image")}} for item in projects],
            "media": [],
        }

    async def create(self, payload: dict, actor: dict) -> dict:
        now = utcnow()
        values = {key: value for key, value in payload.items() if key != "expected_version"}
        values["slug"] = await self.unique_slug(values["full_name"])
        issues = await self.validate_references(values)
        if issues:
            raise HTTPException(status_code=422, detail={"code": "PUBLIC_PROFILE_INVALID", "message": "Du lieu tham chieu khong hop le.", "errors": issues, "warnings": []})
        document = {
            "slug": values["slug"], "version": 1, "status": "DRAFT", "draft": values,
            "created_at": now, "updated_at": now, "created_by": actor_id(actor), "updated_by": actor_id(actor),
        }
        try:
            document = await self.repository.create(document)
        except DuplicateKeyError as exc:
            raise HTTPException(status_code=409, detail="Slug ho so da ton tai") from exc
        await self._audit("CREATE", document, actor)
        return serialize(document) or {}

    async def update(self, profile_id: str, payload: dict, actor: dict) -> dict:
        current = await self.repository.get(profile_id)
        if not current:
            raise HTTPException(status_code=404, detail="Khong tim thay ho so")
        if current.get("status") == "ARCHIVED":
            raise HTTPException(status_code=409, detail={"code": "PROFILE_ARCHIVED", "message": "Ho so da luu tru va khong the chinh sua."})
        values = {key: value for key, value in payload.items() if key != "expected_version"}
        values["slug"] = str(current.get("slug") or (current.get("draft") or {}).get("slug") or await self.unique_slug(values["full_name"]))
        issues = await self.validate_references(values)
        if issues:
            raise HTTPException(status_code=422, detail={"code": "PUBLIC_PROFILE_INVALID", "message": "Du lieu tham chieu khong hop le.", "errors": issues, "warnings": []})
        old_slug = (current.get("draft") or {}).get("slug")
        try:
            doc = await self.repository.update_draft(profile_id, payload.get("expected_version"), {
                "slug": values["slug"], "draft": values, "status": "DRAFT", "rejection_reason": None,
                "updated_at": utcnow(), "updated_by": actor_id(actor),
            })
        except DuplicateKeyError as exc:
            raise HTTPException(status_code=409, detail="Slug ho so da ton tai") from exc
        if not doc:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        await self._audit("UPDATE", doc, actor, metadata={"old_slug": old_slug})
        return serialize(doc) or {}

    async def transition(self, profile_id: str, payload: dict, actor: dict) -> dict:
        current = await self.repository.get(profile_id)
        if not current or current.get("version") != payload["expected_version"]:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        action = payload["action"]
        if not transition_allowed(str(current.get("status") or ""), action):
            raise HTTPException(status_code=409, detail={
                "code": "INVALID_STATUS_TRANSITION",
                "message": "Trang thai ho so hien tai khong cho phep lap lai thao tac nay.",
                "status": current.get("status"),
                "action": action,
            })
        now = utcnow()
        old_slug = ((current.get("published_snapshot") or current.get("draft") or {}).get("slug"))
        fields: dict = {"updated_at": now, "updated_by": actor_id(actor)}
        if action == "publish":
            draft = current.get("draft") or {}
            issues = publication_issues(draft) + await self.validate_references(draft, for_publish=True)
            if issues:
                raise HTTPException(status_code=422, detail={
                    "code": "PUBLIC_PROFILE_INVALID", "message": "Ho so con thieu thong tin bat buoc truoc khi xuat ban.",
                    "score": max(0, 100 - len(issues) * 8), "errors": issues, "warnings": [],
                })
            published_version = int(current.get("published_version") or 0) + 1
            snapshot = {**draft, "published_at": now, "published_by": actor_id(actor)}
            await self.repository.versions.insert_one({
                "profile_id": profile_id, "version": published_version, "snapshot": snapshot,
                "note": payload.get("note"), "created_at": now, "created_by": actor_id(actor),
            })
            fields.update({"status": "PUBLISHED", "is_public": True, "published_snapshot": snapshot, "published_version": published_version, "published_at": now, "published_by": actor_id(actor), "rejection_reason": None})
        elif action == "rollback":
            version = await self.repository.versions.find_one({"profile_id": profile_id, "version": payload.get("target_version")})
            if not version:
                raise HTTPException(status_code=404, detail="Khong tim thay phien ban")
            fields.update({"status": "DRAFT", "draft": version["snapshot"]})
        elif action == "unpublish":
            fields.update({"status": "UNPUBLISHED", "is_public": False})
        elif action == "archive":
            fields.update({"status": "ARCHIVED", "is_public": False})
        doc = await self.repository.transition(profile_id, payload["expected_version"], fields)
        if not doc:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        if action in {"publish", "unpublish", "archive"}:
            await self._sync_media_reference(profile_id, (doc.get("published_snapshot") or {}).get("avatar_media_id"), action == "publish")
            await enqueue(f"WEBSITE_TEAM_{action.upper()}", {
                "entity_id": profile_id, "slug": (doc.get("draft") or {}).get("slug"), "old_slug": old_slug,
                "title": (doc.get("draft") or {}).get("full_name"), "author_id": actor_id(actor),
            })
        await self._audit("STATUS_CHANGED", doc, actor, metadata={"action": action})
        return serialize(doc) or {}

    async def preview(self, profile_id: str) -> dict:
        doc = await self.repository.get(profile_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Khong tim thay ho so")
        return await self.hydrate(doc.get("draft") or {})

    async def versions(self, profile_id: str) -> dict:
        if not await self.repository.get(profile_id):
            raise HTTPException(status_code=404, detail="Khong tim thay ho so")
        docs = await self.repository.versions.find({"profile_id": profile_id}).sort("version", -1).limit(100).to_list(100)
        return {"items": [serialize(item) for item in docs]}

    async def delete(self, profile_id: str, expected_version: int, actor: dict) -> None:
        current = await self.repository.get(profile_id)
        if not current:
            raise HTTPException(status_code=404, detail="Khong tim thay ho so")
        if current.get("status") != "ARCHIVED":
            raise HTTPException(status_code=409, detail={"code": "ARCHIVE_REQUIRED", "message": "Can luu tru ho so truoc khi xoa vinh vien."})
        deleted = await self.repository.delete(profile_id, expected_version)
        if not deleted:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        snapshot = deleted.get("published_snapshot") or deleted.get("draft") or {}
        await self._sync_media_reference(profile_id, None, False)
        await self.repository.versions.delete_many({"profile_id": profile_id})
        await enqueue("WEBSITE_TEAM_DELETE", {
            "entity_id": profile_id,
            "slug": snapshot.get("slug"),
            "old_slug": snapshot.get("slug"),
            "title": snapshot.get("full_name"),
            "author_id": actor_id(actor),
        })
        await self._audit("DELETE", deleted, actor)

    async def public_list(self, *, q: str | None, home: bool | None, featured: bool | None, limit: int, cursor: str | None) -> dict:
        visibility_query = {
            "$or": [
                {"is_public": True},
                {"is_public": {"$exists": False}, "status": "PUBLISHED"},
            ],
        }
        query: dict = {
            "published_snapshot": {"$exists": True},
            **visibility_query,
        }
        if home is not None:
            query["published_snapshot.show_on_home"] = home
        if featured is not None:
            query["published_snapshot.is_featured"] = featured
        if q:
            safe = re.escape(q.strip()[:100])
            query.pop("$or", None)
            query["$and"] = [
                visibility_query,
                {
                    "$or": [
                        {"published_snapshot.full_name": {"$regex": safe, "$options": "i"}},
                        {"published_snapshot.position": {"$regex": safe, "$options": "i"}},
                    ],
                },
            ]
        skip = int(cursor) if cursor and cursor.isdigit() else 0
        docs, total = await self.repository.list_public(query, skip, limit)
        items = [await self.hydrate({**(item.get("published_snapshot") or {}), "updated_at": item.get("updated_at")}) for item in docs]
        return {"items": items, "data": items, "total": total, "next_cursor": str(skip + len(items)) if skip + len(items) < total else None}

    async def public_detail(self, slug: str) -> dict:
        doc = await self.repository.profiles.find_one({
            "published_snapshot.slug": slug,
            "published_snapshot.allow_detail_view": {"$ne": False},
            "$or": [
                {"is_public": True},
                {"is_public": {"$exists": False}, "status": "PUBLISHED"},
            ],
        })
        if not doc:
            raise HTTPException(status_code=404, detail="Khong tim thay chuyen gia")
        return await self.hydrate({**(doc.get("published_snapshot") or {}), "updated_at": doc.get("updated_at")})

    async def set_media_alt_text(self, media_id: str, alt_text: str) -> None:
        await get_database()["media_assets"].update_one(
            {"_id": media_id},
            {"$set": {"alt_text": alt_text.strip()}},
        )

    async def _sync_media_reference(self, profile_id: str, media_id: str | None, active: bool) -> None:
        reference = f"PUBLIC_STAFF:{profile_id}"
        await get_database()["media_assets"].update_many({"references": reference}, {"$pull": {"references": reference}})
        await get_database()["media_usage"].delete_many({"reference": reference})
        if active and media_id:
            await get_database()["media_assets"].update_one({"_id": media_id}, {"$addToSet": {"references": reference}})
            await get_database()["media_usage"].insert_one({"media_id": media_id, "reference": reference, "entity_type": "PUBLIC_STAFF", "entity_id": profile_id, "created_at": utcnow()})

    async def _audit(self, event_type: str, document: dict, actor: dict, metadata: dict | None = None) -> None:
        await record_event(event_type, module="MARKETING", category="DATA_CHANGE", actor=actor,
            target_type="PUBLIC_STAFF", target_id=str(document.get("_id")),
            metadata={"slug": (document.get("draft") or {}).get("slug"), **(metadata or {})})


team_service = TeamService()