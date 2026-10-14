import unittest
from unittest.mock import AsyncMock, Mock, patch

from app.modules.content.jobs.outbox_worker import _revalidate_public_content
from app.modules.website.branding.api import public_snapshot


class BrandingRevalidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_branding_publish_maps_to_branding_revalidation(self):
        response = Mock()
        client = AsyncMock()
        client.post.return_value = response
        context = AsyncMock()
        context.__aenter__.return_value = client
        context.__aexit__.return_value = False

        with patch(
            "app.modules.content.jobs.outbox_worker.httpx.AsyncClient",
            return_value=context,
        ), patch(
            "app.modules.content.jobs.outbox_worker.settings.MARKETING_REVALIDATE_URL",
            "http://frontend/api/webhook/revalidate",
        ), patch(
            "app.modules.content.jobs.outbox_worker.settings.MARKETING_REVALIDATE_SECRET",
            "test-secret",
        ):
            await _revalidate_public_content(
                "WEBSITE_BRANDING_PUBLISH",
                {"published_version": 7},
            )

        client.post.assert_awaited_once_with(
            "http://frontend/api/webhook/revalidate",
            headers={"x-marketing-revalidate-secret": "test-secret"},
            json={"entity": "BRANDING", "slug": None, "old_slug": None, "page_key": None},
        )
        response.raise_for_status.assert_called_once_with()

    async def test_public_snapshot_includes_publish_metadata(self):
        collection = AsyncMock()
        collection.find_one.return_value = {
            "_id": "global",
            "published_version": 3,
            "published_at": "2026-09-28T00:00:00Z",
            "published_snapshot": {
                "footer": {"working_hours": "Thứ 2 – Thứ 6"},
            },
        }

        with patch(
            "app.modules.website.branding.api.get_database",
            return_value={"website_settings": collection},
        ):
            result = await public_snapshot()

        self.assertEqual(result["published_version"], 3)
        self.assertEqual(result["published_at"], "2026-09-28T00:00:00Z")
        self.assertEqual(result["footer"]["working_hours"], "Thứ 2 – Thứ 6")


if __name__ == "__main__":
    unittest.main()