import inspect
import unittest
from unittest.mock import AsyncMock, patch

from app.modules.website.workspaces import api as workspaces_api


class WorkspacePreviewContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_coworking_route_has_no_preview_bypass(self):
        signature = inspect.signature(workspaces_api.get_public_coworking)
        self.assertNotIn('preview', signature.parameters)
        self.assertNotIn('request', signature.parameters)

        public_result = {'status': 'PUBLISHED'}
        with (
            patch.object(
                workspaces_api.workspace_service,
                'get_public_coworking',
                AsyncMock(return_value=public_result),
            ) as get_public,
            patch.object(
                workspaces_api.workspace_service,
                'get_admin_coworking',
                AsyncMock(),
            ) as get_admin,
        ):
            result = await workspaces_api.get_public_coworking()

        self.assertEqual(result, public_result)
        get_public.assert_awaited_once_with()
        get_admin.assert_not_awaited()

    def test_admin_preview_route_remains_permission_protected(self):
        route = next(
            route
            for route in workspaces_api.protected_router.routes
            if route.path == '/website/workspaces/coworking'
            and 'GET' in route.methods
        )
        required_permissions = {
            permission
            for dependency in route.dependant.dependencies
            if dependency.call is not None
            for permission in getattr(dependency.call, 'permissions', set())
        }

        self.assertIn('website.workspaces.read', required_permissions)


if __name__ == '__main__':
    unittest.main()
