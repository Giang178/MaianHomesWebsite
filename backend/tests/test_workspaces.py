import unittest
from httpx import ASGITransport, AsyncClient
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.main import app


class WorkspacesModuleTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from app.core.security import limiter
        limiter.enabled = False
        await connect_to_mongo()
        self.transport = ASGITransport(app=app)

    async def asyncTearDown(self):
        await close_mongo_connection()

    async def test_01_public_coworking_endpoint(self):
        from unittest.mock import AsyncMock, patch

        payload = {
            "name": "Maian Co-working Space",
            "seat_types": [{"code": "HOT"}, {"code": "FIXED"}],
            "pricing_plans": [{}, {}, {}, {}],
            "faqs": [],
            "space": {
                "intro_highlights": [],
                "intro_target_audience": [],
            },
        }
        with patch(
            "app.modules.website.workspaces.api.workspace_service.get_public_coworking",
            new=AsyncMock(return_value=payload),
        ):
            async with AsyncClient(transport=self.transport, base_url="http://test") as ac:
                response = await ac.get("/api/public/workspaces/coworking")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Maian Co-working Space")
        self.assertGreaterEqual(len(data["seat_types"]), 2)
        self.assertGreaterEqual(len(data["pricing_plans"]), 4)
        self.assertIn("intro_highlights", data["space"])
        self.assertIn("intro_target_audience", data["space"])

    async def test_02_public_office_landing_and_buildings(self):
        async with AsyncClient(transport=self.transport, base_url="http://test") as ac:
            # Test landing
            res_landing = await ac.get("/api/public/workspaces/office/landing")
            self.assertEqual(res_landing.status_code, 200)
            landing_data = res_landing.json()
            self.assertIn("MAIAN HOMES", landing_data["hero_title"])

            # Test listing
            res_list = await ac.get("/api/public/workspaces/office")
            self.assertEqual(res_list.status_code, 200)
            list_data = res_list.json()
            self.assertIn("items", list_data)
            self.assertGreaterEqual(list_data["total"], 2)

            # Test filter by district
            res_filter = await ac.get("/api/public/workspaces/office?district=Quận 10")
            self.assertEqual(res_filter.status_code, 200)
            filter_data = res_filter.json()
            for b in filter_data["items"]:
                self.assertEqual(b["district"], "Quận 10")

            # Test detail by slug
            slug = list_data["items"][0]["slug"]
            res_detail = await ac.get(f"/api/public/workspaces/office/{slug}")
            self.assertEqual(res_detail.status_code, 200)
            detail_data = res_detail.json()
            self.assertEqual(detail_data["slug"], slug)
            self.assertIn("units", detail_data)
            self.assertGreaterEqual(len(detail_data["units"]), 1)

    async def test_office_preview_requires_workspace_read_permission(self):
        from unittest.mock import AsyncMock, patch
        from app.modules.website.workspaces import api as workspace_api

        public_payload = {"status": "PUBLISHED"}
        draft_payload = {"status": "DRAFT"}
        with patch.object(
            workspace_api.workspace_service,
            "get_public_office_landing",
            new=AsyncMock(return_value=public_payload),
        ), patch.object(
            workspace_api.workspace_service,
            "get_admin_office_landing",
            new=AsyncMock(return_value=draft_payload),
        ):
            without_permission = await workspace_api.get_public_office_landing(
                preview=True,
                current_user={"permissions": []},
            )
            with_permission = await workspace_api.get_public_office_landing(
                preview=True,
                current_user={"permissions": ["website.workspaces.read"]},
            )

        self.assertEqual(without_permission, public_payload)
        self.assertEqual(with_permission, draft_payload)

    async def test_03_workspace_lead_submission_with_coworking_and_office(self):
        async with AsyncClient(transport=self.transport, base_url="http://test") as ac:
            # Coworking lead
            cw_payload = {
                "customer_name": "Nguyễn Văn An",
                "phone": "0912345678",
                "email": "nguyenvanan@example.com",
                "source": "COWORKING",
                "form_id": "coworking-inquiry",
                "page_url": "/dich-vu-cho-thue/coworking",
                "note": "Quan tâm gói PLAN_HOT_MONTH, dự kiến thuê từ tuần sau cho 2 người.",
                "consent": True,
            }
            res_cw = await ac.post("/api/public/leads", json=cw_payload)
            self.assertEqual(res_cw.status_code, 201)
            self.assertIn("reference_id", res_cw.json())

            # Office lead
            office_payload = {
                "customer_name": "Trần Thị Bích",
                "phone": "0987654321",
                "email": "bich.tran@company.vn",
                "source": "OFFICE",
                "form_id": "office-inquiry",
                "page_url": "/dich-vu-cho-thue/office/maian-tower-central",
                "note": "Quan tâm diện tích MTC-L04-A tại Maian Tower Central, ngân sách $2500/tháng.",
                "consent": True,
            }
            res_office = await ac.post("/api/public/leads", json=office_payload)
            self.assertEqual(res_office.status_code, 201)
            self.assertIn("reference_id", res_office.json())
