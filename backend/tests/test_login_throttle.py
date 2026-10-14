import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.core.login_throttle import (
    FAILURE_LIMIT,
    WINDOW_SECONDS,
    _key,
    clear_account_login_failures,
    ensure_account_login_allowed,
    record_account_login_failure,
)


class LoginThrottleTests(unittest.IsolatedAsyncioTestCase):
    async def test_email_is_hashed_in_redis_key(self):
        key = _key(" Person@Example.com ")
        self.assertTrue(key.startswith("auth:login-failures:"))
        self.assertNotIn("person@example.com", key)
        self.assertEqual(key, _key("person@example.com"))

    async def test_first_failure_starts_expiring_window(self):
        redis = AsyncMock()
        redis.eval.return_value = 1
        with patch("app.core.login_throttle.get_redis_client", return_value=redis):
            await record_account_login_failure("person@example.com")
        redis.eval.assert_awaited_once()
        args = redis.eval.await_args.args
        self.assertEqual(args[2], _key("person@example.com"))
        self.assertEqual(args[3], WINDOW_SECONDS)

    async def test_fifth_failure_is_rejected(self):
        redis = AsyncMock()
        redis.eval.return_value = FAILURE_LIMIT
        redis.ttl.return_value = 300
        with patch("app.core.login_throttle.get_redis_client", return_value=redis):
            with self.assertRaises(HTTPException) as caught:
                await record_account_login_failure("person@example.com")
        self.assertEqual(caught.exception.status_code, 429)
        self.assertEqual(caught.exception.headers["Retry-After"], "300")

    async def test_limit_is_account_scoped_and_returns_retry_after(self):
        redis = AsyncMock()
        redis.get.return_value = str(FAILURE_LIMIT)
        redis.ttl.return_value = 120
        with patch("app.core.login_throttle.get_redis_client", return_value=redis):
            with self.assertRaises(HTTPException) as caught:
                await ensure_account_login_allowed("person@example.com")
        self.assertEqual(caught.exception.status_code, 429)
        self.assertEqual(caught.exception.headers["Retry-After"], "120")

    async def test_success_clears_failure_counter(self):
        redis = AsyncMock()
        with patch("app.core.login_throttle.get_redis_client", return_value=redis):
            await clear_account_login_failures("person@example.com")
        redis.delete.assert_awaited_once_with(_key("person@example.com"))


if __name__ == "__main__":
    unittest.main()
