import unittest

from tests.test_marketing_module import (
    test_admin_article_status_keeps_publication_state_separate,
    test_archived_content_cannot_be_edited_or_published,
    test_article_quality_gate_accepts_complete_content,
    test_article_quality_gate_rejects_unsafe_or_incomplete_content,
    test_html_sanitizer_removes_script_and_event_handlers,
    test_html_sanitizer_keeps_whitelisted_figure_metadata_only,
    test_marketing_routes_do_not_access_database_directly,
    test_project_quality_gate,
    test_public_mapper_removes_workflow_metadata,
    test_staff_ownership_and_manager_permissions,
    test_transferred_article_uses_editor_owner_not_original_author,
)


class TestMarketingModule(unittest.TestCase):
    def test_contracts_policies_and_quality_gates(self):
        for check in (
            test_admin_article_status_keeps_publication_state_separate,
            test_archived_content_cannot_be_edited_or_published,
            test_article_quality_gate_accepts_complete_content,
            test_article_quality_gate_rejects_unsafe_or_incomplete_content,
            test_html_sanitizer_removes_script_and_event_handlers,
            test_html_sanitizer_keeps_whitelisted_figure_metadata_only,
            test_project_quality_gate,
            test_staff_ownership_and_manager_permissions,
            test_transferred_article_uses_editor_owner_not_original_author,
            test_public_mapper_removes_workflow_metadata,
            test_marketing_routes_do_not_access_database_directly,
        ):
            with self.subTest(check=check.__name__):
                check()
