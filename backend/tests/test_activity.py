import unittest
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import FastAPI, HTTPException

from app.modules.activity.api import activity_admin, ensure_aware
from app.modules.activity.api import router as activity_router
from app.modules.activity.registry import normalize_event_type, normalize_result
from app.modules.activity.service import RETENTION_DAYS, _decode_cursor, _encode_cursor, _event_key, redact


class ActivityV3UnitTests(unittest.TestCase):
    def test_redact_removes_secrets_recursively_and_limits_depth(self):
        value = redact({"password": "secret", "nested": {"access_token": "token"}, "ok": "safe"})
        self.assertEqual(value["password"], "[REDACTED]")
        self.assertEqual(value["nested"]["access_token"], "[REDACTED]")
        self.assertEqual(value["ok"], "safe")
        self.assertIn("TRUNCATED", str(redact({"a": {"b": {"c": {"d": {"e": {"f": 1}}}}}})))

    def test_event_key_is_deterministic_when_request_id_is_present(self):
        first = _event_key("SYSTEM", "SECURITY", "CANDIDATE_CREATED", "CANDIDATE", "abc", "request-1", None)
        second = _event_key("SYSTEM", "SECURITY", "CANDIDATE_CREATED", "CANDIDATE", "abc", "request-1", None)
        self.assertEqual(first, second)

    def test_events_are_permanent_and_manual_purge_threshold_is_180_days(self):
        self.assertEqual(RETENTION_DAYS, 180)

    def test_taxonomy_normalizes_legacy_aliases(self):
        self.assertEqual(normalize_result("FAILED"), "FAILURE")
        self.assertEqual(normalize_event_type("DOWNLOADED"), "DOWNLOAD")

    def test_only_ceo_and_admin_can_access_activity_api(self):
        self.assertEqual(activity_admin({"role": "CEO"})["role"], "CEO")
        self.assertEqual(activity_admin({"role": "ADMIN"})["role"], "ADMIN")
        for role in ("MARKETING", "UNKNOWN_ROLE"):
            with self.assertRaises(HTTPException) as error:
                activity_admin({"role": role})
            self.assertEqual(error.exception.status_code, 403)

    def test_datetime_filters_require_timezone(self):
        with self.assertRaises(HTTPException):
            ensure_aware(datetime(2026, 8, 1), "start")
        aware = datetime(2026, 8, 1, tzinfo=timezone.utc)
        self.assertEqual(ensure_aware(aware, "start"), aware)

    def test_cursor_is_opaque_signed_and_round_trips(self):
        occurred_at = datetime(2026, 8, 1, tzinfo=timezone.utc)
        object_id = ObjectId()
        cursor = _encode_cursor(occurred_at, object_id)
        self.assertNotIn(str(object_id), cursor)
        decoded_at, decoded_id = _decode_cursor(cursor)
        self.assertEqual(decoded_at, occurred_at)
        self.assertEqual(decoded_id, object_id)
        with self.assertRaises(HTTPException):
            _decode_cursor(cursor + "tampered")


class ActivityV3ContractTests(unittest.TestCase):
    def test_clean_cut_api_contract(self):
        app = FastAPI()
        app.include_router(activity_router, prefix="/api/protected")
        paths = app.openapi()["paths"]
        self.assertEqual(set(paths), {
            "/api/protected/activity-events",
            "/api/protected/activity-events/metadata",
            "/api/protected/activity-events/export",
            "/api/protected/activity-events/purge-preview",
            "/api/protected/activity-events/purge",
            "/api/protected/activity-events/{event_id}",
        })