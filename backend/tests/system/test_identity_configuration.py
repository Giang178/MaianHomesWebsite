import unittest
import inspect
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError
from app.core.config import settings

from app import main as application_main
from app.modules.identity.policies import validate_password
from app.modules.identity.schemas import AccountPolicyUpdate, EmailTemplateUpdate
from app.modules.identity.service import IdentityService
from app.modules.identity.templates import (
    ALLOWED_PLACEHOLDERS,
    DEFAULT_TEMPLATES,
    render_template,
    sanitize_template,
    access_url_with_token,
    normalize_access_url,
)

from app.modules.system.settings.service import SystemSettingsService
from app.modules.system.settings.schemas import EmailSettingsUpdate
from app.modules.system.monitoring import service as monitoring_service
from app.infrastructure import email_delivery
from app.api.public import auth as public_auth

class IdentityTemplateContractTests(unittest.TestCase):
    def test_exactly_seven_account_events_are_managed(self):
        self.assertEqual(len(DEFAULT_TEMPLATES), 7)
        self.assertEqual(set(DEFAULT_TEMPLATES), set(ALLOWED_PLACEHOLDERS))
        self.assertIn("ACCOUNT_EMAIL_CHANGED", DEFAULT_TEMPLATES)

    def test_placeholder_contract_is_scoped_per_event(self):
        with self.assertRaises(HTTPException) as caught:
            sanitize_template(
                "PASSWORD_CHANGED",
                "Changed",
                '<p><a href="{{reset_url}}">Reset</a></p>',
            )
        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(
            caught.exception.detail["code"],
            "UNSUPPORTED_EMAIL_PLACEHOLDER",
        )

    def test_render_escapes_values_and_removes_active_content(self):
        subject, body = render_template(
            "PASSWORD_RESET",
            {
                "subject": "Reset {{email}}",
                "html_body": (
                    '<p onclick="alert(1)">{{email}}</p>'
                    '<script>alert(1)</script>'
                    '<a href="{{reset_url}}">Reset</a>'
                ),
            },
            {
                "email": '<admin@example.com>',
                "reset_url": "https://example.com/reset?a=1&b=2",
                "expires_minutes": 15,
            },
        )
        self.assertNotIn("onclick", body)
        self.assertNotIn("<script", body)
        self.assertIn("&lt;admin@example.com&gt;", subject)
        self.assertIn("https://example.com/reset?a=1&amp;b=2", body)

    def test_active_account_notification_templates_render(self):
        for event_type in ("PASSWORD_CHANGED", "ACCOUNT_LOCKED", "ACCOUNT_UNLOCKED"):
            with self.subTest(event_type=event_type):
                subject, body = render_template(
                    event_type,
                    {
                        "subject": DEFAULT_TEMPLATES[event_type][0],
                        "html_body": DEFAULT_TEMPLATES[event_type][1],
                    },
                    {"email": "employee@example.com"},
                )
                self.assertTrue(subject)
                self.assertIn("employee@example.com", body)

    def test_new_mutation_schemas_require_reason_and_forbid_extra_fields(self):
        with self.assertRaises(ValidationError):
            AccountPolicyUpdate(expected_version=1, password_min_length=14)
        with self.assertRaises(ValidationError):
            EmailTemplateUpdate(
                expected_version=1,
                reason="security update",
                subject="Subject",
                html_body="<p>Body</p>",
                unexpected=True,
            )

    def test_password_policy_is_owned_by_identity_domain(self):
        validate_password(
            "Strong-Password-123",
            {
                "password_min_length": 12,
                "require_uppercase": True,
                "require_lowercase": True,
                "require_digit": True,
                "require_special": True,
            },
        )
        with self.assertRaises(HTTPException):
            validate_password("weak", {"password_min_length": 12})


    def test_employee_configured_reset_url_receives_the_request_token(self):
        value = access_url_with_token(
            "https://admin.example.com/reset-password?source=email",
            "opaque-token",
        )
        self.assertIn("source=email", value)
        self.assertIn("token=opaque-token", value)
        with self.assertRaises(HTTPException):
            normalize_access_url("javascript:alert(1)")

    def test_identity_uses_only_canonical_collections(self):
        service = IdentityService()
        self.assertEqual(service.policy_collection_name, "identity_settings")
        self.assertEqual(service.template_collection_name, "identity_email_templates")


class IdentityWorkerContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_password_policy_exposes_only_validation_rules(self):
        policy = {
            "password_min_length": 18,
            "require_uppercase": True,
            "require_lowercase": True,
            "require_digit": False,
            "require_special": False,
            "updated_by": "it@example.com",
        }
        with patch.object(
            public_auth.identity_service,
            "get_policy",
            AsyncMock(return_value=policy),
        ):
            result = await public_auth.password_policy()
        self.assertEqual(set(result), set(public_auth.PUBLIC_PASSWORD_POLICY_FIELDS))
        self.assertEqual(result["password_min_length"], 18)
        self.assertNotIn("updated_by", result)

    async def test_configured_reset_url_is_loaded_from_the_email_template(self):
        service = IdentityService()
        with patch.object(
            service,
            "get_template",
            AsyncMock(return_value={
                "subject": "Reset",
                "html_body": '<a href="{{reset_url}}">Reset</a>',
                "access_url": "https://staff-entered.example/reset-password",
            }),
        ):
            result = await service.configured_access_url(
                "PASSWORD_RESET", token="opaque-token"
            )
        self.assertEqual(
            result,
            "https://staff-entered.example/reset-password?token=opaque-token",
        )

    async def test_configured_reset_url_uses_reset_fallback(self):
        service = IdentityService()
        with patch.object(
            service,
            "get_template",
            AsyncMock(return_value={
                "subject": "Reset",
                "html_body": '<a href="{{reset_url}}">Reset</a>',
                "access_url": None,
            }),
        ), patch.object(
            settings,
            "ADMIN_RESET_URL",
            "https://admin.example/reset-password",
        ), patch.object(
            settings,
            "ADMIN_LOGIN_URL",
            "https://admin.example/login",
        ):
            result = await service.configured_access_url(
                "PASSWORD_RESET", token="opaque-token"
            )
        self.assertEqual(result, "https://admin.example/reset-password?token=opaque-token")

    async def test_template_update_persists_the_url_entered_by_it(self):
        collection = MagicMock()
        collection.find_one_and_update = AsyncMock(return_value={

            "_id": ObjectId(),
            "event_type": "ACCOUNT_CREATED",
            "subject": "Account",
            "html_body": '<a href="{{login_url}}">Login</a>',
            "access_url": "https://staff-entered.example/login",
            "version": 2,
        })
        database = MagicMock()
        database.__getitem__.return_value = collection
        service = IdentityService()
        current = {
            "subject": "Old",
            "html_body": '<a href="{{login_url}}">Old</a>',
            "access_url": None,
            "version": 1,
        }
        with patch(
            "app.modules.identity.service.get_database", return_value=database
        ), patch.object(service, "get_template", AsyncMock(return_value=current)):
            updated, _ = await service.update_template(
                "ACCOUNT_CREATED",
                expected_version=1,
                subject="Account",
                html_body='<a href="{{login_url}}">Login</a>',
                access_url="https://staff-entered.example/login",
            )
        update_document = collection.find_one_and_update.await_args.args[1]
        self.assertEqual(
            update_document["$set"]["access_url"],
            "https://staff-entered.example/login",
        )
        self.assertEqual(updated["access_url"], "https://staff-entered.example/login")

    async def test_smtp_database_configuration_has_priority(self):
        service = SystemSettingsService()
        document = {
            "_id": "company_email",
            "host": "smtp.database.test",
            "port": 587,
            "username": "database@example.com",
            "from_name": "Database",
            "from_email": "database@example.com",
            "start_tls": True,
            "password_ciphertext": "ciphertext",
            "verified_at": datetime.now(timezone.utc),
            "version": 2,
        }
        with patch.object(service, "email_document", AsyncMock(return_value=document)), patch(
            "app.modules.system.settings.service.decrypt_password",
            return_value="database-secret",
        ), patch("app.modules.system.settings.service.settings.SMTP_USER", "env@example.com"), patch(
            "app.modules.system.settings.service.settings.SMTP_PASSWORD", "environment-secret"
        ):
            config = await service.smtp_config(require_verified=True)
        self.assertEqual(config["source"], "database")
        self.assertEqual(config["host"], "smtp.database.test")
        self.assertEqual(config["password"], "database-secret")

    async def test_smtp_environment_is_only_an_unverified_fallback(self):
        service = SystemSettingsService()
        with patch.object(service, "email_document", AsyncMock(return_value=None)), patch(
            "app.modules.system.settings.service.settings.SMTP_USER", "env@example.com"
        ), patch("app.modules.system.settings.service.settings.SMTP_PASSWORD", "environment-secret"):
            config = await service.smtp_config()
            self.assertEqual(config["source"], "environment")
            with self.assertRaises(HTTPException) as caught:
                await service.smtp_config(require_verified=True)
        self.assertEqual(caught.exception.status_code, 503)

    async def test_smtp_environment_honors_explicit_starttls_setting(self):
        service = SystemSettingsService()
        with patch.object(service, "email_document", AsyncMock(return_value=None)), patch(
            "app.modules.system.settings.service.settings.SMTP_USER", "env@example.com"
        ), patch(
            "app.modules.system.settings.service.settings.SMTP_PASSWORD", "environment-secret"
        ), patch(
            "app.modules.system.settings.service.settings.SMTP_START_TLS", False
        ):
            config = await service.smtp_config()
        self.assertFalse(config["start_tls"])

    def test_smtp_environment_rejects_example_credentials(self):
        service = SystemSettingsService()
        with patch(
            "app.modules.system.settings.service.settings.SMTP_USER",
            "your-smtp-account@gmail.com",
        ), patch(
            "app.modules.system.settings.service.settings.SMTP_PASSWORD",
            "your-16-char-smtp-app-password",
        ):
            self.assertIsNone(service._environment_smtp_config())

    def test_smtp_port_587_requires_starttls(self):
        with self.assertRaisesRegex(
            ValidationError, "SMTP_STARTTLS_REQUIRED_FOR_PORT_587"
        ):
            EmailSettingsUpdate(
                expected_version=1,
                host="smtp.gmail.com",
                port=587,
                username="mailer@example.com",
                from_name="Maian Homes",
                from_email="mailer@example.com",
                start_tls=False,
                reason="Secure the production SMTP transport",
            )


    def test_transport_monitoring_outbox_and_readiness_share_smtp_resolver(self):
        self.assertIn(
            "system_settings_service.smtp_config",
            inspect.getsource(email_delivery.send_email),
        )
        self.assertIn(
            "system_settings_service.smtp_config",
            inspect.getsource(monitoring_service._email_check),
        )
        readiness_source = inspect.getsource(application_main.health_ready)
        self.assertIn("system_settings_service.smtp_config", readiness_source)
        self.assertNotIn("settings.SMTP_USER", readiness_source)

if __name__ == "__main__":
    unittest.main()
