import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class NginxCapacityContractTests(unittest.TestCase):
    def setUp(self):
        self.development = (ROOT / "infrastructure" / "nginx.conf").read_text(
            encoding="utf-8"
        )
        self.production = (
            ROOT / "infrastructure" / "nginx.production.conf"
        ).read_text(encoding="utf-8")

    def test_nginx_uses_all_cpus_and_has_connection_headroom(self):
        for source in (self.development, self.production):
            self.assertIn("worker_processes auto;", source)
            self.assertIn("worker_rlimit_nofile 65535;", source)
            self.assertRegex(source, r"worker_connections\s+8192;")
            self.assertIn("worker_shutdown_timeout 30s;", source)

    def test_proxy_overload_and_connection_reuse_are_explicit(self):
        for source in (self.development, self.production):
            self.assertIn("proxy_socket_keepalive on;", source)
            self.assertIn("proxy_next_upstream_tries 2;", source)
            self.assertIn("limit_req_status 429;", source)
            self.assertIn("limit_conn_status 429;", source)
            self.assertIn('proxy_set_header Connection "";', source)
            self.assertIn("proxy_buffering off;", source)
            self.assertIn("location ~ ^/health/(live|ready)$", source)
            self.assertIn(
                "limit_req_zone $binary_remote_addr zone=health:1m rate=30r/m;",
                source,
            )
            self.assertIn("limit_req zone=health burst=10 nodelay;", source)

        for color in ("blue", "green"):
            source = (
                ROOT / "infrastructure" / "upstreams" / f"{color}.conf"
            ).read_text(encoding="utf-8")
            self.assertIn("zone frontend 64k;", source)
            self.assertIn("zone backend 64k;", source)
            self.assertIn("keepalive 32;", source)
            self.assertIn("keepalive 64;", source)
            self.assertIn("keepalive_requests 1000;", source)

    def test_both_consignment_upload_routes_share_the_same_limits(self):
        expected = r"location ~ ^/api/public/consignments(?:/with-images)?$"
        for source in (self.development, self.production):
            self.assertIn(expected, source)
            location = source.split(expected, 1)[1].split("}", 1)[0]
            self.assertIn("limit_req zone=uploads burst=5 nodelay;", location)
            self.assertIn("limit_conn upload_connections 2;", location)

    def test_compose_bounds_uvicorn_without_changing_worker_default(self):
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

        self.assertIn('$${UVICORN_WORKERS:-4}', compose)
        self.assertIn('$${UVICORN_LIMIT_CONCURRENCY:-512}', compose)
        self.assertIn('$${UVICORN_BACKLOG:-2048}', compose)
        self.assertIn('$${UVICORN_TIMEOUT_KEEP_ALIVE:-10}', compose)
        self.assertIn('$${UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN:-30}', compose)
        self.assertIn("--no-access-log", compose)
        self.assertRegex(
            compose,
            r"ulimits:\s+nofile:\s+soft: 65535\s+hard: 65535",
        )


class StagedLoadProfileContractTests(unittest.TestCase):
    def _read(self, name):
        return (ROOT / "backend" / "tests" / "load" / name).read_text(encoding="utf-8")

    def test_website_profile_is_read_only_and_staged(self):
        source = self._read("mixed_1000_k6.js")
        self.assertIn("[25, 50, 125, 250, 500, 750, 1000]", source)
        self.assertIn("positiveInteger('MAX_VUS', '125', 1000)", source)
        self.assertNotRegex(source, re.compile(r"http\.(post|put|patch|del)\s*\(", re.IGNORECASE))
        for route in ("'/'", "'/gioi-thieu'", "'/du_an'", "'/tin_tuc'", "'/tuyen-dung'"):
            self.assertIn(route, source)
        self.assertNotRegex(source, re.compile(r"/api/protected/(hr|it|sales)", re.IGNORECASE))

    def test_profiles_use_non_bypassable_target_guards(self):
        guard = self._read("target_guard.js")
        for production_host in ("maianhomes.vn", "www.maianhomes.vn", "admin.maianhomes.vn"):
            self.assertIn(f"'{production_host}'", guard)
        for value in (
            "EXPECTED_TARGET_HOST", "LOAD_TEST_TARGET", "CONFIRM_STAGING_TARGET",
            "CONFIRM_LOCAL_TARGET", "EXPECTED_RELEASE", "EXPECTED_IMAGE_REVISION",
            "EXPECTED_LOAD_TEST_MARKER", "EXPECTED_DEPLOYMENT_TIER",
        ):
            self.assertIn(value, guard)
        self.assertIn("CONFIRM_HIGH_LOAD", self._read("mixed_1000_k6.js"))
        self.assertIn("execution.test.abort", guard)

    def test_focused_profiles_are_website_scoped(self):
        for profile in ("activity_k6.js", "websocket_1000_k6.js"):
            source = self._read(profile)
            self.assertIn("guardLoadTarget", source)
            self.assertIn("probeTargetReadiness(target, true, 'before')", source)
            self.assertIn("maybeProbeTargetReadiness(target)", source)
            self.assertIn("load_readiness_failed", source)
            self.assertNotRegex(source, re.compile(r"/api/protected/(hr|it|sales)", re.IGNORECASE))

    def test_websocket_profile_requires_unique_ignored_session_pool(self):
        source = self._read("websocket_1000_k6.js")
        ignored = self._read(".gitignore")
        self.assertIn("*.sessions.json", ignored)
        self.assertIn("SESSION_POOL_FILE", source)
        self.assertIn("/api/ws/notifications", source)
        self.assertNotIn("?token=", source)

