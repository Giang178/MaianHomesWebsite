import unittest
from unittest.mock import AsyncMock, PropertyMock, patch

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.website.workspaces.schemas import (
    OfficeBuildingCreateUpdate,
    OfficeUnitCreateUpdate,
)
from app.modules.website.workspaces.service import WorkspaceService
from app.modules.website.workspaces import api as workspaces_api


class FakeCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *_args):
        return self

    async def to_list(self, _length):
        return self.items


class EmptyCollection:
    def find(self, _query):
        return FakeCursor([])


class BuildingCollection:
    def __init__(self, existing):
        self.existing = existing
        self.update_filter = None
        self.update = None

    async def find_one(self, query, *_args):
        if "$or" in query and "_id" in query:
            return None
        return self.existing

    async def find_one_and_update(self, query, update, **_kwargs):
        self.update_filter = query
        self.update = update["$set"]
        return {**self.existing, **self.update}


class OfficeSchemaContractTests(unittest.TestCase):
    def test_building_accepts_admin_fields_and_normalizes_grade(self):
        model = OfficeBuildingCreateUpdate(
            name="Maian Tower",
            slug="maian-tower",
            address="1 Main",
            district="Q1",
            grade="A",
            total_floors=12,
            basements=2,
            price_per_sqm_min=20,
            price_per_sqm_max=35,
            ceiling_height="2.7m",
        )

        payload = model.model_dump()
        self.assertEqual(payload["building_grade"], "A")
        self.assertEqual(payload["total_floors"], 12)
        self.assertEqual(payload["basements"], 2)
        self.assertEqual(payload["price_per_sqm_min"], 20)

    def test_building_status_cannot_bypass_publish_permission(self):
        with self.assertRaises(ValidationError):
            OfficeBuildingCreateUpdate(
                name="Maian Tower",
                slug="maian-tower",
                address="1 Main",
                district="Q1",
                status="PUBLISHED",
            )

    def test_unit_normalizes_legacy_admin_payload(self):
        model = OfficeUnitCreateUpdate(
            building_id=str(ObjectId()),
            unit_code="L08-01",
            floor="8",
            area_sqm=120,
            price_per_sqm=25,
            status="AVAILABLE",
            handover_condition="Bàn giao thô",
        )

        payload = model.model_dump()
        self.assertEqual(payload["area"], 120)
        self.assertEqual(payload["rental_price"], 25)
        self.assertEqual(payload["availability_status"], "AVAILABLE")
        self.assertEqual(payload["status"], "ACTIVE")


class OfficeBuildingWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_detail_preview_requires_workspace_read_permission(self):
        public_payload = {"name": "Live"}
        preview_payload = {"name": "Draft"}
        with (
            patch.object(
                workspaces_api.workspace_service,
                "get_public_building_by_slug",
                AsyncMock(return_value=public_payload),
            ),
            patch.object(
                workspaces_api.workspace_service,
                "get_preview_building_by_slug",
                AsyncMock(return_value=preview_payload),
            ),
        ):
            denied = await workspaces_api.get_public_building_detail(
                "maian-tower",
                preview=True,
                current_user={"permissions": []},
            )
            allowed = await workspaces_api.get_public_building_detail(
                "maian-tower",
                preview=True,
                current_user={"permissions": ["website.workspaces.read"]},
            )

        self.assertEqual(denied, public_payload)
        self.assertEqual(allowed, preview_payload)

    async def test_public_detail_uses_published_snapshot(self):
        building_id = ObjectId()
        buildings = BuildingCollection(
            {
                "_id": building_id,
                "slug": "draft-slug",
                "name": "Draft name",
                "status": "PUBLISHED",
                "version": 3,
                "published_snapshot": {
                    "slug": "live-slug",
                    "name": "Live name",
                    "district": "Q1",
                },
                "draft_snapshot": {
                    "slug": "draft-slug",
                    "name": "Draft name",
                },
            }
        )
        with (
            patch.object(
                WorkspaceService,
                "buildings_col",
                new_callable=PropertyMock,
                return_value=buildings,
            ),
            patch.object(
                WorkspaceService,
                "units_col",
                new_callable=PropertyMock,
                return_value=EmptyCollection(),
            ),
            patch.object(
                WorkspaceService,
                "faqs_col",
                new_callable=PropertyMock,
                return_value=EmptyCollection(),
            ),
        ):
            result = await WorkspaceService().get_public_building_by_slug("live-slug")

        self.assertEqual(result["name"], "Live name")
        self.assertEqual(result["slug"], "live-slug")

    async def test_update_published_building_preserves_live_snapshot(self):
        building_id = ObjectId()
        buildings = BuildingCollection(
            {
                "_id": building_id,
                "slug": "maian-tower",
                "name": "Live name",
                "status": "PUBLISHED",
                "version": 4,
            }
        )
        draft = {
            "name": "Draft name",
            "slug": "maian-tower",
            "address": "1 Main",
            "district": "Q1",
        }
        with patch.object(
            WorkspaceService,
            "buildings_col",
            new_callable=PropertyMock,
            return_value=buildings,
        ):
            await WorkspaceService().update_building(
                str(building_id),
                draft,
                {"email": "admin@example.com"},
                expected_version=4,
            )

        self.assertEqual(buildings.update["draft_snapshot"], draft)
        self.assertEqual(buildings.update["published_snapshot"]["name"], "Live name")
        self.assertEqual(buildings.update_filter["version"], 4)

    async def test_transition_rejects_stale_version(self):
        building_id = ObjectId()
        buildings = BuildingCollection(
            {"_id": building_id, "status": "DRAFT", "version": 3}
        )
        with patch.object(
            WorkspaceService,
            "buildings_col",
            new_callable=PropertyMock,
            return_value=buildings,
        ):
            with self.assertRaises(HTTPException) as caught:
                await WorkspaceService().transition_building(
                    str(building_id),
                    "PUBLISH",
                    2,
                    {"email": "admin@example.com"},
                )

        self.assertEqual(caught.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
