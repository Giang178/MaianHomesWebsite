from pathlib import Path

from scripts.verify_website_bootstrap import (
    FORBIDDEN_COLLECTIONS,
    REQUIRED_INDEXES,
)


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"


def test_canonical_bootstrap_has_no_department_dependencies():
    source = (BACKEND / "scripts" / "database_bootstrap.py").read_text(
        encoding="utf-8"
    )
    assert "app.modules.people" not in source
    assert "app.modules.sales" not in source
    assert '"employees"' not in source
    assert "legacy-adopt" not in source
    assert "bootstrap_database" in source
    assert "verify_database" in source


def test_website_bootstrap_writes_release_identity_and_forces_password_change():
    website_source = (BACKEND / "scripts" / "bootstrap_website.py").read_text(
        encoding="utf-8"
    )
    admin_source = (BACKEND / "scripts" / "bootstrap_admin.py").read_text(
        encoding="utf-8"
    )
    assert '"source": "fresh-bootstrap"' in website_source
    assert '"profile": "website-only-v1"' in website_source
    assert '"must_change_password": True' in admin_source


def test_compose_blocks_api_until_database_verification_succeeds():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    assert 'command: ["python", "-m", "scripts.database_bootstrap"]' in compose
    assert 'command: ["python", "-m", "scripts.database_verify"]' in compose
    assert compose.count(
        "database-verify: {condition: service_completed_successfully}"
    ) >= 3


def test_verifier_covers_runtime_indexes_and_retired_collections():
    assert {"user_accounts", "website_pages", "website_leads", "projects", "articles"} <= set(
        REQUIRED_INDEXES
    )
    assert {"employees", "leads", "inventory", "consignments"} <= FORBIDDEN_COLLECTIONS


def test_release_runbook_contains_no_legacy_migration_steps():
    runbook = (ROOT / "docs" / "release" / "RELEASE_RUNBOOK.md").read_text(
        encoding="utf-8"
    )
    assert "scripts.migrations.repair_release_state --apply" not in runbook
    assert "scripts.backfill_employee_search_fields" not in runbook
    assert "DATABASE_BOOTSTRAP_MODE=fresh-only" in runbook
    assert "scripts.database_fresh_verify" in runbook
