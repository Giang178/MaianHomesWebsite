from datetime import datetime, timezone
from typing import Any
from bson import ObjectId
from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize(doc: dict | None) -> dict | None:
    if not doc:
        return None
    res = dict(doc)
    if "_id" in res:
        res["id"] = str(res.pop("_id"))
    for k, v in list(res.items()):
        if isinstance(v, ObjectId):
            res[k] = str(v)
        elif isinstance(v, datetime):
            res[k] = v.isoformat()
        elif isinstance(v, list):
            res[k] = [
                serialize(item)
                if isinstance(item, dict)
                else str(item)
                if isinstance(item, ObjectId)
                else item.isoformat()
                if isinstance(item, datetime)
                else item
                for item in v
            ]
        elif isinstance(v, dict):
            res[k] = serialize(v)
    return res


class WorkspaceService:
    @property
    def coworking_col(self):
        return get_database()["workspace_coworking"]

    @property
    def seat_types_col(self):
        return get_database()["workspace_seat_types"]

    @property
    def pricing_plans_col(self):
        return get_database()["workspace_pricing_plans"]

    @property
    def office_landing_col(self):
        return get_database()["workspace_office_landing"]

    @property
    def buildings_col(self):
        return get_database()["workspace_office_buildings"]

    @property
    def units_col(self):
        return get_database()["workspace_office_units"]

    @property
    def faqs_col(self):
        return get_database()["workspace_faqs"]

    # ==========================================
    # 1. COWORKING MANAGEMENT
    # ==========================================

    @staticmethod
    def _format_coworking_space(serialized: dict) -> dict:
        space = dict(serialized)
        space["seo"] = serialized.get("seo_metadata") or {}
        if "location" in serialized and isinstance(serialized["location"], dict):
            loc = serialized["location"]
            space["address"] = loc.get("address", "")
            space["district"] = loc.get("district", "")
            space["city"] = loc.get("city", "")
            space["phone"] = loc.get("contact_phone", "")
            space["email"] = loc.get("contact_email", "")
            space["opening_hours"] = loc.get("operating_hours", "")
        if "hero" in serialized and isinstance(serialized["hero"], dict):
            space["hero_image"] = serialized["hero"].get("image_url", "")
            space["hero_alt_text"] = serialized["hero"].get("alt_text", "")
            space["tagline"] = serialized["hero"].get("subtitle", "")
        if "introduction" in serialized and isinstance(
            serialized["introduction"], dict
        ):
            space["intro_image"] = serialized["introduction"].get("image_url", "")
            space["intro_alt_text"] = serialized["introduction"].get("alt_text", "")
            space["intro_title"] = serialized["introduction"].get("title", "")
            space["intro_short_desc"] = serialized["introduction"].get("short_desc", "")
            space["intro_full_desc"] = serialized["introduction"].get("full_desc", "")
            space["intro_highlights"] = serialized["introduction"].get("highlights", [])
            space["intro_target_audience"] = serialized["introduction"].get(
                "target_audience", []
            )

        gallery_raw = serialized.get("gallery") or []
        formatted_gallery = []
        for i, item in enumerate(gallery_raw):
            if isinstance(item, str):
                formatted_gallery.append(
                    {
                        "id": f"gal-{i + 1}",
                        "url": item,
                        "alt_text": f"Ảnh Co-working Space {i + 1}",
                        "caption": "",
                        "is_primary": (i == 0),
                        "display_order": i + 1,
                    }
                )
            elif isinstance(item, dict):
                formatted_gallery.append(
                    {
                        "id": item.get("id") or f"gal-{i + 1}",
                        "url": item.get("url", ""),
                        "alt_text": item.get("alt_text")
                        or f"Ảnh Co-working Space {i + 1}",
                        "caption": item.get("caption", ""),
                        "is_primary": bool(item.get("is_primary", i == 0)),
                        "display_order": item.get("display_order", i + 1),
                    }
                )
        space["gallery"] = formatted_gallery
        return space

    async def get_public_coworking(self) -> dict:
        doc = await self.coworking_col.find_one(
            {"key": "singleton_location", "status": "PUBLISHED"}
        )
        if not doc:
            raise HTTPException(
                status_code=404, detail="Trang Co-working hiện không được công khai"
            )

        data = doc.get("published_snapshot") or doc
        serialized_doc = serialize(data)

        # Attach active seat types, pricing plans, and FAQs
        seat_types = (
            await self.seat_types_col.find({"status": "ACTIVE"})
            .sort("display_order", 1)
            .to_list(100)
        )
        plans = (
            await self.pricing_plans_col.find({"status": "ACTIVE"})
            .sort("display_order", 1)
            .to_list(100)
        )
        faqs = (
            await self.faqs_col.find(
                {"entity_type": "COWORKING", "status": "PUBLISHED"}
            )
            .sort("display_order", 1)
            .to_list(100)
        )

        serialized_doc["seat_types"] = [serialize(st) for st in seat_types]
        serialized_doc["pricing_plans"] = [serialize(p) for p in plans]
        serialized_doc["faqs"] = [serialize(f) for f in faqs]
        serialized_doc["space"] = self._format_coworking_space(serialized_doc)
        return serialized_doc

    async def get_public_availability(self) -> dict[str, bool]:
        coworking = await self.coworking_col.find_one(
            {"key": "singleton_location", "status": "PUBLISHED"}, {"_id": 1}
        )
        office = await self.office_landing_col.find_one(
            {"key": "office_landing", "status": "PUBLISHED"}, {"_id": 1}
        )
        return {"coworking": coworking is not None, "office": office is not None}

    async def get_admin_coworking(self, preview: bool = False) -> dict:
        doc = await self.coworking_col.find_one({"key": "singleton_location"})
        if not doc:
            raise HTTPException(
                status_code=404, detail="Không tìm thấy bản ghi Co-working"
            )

        target_data = (
            doc.get("draft_snapshot") if preview and doc.get("draft_snapshot") else doc
        )
        serialized = serialize(target_data)

        seat_types = (
            await self.seat_types_col.find().sort("display_order", 1).to_list(100)
        )
        plans = (
            await self.pricing_plans_col.find().sort("display_order", 1).to_list(100)
        )
        faqs = (
            await self.faqs_col.find({"entity_type": "COWORKING"})
            .sort("display_order", 1)
            .to_list(100)
        )

        serialized["seat_types"] = [serialize(st) for st in seat_types]
        serialized["pricing_plans"] = [serialize(p) for p in plans]
        serialized["faqs"] = [serialize(f) for f in faqs]
        serialized["has_draft"] = doc.get("draft_snapshot") is not None
        serialized["status"] = doc.get("status", "PUBLISHED")
        serialized["version"] = doc.get("version", 1)
        serialized["space"] = self._format_coworking_space(serialized)
        return serialized

    async def upsert_coworking(self, payload: dict, current_user: dict) -> dict:
        now = utcnow()
        existing = await self.coworking_col.find_one({"key": "singleton_location"})
        version = (existing.get("version", 0) + 1) if existing else 1

        update_doc = dict(payload)

        # Sync flat fields if provided from admin form
        if any(
            k in update_doc
            for k in ("address", "district", "city", "phone", "email", "opening_hours")
        ):
            loc = dict(
                update_doc.get("location")
                or (existing.get("location") if existing else {})
                or {}
            )
            if "address" in update_doc and update_doc["address"]:
                loc["address"] = update_doc["address"]
            if "district" in update_doc and update_doc["district"]:
                loc["district"] = update_doc["district"]
            if "city" in update_doc and update_doc["city"]:
                loc["city"] = update_doc["city"]
            if "phone" in update_doc and update_doc["phone"]:
                loc["contact_phone"] = update_doc["phone"]
            if "email" in update_doc and update_doc["email"]:
                loc["contact_email"] = update_doc["email"]
            if "opening_hours" in update_doc and update_doc["opening_hours"]:
                loc["operating_hours"] = update_doc["opening_hours"]
            update_doc["location"] = loc

        if (
            "hero_image" in update_doc
            or "tagline" in update_doc
            or "hero_alt_text" in update_doc
        ):
            hero = dict(
                update_doc.get("hero")
                or (existing.get("hero") if existing else {})
                or {}
            )
            if "hero_image" in update_doc and update_doc["hero_image"]:
                hero["image_url"] = update_doc["hero_image"]
            if "hero_alt_text" in update_doc:
                hero["alt_text"] = update_doc["hero_alt_text"]
            if "tagline" in update_doc and update_doc["tagline"]:
                hero["subtitle"] = update_doc["tagline"]
            update_doc["hero"] = hero

        if any(
            k in update_doc
            for k in (
                "intro_image",
                "intro_alt_text",
                "intro_title",
                "intro_short_desc",
                "intro_full_desc",
                "intro_highlights",
                "intro_target_audience",
            )
        ):
            intro = dict(
                update_doc.get("introduction")
                or (existing.get("introduction") if existing else {})
                or {}
            )
            if "intro_image" in update_doc and update_doc["intro_image"]:
                intro["image_url"] = update_doc["intro_image"]
            if "intro_alt_text" in update_doc:
                intro["alt_text"] = update_doc["intro_alt_text"]
            if "intro_title" in update_doc and update_doc["intro_title"]:
                intro["title"] = update_doc["intro_title"]
            if "intro_short_desc" in update_doc and update_doc["intro_short_desc"]:
                intro["short_desc"] = update_doc["intro_short_desc"]
            if "intro_full_desc" in update_doc and update_doc["intro_full_desc"]:
                intro["full_desc"] = update_doc["intro_full_desc"]
            if "intro_highlights" in update_doc:
                if isinstance(update_doc["intro_highlights"], list):
                    intro["highlights"] = [
                        h.strip()
                        for h in update_doc["intro_highlights"]
                        if isinstance(h, str) and h.strip()
                    ]
                elif isinstance(update_doc["intro_highlights"], str):
                    intro["highlights"] = [
                        h.strip()
                        for h in update_doc["intro_highlights"].split("\n")
                        if h.strip()
                    ]
            if "intro_target_audience" in update_doc:
                if isinstance(update_doc["intro_target_audience"], list):
                    intro["target_audience"] = [
                        t.strip()
                        for t in update_doc["intro_target_audience"]
                        if isinstance(t, str) and t.strip()
                    ]
                elif isinstance(update_doc["intro_target_audience"], str):
                    intro["target_audience"] = [
                        t.strip()
                        for t in update_doc["intro_target_audience"].split("\n")
                        if t.strip()
                    ]
            update_doc["introduction"] = intro

        if "seo" in update_doc and isinstance(update_doc["seo"], dict):
            seo = dict(
                update_doc.get("seo_metadata")
                or (existing.get("seo_metadata") if existing else {})
                or {}
            )
            seo_in = update_doc["seo"]
            if "meta_title" in seo_in:
                seo["title"] = seo_in["meta_title"]
            if "meta_description" in seo_in:
                seo["description"] = seo_in["meta_description"]
            if "canonical_url" in seo_in:
                seo["canonical_url"] = seo_in["canonical_url"]
            if "robots_directives" in seo_in:
                seo["robots"] = seo_in["robots_directives"]
            update_doc["seo_metadata"] = seo

        status = update_doc.get("status") or (
            existing.get("status") if existing else "PUBLISHED"
        )

        # Extract nested collections so they don't pollute the singleton_location document
        seat_types_input = update_doc.pop("seat_types", None)
        pricing_plans_input = update_doc.pop("pricing_plans", None)
        faqs_input = update_doc.pop("faqs", None)

        update_data = {
            **update_doc,
            "status": status,
            "version": version,
            "updated_at": now,
            "updated_by": current_user.get("email"),
            "draft_snapshot": update_doc,
        }
        if status == "PUBLISHED":
            update_data["published_snapshot"] = update_doc
            update_data["published_version"] = version

        # CRITICAL: Prevent ConflictingUpdateOperators and immutable _id error
        for forbidden in ("_id", "id", "created_at", "space"):
            update_data.pop(forbidden, None)

        doc = await self.coworking_col.find_one_and_update(
            {"key": "singleton_location"},
            {"$set": update_data, "$setOnInsert": {"created_at": now}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        # Synchronize seat_types, pricing_plans, faqs if provided
        if seat_types_input is not None and isinstance(seat_types_input, list):
            saved_st_ids = []
            for st in seat_types_input:
                if isinstance(st, dict):
                    st_id = st.get("id") or st.get("_id")
                    st_data = {
                        "space_key": "singleton_location",
                        "name": st.get("name", ""),
                        "code": st.get("code", ""),
                        "description": st.get("description", ""),
                        "target_audience": st.get("target_audience", ""),
                        "image_url": st.get("image_url"),
                        "alt_text": st.get("alt_text", ""),
                        "capacity": st.get("capacity"),
                        "reference_price": st.get("reference_price"),
                        "status": st.get("status", "ACTIVE"),
                        "display_order": st.get("display_order", 0),
                        "updated_at": now,
                    }
                    if (
                        st_id
                        and len(str(st_id)) == 24
                        and ObjectId.is_valid(str(st_id))
                    ):
                        obj_id = ObjectId(str(st_id))
                        await self.seat_types_col.update_one(
                            {"_id": obj_id}, {"$set": st_data}, upsert=True
                        )
                        saved_st_ids.append(obj_id)
                    elif st_id and not str(st_id).startswith("seat-"):
                        res = await self.seat_types_col.update_one(
                            {"id": st_id}, {"$set": st_data}, upsert=True
                        )
                        if res.upserted_id:
                            saved_st_ids.append(res.upserted_id)
                        else:
                            found = await self.seat_types_col.find_one({"id": st_id})
                            if found:
                                saved_st_ids.append(found["_id"])
                    else:
                        st_data["created_at"] = now
                        res = await self.seat_types_col.insert_one(st_data)
                        saved_st_ids.append(res.inserted_id)
            if saved_st_ids:
                await self.seat_types_col.delete_many(
                    {
                        "space_key": "singleton_location",
                        "_id": {"$nin": saved_st_ids},
                    }
                )

        if pricing_plans_input is not None and isinstance(pricing_plans_input, list):
            saved_plan_ids = []
            for p in pricing_plans_input:
                if isinstance(p, dict):
                    p_id = p.get("id") or p.get("_id")
                    p_data = {
                        "space_key": "singleton_location",
                        "seat_type_id": p.get("seat_type_id"),
                        "seat_type_name": p.get("seat_type_name"),
                        "name": p.get("name", ""),
                        "code": p.get("code") or p.get("plan_code", ""),
                        "description": p.get("description", ""),
                        "price": p.get("price"),
                        "currency": p.get("currency", "VND"),
                        "billing_period": p.get("billing_period", "THANG"),
                        "duration": p.get("duration", "Theo tháng"),
                        "benefits": p.get("benefits") or p.get("features") or [],
                        "extra_fees": p.get("extra_fees"),
                        "is_featured": bool(
                            p.get("is_featured") or p.get("is_popular")
                        ),
                        "badge": p.get("badge") or p.get("badge_label") or "",
                        "status": p.get("status", "ACTIVE"),
                        "display_order": p.get("display_order", 0),
                        "updated_at": now,
                    }
                    if p_id and len(str(p_id)) == 24 and ObjectId.is_valid(str(p_id)):
                        obj_id = ObjectId(str(p_id))
                        await self.pricing_plans_col.update_one(
                            {"_id": obj_id}, {"$set": p_data}, upsert=True
                        )
                        saved_plan_ids.append(obj_id)
                    elif p_id and not str(p_id).startswith("plan-"):
                        res = await self.pricing_plans_col.update_one(
                            {"id": p_id}, {"$set": p_data}, upsert=True
                        )
                        if res.upserted_id:
                            saved_plan_ids.append(res.upserted_id)
                        else:
                            found = await self.pricing_plans_col.find_one({"id": p_id})
                            if found:
                                saved_plan_ids.append(found["_id"])
                    else:
                        p_data["created_at"] = now
                        res = await self.pricing_plans_col.insert_one(p_data)
                        saved_plan_ids.append(res.inserted_id)
            if saved_plan_ids:
                await self.pricing_plans_col.delete_many(
                    {
                        "space_key": "singleton_location",
                        "_id": {"$nin": saved_plan_ids},
                    }
                )

        if faqs_input is not None and isinstance(faqs_input, list):
            for f in faqs_input:
                if isinstance(f, dict):
                    f_id = f.get("id") or f.get("_id")
                    f_data = {
                        "entity_type": "COWORKING",
                        "entity_id": "singleton_location",
                        "question": f.get("question", ""),
                        "answer": f.get("answer", ""),
                        "display_order": f.get("display_order", 0),
                        "status": f.get("status", "PUBLISHED"),
                        "updated_at": now,
                    }
                    if f_id and len(str(f_id)) == 24:
                        await self.faqs_col.update_one(
                            {"_id": ObjectId(f_id)}, {"$set": f_data}, upsert=True
                        )
                    elif f_id:
                        await self.faqs_col.update_one(
                            {"id": f_id}, {"$set": f_data}, upsert=True
                        )

        res = serialize(doc)
        res["space"] = self._format_coworking_space(res)
        return res

    async def transition_coworking(
        self,
        action: str,
        expected_version: int,
        current_user: dict,
        note: str | None = None,
    ) -> dict:
        doc = await self.coworking_col.find_one({"key": "singleton_location"})
        if not doc:
            raise HTTPException(
                status_code=404, detail="Không tìm thấy bản ghi Co-working"
            )

        if doc.get("version", 1) != expected_version:
            raise HTTPException(
                status_code=409,
                detail="Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại trang.",
            )

        now = utcnow()
        new_version = doc.get("version", 1) + 1

        if action == "PUBLISH":
            snapshot = doc.get("draft_snapshot") or {
                k: v
                for k, v in doc.items()
                if k not in {"_id", "draft_snapshot", "published_snapshot"}
            }
            update = {
                "status": "PUBLISHED",
                "published_snapshot": snapshot,
                "draft_snapshot": None,
                "published_version": new_version,
                "version": new_version,
                "updated_at": now,
                "updated_by": current_user.get("email"),
            }
        elif action == "HIDE":
            update = {
                "status": "HIDDEN",
                "version": new_version,
                "updated_at": now,
                "updated_by": current_user.get("email"),
            }
        elif action == "DRAFT":
            update = {
                "status": "DRAFT",
                "version": new_version,
                "updated_at": now,
                "updated_by": current_user.get("email"),
            }
        else:
            raise HTTPException(status_code=400, detail="Hành động không hợp lệ")

        updated = await self.coworking_col.find_one_and_update(
            {"key": "singleton_location"},
            {"$set": update},
            return_document=ReturnDocument.AFTER,
        )
        return serialize(updated)

    # Seat Types
    async def list_seat_types(self) -> list[dict]:
        items = await self.seat_types_col.find().sort("display_order", 1).to_list(100)
        return [serialize(item) for item in items]

    async def create_seat_type(self, payload: dict, current_user: dict) -> dict:
        now = utcnow()
        doc = {
            **payload,
            "space_key": "singleton_location",
            "created_at": now,
            "updated_at": now,
        }
        res = await self.seat_types_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize(doc)

    async def update_seat_type(
        self, seat_type_id: str, payload: dict, current_user: dict
    ) -> dict:
        if not ObjectId.is_valid(seat_type_id):
            raise HTTPException(status_code=400, detail="ID loại chỗ ngồi không hợp lệ")
        now = utcnow()
        res = await self.seat_types_col.find_one_and_update(
            {"_id": ObjectId(seat_type_id)},
            {"$set": {**payload, "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if not res:
            raise HTTPException(status_code=404, detail="Không tìm thấy loại chỗ ngồi")
        return serialize(res)

    async def delete_seat_type(self, seat_type_id: str, current_user: dict) -> dict:
        if not ObjectId.is_valid(seat_type_id):
            raise HTTPException(status_code=400, detail="ID loại chỗ ngồi không hợp lệ")
        res = await self.seat_types_col.delete_one({"_id": ObjectId(seat_type_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy loại chỗ ngồi")
        return {"success": True, "message": "Đã xóa loại chỗ ngồi"}

    # Pricing Plans
    async def list_pricing_plans(self) -> list[dict]:
        items = (
            await self.pricing_plans_col.find().sort("display_order", 1).to_list(100)
        )
        return [serialize(item) for item in items]

    async def create_pricing_plan(self, payload: dict, current_user: dict) -> dict:
        now = utcnow()
        doc = {
            **payload,
            "space_key": "singleton_location",
            "created_at": now,
            "updated_at": now,
        }
        res = await self.pricing_plans_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize(doc)

    async def update_pricing_plan(
        self, plan_id: str, payload: dict, current_user: dict
    ) -> dict:
        if not ObjectId.is_valid(plan_id):
            raise HTTPException(status_code=400, detail="ID gói thuê không hợp lệ")
        now = utcnow()
        res = await self.pricing_plans_col.find_one_and_update(
            {"_id": ObjectId(plan_id)},
            {"$set": {**payload, "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if not res:
            raise HTTPException(status_code=404, detail="Không tìm thấy gói thuê")
        return serialize(res)

    async def delete_pricing_plan(self, plan_id: str, current_user: dict) -> dict:
        if not ObjectId.is_valid(plan_id):
            raise HTTPException(status_code=400, detail="ID gói thuê không hợp lệ")
        res = await self.pricing_plans_col.delete_one({"_id": ObjectId(plan_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy gói thuê")
        return {"success": True, "message": "Đã xóa gói thuê"}

    # ==========================================
    # 2. OFFICE LANDING CONTENT
    # ==========================================

    def _normalize_office_landing(self, doc: dict) -> dict:
        serialized = serialize(doc) or {}
        seo = serialized.get("seo_metadata") or serialized.get("seo") or {}
        keywords_str = (
            ", ".join(seo.get("keywords", []))
            if isinstance(seo.get("keywords"), list)
            else str(seo.get("keywords") or "")
        )
        serialized["seo"] = {
            "meta_title": seo.get("title") or seo.get("meta_title") or "",
            "meta_description": seo.get("description") or seo.get("meta_description") or "",
            "keywords": keywords_str,
            **seo,
        }
        return serialized

    async def get_public_office_landing(self) -> dict:
        doc = await self.office_landing_col.find_one(
            {"key": "office_landing", "status": "PUBLISHED"}
        )
        if not doc:
            doc = await self.office_landing_col.find_one({"key": "office_landing"})
            if doc:
                raise HTTPException(
                    status_code=404, detail="Trang Office hiện không được công khai"
                )
            if not doc:
                raise HTTPException(status_code=404, detail="Office landing chưa được cấu hình")
        data = doc.get("published_snapshot") or doc
        normalized = self._normalize_office_landing(data)
        faqs = (
            await self.faqs_col.find(
                {"entity_type": "OFFICE_LANDING", "status": "PUBLISHED"}
            )
            .sort("display_order", 1)
            .to_list(100)
        )
        normalized["faqs"] = [serialize(f) for f in faqs]
        return normalized

    async def get_admin_office_landing(self, preview: bool = False) -> dict:
        doc = await self.office_landing_col.find_one({"key": "office_landing"})
        if not doc:
            doc = {
                "key": "office_landing",
                "status": "DRAFT",
                "version": 1,
            }
        target = (
            doc.get("draft_snapshot") if preview and doc.get("draft_snapshot") else doc
        )
        normalized = self._normalize_office_landing(target)
        faqs = (
            await self.faqs_col.find({"entity_type": "OFFICE_LANDING"})
            .sort("display_order", 1)
            .to_list(100)
        )
        normalized["faqs"] = [serialize(f) for f in faqs]
        normalized["has_draft"] = doc.get("draft_snapshot") is not None
        normalized["version"] = doc.get("version", 1)
        return normalized

    async def upsert_office_landing(self, payload: dict, current_user: dict) -> dict:
        now = utcnow()
        existing = await self.office_landing_col.find_one({"key": "office_landing"})
        version = (existing.get("version", 0) + 1) if existing else 1
        is_published = bool(existing and existing.get("status") == "PUBLISHED")

        # GET responses contain persistence metadata that the admin form can
        # send back. Keep server-owned fields out of $set; otherwise they can
        # overlap with $setOnInsert and MongoDB raises error code 40.
        content = dict(payload)
        faqs_input = content.pop("faqs", None)
        for field in (
            "_id",
            "id",
            "created_at",
            "updated_at",
            "updated_by",
            "status",
            "version",
            "published_snapshot",
            "published_version",
            "draft_snapshot",
            "has_draft",
        ):
            content.pop(field, None)

        # CRITICAL: Preserve and merge existing grade_pages so partial updates or saving other tabs never erases grade_pages
        if existing and existing.get("grade_pages"):
            existing_gp = dict(existing.get("grade_pages") or {})
            if "grade_pages" in content and isinstance(content["grade_pages"], dict) and content["grade_pages"]:
                # Deep merge each grade (A, B, C)
                merged_gp = dict(existing_gp)
                for g_key, g_val in content["grade_pages"].items():
                    if isinstance(g_val, dict) and isinstance(merged_gp.get(g_key), dict):
                        merged_gp[g_key] = {**merged_gp[g_key], **g_val}
                    else:
                        merged_gp[g_key] = g_val
                content["grade_pages"] = merged_gp
            elif not content.get("grade_pages"):
                content["grade_pages"] = existing_gp

        update_data = {
            **content,
            "version": version,
            "updated_at": now,
            "updated_by": current_user.get("email"),
            "draft_snapshot": None if is_published else content,
        }
        # The Office admin promises that saved content is synchronized to the
        # customer-facing page. Keep the public snapshot current when editing an
        # already-published landing page; drafts remain private until published.
        if is_published:
            update_data["published_snapshot"] = content
            update_data["published_version"] = version
        doc = await self.office_landing_col.find_one_and_update(
            {"key": "office_landing"},
            {
                "$set": update_data,
                "$setOnInsert": {"created_at": now, "status": "DRAFT"},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        if isinstance(faqs_input, list):
            saved_ids = []
            for index, faq in enumerate(faqs_input):
                if not isinstance(faq, dict):
                    continue
                faq_data = {
                    "entity_type": "OFFICE_LANDING",
                    "entity_id": "office_landing",
                    "question": str(faq.get("question") or "").strip(),
                    "answer": str(faq.get("answer") or "").strip(),
                    "display_order": faq.get("display_order", index + 1),
                    "status": faq.get("status", "PUBLISHED"),
                    "updated_at": now,
                }
                faq_id = faq.get("id") or faq.get("_id")
                if faq_id and ObjectId.is_valid(str(faq_id)):
                    object_id = ObjectId(str(faq_id))
                    await self.faqs_col.update_one(
                        {"_id": object_id, "entity_type": "OFFICE_LANDING"},
                        {"$set": faq_data},
                    )
                    saved_ids.append(object_id)
                else:
                    faq_data["created_at"] = now
                    result = await self.faqs_col.insert_one(faq_data)
                    saved_ids.append(result.inserted_id)

            delete_query: dict[str, Any] = {
                "entity_type": "OFFICE_LANDING",
                "entity_id": "office_landing",
            }
            if saved_ids:
                delete_query["_id"] = {"$nin": saved_ids}
            await self.faqs_col.delete_many(delete_query)

        return serialize(doc)

    async def transition_office_landing(
        self,
        action: str,
        expected_version: int,
        current_user: dict,
        note: str | None = None,
    ) -> dict:
        doc = await self.office_landing_col.find_one({"key": "office_landing"})
        if not doc:
            raise HTTPException(
                status_code=404, detail="Không tìm thấy bản ghi Office Landing"
            )
        if doc.get("version", 1) != expected_version:
            raise HTTPException(
                status_code=409,
                detail="Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại trang.",
            )
        now = utcnow()
        new_version = doc.get("version", 1) + 1

        if action == "PUBLISH":
            snapshot = doc.get("draft_snapshot") or {
                k: v
                for k, v in doc.items()
                if k not in {"_id", "draft_snapshot", "published_snapshot"}
            }
            update = {
                "status": "PUBLISHED",
                "published_snapshot": snapshot,
                "draft_snapshot": None,
                "published_version": new_version,
                "version": new_version,
                "updated_at": now,
                "updated_by": current_user.get("email"),
            }
        elif action == "HIDE":
            update = {
                "status": "HIDDEN",
                "version": new_version,
                "updated_at": now,
                "updated_by": current_user.get("email"),
            }
        elif action == "DRAFT":
            update = {
                "status": "DRAFT",
                "version": new_version,
                "updated_at": now,
                "updated_by": current_user.get("email"),
            }
        else:
            raise HTTPException(status_code=400, detail="Hành động không hợp lệ")

        updated = await self.office_landing_col.find_one_and_update(
            {"key": "office_landing"},
            {"$set": update},
            return_document=ReturnDocument.AFTER,
        )
        return serialize(updated)

    # ==========================================
    # 3. OFFICE BUILDINGS & UNITS
    # ==========================================

    @staticmethod
    def _building_content(doc: dict, *, preview: bool = False) -> dict:
        if preview and doc.get("draft_snapshot"):
            content = dict(doc["draft_snapshot"])
        elif not preview and doc.get("status") == "PUBLISHED" and doc.get("published_snapshot"):
            content = dict(doc["published_snapshot"])
        else:
            content = {
                key: value
                for key, value in doc.items()
                if key not in {"draft_snapshot", "published_snapshot"}
            }

        content["_id"] = doc["_id"]
        content["status"] = doc.get("status", "DRAFT")
        content["version"] = doc.get("version", 1)
        content["published_version"] = doc.get("published_version", 0)
        return content

    @staticmethod
    def _building_slug_query(slug: str, exclude_id: ObjectId | None = None) -> dict:
        query: dict[str, Any] = {
            "$or": [
                {"slug": slug},
                {"draft_snapshot.slug": slug},
                {"published_snapshot.slug": slug},
            ]
        }
        if exclude_id is not None:
            query["_id"] = {"$ne": exclude_id}
        return query

    async def list_public_buildings(
        self,
        district: str | None = None,
        area_min: float | None = None,
        area_max: float | None = None,
        budget_min: float | None = None,
        budget_max: float | None = None,
        budget_band: str | None = None,
        area_band: str | None = None,
        grade: str | None = None,
        availability: str | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        budget_ranges = {
            "under_20": (None, 20.0),
            "20_35": (20.0, 35.0),
            "over_35": (35.0, None),
        }
        area_ranges = {
            "under_100": (None, 100.0),
            "100_300": (100.0, 300.0),
            "300_500": (300.0, 500.0),
            "over_500": (500.0, None),
        }
        if budget_band:
            if budget_band not in budget_ranges:
                raise HTTPException(status_code=400, detail="Invalid budget band")
            budget_min, budget_max = budget_ranges[budget_band]
        if area_band:
            if area_band not in area_ranges:
                raise HTTPException(status_code=400, detail="Invalid area band")
            area_min, area_max = area_ranges[area_band]

        buildings = (
            await self.buildings_col.find({"status": "PUBLISHED"})
            .sort("display_order", 1)
            .to_list(None)
        )
        published_buildings = [self._building_content(doc) for doc in buildings]
        selected_grade = grade.upper() if grade and grade != "all" else None
        districts = sorted(
            {
                str(item.get("district")).strip()
                for item in published_buildings
                if item.get("district")
                and (not selected_grade or str(item.get("building_grade") or "").upper() == selected_grade)
            },
            key=str.casefold,
        )

        # For each building, aggregate units to compute min_area, max_area, min_price, available_units_count
        building_items = []
        for b in published_buildings:
            if district and district != "all" and str(b.get("district") or "").casefold() != district.casefold():
                continue
            if selected_grade and str(b.get("building_grade") or "").upper() != selected_grade:
                continue
            if search and search.strip():
                needle = search.strip().casefold()
                haystack = " ".join(
                    str(b.get(field) or "") for field in ("name", "address", "description")
                ).casefold()
                if needle not in haystack:
                    continue

            b_id = str(b["_id"])
            unit_query: dict[str, Any] = {"building_id": b_id, "status": {"$ne": "HIDDEN"}}
            units = await self.units_col.find(unit_query).to_list(None)

            available_units = [
                u
                for u in units
                if u.get("availability_status") in {"AVAILABLE", "UPCOMING"}
            ]
            areas = [u.get("area", 0) for u in units if u.get("area")]
            prices = [u.get("rental_price", 0) for u in units if u.get("rental_price")]

            min_area = min(areas) if areas else 0.0
            max_area = max(areas) if areas else 0.0
            min_price = min(prices) if prices else float(b.get("price_per_sqm_min") or 0)
            max_price = max(prices) if prices else float(b.get("price_per_sqm_max") or min_price)

            # Filter by area if specified
            if area_min is not None and max_area < area_min:
                continue
            if area_max is not None and min_area > area_max:
                continue

            # Filter by budget if specified
            if budget_min is not None and max_price < budget_min:
                continue
            if budget_max is not None and min_price > budget_max:
                continue

            # Filter by availability
            if availability == "AVAILABLE" and not any(
                u.get("availability_status") == "AVAILABLE" for u in units
            ):
                continue
            if availability == "UPCOMING" and not any(
                u.get("availability_status") == "UPCOMING" for u in units
            ):
                continue

            s_building = serialize(b)
            s_building["min_area"] = min_area
            s_building["max_area"] = max_area
            s_building["min_price"] = min_price
            s_building["max_price"] = max_price
            s_building["total_units"] = len(units)
            s_building["available_units_count"] = len(available_units)
            s_building["has_available_units"] = len(available_units) > 0
            building_items.append(s_building)

        # Pagination on filtered results
        total = len(building_items)
        start = (page - 1) * limit
        end = start + limit
        paginated_items = building_items[start:end]

        return {
            "items": paginated_items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 1,
            "districts": districts,
        }

    async def get_public_building_by_slug(self, slug: str) -> dict:
        doc = await self.buildings_col.find_one(
            {
                "status": "PUBLISHED",
                "$or": [{"slug": slug}, {"published_snapshot.slug": slug}],
            }
        )
        if not doc:
            raise HTTPException(
                status_code=404, detail="Không tìm thấy tòa nhà văn phòng"
            )

        b_id = str(doc["_id"])
        units = (
            await self.units_col.find({"building_id": b_id, "status": {"$ne": "HIDDEN"}})
            .sort("display_order", 1)
            .to_list(None)
        )
        faqs = (
            await self.faqs_col.find(
                {"entity_type": "BUILDING", "entity_id": b_id, "status": "PUBLISHED"}
            )
            .sort("display_order", 1)
            .to_list(None)
        )

        public_content = self._building_content(doc)
        if public_content.get("slug") != slug:
            raise HTTPException(
                status_code=404, detail="Không tìm thấy tòa nhà văn phòng"
            )
        s_building = serialize(public_content)
        serialized_units = []
        for u in units:
            su = serialize(u)
            if not su.get("unit_code"):
                su["unit_code"] = su.get("code") or su.get("unit_number") or ""
            serialized_units.append(su)
        s_building["units"] = serialized_units
        s_building["faqs"] = [serialize(f) for f in faqs]
        s_building["has_available_units"] = any(
            u.get("availability_status") in {"AVAILABLE", "UPCOMING"} for u in units
        )
        return s_building

    async def get_preview_building_by_slug(self, slug: str) -> dict:
        doc = await self.buildings_col.find_one(self._building_slug_query(slug))
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")

        content = self._building_content(doc, preview=True)
        if content.get("slug") != slug:
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")

        building_id = str(doc["_id"])
        units = (
            await self.units_col.find({"building_id": building_id})
            .sort("display_order", 1)
            .to_list(None)
        )
        faqs = (
            await self.faqs_col.find(
                {"entity_type": "BUILDING", "entity_id": building_id, "status": "PUBLISHED"}
            )
            .sort("display_order", 1)
            .to_list(None)
        )
        result = serialize(content)
        preview_units = []
        for unit in units:
            su = serialize(unit)
            if not su.get("unit_code"):
                su["unit_code"] = su.get("code") or su.get("unit_number") or ""
            preview_units.append(su)
        result["units"] = preview_units
        result["faqs"] = [serialize(faq) for faq in faqs]
        result["has_available_units"] = any(
            unit.get("availability_status") in {"AVAILABLE", "UPCOMING"}
            for unit in units
        )
        return result

    async def list_admin_buildings(
        self,
        page: int = 1,
        limit: int = 50,
        search: str | None = None,
        status: str | None = None,
    ) -> dict:
        query: dict[str, Any] = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"address": {"$regex": search, "$options": "i"}},
                {"district": {"$regex": search, "$options": "i"}},
                {"code": {"$regex": search, "$options": "i"}},
            ]
        total = await self.buildings_col.count_documents(query)
        items = (
            await self.buildings_col.find(query)
            .sort("display_order", 1)
            .skip((page - 1) * limit)
            .limit(limit)
            .to_list(limit)
        )

        results = []
        for b in items:
            b_id = str(b["_id"])
            units_count = await self.units_col.count_documents({"building_id": b_id})
            avail_count = await self.units_col.count_documents(
                {
                    "building_id": b_id,
                    "status": "ACTIVE",
                    "availability_status": "AVAILABLE",
                }
            )
            s_b = serialize(b)
            s_b["has_draft"] = b.get("draft_snapshot") is not None
            s_b.pop("draft_snapshot", None)
            s_b.pop("published_snapshot", None)
            s_b["units_count"] = units_count
            s_b["available_units_count"] = avail_count
            results.append(s_b)

        return {"items": results, "total": total, "page": page, "limit": limit}

    async def get_admin_building(self, building_id: str, preview: bool = False) -> dict:
        if not ObjectId.is_valid(building_id):
            raise HTTPException(status_code=400, detail="ID tòa nhà không hợp lệ")
        doc = await self.buildings_col.find_one({"_id": ObjectId(building_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")

        s_b = serialize(self._building_content(doc, preview=preview))
        units = (
            await self.units_col.find({"building_id": building_id})
            .sort("display_order", 1)
            .to_list(None)
        )
        faqs = (
            await self.faqs_col.find(
                {"entity_type": "BUILDING", "entity_id": building_id}
            )
            .sort("display_order", 1)
            .to_list(None)
        )
        s_b["units"] = [serialize(u) for u in units]
        s_b["faqs"] = [serialize(f) for f in faqs]
        s_b["has_draft"] = doc.get("draft_snapshot") is not None
        s_b["version"] = doc.get("version", 1)
        s_b["status"] = doc.get("status", "PUBLISHED")
        return s_b

    async def create_building(self, payload: dict, current_user: dict) -> dict:
        now = utcnow()
        existing = await self.buildings_col.find_one(
            self._building_slug_query(payload["slug"])
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Slug tòa nhà đã tồn tại. Vui lòng chọn đường dẫn khác.",
            )

        doc = {
            **payload,
            "status": "DRAFT",
            "version": 1,
            "published_version": 0,
            "draft_snapshot": payload,
            "published_snapshot": None,
            "created_at": now,
            "updated_at": now,
            "created_by": current_user.get("email"),
        }
        try:
            res = await self.buildings_col.insert_one(doc)
        except DuplicateKeyError as exc:
            raise HTTPException(status_code=409, detail="Slug tòa nhà đã tồn tại") from exc
        doc["_id"] = res.inserted_id
        return serialize(doc)

    async def update_building(
        self,
        building_id: str,
        payload: dict,
        current_user: dict,
        expected_version: int | None = None,
    ) -> dict:
        if not ObjectId.is_valid(building_id):
            raise HTTPException(status_code=400, detail="ID tòa nhà không hợp lệ")
        now = utcnow()
        existing = await self.buildings_col.find_one({"_id": ObjectId(building_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")

        slug_check = await self.buildings_col.find_one(
            self._building_slug_query(payload["slug"], ObjectId(building_id))
        )
        if slug_check:
            raise HTTPException(
                status_code=400, detail="Slug tòa nhà đã được dùng cho tòa nhà khác"
            )

        current_version = existing.get("version", 1)
        if expected_version is not None and current_version != expected_version:
            raise HTTPException(
                status_code=409,
                detail="Dữ liệu đã được thay đổi bởi người khác. Vui lòng tải lại trang.",
            )

        version = current_version + 1
        update_data = {
            **payload,
            "version": version,
            "updated_at": now,
            "updated_by": current_user.get("email"),
            "draft_snapshot": payload,
        }
        if existing.get("status") == "PUBLISHED" and not existing.get("published_snapshot"):
            update_data["published_snapshot"] = {
                key: value
                for key, value in existing.items()
                if key
                not in {
                    "_id",
                    "status",
                    "version",
                    "published_version",
                    "draft_snapshot",
                    "published_snapshot",
                    "created_at",
                    "updated_at",
                    "created_by",
                    "updated_by",
                }
            }
            update_data["published_version"] = current_version
        update_filter: dict[str, Any] = {"_id": ObjectId(building_id)}
        if expected_version is not None:
            update_filter["version"] = expected_version
        updated = await self.buildings_col.find_one_and_update(
            update_filter,
            {"$set": update_data},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(
                status_code=409,
                detail="Dữ liệu đã được thay đổi bởi người khác. Vui lòng tải lại trang.",
            )
        return serialize(updated)

    async def transition_building(
        self,
        building_id: str,
        action: str,
        expected_version: int,
        current_user: dict,
    ) -> dict:
        if not ObjectId.is_valid(building_id):
            raise HTTPException(status_code=400, detail="ID tòa nhà không hợp lệ")
        doc = await self.buildings_col.find_one({"_id": ObjectId(building_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")

        current_version = doc.get("version", 1)
        if current_version != expected_version:
            raise HTTPException(
                status_code=409,
                detail="Dữ liệu đã được thay đổi bởi người khác. Vui lòng tải lại trang.",
            )

        now = utcnow()
        new_version = current_version + 1
        status_map = {"PUBLISH": "PUBLISHED", "HIDE": "HIDDEN", "DRAFT": "DRAFT"}
        target_status = status_map.get(action)
        if not target_status:
            raise HTTPException(status_code=400, detail="Hành động không hợp lệ")

        update = {
            "status": target_status,
            "version": new_version,
            "updated_at": now,
            "updated_by": current_user.get("email"),
        }
        if action == "PUBLISH":
            snapshot = doc.get("draft_snapshot") or {
                k: v
                for k, v in doc.items()
                if k not in {"_id", "draft_snapshot", "published_snapshot"}
            }
            update["published_snapshot"] = snapshot
            update["draft_snapshot"] = None
            update["published_version"] = new_version

        updated = await self.buildings_col.find_one_and_update(
            {"_id": ObjectId(building_id), "version": expected_version},
            {"$set": update},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(
                status_code=409,
                detail="Dữ liệu đã được thay đổi bởi người khác. Vui lòng tải lại trang.",
            )
        return serialize(updated)

    async def delete_building(self, building_id: str, current_user: dict) -> dict:
        if not ObjectId.is_valid(building_id):
            raise HTTPException(status_code=400, detail="ID tòa nhà không hợp lệ")
        res = await self.buildings_col.delete_one({"_id": ObjectId(building_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")
        await self.units_col.delete_many({"building_id": building_id})
        await self.faqs_col.delete_many(
            {"entity_type": "BUILDING", "entity_id": building_id}
        )
        return {"success": True, "message": "Đã xóa tòa nhà và các diện tích liên kết"}

    # Units
    async def list_units(
        self, building_id: str, public_only: bool = False
    ) -> list[dict]:
        query: dict[str, Any] = {"building_id": building_id}
        if public_only:
            query["status"] = "ACTIVE"
        items = await self.units_col.find(query).sort("display_order", 1).to_list(None)
        return [serialize(item) for item in items]

    async def create_unit(self, payload: dict, current_user: dict) -> dict:
        building_id = payload.get("building_id", "")
        if not ObjectId.is_valid(building_id):
            raise HTTPException(status_code=400, detail="ID tòa nhà không hợp lệ")
        if not await self.buildings_col.find_one({"_id": ObjectId(building_id)}, {"_id": 1}):
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")

        now = utcnow()
        doc = {
            **payload,
            "created_at": now,
            "updated_at": now,
            "updated_by": current_user.get("email"),
        }
        try:
            res = await self.units_col.insert_one(doc)
        except DuplicateKeyError as exc:
            raise HTTPException(
                status_code=409, detail="Mã sàn đã tồn tại trong tòa nhà này"
            ) from exc
        doc["_id"] = res.inserted_id
        return serialize(doc)

    async def update_unit(
        self, unit_id: str, payload: dict, current_user: dict
    ) -> dict:
        if not ObjectId.is_valid(unit_id):
            raise HTTPException(status_code=400, detail="ID diện tích không hợp lệ")
        building_id = payload.get("building_id", "")
        if not ObjectId.is_valid(building_id):
            raise HTTPException(status_code=400, detail="ID tòa nhà không hợp lệ")
        if not await self.buildings_col.find_one({"_id": ObjectId(building_id)}, {"_id": 1}):
            raise HTTPException(status_code=404, detail="Không tìm thấy tòa nhà")
        now = utcnow()
        try:
            res = await self.units_col.find_one_and_update(
                {"_id": ObjectId(unit_id)},
                {
                    "$set": {
                        **payload,
                        "updated_at": now,
                        "updated_by": current_user.get("email"),
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as exc:
            raise HTTPException(
                status_code=409, detail="Mã sàn đã tồn tại trong tòa nhà này"
            ) from exc
        if not res:
            raise HTTPException(status_code=404, detail="Không tìm thấy diện tích")
        return serialize(res)

    async def delete_unit(self, unit_id: str, current_user: dict) -> dict:
        if not ObjectId.is_valid(unit_id):
            raise HTTPException(status_code=400, detail="ID diện tích không hợp lệ")
        res = await self.units_col.delete_one({"_id": ObjectId(unit_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy diện tích")
        return {"success": True, "message": "Đã xóa diện tích"}

    # FAQs
    async def list_faqs(
        self, entity_type: str, entity_id: str, public_only: bool = False
    ) -> list[dict]:
        query: dict[str, Any] = {"entity_type": entity_type, "entity_id": entity_id}
        if public_only:
            query["status"] = "PUBLISHED"
        items = await self.faqs_col.find(query).sort("display_order", 1).to_list(100)
        return [serialize(item) for item in items]

    async def create_faq(self, payload: dict, current_user: dict) -> dict:
        now = utcnow()
        doc = {**payload, "created_at": now, "updated_at": now}
        res = await self.faqs_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize(doc)

    async def update_faq(self, faq_id: str, payload: dict, current_user: dict) -> dict:
        if not ObjectId.is_valid(faq_id):
            raise HTTPException(status_code=400, detail="ID câu hỏi không hợp lệ")
        now = utcnow()
        res = await self.faqs_col.find_one_and_update(
            {"_id": ObjectId(faq_id)},
            {"$set": {**payload, "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if not res:
            raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
        return serialize(res)

    async def delete_faq(self, faq_id: str, current_user: dict) -> dict:
        if not ObjectId.is_valid(faq_id):
            raise HTTPException(status_code=400, detail="ID câu hỏi không hợp lệ")
        res = await self.faqs_col.delete_one({"_id": ObjectId(faq_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
        return {"success": True, "message": "Đã xóa câu hỏi"}

    # ==========================================
    # 4. SEO & GEO AUDIT ENGINE
    # ==========================================

    async def audit_seo_geo(self) -> list[dict]:
        audits = []

        # 1. Coworking audit
        cw = await self.coworking_col.find_one({"key": "singleton_location"}) or {}
        cw_seo = cw.get("seo_metadata") or {}
        cw_loc = cw.get("location") or {}
        cw_faqs = await self.faqs_col.find({"entity_type": "COWORKING"}).to_list(100)
        cw_plans = await self.pricing_plans_col.find({"status": "ACTIVE"}).to_list(100)

        cw_seo_checks = []
        cw_title = cw_seo.get("title", "")
        if not cw_title:
            cw_seo_checks.append(
                {
                    "field": "SEO Title",
                    "status": "ERROR",
                    "message": "Thiếu SEO Title",
                    "recommendation": "Thêm tiêu đề SEO 40-65 ký tự",
                }
            )
        elif len(cw_title) < 30 or len(cw_title) > 70:
            cw_seo_checks.append(
                {
                    "field": "SEO Title",
                    "status": "WARNING",
                    "message": f"Độ dài tiêu đề ({len(cw_title)} ký tự) chưa tối ưu",
                    "current_value": cw_title,
                    "recommendation": "Nên từ 40 đến 65 ký tự",
                }
            )
        else:
            cw_seo_checks.append(
                {
                    "field": "SEO Title",
                    "status": "PASSED",
                    "message": "Tiêu đề SEO chuẩn độ dài",
                    "current_value": cw_title,
                }
            )

        cw_desc = cw_seo.get("description", "")
        if not cw_desc:
            cw_seo_checks.append(
                {
                    "field": "Meta Description",
                    "status": "ERROR",
                    "message": "Thiếu Meta Description",
                    "recommendation": "Thêm mô tả 120-160 ký tự",
                }
            )
        elif len(cw_desc) < 70 or len(cw_desc) > 170:
            cw_seo_checks.append(
                {
                    "field": "Meta Description",
                    "status": "WARNING",
                    "message": f"Độ dài mô tả ({len(cw_desc)} ký tự) chưa tối ưu",
                    "current_value": cw_desc,
                    "recommendation": "Nên từ 120 đến 160 ký tự",
                }
            )
        else:
            cw_seo_checks.append(
                {
                    "field": "Meta Description",
                    "status": "PASSED",
                    "message": "Meta Description chuẩn độ dài",
                    "current_value": cw_desc,
                }
            )

        cw_h1 = (cw.get("hero") or {}).get("title", "")
        cw_seo_checks.append(
            {
                "field": "H1 Heading",
                "status": "PASSED" if cw_h1 else "ERROR",
                "message": "Thẻ H1 hợp lệ" if cw_h1 else "Thiếu thẻ H1",
                "current_value": cw_h1,
            }
        )

        cw_geo_checks = []
        cw_addr = cw_loc.get("address", "")
        cw_geo_checks.append(
            {
                "field": "Địa chỉ thực tế",
                "status": "PASSED" if cw_addr else "ERROR",
                "message": "Địa chỉ đã xác minh"
                if cw_addr
                else "Thiếu địa chỉ thực tế",
                "current_value": cw_addr,
            }
        )
        cw_geo_checks.append(
            {
                "field": "Bảng giá dịch vụ",
                "status": "PASSED" if cw_plans else "WARNING",
                "message": f"Đang có {len(cw_plans)} gói giá hoạt động"
                if cw_plans
                else "Chưa cấu hình gói giá cụ thể",
            }
        )
        cw_geo_checks.append(
            {
                "field": "FAQ & Trợ giúp",
                "status": "PASSED" if len(cw_faqs) >= 3 else "WARNING",
                "message": f"Đang có {len(cw_faqs)} câu hỏi thường gặp"
                if cw_faqs
                else "Nên bổ sung ít nhất 3 FAQ",
            }
        )

        # Structured Data Preview
        cw_schema = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Organization",
                    "name": cw.get("name") or None,
                    "url": "https://maianhomes.vn",
                },
                {
                    "@type": "Service",
                    "name": cw.get("name") or None,
                    "serviceType": (cw.get("hero") or {}).get("title") or None,
                    "provider": {"@type": "Organization", "name": cw.get("name") or None},
                    "areaServed": {"@type": "City", "name": cw_loc.get("city") or None},
                    "offers": [
                        {
                            "@type": "Offer",
                            "name": p.get("name"),
                            "price": p.get("price"),
                            "priceCurrency": p.get("currency"),
                        }
                        for p in cw_plans
                        if p.get("price")
                    ],
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": [
                        {
                            "@type": "Question",
                            "name": f.get("question"),
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": f.get("answer"),
                            },
                        }
                        for f in cw_faqs
                    ],
                },
            ],
        }

        audits.append(
            {
                "page_id": "coworking",
                "page_type": "COWORKING",
                "title": "Co-working Space (Địa điểm duy nhất)",
                "slug": "/dich-vu-cho-thue/coworking",
                "seo_score_label": "Đạt"
                if all(c["status"] == "PASSED" for c in cw_seo_checks)
                else "Cần cải thiện",
                "geo_score_label": "Đạt"
                if all(c["status"] == "PASSED" for c in cw_geo_checks)
                else "Cần cải thiện",
                "seo_checks": cw_seo_checks,
                "geo_checks": cw_geo_checks,
                "structured_data_preview": cw_schema,
                "last_updated": cw.get("updated_at", utcnow()).isoformat()
                if isinstance(cw.get("updated_at"), datetime)
                else str(cw.get("updated_at")),
            }
        )

        # 2. Office Landing audit
        ol = await self.office_landing_col.find_one({"key": "office_landing"}) or {}
        ol_seo = ol.get("seo_metadata") or {}
        ol_faqs = await self.faqs_col.find({"entity_type": "OFFICE_LANDING"}).to_list(
            100
        )
        ol_title = ol_seo.get("title") or ol.get("hero_title") or ""
        ol_desc = ol_seo.get("description") or ol.get("hero_description") or ""

        ol_seo_checks = [
            {
                "field": "SEO Title",
                "status": "PASSED" if len(ol_title) >= 30 else "WARNING",
                "message": "Tiêu đề SEO hợp lệ",
                "current_value": ol_title,
            },
            {
                "field": "Meta Description",
                "status": "PASSED" if len(ol_desc) >= 60 else "WARNING",
                "message": "Mô tả SEO hợp lệ",
                "current_value": ol_desc,
            },
            {
                "field": "H1 Heading",
                "status": "PASSED",
                "message": "Thẻ H1 hợp lệ",
                "current_value": ol.get("hero_title", ""),
            },
        ]
        ol_geo_checks = [
            {
                "field": "Phạm vi địa lý",
                "status": "PASSED",
                "message": "Khu vực kinh doanh TP.HCM",
                "current_value": ol.get("districts") or [],
            },
            {
                "field": "FAQ Tổng quan",
                "status": "PASSED" if ol_faqs else "WARNING",
                "message": f"{len(ol_faqs)} câu hỏi thường gặp",
            },
        ]

        audits.append(
            {
                "page_id": "office_landing",
                "page_type": "OFFICE_LANDING",
                "title": "Văn Phòng Cho Thuê (Landing Page)",
                "slug": "/dich-vu-cho-thue/office",
                "seo_score_label": "Đạt",
                "geo_score_label": "Đạt",
                "seo_checks": ol_seo_checks,
                "geo_checks": ol_geo_checks,
                "structured_data_preview": {
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    "name": ol_title,
                    "description": ol_desc,
                },
                "last_updated": ol.get("updated_at", utcnow()).isoformat()
                if isinstance(ol.get("updated_at"), datetime)
                else str(ol.get("updated_at")),
            }
        )

        # 3. Office Buildings audit
        buildings = await self.buildings_col.find().to_list(50)
        for b in buildings:
            b_id = str(b["_id"])
            b_seo = b.get("seo_metadata") or {}
            b_title = b_seo.get("title") or ""
            b_desc = b_seo.get("description") or ""
            b_units = await self.units_col.find({"building_id": b_id}).to_list(100)

            b_seo_checks = [
                {
                    "field": "SEO Title",
                    "status": "PASSED" if b_title else "ERROR",
                    "message": "Đã có tiêu đề riêng biệt",
                    "current_value": b_title,
                },
                {
                    "field": "Meta Description",
                    "status": "PASSED" if b_desc else "WARNING",
                    "message": "Đã có mô tả",
                    "current_value": b_desc,
                },
                {
                    "field": "Slug URL",
                    "status": "PASSED",
                    "message": "Slug chuẩn SEO",
                    "current_value": b.get("slug"),
                },
            ]
            b_geo_checks = [
                {
                    "field": "Địa chỉ tòa nhà",
                    "status": "PASSED" if b.get("address") else "ERROR",
                    "message": "Địa chỉ đầy đủ",
                    "current_value": b.get("address"),
                },
                {
                    "field": "Diện tích khả dụng",
                    "status": "PASSED" if b_units else "WARNING",
                    "message": f"{len(b_units)} diện tích đã niêm yết",
                },
            ]

            audits.append(
                {
                    "page_id": b_id,
                    "page_type": "BUILDING",
                    "title": f"Tòa nhà: {b.get('name')}",
                    "slug": f"/dich-vu-cho-thue/office/{b.get('slug')}",
                    "seo_score_label": "Đạt",
                    "geo_score_label": "Đạt",
                    "seo_checks": b_seo_checks,
                    "geo_checks": b_geo_checks,
                    "structured_data_preview": {
                        "@context": "https://schema.org",
                        "@type": "RealEstateListing",
                        "name": b.get("name"),
                        "address": b.get("address"),
                        "description": b.get("description"),
                    },
                    "last_updated": b.get("updated_at", utcnow()).isoformat()
                    if isinstance(b.get("updated_at"), datetime)
                    else str(b.get("updated_at")),
                }
            )

        return audits

    async def get_overview_stats(self) -> dict:
        total_buildings = await self.buildings_col.count_documents({})
        published_buildings = await self.buildings_col.count_documents(
            {"status": "PUBLISHED"}
        )
        total_units = await self.units_col.count_documents({})
        avail_units = await self.units_col.count_documents(
            {"availability_status": "AVAILABLE"}
        )
        total_plans = await self.pricing_plans_col.count_documents({})
        active_plans = await self.pricing_plans_col.count_documents(
            {"status": "ACTIVE"}
        )

        # Leads inquiries for coworking & office
        coworking_leads = await get_database()["website_leads"].count_documents(
            {"source": "COWORKING"}
        )
        office_leads = await get_database()["website_leads"].count_documents(
            {"source": "OFFICE"}
        )

        return {
            "total_buildings": total_buildings,
            "published_buildings": published_buildings,
            "total_units": total_units,
            "available_units": avail_units,
            "total_plans": total_plans,
            "active_plans": active_plans,
            "coworking_leads_count": coworking_leads,
            "office_leads_count": office_leads,
            "total_workspace_leads": coworking_leads + office_leads,
        }


workspace_service = WorkspaceService()