class InfrastructureRolloutContractTests(unittest.TestCase):
    def test_production_workflow_enforces_release_gates(self):
        workflow = (
            ROOT / ".github" / "workflows" / "production-gates.yml"
        ).read_text(encoding="utf-8")
        for job in ("backend:", "frontend:", "containers:"):
            self.assertIn(job, workflow)
        for gate in (
            "python -m pytest -q",
            "pip-audit -r requirements.txt",
            "npm audit --audit-level=high",
            "gitleaks/gitleaks-action",
            "aquasecurity/trivy-action",
            "Docker Compose smoke test",
        ):
            self.assertIn(gate, workflow)
        self.assertIn("needs: [backend, frontend]", workflow)
        self.assertIn("maian-backend:${{ github.sha }}", workflow)
        self.assertIn("maian-frontend:${{ github.sha }}", workflow)
    def test_backend_image_declares_activity_worker_capability(self):
        dockerfile = (ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn(
            'LABEL com.maianhomes.capability.activity-worker="true"', dockerfile
        )
        self.assertIn('"--no-access-log"', dockerfile)

    def test_worker_rollback_preflights_and_explicitly_handles_legacy_blue(self):
        deploy = (
            ROOT / "scripts" / "deployment" / "deploy-workers.ps1"
        ).read_text(encoding="utf-8")
        rollback = (
            ROOT / "scripts" / "deployment" / "rollback-blue-green.ps1"
        ).read_text(encoding="utf-8")

        self.assertIn("com.maianhomes.capability.activity-worker", deploy)
        self.assertIn("docker image inspect", deploy)
        self.assertIn("AllowLegacyWithoutActivityWorker", deploy)
        self.assertIn("$Color -ne 'blue'", deploy)
        self.assertIn("stop activity-worker", deploy)
        self.assertIn("activity-worker-before-stop.txt", deploy)
        self.assertIn("activity-worker-stopped.txt", deploy)
        self.assertIn("worker-capability.txt", deploy)
        self.assertIn("PreflightOnly", deploy)
        self.assertIn("AllowLegacyBlueWithoutActivityWorker", rollback)
        self.assertLess(rollback.find("-PreflightOnly"), rollback.find("switch-blue-green.ps1"))

    def test_nginx_reload_is_conditional_on_valid_certificate_change(self):
        watcher = (
            ROOT / "infrastructure" / "watch-nginx-certificates.sh"
        ).read_text(encoding="utf-8")
        for compose_name in ("docker-compose.production.yml", "docker-compose.staging.yml"):
            compose = (ROOT / compose_name).read_text(encoding="utf-8")
            self.assertIn("watch-nginx-certificates.sh", compose)
            self.assertNotIn("sleep 6h; nginx -s reload", compose)
        self.assertIn("certificate_checksum", watcher)
        self.assertIn('if [ "$current_checksum" = "$previous_checksum" ]; then', watcher)
        self.assertIn('mkdir "$route_lock_dir"', watcher)
        self.assertIn("if ! nginx -t; then", watcher)
        self.assertIn("if ! nginx -s reload; then", watcher)
        self.assertIn("certificate_reload_attempted=1", watcher)
        self.assertIn("route lock retained for operator review", watcher)


if __name__ == "__main__":
    unittest.main()
