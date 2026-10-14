import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.requests import Request
from starlette.responses import Response

from app.api.public.auth import LoginRequest, login, logout


class TestAuthPhone(unittest.IsolatedAsyncioTestCase):
    async def test_login_employee_not_found_returns_phone_none_and_sets_cookie(self):
        mock_auth_result = {
            "employee_id": "non_existent_id",
            "id": "account-id",
            "role": "STAFF",
            "email": "test@maianhomes.vn",
            "token_version": 1,
            "must_change_password": True,
        }
        session = {
            "_id": "session-id",
            "ip_address": "127.0.0.1",
            "user_agent": "Unit test",
        }
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/public/auth/login",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
        request = Request(scope)
        response = Response()
        payload = LoginRequest(email="test@maianhomes.vn", password="secretpassword")

        mocked_account_service = MagicMock()
        mocked_account_service.authenticate = AsyncMock(return_value=mock_auth_result)
        mocked_account_service.collection.update_one = AsyncMock()
        with patch(
            "app.api.public.auth.account_service",
            mocked_account_service,
        ), patch(
            "app.api.public.auth.session_service.create",
            AsyncMock(return_value=session),
        ), patch(
            "app.api.public.auth.record_activity",
            AsyncMock(),
        ):
            result = await login(request, response, payload)

        self.assertIsNone(result.phone)
        self.assertTrue(result.must_change_password)
        self.assertEqual(result.allowed_paths, ["/change-password"])
        set_cookie_header = response.headers.get("set-cookie")
        self.assertIsNotNone(set_cookie_header)
        self.assertIn("access_token=", set_cookie_header)
        self.assertIn("HttpOnly", set_cookie_header)

    async def test_logout_deletes_cookie(self):
        request = Request({
            "type": "http",
            "method": "POST",
            "path": "/api/public/auth/logout",
            "headers": [],
        })
        response = Response()
        await logout(request, response)
        set_cookie_header = response.headers.get("set-cookie")
        self.assertIsNotNone(set_cookie_header)
        self.assertIn("access_token=", set_cookie_header)
        self.assertIn("Max-Age=0", set_cookie_header)


if __name__ == "__main__":
    unittest.main()
