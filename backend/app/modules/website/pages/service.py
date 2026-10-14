from datetime import datetime, timezone
import logging

from fastapi import HTTPException
from pymongo import ReturnDocument
from urllib.parse import urlparse

from app.db.mongodb import get_database
from app.core.config import settings
from app.modules.website.pages.definitions import PAGE_CONTENT_FIELDS, PAGE_DEFINITIONS, PAGE_KEYS
from app.modules.content.common.outbox import enqueue

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


def serialize(document: dict | None) -> dict | None:
    if document is None:
        return None
    result = dict(document)
    if "_id" in result:
        result["id"] = str(result.pop("_id"))
    return result


class WebsitePageService:
    @property
    def pages(self):
        return get_database()["website_pages"]

    @property
    def versions(self):
        return get_database()["website_page_versions"]

    @staticmethod
    def validate_key(page_key: str) -> str:
        if page_key not in PAGE_KEYS:
            raise HTTPException(status_code=404, detail="Trang website không tồn tại")
        return page_key

    async def public(self, page_key: str) -> dict:
        self.validate_key(page_key)
        doc = await self.pages.find_one({"page_key": page_key, "$or": [{"publication_status": "PUBLISHED"}, {"status": "PUBLISHED"}]})
        if not doc or not doc.get("published_snapshot"):
            raise HTTPException(status_code=404, detail="Trang chưa được xuất bản")
        snapshot = dict(doc["published_snapshot"])
        snapshot.update({"page_key": page_key, "version": doc.get("published_version", doc.get("version", 1))})
        return snapshot

    async def get(self, page_key: str) -> dict:
        self.validate_key(page_key)
        doc = await self.pages.find_one({"page_key": page_key})
        if not doc:
            raise HTTPException(status_code=404, detail="Trang chưa được khởi tạo")
        return serialize(doc) or {}

    async def preview(self, page_key: str) -> dict:
        document = await self.get(page_key)
        return {"page_key": page_key, "version": document.get("version"), **(document.get("draft") or {})}

    async def list_versions(self, page_key: str) -> dict:
        self.validate_key(page_key)
        documents = await self.versions.find({"page_key": page_key}).sort("version", -1).limit(50).to_list(50)
        return {"items": [serialize(item) for item in documents]}

    @staticmethod
    def media_ids(payload: dict) -> set[str]:
        result: set[str] = set()
        def collect(value, key=""):
            if isinstance(value, dict):
                for nested_key, nested in value.items():
                    collect(nested, nested_key)
            elif isinstance(value, list):
                for nested in value:
                    collect(nested, key)
            elif isinstance(value, str) and (key.endswith("media_id") or key == "partner_logos") and value.strip():
                result.add(value.strip())
        collect(payload)
        return result

    async def validate_media(self, payload: dict) -> list[dict]:
        ids = self.media_ids(payload)
        if not ids:
            return []
        documents = await get_database()["media_assets"].find({"_id": {"$in": sorted(ids)}, "lifecycle_status": "ACTIVE"}, {"_id": 1, "alt_text": 1}).to_list(len(ids))
        found = {str(item["_id"]): item for item in documents}
        errors = []
        for media_id in sorted(ids):
            if media_id not in found:
                errors.append({"field": "media", "code": "MEDIA_NOT_FOUND", "message": f"Hình ảnh {media_id} không tồn tại hoặc đã bị lưu trữ."})
            elif len(str(found[media_id].get("alt_text") or "").strip()) < 10:
                errors.append({"field": "media", "code": "MEDIA_ALT_REQUIRED", "message": f"Hình ảnh {media_id} chưa có alt text hợp lệ."})
        return errors

    @staticmethod
    def validate_content(page_key: str, content: dict, *, enforce_required: bool = False) -> list[dict]:
        errors: list[dict] = []
        for field in PAGE_DEFINITIONS[page_key].fields:
            value = content.get(field.key)
            if enforce_required and field.required and (value is None or (isinstance(value, str) and not value.strip()) or value == []):
                errors.append({"field": f"content.{field.key}", "code": "CONTENT_REQUIRED", "message": f"{field.label} là nội dung bắt buộc."})
                continue
            if value is None:
                continue
            if field.kind == "sections":
                if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
                    errors.append({"field": f"content.{field.key}", "code": "CONTENT_TYPE_INVALID", "message": f"{field.label} phải là danh sách nội dung."})
                elif enforce_required and any(not str(item.get("title") or "").strip() or not str(item.get("content") or "").strip() for item in value):
                    errors.append({"field": f"content.{field.key}", "code": "CONTENT_SECTION_INCOMPLETE", "message": f"Mỗi mục trong {field.label.lower()} cần có tiêu đề và nội dung."})
                continue
            if not isinstance(value, str):
                errors.append({"field": f"content.{field.key}", "code": "CONTENT_TYPE_INVALID", "message": f"{field.label} phải là văn bản."})
                continue
            if len(value.strip()) > field.max_length:
                errors.append({"field": f"content.{field.key}", "code": "CONTENT_TOO_LONG", "message": f"{field.label} vượt quá {field.max_length} ký tự."})
            if field.kind == "url" and value.strip() and not (value.strip().startswith("/") or urlparse(value.strip()).scheme == "https"):
                errors.append({"field": f"content.{field.key}", "code": "CONTENT_URL_INVALID", "message": f"{field.label} phải là đường dẫn nội bộ hoặc HTTPS."})
        return errors

    async def validate_media_slots(self, page_key: str, content: dict) -> list[dict]:
        errors: list[dict] = []
        for slot in PAGE_DEFINITIONS[page_key].media_slots:
            media_id = str(content.get(slot.key) or "").strip()
            if not media_id:
                if slot.required:
                    errors.append({"field": f"content.{slot.key}", "code": "MEDIA_REQUIRED", "message": f"Vui lòng chọn {slot.label.lower()}."})
                continue
            document = await get_database()["media_assets"].find_one({"_id": media_id, "lifecycle_status": "ACTIVE"}, {"width": 1, "height": 1})
            if not document:
                continue
            width, height = int(document.get("width") or 0), int(document.get("height") or 0)
            if width and height and (width < slot.min_width or height < slot.min_height):
                errors.append({"field": f"content.{slot.key}", "code": "MEDIA_DIMENSIONS_INVALID", "message": f"{slot.label} cần tối thiểu {slot.min_width}×{slot.min_height}px."})
            if slot.aspect_ratio and width and height and abs(width / height - slot.aspect_ratio) / slot.aspect_ratio > slot.ratio_tolerance:
                errors.append({"field": f"content.{slot.key}", "code": "MEDIA_RATIO_INVALID", "message": f"{slot.label} không đúng tỷ lệ yêu cầu."})
        return errors

    async def validate_publish(self, page_key: str, draft: dict) -> list[dict]:
        errors: list[dict] = []
        seo = draft.get("seo") or {}
        geo = draft.get("geo") or {}
        content = draft.get("content") or {}
        errors.extend(self.validate_content(page_key, content, enforce_required=True))
        title = str(seo.get("title") or "").strip()
        description = str(seo.get("description") or "").strip()
        if not 30 <= len(title) <= 60:
            errors.append({"field": "seo.title", "code": "SEO_TITLE_LENGTH", "message": "Tiêu đề SEO phải từ 30 đến 60 ký tự."})
        if not 120 <= len(description) <= 160:
            errors.append({"field": "seo.description", "code": "SEO_DESCRIPTION_LENGTH", "message": "Mô tả SEO phải từ 120 đến 160 ký tự."})
        if not str(seo.get("focus_keyword") or "").strip():
            errors.append({"field": "seo.focus_keyword", "code": "SEO_FOCUS_KEYWORD_REQUIRED", "message": "Vui lòng nhập từ khóa trọng tâm."})
        keywords = [str(item).strip().casefold() for item in seo.get("keywords") or [] if str(item).strip()]
        if len(set(keywords)) < 3 or len(keywords) != len(set(keywords)):
            errors.append({"field": "seo.keywords", "code": "SEO_KEYWORDS_REQUIRED", "message": "Cần ít nhất 3 từ khóa không trùng lặp."})
        canonical = str(seo.get("canonical_url") or "").strip()
        public_host = urlparse(settings.PUBLIC_SITE_URL).hostname
        parsed_canonical = urlparse(canonical)
        if not canonical or parsed_canonical.scheme not in {"http", "https"} or parsed_canonical.hostname != public_host:
            errors.append({"field": "seo.canonical_url", "code": "SEO_CANONICAL_INVALID", "message": "Canonical URL phải thuộc tên miền website chính thức."})
        if seo.get("robots") not in {"index,follow", "noindex,follow", "noindex,nofollow"}:
            errors.append({"field": "seo.robots", "code": "SEO_ROBOTS_INVALID", "message": "Chỉ thị robots không hợp lệ."})
        if await self.pages.find_one({"page_key": {"$ne": page_key}, "$or": [{"draft.seo.title": title}, {"draft.seo.description": description}]}):
            errors.append({"field": "seo.title", "code": "SEO_DUPLICATE", "message": "Tiêu đề hoặc mô tả SEO đang trùng với trang khác."})
        if not str(geo.get("answer_summary") or "").strip():
            if page_key != "sitemap":
                errors.append({"field": "geo.answer_summary", "code": "GEO_SUMMARY_REQUIRED", "message": "Vui lòng nhập tóm tắt trả lời GEO."})
        facts_required = {"home", "about", "consignment", "projects_index", "news_index", "team_index", "recruitment_index", "privacy"}
        if page_key in facts_required and len([item for item in geo.get("key_facts") or [] if str(item).strip()]) < 3:
            errors.append({"field": "geo.key_facts", "code": "GEO_FACTS_REQUIRED", "message": "Cần ít nhất 3 thông tin chính."})
        faq_required = {"consignment", "privacy"}
        if page_key in faq_required:
            faqs = [item for item in geo.get("faqs") or [] if isinstance(item, dict) and str(item.get("question") or "").strip() and str(item.get("answer") or "").strip()]
            questions = [str(item["question"]).strip().casefold() for item in faqs]
            if len(faqs) < 3 or len(questions) != len(set(questions)):
                errors.append({"field": "geo.faqs", "code": "GEO_FAQS_REQUIRED", "message": "Cần ít nhất 3 FAQ hoàn chỉnh và không trùng câu hỏi."})
        sources = geo.get("sources") or []
        sources_required = {"home", "about", "contact", "consignment", "projects_index", "news_index", "team_index", "recruitment_index", "privacy"}
        if page_key in sources_required and (not sources or any(urlparse(str(item.get("url") or "")).scheme != "https" for item in sources if isinstance(item, dict))):
            errors.append({"field": "geo.sources", "code": "GEO_SOURCE_REQUIRED", "message": "Cần ít nhất một nguồn HTTPS hợp lệ."})
        links = geo.get("internal_links") or []
        if page_key != "sitemap" and (not links or any(not str(item.get("url") or "").startswith("/") for item in links if isinstance(item, dict))):
            errors.append({"field": "geo.internal_links", "code": "GEO_LINK_REQUIRED", "message": "Cần ít nhất một liên kết nội bộ bắt đầu bằng /."})
        return errors

    async def sync_references(self, reference: str, desired: set[str]) -> None:
        collection = get_database()["media_assets"]
        previous = await collection.find({"references": reference}, {"_id": 1}).to_list(1000)
        previous_ids = {str(item["_id"]) for item in previous}
        if previous_ids - desired:
            await collection.update_many({"_id": {"$in": sorted(previous_ids - desired)}}, {"$pull": {"references": reference}})
        if desired:
            await collection.update_many({"_id": {"$in": sorted(desired)}}, {"$addToSet": {"references": reference}})

    async def upsert(self, page_key: str, payload: dict, actor: dict) -> dict:
        self.validate_key(page_key)
        content = payload.get("content") or {}
        if not isinstance(content, dict):
            raise HTTPException(status_code=422, detail="Nội dung trang phải là một object")
        unknown_fields = sorted(set(content) - PAGE_CONTENT_FIELDS[page_key])
        if unknown_fields:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "UNKNOWN_CONTENT_SLOTS",
                    "message": "Trang chứa vị trí nội dung không thuộc schema cố định.",
                    "fields": unknown_fields,
                },
            )
        content_errors = self.validate_content(page_key, content)
        if content_errors:
            raise HTTPException(status_code=422, detail={"code": "CONTENT_VALIDATION_FAILED", "errors": content_errors})
        now = utcnow()
        existing = await self.pages.find_one({"page_key": page_key})
        expected = payload.pop("expected_version", None)
        query = {"page_key": page_key}
        if existing and expected is not None:
            query["version"] = expected
        update_doc: dict = {
            "$set": {
                "draft": payload,
                "workflow_status": "DRAFT",
                "status": existing.get("status", "DRAFT") if existing and existing.get("published_snapshot") else "DRAFT",
                "publication_status": existing.get("publication_status", "PUBLISHED" if existing and existing.get("published_snapshot") else "NEVER_PUBLISHED") if existing else "NEVER_PUBLISHED",
                "updated_by": actor.get("account_id") or actor.get("id"), "updated_at": now,
            },
            "$inc": {"version": 1},
        }
        if not existing:
            update_doc["$setOnInsert"] = {"page_key": page_key, "created_at": now}

        doc = await self.pages.find_one_and_update(
            query,
            update_doc,
            upsert=not existing,
            return_document=ReturnDocument.AFTER,
        )
        if not doc:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        await self.sync_references(f"PAGE:{page_key}:DRAFT", self.media_ids(payload))
        return serialize(doc) or {}

    async def transition(self, page_key: str, action: str, expected_version: int, actor: dict, target_version: int | None = None, note: str | None = None) -> dict:
        self.validate_key(page_key)
        now = utcnow()
        current = await self.pages.find_one({"page_key": page_key, "version": expected_version})
        if not current:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        if action == "publish":
            draft = current.get("draft") or {}
            validation_errors = await self.validate_publish(page_key, draft)
            if validation_errors:
                raise HTTPException(status_code=422, detail={"code": "PUBLISH_VALIDATION_FAILED", "errors": validation_errors})
            next_published_version = int(current.get("published_version") or 0) + 1
            snapshot = {**draft, "published_at": now, "published_by": actor.get("account_id") or actor.get("id")}
            await self.versions.insert_one({
                "page_key": page_key, "version": next_published_version, "snapshot": snapshot,
                "note": note, "created_at": now, "created_by": actor.get("account_id") or actor.get("id"),
            })
            update = {"status": "PUBLISHED", "publication_status": "PUBLISHED", "workflow_status": "PUBLISHED", "rejection_reason": None, "published_snapshot": snapshot, "published_version": next_published_version, "published_at": now}
        elif action == "rollback":
            if not target_version:
                raise HTTPException(status_code=422, detail="Thiếu phiên bản cần khôi phục")
            version = await self.versions.find_one({"page_key": page_key, "version": target_version})
            if not version:
                raise HTTPException(status_code=404, detail="Không tìm thấy phiên bản")
            restored = dict(version["snapshot"])
            restored.pop("published_at", None)
            restored.pop("published_by", None)
            update = {"workflow_status": "DRAFT", "draft": restored}
        elif action == "unpublish":
            update = {"status": "UNPUBLISHED", "publication_status": "UNPUBLISHED"}
        elif action == "archive":
            update = {"status": "ARCHIVED"}
        else:
            raise HTTPException(status_code=422, detail="Thao tác không hợp lệ")
        doc = await self.pages.find_one_and_update(
            {"page_key": page_key, "version": expected_version},
            {"$set": {**update, "updated_at": now, "updated_by": actor.get("account_id") or actor.get("id")}, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if not doc:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        if action == "publish":
            await self.sync_references(f"PAGE:{page_key}:PUBLISHED:{next_published_version}", self.media_ids(current.get("draft") or {}))
        if action in {"publish", "unpublish"}:
            try:
                await enqueue(f"WEBSITE_PAGE_{action.upper()}", {"entity_id": page_key, "page_key": page_key, "author_id": actor.get("account_id") or actor.get("id")})
            except Exception:
                logger.exception("website_page_revalidation_enqueue_failed", extra={"page_key": page_key, "action": action})
        return serialize(doc) or {}


website_page_service = WebsitePageService()
