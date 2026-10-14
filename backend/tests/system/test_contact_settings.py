import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI, HTTPException
from pydantic import ValidationError

from app.modules.website.branding.api import public_router
from app.modules.system.settings.schemas import ContactSettingsUpdate
from app.modules.system.settings.service import (
    public_contact_settings,
    system_settings_service,
)


class ContactSettingsContractTests(unittest.TestCase):
    def test_public_contract_exposes_only_navigation_fields(self):
        app = FastAPI()
        app.include_router(public_router, prefix="/api/public")
        self.assertIn("/api/public/contact-settings", app.openapi()["paths"])

        result = public_contact_settings({
            "phone": "+84969105059",
            "messenger_url": "https://m.me/MaianHomes",
            "email": "hello@maianhomes.vn",
            "updated_by": "it@maianhomes.vn",
            "version": 4,
        })
        self.assertEqual(result, {
            "phone": "+84969105059",
            "phone_href": "tel:+84969105059",
            "zalo_url": "https://zalo.me/84969105059",
            "messenger_url": "https://m.me/MaianHomes",
            "email": "hello@maianhomes.vn",
            "email_href": "mailto:hello@maianhomes.vn",
        })

    def test_empty_settings_are_safe_for_the_public_widget(self):
        self.assertEqual(public_contact_settings(None), {
            "phone": None,
            "phone_href": None,
            "zalo_url": None,
            "messenger_url": None,
            "email": None,
            "email_href": None,
        })

    def test_contact_values_are_normalized_and_invalid_redirects_are_rejected(self):
        payload = ContactSettingsUpdate(
            expected_version=1,
            phone="(+84) 969 105 059",
            messenger_url="https://m.me/MaianHomes",
            email=" CONTACT@MAIANHOMES.VN ",
            reason="Cập nhật liên hệ",
        )
        self.assertEqual(payload.phone, "+84969105059")
        self.assertEqual(payload.email, "contact@maianhomes.vn")

        with self.assertRaises(ValidationError):
            ContactSettingsUpdate(
                expected_version=1,
                messenger_url="https://example.com/redirect",
                reason="URL không hợp lệ",
            )


class ContactSettingsServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_update_is_versioned_and_audited_without_touching_smtp(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        collection.find_one_and_update = AsyncMock(return_value={
            "_id": "website_contact",
            "phone": "0969105059",
            "messenger_url": None,
            "email": "contact@maianhomes.vn",
            "version": 1,
            "updated_at": datetime.now(timezone.utc),
        })
        actor = {"email": "it@maianhomes.vn"}

        with patch(
            "app.modules.system.settings.service.get_database",
            return_value={"system_settings": collection},
        ), patch(
            "app.modules.system.settings.service.record_activity",
            new=AsyncMock(),
        ) as record_activity:
            result = await system_settings_service.update_contact({
                "expected_version": 1,
                "reason": "Cập nhật hotline",
                "phone": "0969105059",
                "messenger_url": None,
                "email": "contact@maianhomes.vn",
            }, actor)

        self.assertEqual(result["version"], 1)
        update = collection.find_one_and_update.await_args.args[1]
        self.assertNotIn("verified_at", update["$set"])
        record_activity.assert_awaited_once()
        self.assertEqual(
            record_activity.await_args.kwargs["metadata"]["fields"],
            ["email", "phone"],
        )

    async def test_stale_contact_version_is_rejected(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value={"_id": "website_contact", "version": 2})
        collection.find_one_and_update = AsyncMock(return_value=None)
        with patch(
            "app.modules.system.settings.service.get_database",
            return_value={"system_settings": collection},
        ):
            with self.assertRaises(HTTPException) as context:
                await system_settings_service.update_contact({
                    "expected_version": 1,
                    "reason": "Cập nhật đồng thời",
                    "phone": None,
                    "messenger_url": None,
                    "email": None,
                }, {"email": "it@maianhomes.vn"})
        self.assertEqual(context.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
