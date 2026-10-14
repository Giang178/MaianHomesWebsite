import unittest

from app.main import app


class TestMarketingOpenAPIContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = app.openapi()

    def test_public_compatibility_paths_are_preserved(self):
        paths = self.schema["paths"]
        self.assertIn("/api/public/projects", paths)
        self.assertIn("/api/public/projects/{id_or_slug}", paths)
        self.assertIn("/api/public/articles", paths)
        self.assertIn("/api/public/articles/{slug}", paths)

    def test_project_mutations_expose_concurrency_and_idempotency_contract(self):
        schemas = self.schema["components"]["schemas"]
        self.assertIn(
            "idempotency_key",
            schemas["ProjectCreateRequest"]["required"],
        )
        update_required = set(schemas["ProjectDraftUpdate"]["required"])
        self.assertTrue(
            {"expected_version", "idempotency_key"} <= update_required
        )
        self.assertIn("/api/protected/projects/validate", self.schema["paths"])
        self.assertIn(
            "post",
            self.schema["paths"]["/api/protected/projects/validate"],
        )

    def test_article_mutations_expose_concurrency_and_idempotency_contract(self):
        schemas = self.schema["components"]["schemas"]
        self.assertIn(
            "idempotency_key",
            schemas["ArticleCreateRequest"]["required"],
        )
        update_required = set(schemas["ArticleDraftUpdate"]["required"])
        self.assertTrue(
            {"expected_version", "idempotency_key"} <= update_required
        )
        transition_required = set(schemas["TransitionRequest"]["required"])
        self.assertTrue(
            {"action", "expected_version", "idempotency_key"}
            <= transition_required
        )

    def test_article_history_contract_is_exposed(self):
        paths = self.schema["paths"]
        self.assertIn("/api/protected/articles/{article_id}/revisions", paths)
        self.assertIn("/api/protected/articles/{article_id}/audit-logs", paths)
        self.assertIn(
            "get", paths["/api/protected/articles/{article_id}/revisions"]
        )
        self.assertIn(
            "get", paths["/api/protected/articles/{article_id}/audit-logs"]
        )

    def test_archived_content_has_explicit_permanent_delete_endpoints(self):
        paths = self.schema["paths"]
        self.assertIn("/api/protected/projects/{project_id}/permanent", paths)
        self.assertIn("/api/protected/articles/{article_id}/permanent", paths)
        self.assertIn(
            "delete",
            paths["/api/protected/projects/{project_id}/permanent"],
        )
        self.assertIn(
            "delete",
            paths["/api/protected/articles/{article_id}/permanent"],
        )
