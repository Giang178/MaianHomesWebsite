import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import Settings, settings
from app.main import app
from app.infrastructure.ai_runtime import OllamaService
from scripts.database_bootstrap import _validate_password


class ProductionConfigurationTests(unittest.TestCase):
    @staticmethod
    def valid_production_settings():
        return {
            "ENVIRONMENT": "production",
            "DEPLOYMENT_TIER": "production",
            "DEPLOYMENT_INSTANCE_ID": "maian-production-primary",
            "APP_RELEASE": "release-0123456789abcdef",
            "SECRET_KEY": "a-secure-production-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            "ALLOWED_ORIGINS": "https://maianhomes.vn,https://admin.maianhomes.vn",
            "CSRF_ORIGIN_ENFORCEMENT": True,
            "MARKETING_TRANSACTIONS_ENABLED": True,
            "MARKETING_EMBEDDED_JOBS": False,
            "MARKETING_REVALIDATE_URL": "https://maianhomes.vn/api/webhook/revalidate",
            "MARKETING_REVALIDATE_SECRET": "secure-production-revalidation-secret",
            "CONSIGNMENT_ENABLED": True,
            "ENSURE_INDEXES_ON_STARTUP": False,
            "WORKER_HEALTH_REQUIRED": True,
            "ACTIVITY_EMBEDDED_JOBS": False,
            "RATE_LIMIT_STORAGE_URI": "redis://redis:6379/1",
            "NOTIFICATIONS_REALTIME_ENABLED": True,
            "WS_ALLOW_QUERY_TOKEN": False,
            "REDIS_URL": "redis://redis:6379/0",
            "S3_ENABLED": True,
            "S3_ACCESS_KEY": "secure-storage-user",
            "S3_SECRET_KEY": "secure-storage-password",
            "MALWARE_SCAN_ENABLED": True,
            "AI_PROVIDER": "ollama",
            "OLLAMA_REQUIRED": True,
            "OLLAMA_HOST": "http://ollama:11434",
            "OLLAMA_MODEL": "qwen3:4b-instruct-2507-q4_K_M",
            "SYSTEM_MONITOR_REQUIRED": True,
            "PASSWORD_RESET_ENABLED": False,
            "ACCOUNT_CREDENTIAL_DELIVERY_ENABLED": False,
            "ADMIN_LOGIN_URL": "https://admin.maianhomes.vn/login",
            "ADMIN_RESET_URL": "https://admin.maianhomes.vn/reset-password",
            "ADMIN_SETUP_URL": "https://admin.maianhomes.vn/setup-account",
        }

    def test_complete_production_configuration_is_accepted(self):
        configured = Settings(_env_file=None, **self.valid_production_settings())
        self.assertEqual(configured.ENVIRONMENT, "production")

    def test_production_safety_invariants_fail_closed(self):
        cases = [
            ("insecure origin", {"ALLOWED_ORIGINS": "http://maianhomes.vn"}, "explicit HTTPS origins"),
            ("origin enforcement", {"CSRF_ORIGIN_ENFORCEMENT": False}, "Origin enforcement"),
            ("marketing transactions", {"MARKETING_TRANSACTIONS_ENABLED": False}, "Marketing requires MongoDB transactions"),
            ("embedded marketing jobs", {"MARKETING_EMBEDDED_JOBS": True}, "external worker"),
            (
                "production load-test marker",
                {"LOAD_TEST_TARGET_MARKER": "staging-load-target"},
                "empty LOAD_TEST_TARGET_MARKER",
            ),
            (
                "deployment instance namespace",
                {"DEPLOYMENT_INSTANCE_ID": "production"},
                "explicit deployment instance identifier",
            ),
            (
                "immutable release identity",
                {"APP_RELEASE": "production"},
                "immutable APP_RELEASE",
            ),
            ("marketing revalidation URL", {"MARKETING_REVALIDATE_URL": ""}, "revalidation URL and secret"),
            ("marketing revalidation secret", {"MARKETING_REVALIDATE_SECRET": "change-me"}, "revalidation URL and secret"),
            ("legacy consignment mutations", {"CONSIGNMENT_ENABLED": False}, "must use Consignment"),
            ("startup indexes", {"ENSURE_INDEXES_ON_STARTUP": True}, "database-bootstrap"),
            ("worker health", {"WORKER_HEALTH_REQUIRED": False}, "external Activity worker"),
            ("embedded activity jobs", {"ACTIVITY_EMBEDDED_JOBS": True}, "external Activity worker"),
            ("rate-limit storage", {"RATE_LIMIT_STORAGE_URI": "memory://"}, "rate limiting must use Redis"),
            ("realtime Redis", {"REDIS_URL": "http://redis:6379"}, "Realtime notifications require Redis"),
            ("WebSocket query token", {"WS_ALLOW_QUERY_TOKEN": True}, "HttpOnly cookie"),
            ("S3 disabled", {"S3_ENABLED": False}, "object storage must use S3/MinIO"),
            ("placeholder storage key", {"S3_ACCESS_KEY": "replace-minio-user"}, "storage credentials"),
            ("system monitor disabled", {"SYSTEM_MONITOR_REQUIRED": False}, "system monitoring worker"),
            ("malware scanning", {"MALWARE_SCAN_ENABLED": False}, "malware scanning"),
            ("Ollama readiness", {"OLLAMA_REQUIRED": False}, "Ollama readiness"),
            (
                "local Ollama host",
                {"OLLAMA_HOST": "http://localhost:11434"},
                "explicit service URL",
            ),
            (
                "invalid credential key",
                {"ACCOUNT_CREDENTIAL_DELIVERY_ENABLED": True, "CREDENTIAL_ENCRYPTION_KEY": "abc"},
                "exactly 32 bytes",
            ),
            (
                "insecure password reset URL",
                {
                    "PASSWORD_RESET_ENABLED": True,
                    "CREDENTIAL_ENCRYPTION_KEY": "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
                    "ADMIN_RESET_URL": "http://localhost:3000/reset-password",
                },
                "explicit HTTPS URLs",
            ),
            (
                "insecure account setup URL",
                {
                    "ACCOUNT_CREDENTIAL_DELIVERY_ENABLED": True,
                    "CREDENTIAL_ENCRYPTION_KEY": "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
                    "ADMIN_SETUP_URL": "http://localhost:3000/setup-account",
                },
                "explicit HTTPS URLs",
            ),
            (
                "smtp submission without STARTTLS",
                {
                    "ACCOUNT_CREDENTIAL_DELIVERY_ENABLED": True,
                    "CREDENTIAL_ENCRYPTION_KEY": "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
                    "SMTP_PORT": 587,
                    "SMTP_START_TLS": False,
                },
                "SMTP port 587 requires STARTTLS",
            ),
        ]

        baseline = self.valid_production_settings()
        for label, overrides, expected_error in cases:
            with self.subTest(label=label):
                with self.assertRaisesRegex(ValueError, expected_error):
                    Settings(_env_file=None, **{**baseline, **overrides})

    def test_staging_tier_requires_a_real_load_test_marker(self):
        baseline = self.valid_production_settings()
        configured = Settings(
            _env_file=None,
            **{
                **baseline,
                "DEPLOYMENT_TIER": "staging",
                "LOAD_TEST_TARGET_MARKER": "staging-capacity-target-2026",
            },
        )
        self.assertEqual(configured.DEPLOYMENT_TIER, "staging")

        with self.assertRaisesRegex(ValueError, "non-placeholder"):
            Settings(
                _env_file=None,
                **{
                    **baseline,
                    "DEPLOYMENT_TIER": "staging",
                    "LOAD_TEST_TARGET_MARKER": "replace-with-staging-marker",
                },
            )

    def test_production_mode_rejects_development_deployment_tier(self):
        baseline = self.valid_production_settings()
        with self.assertRaisesRegex(ValueError, "DEPLOYMENT_TIER"):
            Settings(
                _env_file=None,
                **{**baseline, "DEPLOYMENT_TIER": "development"},
            )

    def test_served_tiers_require_an_immutable_release_identity(self):
        baseline = self.valid_production_settings()
        for tier, marker in (
            ("production", ""),
            ("staging", "staging-capacity-target-2026"),
        ):
            for release in (
                "",
                "development",
                "production",
                "unknown",
                "replace-with-git-sha",
            ):
                with self.subTest(
                    tier=tier, release=release
                ), self.assertRaisesRegex(ValueError, "immutable APP_RELEASE"):
                    Settings(
                        _env_file=None,
                        **{
                            **baseline,
                            "DEPLOYMENT_TIER": tier,
                            "LOAD_TEST_TARGET_MARKER": marker,
                            "APP_RELEASE": release,
                        },
                    )

    def test_runtime_release_must_match_baked_image_revision(self):
        baseline = self.valid_production_settings()
        with patch("app.core.config.baked_image_revision", return_value="0123456789abcdef"):
            configured = Settings(
                _env_file=None,
                **{**baseline, "APP_RELEASE": "0123456789abcdef"},
            )
            self.assertEqual(configured.APP_RELEASE, "0123456789abcdef")

            with self.assertRaisesRegex(ValueError, "baked into the backend image"):
                Settings(
                    _env_file=None,
                    **{**baseline, "APP_RELEASE": "fedcba9876543210"},
                )

    def test_production_rejects_placeholder_secret(self):
        with self.assertRaises(ValueError):
            Settings(
                _env_file=None,
                ENVIRONMENT="production",
                DEPLOYMENT_TIER="production",
                DEPLOYMENT_INSTANCE_ID="maian-production-primary",
                LOAD_TEST_TARGET_MARKER="",
                APP_RELEASE="release-0123456789abcdef",
                SECRET_KEY="replace-with-at-least-64-random-characters",
                ALLOWED_ORIGINS="https://maianhomes.vn",
                RATE_LIMIT_STORAGE_URI="redis://redis:6379/1",
            )

    def test_removed_internal_domains_are_not_in_openapi(self):
        paths = app.openapi()["paths"]
        self.assertFalse(any("/performance" in path or "/leave" in path for path in paths))
        self.assertFalse(any("/api/protected/it/" in path for path in paths))
        self.assertFalse(any("/api/protected/hr/" in path for path in paths))

    def test_production_requires_external_worker_health(self):
        with self.assertRaisesRegex(ValueError, "external Activity worker"):
            Settings(
                _env_file=None,
                ENVIRONMENT="production",
                DEPLOYMENT_TIER="production",
                DEPLOYMENT_INSTANCE_ID="maian-production-primary",
                LOAD_TEST_TARGET_MARKER="",
                APP_RELEASE="release-0123456789abcdef",
                SECRET_KEY="a-secure-production-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                ALLOWED_ORIGINS="https://maianhomes.vn",
                CSRF_ORIGIN_ENFORCEMENT=True,
                MARKETING_TRANSACTIONS_ENABLED=True,
                MARKETING_EMBEDDED_JOBS=False,
                MARKETING_REVALIDATE_URL="https://maianhomes.vn/api/webhook/revalidate",
                MARKETING_REVALIDATE_SECRET="secure-production-revalidation-secret",
                RATE_LIMIT_STORAGE_URI="redis://redis:6379/1",
                S3_ENABLED=True,
                S3_ACCESS_KEY="secure-storage-user",
                S3_SECRET_KEY="secure-storage-password",
                PASSWORD_RESET_ENABLED=False,
                ACCOUNT_CREDENTIAL_DELIVERY_ENABLED=False,
                CONSIGNMENT_ENABLED=True,
                WORKER_HEALTH_REQUIRED=False,
                ACTIVITY_EMBEDDED_JOBS=True,
            )

    def test_bootstrap_password_requires_every_policy_character_class(self):
        invalid_passwords = (
            "lowercase-only-password",
            "UPPERCASE-ONLY-PASSWORD",
            "NoDigitsInThisPassword!",
            "No-Symbols-In-Password1".replace("-", ""),
        )
        for password in invalid_passwords:
            with self.subTest(password_class=password):
                with self.assertRaisesRegex(RuntimeError, "password policy"):
                    _validate_password(password)

        _validate_password("Valid-Bootstrap-Password-2026!")


class OllamaReadinessTests(unittest.IsolatedAsyncioTestCase):
    async def test_configured_model_must_exist_in_ollama(self):
        response = MagicMock()
        response.json.return_value = {
            "models": [{"name": "qwen3:4b-instruct-2507-q4_K_M"}]
        }
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.get.return_value = response

        with patch("app.infrastructure.ai_runtime.httpx.AsyncClient", return_value=client), \
             patch.object(settings, "AI_PROVIDER", "ollama"), \
             patch.object(settings, "OLLAMA_HOST", "http://ollama:11434"), \
             patch.object(settings, "OLLAMA_MODEL", "qwen3:4b-instruct-2507-q4_K_M"):
            self.assertTrue(await OllamaService.readiness())

        client.get.assert_awaited_once_with("http://ollama:11434/api/tags")
        response.raise_for_status.assert_called_once_with()



if __name__ == "__main__":
    unittest.main()
