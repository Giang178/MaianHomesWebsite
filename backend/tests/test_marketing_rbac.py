import unittest
from unittest.mock import AsyncMock, MagicMock

from app.modules.content.projects.service import ProjectApplicationService

class TestMarketingRbac(unittest.IsolatedAsyncioTestCase):
    async def test_marketing_staff_admin_list_includes_all_projects(self):
        service = ProjectApplicationService()
        service.repository = MagicMock()
        service.repository.list_admin = AsyncMock(return_value=([], 0))

        await service.list(
            {
                "id": "account-123",
                "email": "changeable@example.com",
                "role": "MARKETING_STAFF",
            },
            0,
            20,
            None,
            None,
        )

        query = service.repository.list_admin.await_args.args[0]
        self.assertEqual({}, query)
