import unittest
from unittest.mock import AsyncMock, patch

from pydantic import ValidationError

from app.modules.website.branding.api import get_public_contact_settings
from app.modules.website.branding.constants import (
    DEFAULT_ZALO_OA_ID,
    DEFAULT_ZALO_OA_URL,
)
from app.modules.website.branding.schemas import BrandingPayload


class BrandingZaloOAContractTests(unittest.TestCase):
    def test_accepts_a_numeric_zalo_oa_id(self):
        payload = BrandingPayload(zalo_oa_id=" 4085613041166590560 ")
        self.assertEqual(payload.zalo_oa_id, DEFAULT_ZALO_OA_ID)

    def test_rejects_an_invalid_zalo_oa_id(self):
        with self.assertRaises(ValidationError):
            BrandingPayload(zalo_oa_id="https://zalo.me/not-an-id")


class PublicZaloOASettingsTests(unittest.IsolatedAsyncioTestCase):
    async def test_uses_the_official_oa_when_legacy_snapshot_only_has_a_phone_link(self):
        with patch(
            "app.modules.website.branding.api.public_snapshot",
            new=AsyncMock(return_value={"zalo_url": "https://zalo.me/0969105059"}),
        ):
            result = await get_public_contact_settings()

        self.assertEqual(result["zalo_oa_id"], DEFAULT_ZALO_OA_ID)
        self.assertEqual(result["zalo_url"], DEFAULT_ZALO_OA_URL)

    async def test_derives_the_fallback_link_from_a_configured_oa_id(self):
        with patch(
            "app.modules.website.branding.api.public_snapshot",
            new=AsyncMock(return_value={
                "zalo_oa_id": "1234567890123456789",
            }),
        ):
            result = await get_public_contact_settings()

        self.assertEqual(result["zalo_oa_id"], "1234567890123456789")
        self.assertEqual(result["zalo_url"], "https://zalo.me/1234567890123456789")


if __name__ == "__main__":
    unittest.main()
