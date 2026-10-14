from bson import ObjectId
from pymongo import ReturnDocument

from app.db.mongodb import get_database


class TeamRepository:
    @property
    def profiles(self):
        return get_database()["public_staff_profiles"]

    @property
    def versions(self):
        return get_database()["public_staff_profile_versions"]

    async def list_admin(self, *, status: str | None = None, q: str | None = None) -> list[dict]:
        query: dict = {}
        if status:
            query["status"] = status
        if q:
            query["draft.full_name"] = {"$regex": q[:100], "$options": "i"}
        return await self.profiles.find(query).sort([("updated_at", -1), ("_id", -1)]).limit(500).to_list(500)

    async def get(self, profile_id: str) -> dict | None:
        if not ObjectId.is_valid(profile_id):
            return None
        return await self.profiles.find_one({"_id": ObjectId(profile_id)})

    async def create(self, document: dict) -> dict:
        result = await self.profiles.insert_one(document)
        document["_id"] = result.inserted_id
        return document

    async def update_draft(self, profile_id: str, expected_version: int | None, fields: dict) -> dict | None:
        query: dict = {"_id": ObjectId(profile_id)}
        if expected_version is not None:
            query["version"] = expected_version
        return await self.profiles.find_one_and_update(
            query, {"$set": fields, "$inc": {"version": 1}}, return_document=ReturnDocument.AFTER,
        )

    async def transition(self, profile_id: str, expected_version: int, fields: dict) -> dict | None:
        return await self.profiles.find_one_and_update(
            {"_id": ObjectId(profile_id), "version": expected_version},
            {"$set": fields, "$inc": {"version": 1}}, return_document=ReturnDocument.AFTER,
        )

    async def delete(self, profile_id: str, expected_version: int) -> dict | None:
        if not ObjectId.is_valid(profile_id):
            return None
        return await self.profiles.find_one_and_delete(
            {"_id": ObjectId(profile_id), "version": expected_version}
        )

    async def list_public(self, query: dict, skip: int, limit: int) -> tuple[list[dict], int]:
        total = await self.profiles.count_documents(query)
        items = await self.profiles.find(query).sort([
            ("published_snapshot.is_featured", -1),
            ("published_snapshot.display_order", 1),
            ("published_snapshot.full_name", 1),
        ]).skip(skip).limit(limit).to_list(limit)
        return items, total


team_repository = TeamRepository()
