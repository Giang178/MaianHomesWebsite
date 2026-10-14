import unittest

from pydantic import ValidationError

from app.modules.website.inquiries.schemas import (
    WebsiteLeadCreate,
    WebsiteLeadStatusUpdate,
)
from app.modules.website.inquiries.service import safe_spreadsheet_value


class WebsiteLeadContractTests(unittest.TestCase):
    def test_normalizes_customer_identity_fields(self):
        payload = WebsiteLeadCreate(
            customer_name="  Nguyễn An  ",
            phone="+84 969 105 059",
            email="  CUSTOMER@EXAMPLE.COM ",
        )
        self.assertEqual(payload.customer_name, "Nguyễn An")
        self.assertEqual(payload.phone, "0969105059")
        self.assertEqual(payload.email, "customer@example.com")

    def test_rejects_invalid_source_email_and_missing_consent(self):
        invalid_payloads = (
            {"source": "UNTRUSTED"},
            {"email": "not-an-email"},
            {"consent": False},
        )
        for override in invalid_payloads:
            with self.subTest(override=override), self.assertRaises(ValidationError):
                WebsiteLeadCreate(
                    customer_name="Khách hàng",
                    phone="0969105059",
                    **override,
                )

    def test_status_update_requires_version(self):
        with self.assertRaises(ValidationError):
            WebsiteLeadStatusUpdate(status="VIEWED")

    def test_export_cells_cannot_execute_formulas(self):
        for value in ("=CMD()", "+1+1", "-2+3", "@SUM(A1:A2)"):
            self.assertTrue(safe_spreadsheet_value(value).startswith("'"))
        self.assertEqual(safe_spreadsheet_value("Khách hàng"), "Khách hàng")


if __name__ == "__main__":
    unittest.main()
