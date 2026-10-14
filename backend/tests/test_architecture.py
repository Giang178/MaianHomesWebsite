import ast
import os

from app.models.user_account import UserRole


def test_external_adapters_live_in_infrastructure_package():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    infrastructure_dir = os.path.join(backend_dir, "app", "infrastructure")
    for filename in ("object_storage.py", "email_delivery.py", "ai_runtime.py"):
        assert os.path.isfile(os.path.join(infrastructure_dir, filename))

    legacy_services_dir = os.path.join(backend_dir, "app", "services")
    for filename in ("storage.py", "email_service.py", "ollama_services.py"):
        assert not os.path.exists(os.path.join(legacy_services_dir, filename))


def test_retired_domain_packages_are_absent():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    retired_paths = (
        "app/modules/people",
        "app/models/people.py",
        "app/api/public/jobs.py",
        "app/modules/platform",
    )
    assert not [
        path for path in retired_paths
        if os.path.exists(os.path.join(backend_dir, *path.split("/")))
    ]


def test_runtime_has_no_removed_domain_imports():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app_dir = os.path.join(backend_dir, "app")
    banned = ("app.services.hr_service", "app.modules.people", "app.models.people", "app.api.public.jobs")
    violations = []
    for root, _, files in os.walk(app_dir):
        for filename in files:
            if not filename.endswith(".py"):
                continue
            path = os.path.join(root, filename)
            with open(path, "r", encoding="utf-8") as source:
                tree = ast.parse(source.read())
            for node in ast.walk(tree):
                imported = []
                if isinstance(node, ast.ImportFrom) and node.module:
                    imported.append(node.module)
                elif isinstance(node, ast.Import):
                    imported.extend(alias.name for alias in node.names)
                if any(value.startswith(item) for value in imported for item in banned):
                    violations.append(path)
    assert not violations, f"Found removed runtime imports: {sorted(set(violations))}"


def test_removed_compatibility_routes_do_not_return():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    removed_files = (
        "app/api/protected/articles.py",
        "app/api/protected/projects.py",
        "app/api/protected/resume_controller.py",
        "app/api/public/articles.py",
        "app/api/public/projects.py",
    )
    existing = [
        relative_path
        for relative_path in removed_files
        if os.path.exists(os.path.join(backend_dir, *relative_path.split("/")))
    ]
    assert not existing, f"Removed compatibility routes returned: {existing}"


def test_shared_service_layer_contains_no_domain_services():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    services_dir = os.path.join(backend_dir, "app", "services")
    allowed = {"base.py", "README.md", "__init__.py"}
    files = {
        name
        for name in os.listdir(services_dir)
        if os.path.isfile(os.path.join(services_dir, name))
    }
    assert files <= allowed, f"Domain services leaked into app/services: {sorted(files - allowed)}"

    required_domain_files = (
        "app/modules/identity/accounts/service.py",
        "app/modules/activity/audit.py",
        "app/modules/notifications/service.py",
        "app/modules/content/assistant/knowledge_service.py",
        "app/modules/content/assistant/grounded_service.py",
        "app/modules/content/assistant/seo_service.py",
    )
    assert all(
        os.path.isfile(os.path.join(backend_dir, *path.split("/")))
        for path in required_domain_files
    )


def test_admin_roles_are_website_scoped():
    assert {role.value for role in UserRole} == {"CEO", "ADMIN", "MARKETING"}
    assert not {"HR", "IT", "SALES"} & {role.value for role in UserRole}
