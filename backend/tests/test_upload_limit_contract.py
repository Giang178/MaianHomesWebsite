import unittest
from pathlib import Path

from app.modules.website.consignments.api import MAX_PUBLIC_IMAGES, MAX_UPLOAD_BYTES


ROOT = Path(__file__).resolve().parents[2]


class UploadLimitContractTests(unittest.TestCase):
    def test_proxy_limit_has_margin_above_application_maximum(self):
        application_maximum = MAX_PUBLIC_IMAGES * MAX_UPLOAD_BYTES
        proxy_limit = 96 * 1024 * 1024

        self.assertEqual(MAX_PUBLIC_IMAGES, 8)
        self.assertEqual(MAX_UPLOAD_BYTES, 10 * 1024 * 1024)
        self.assertGreaterEqual(proxy_limit - application_maximum, 16 * 1024 * 1024)

        nginx = (ROOT / "infrastructure" / "nginx.production.conf").read_text(encoding="utf-8")
        next_config = (ROOT / "frontend" / "next.config.ts").read_text(encoding="utf-8")
        self.assertIn("client_max_body_size 96m;", nginx)
        self.assertIn("proxyClientMaxBodySize: 96 * 1024 * 1024", next_config)
        self.assertIn(
            r"location ~ ^/api/public/consignments(?:/with-images)?$",
            nginx,
        )
        self.assertIn("limit_conn upload_connections 2;", nginx)
        self.assertIn("client_body_timeout 30s;", nginx)
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("clamav/clamav:1.4.5", compose)


if __name__ == "__main__":
    unittest.main()
