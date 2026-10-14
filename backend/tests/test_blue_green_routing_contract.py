import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class BlueGreenRoutingContractTests(unittest.TestCase):
    def test_revalidation_routes_to_the_active_frontend_upstream(self):
        config = (ROOT / "infrastructure" / "nginx.production.conf").read_text(encoding="utf-8")
        exact_location = "location = /api/webhook/revalidate"

        self.assertEqual(config.count(exact_location), 2)
        for block in config.split(exact_location)[1:]:
            self.assertIn("proxy_pass http://frontend;", block.split("}", 1)[0])
        self.assertLess(config.find(exact_location), config.find("location /api/"))

    def test_blue_green_and_rollback_select_the_expected_frontend(self):
        blue = (ROOT / "infrastructure" / "upstreams" / "blue.conf").read_text(encoding="utf-8")
        green = (ROOT / "infrastructure" / "upstreams" / "green.conf").read_text(encoding="utf-8")
        switch = (ROOT / "scripts" / "deployment" / "switch-blue-green.ps1").read_text(encoding="utf-8")
        rollback = (ROOT / "scripts" / "deployment" / "rollback-blue-green.ps1").read_text(encoding="utf-8")

        self.assertIn("server frontend1:3000;", blue)
        self.assertIn("server frontend2:3000;", green)
        self.assertIn("upstreams/$Color.conf", switch)
        self.assertIn("Color = 'blue'", rollback)

    def test_active_route_survives_nginx_recreate_and_restart(self):
        config = (ROOT / "infrastructure" / "nginx.production.conf").read_text(
            encoding="utf-8"
        )
        production = (ROOT / "docker-compose.production.yml").read_text(
            encoding="utf-8"
        )
        staging = (ROOT / "docker-compose.staging.yml").read_text(encoding="utf-8")
        watcher = (
            ROOT / "infrastructure" / "watch-nginx-certificates.sh"
        ).read_text(encoding="utf-8")
        route_switch = (
            ROOT / "infrastructure" / "switch-nginx-upstream.sh"
        ).read_text(encoding="utf-8")
        powershell_switch = (
            ROOT / "scripts" / "deployment" / "switch-blue-green.ps1"
        ).read_text(encoding="utf-8")

        self.assertIn(
            "include /etc/nginx/runtime/active-upstreams.conf;", config
        )
        self.assertNotIn(
            "include /etc/nginx/conf.d/active-upstreams.conf;", config
        )
        for compose in (production, staging):
            self.assertIn("nginx_active_state:/etc/nginx/runtime", compose)
            self.assertIn(
                "DEPLOYMENT_INSTANCE_ID: ${DEPLOYMENT_INSTANCE_ID:?",
                compose,
            )
            self.assertIn(
                "switch-nginx-upstream.sh:/etc/nginx/scripts/switch-nginx-upstream.sh:ro",
                compose,
            )
        self.assertIn("name: maian_production_nginx_active_state", production)
        self.assertIn("name: maian_staging_nginx_active_state", staging)

        self.assertIn('instance_id_file="$runtime_dir/deployment-instance-id"', watcher)
        self.assertIn('bootstrap_lock_dir="$runtime_dir/.route-bootstrap.lock"', watcher)
        self.assertIn("runtime_state_is_empty()", watcher)
        self.assertIn("runtime_state_contains_only_bootstrap_lock()", watcher)
        self.assertIn(
            "Existing Nginx routing state has no deployment-instance owner",
            watcher,
        )
        self.assertIn(
            'printf \'%s\\n\' "$deployment_instance_id" | cmp -s - "$instance_id_file"',
            watcher,
        )
        bootstrap_lock = watcher.index('mkdir "$bootstrap_lock_dir"')
        bootstrap_config = watcher.index('mv "$active_config_tmp" "$active_config"')
        bootstrap_validation = watcher.index("if ! nginx -t", bootstrap_config)
        owner_commit = watcher.index('mv "$instance_id_tmp" "$instance_id_file"')
        bootstrap_unlock = watcher.index('rmdir "$bootstrap_lock_dir"', owner_commit)
        self.assertLess(bootstrap_lock, bootstrap_config)
        self.assertLess(bootstrap_config, bootstrap_validation)
        self.assertLess(bootstrap_validation, owner_commit)
        self.assertLess(owner_commit, bootstrap_unlock)
        self.assertIn('persisted_color="$(cat "$active_color_file")"', watcher)
        self.assertIn(
            'persisted_template="/etc/nginx/upstreams/${persisted_color}.conf"',
            watcher,
        )
        self.assertIn(
            "Persisted-color upstream template does not contain only",
            watcher,
        )
        self.assertIn('cp "$active_config" "$backup"', route_switch)
        self.assertIn('backup_ready=0', route_switch)
        self.assertIn('backup_ready=1', route_switch)
        verified_backup = route_switch.index(
            'cmp -s "$active_config" "$backup"'
        )
        self.assertLess(verified_backup, route_switch.index('backup_ready=1'))
        self.assertIn('backup_sha256_output="$(sha256sum "$backup")"', route_switch)
        self.assertIn('backup_sha256="${backup_sha256_output%% *}"', route_switch)
        self.assertIn('[ "${#backup_sha256}" -ne 64 ]', route_switch)
        self.assertIn('[ "${#current_backup_sha256}" -ne 64 ]', route_switch)
        self.assertNotIn("cksum", route_switch)
        self.assertIn('[ "$backup_ready" -ne 1 ]', route_switch)
        self.assertIn(
            '[ "$current_backup_sha256" != "$backup_sha256" ]',
            route_switch,
        )
        self.assertIn(
            'instance_id_file="$runtime_dir/deployment-instance-id"', route_switch
        )
        first_owner_gate = route_switch.index(
            "Persistent Nginx routing state is not owned by this exact deployment instance"
        )
        route_lock = route_switch.index('mkdir "$lock_dir"')
        second_owner_gate = route_switch.index(
            "Nginx routing-state ownership changed while the route lock was acquired"
        )
        self.assertLess(first_owner_gate, route_lock)
        self.assertLess(route_lock, second_owner_gate)
        self.assertIn(
            'printf \'%s\\n\' "$previous_color" | cmp -s - "$active_color_file"',
            route_switch,
        )
        self.assertIn('expected_frontend="frontend1:3000"', route_switch)
        self.assertIn('expected_frontend="frontend2:3000"', route_switch)
        self.assertIn('expected_api="api1:8000"', route_switch)
        self.assertIn('expected_api="api2:8000"', route_switch)
        self.assertIn('server_count" -ne 2', route_switch)
        semantic_gate = route_switch.index(
            "Selected upstream template does not contain only"
        )
        self.assertLess(semantic_gate, route_switch.index('cp "$source_config" "$candidate"'))
        candidate_copy = route_switch.index('cp "$source_config" "$candidate"')
        candidate_copy_check = route_switch.index(
            'cmp -s "$source_config" "$candidate"', candidate_copy
        )
        mutation_started = route_switch.index('route_disk_mutation_started=1')
        self.assertLess(candidate_copy, candidate_copy_check)
        self.assertLess(candidate_copy_check, mutation_started)
        self.assertIn('mv "$candidate" "$active_config"', route_switch)
        self.assertIn('cmp -s "$source_config" "$active_config"', route_switch)
        self.assertNotIn('mv "$backup" "$active_config"', route_switch)
        self.assertIn('cp "$backup" "$restore_candidate"', route_switch)
        self.assertIn('cmp -s "$backup" "$restore_candidate"', route_switch)
        self.assertIn('cmp -s "$backup" "$active_config"', route_switch)
        recovery_failure = route_switch.index(
            'if [ "$recovery_failed" -eq 1 ]'
        )
        recovery_cleanup = route_switch.index(
            'rm -f "$candidate" "$backup" "$restore_candidate"'
        )
        lock_cleanup = route_switch.index('rmdir "$lock_dir"', recovery_failure)
        self.assertLess(recovery_failure, recovery_cleanup)
        self.assertLess(recovery_failure, lock_cleanup)
        self.assertIn(
            'preserving $backup and $lock_dir for operator recovery',
            route_switch,
        )
        failed_recovery_block = route_switch[recovery_failure:recovery_cleanup]
        self.assertIn("exit 1", failed_recovery_block)
        self.assertNotIn("rm -f", failed_recovery_block)
        self.assertNotIn("rmdir", failed_recovery_block)
        self.assertIn('printf \'%s\\n\' "$previous_color"', route_switch)
        recovery_validation = route_switch.index(
            '[ "$recovery_failed" -eq 0 ] && ! nginx -t',
            route_switch.index('finish_transaction()'),
        )
        recovery_reload = route_switch.index(
            '[ "$route_reload_attempted" -eq 1 ] && ! nginx -s reload',
            recovery_validation,
        )
        recovery_proven = route_switch.index(
            'route_recovered=1', recovery_reload
        )
        marker_restore = route_switch.index(
            'printf \'%s\\n\' "$previous_color"', recovery_proven
        )
        self.assertLess(recovery_validation, marker_restore)
        self.assertLess(recovery_reload, marker_restore)
        self.assertLess(recovery_proven, marker_restore)
        reload_attempt = route_switch.index("route_reload_attempted=1")
        self.assertLess(
            reload_attempt,
            route_switch.index("if ! nginx -s reload", reload_attempt),
        )
        committed_marker = route_switch.rindex(
            'mv "$color_file_tmp" "$active_color_file"'
        )
        self.assertLess(
            committed_marker, route_switch.index("committed=1")
        )
        candidate_switch = route_switch.index('mv "$candidate" "$active_config"')
        candidate_test = route_switch.index("if ! nginx -t", candidate_switch)
        candidate_reload = route_switch.index(
            "if ! nginx -s reload", candidate_test
        )
        self.assertLess(candidate_switch, candidate_test)
        self.assertLess(candidate_test, candidate_reload)
        certificate_lock = watcher.index('mkdir "$route_lock_dir"')
        certificate_checksum = watcher.index(
            'current_checksum="$(certificate_checksum)"', certificate_lock
        )
        certificate_reload_flag = watcher.index(
            "certificate_reload_attempted=1", certificate_checksum
        )
        certificate_reload = watcher.index(
            "if ! nginx -s reload", certificate_reload_flag
        )
        certificate_unlock = watcher.index(
            "release_certificate_route_lock", certificate_reload
        )
        self.assertLess(certificate_lock, certificate_checksum)
        self.assertLess(certificate_checksum, certificate_reload_flag)
        self.assertLess(certificate_reload_flag, certificate_reload)
        self.assertLess(certificate_reload, certificate_unlock)
        self.assertIn(
            "Certificate reload outcome is uncertain; preserving", watcher
        )
        self.assertIn("/etc/nginx/runtime", powershell_switch)
        self.assertIn("switch-nginx-upstream.sh $Color", powershell_switch)
        self.assertIn("persisted active-color evidence", powershell_switch)

    def test_workers_and_monitoring_use_nginx_active_frontend_routes(self):
        env = (ROOT / ".env.docker.example").read_text(encoding="utf-8")

        self.assertIn(
            "MARKETING_REVALIDATE_URL=http://nginx/api/webhook/revalidate", env
        )
        self.assertIn(
            "SYSTEM_MONITOR_FRONTEND_URL=http://nginx/internal/active-frontend-health", env
        )
        self.assertNotIn("MARKETING_REVALIDATE_URL=http://frontend1", env)
        self.assertNotIn("SYSTEM_MONITOR_FRONTEND_URL=http://frontend1", env)


if __name__ == "__main__":
    unittest.main()
