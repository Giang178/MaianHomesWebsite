import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.content.jobs.outbox_worker import _revalidate_public_content


class PublicTeamRevalidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_publish_revalidates_new_and_old_slug(self):
        response = MagicMock()
        response.raise_for_status.return_value = None
        client = AsyncMock()
        client.post.return_value = response
        context = AsyncMock()
        context.__aenter__.return_value = client

        event = {
            "event_type": "WEBSITE_TEAM_PUBLISH",
            "payload": {
                "employee_id": "employee-1",
                "slug": "slug-moi",
                "old_slug": "slug-cu",
            },
        }
        with (
            patch("app.modules.content.jobs.outbox_worker.httpx.AsyncClient", return_value=context),
            patch("app.modules.content.jobs.outbox_worker.settings.MARKETING_REVALIDATE_URL", "http://frontend/api/webhook/revalidate"),
            patch("app.modules.content.jobs.outbox_worker.settings.MARKETING_REVALIDATE_SECRET", "test-secret"),
        ):
            await _revalidate_public_content(event["event_type"], event["payload"])

        client.post.assert_awaited_once_with(
            "http://frontend/api/webhook/revalidate",
            headers={"x-marketing-revalidate-secret": "test-secret"},
            json={"entity": "TEAM", "slug": "slug-moi", "old_slug": "slug-cu", "page_key": None},
        )
        response.raise_for_status.assert_called_once()

    async def test_non_publish_event_does_not_call_frontend(self):
        with patch("app.modules.content.jobs.outbox_worker.httpx.AsyncClient") as client:
            await _revalidate_public_content("WEBSITE_TEAM_DELETE", {})
        client.assert_not_called()
