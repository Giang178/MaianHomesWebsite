import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DeploymentPreflightContractTests(unittest.TestCase):
    def test_service_build_contexts_exclude_local_and_runtime_data(self):
        backend_ignore = (ROOT / "backend" / ".dockerignore").read_text(encoding="utf-8")
        frontend_ignore = (ROOT / "frontend" / ".dockerignore").read_text(encoding="utf-8")

        for entry in (".env", "venv/", "uploads/", "app/uploads/", "tests/"):
            self.assertIn(entry, backend_ignore)
        for entry in (".env", "node_modules/", ".next/", "test-results/", "tests/"):
            self.assertIn(entry, frontend_ignore)

    def test_compose_smoke_exports_all_immutable_images(self):
        workflow = (ROOT / ".github" / "workflows" / "production-gates.yml").read_text(
            encoding="utf-8"
        )
        for name in (
            "BACKEND_RELEASE_IMAGE",
            "BACKEND_BLUE_IMAGE",
            "BACKEND_GREEN_IMAGE",
            "BACKEND_WORKER_IMAGE",
            "FRONTEND_BLUE_IMAGE",
            "FRONTEND_GREEN_IMAGE",
        ):
            self.assertIn(f"{name}:", workflow)

        for name in (
            "BACKEND_RELEASE_ID",
            "BACKEND_BLUE_RELEASE",
            "BACKEND_GREEN_RELEASE",
            "BACKEND_WORKER_RELEASE",
        ):
            self.assertIn(f"{name}:", workflow)

    def test_backend_images_bake_and_verify_independent_release_identity(self):
        dockerfile = (ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")
        production = (ROOT / "docker-compose.production.yml").read_text(
            encoding="utf-8"
        )
        switch = (ROOT / "scripts" / "deployment" / "switch-blue-green.ps1").read_text(
            encoding="utf-8"
        )

        self.assertIn("ARG APP_RELEASE", dockerfile)
        self.assertIn("org.opencontainers.image.revision", dockerfile)
        self.assertIn("/app/.image-revision", dockerfile)
        for release_name in (
            "BACKEND_RELEASE_ID",
            "BACKEND_BLUE_RELEASE",
            "BACKEND_GREEN_RELEASE",
            "BACKEND_WORKER_RELEASE",
        ):
            self.assertIn(release_name, production)
        self.assertIn("org.opencontainers.image.revision", switch)
        self.assertIn("{{.Image}}", switch)
        self.assertIn("image_revision", switch)

        publisher = (
            ROOT / "scripts" / "deployment" / "publish-gcp-images.ps1"
        ).read_text(encoding="utf-8")
        self.assertIn("[switch]$InitialProvisioning", publisher)
        self.assertIn(
            "[switch]$BreakGlassReuseExistingImmutableShaTag",
            publisher,
        )
        self.assertNotIn("[switch]$AllowDirty", publisher)
        self.assertNotIn("BreakGlassAllowMutableRepository", publisher)
        self.assertIn("git rev-parse --verify HEAD", publisher)
        self.assertIn("Release must resolve to the current Git HEAD", publisher)
        self.assertIn("$Release = $headSha", publisher)
        self.assertIn("$worktreeStatus.Count -gt 0", publisher)
        self.assertIn("git worktree add --detach", publisher)
        self.assertIn("Isolated build snapshot is not the exact clean release commit", publisher)
        self.assertIn('(Join-Path $snapshotPath "backend")', publisher)
        self.assertIn('(Join-Path $snapshotPath "frontend")', publisher)
        self.assertIn("git worktree remove --force", publisher)
        self.assertNotIn('(Join-Path $workspace "backend")', publisher)
        self.assertNotIn('(Join-Path $workspace "frontend")', publisher)
        self.assertIn("dockerConfig.immutableTags", publisher)
        self.assertIn("Refusing a race-prone publish", publisher)
        self.assertIn("gcloud artifacts docker tags list", publisher)
        self.assertIn("--format=value(image,tag)", publisher)
        self.assertIn("$repositoryPath", publisher)
        self.assertIn("returned an unreadable image/tag row", publisher)
        self.assertNotIn("ConvertFrom-Json", publisher)
        self.assertIn("Remote SHA tag already exists", publisher)
        self.assertIn(
            "Refusing to overwrite or silently reuse immutable release identity",
            publisher,
        )
        self.assertIn("This script will not push or move that tag", publisher)
        self.assertIn(
            "Break-glass reuse was requested, but neither immutable SHA tag exists",
            publisher,
        )
        self.assertIn("gcloud artifacts docker images describe", publisher)
        self.assertIn("--format=value(image_summary.digest)", publisher)
        self.assertIn('return "{0}@{1}" -f $ImageName, $digests[0]', publisher)
        self.assertIn(
            'Write-Output "BACKEND_RELEASE_IMAGE=$backendDigestImage"', publisher
        )
        self.assertIn(
            'Write-Output "BACKEND_GREEN_IMAGE=$backendDigestImage"', publisher
        )
        self.assertIn(
            'Write-Output "BACKEND_WORKER_GREEN_IMAGE=$backendDigestImage"',
            publisher,
        )
        self.assertIn(
            'Write-Output "FRONTEND_GREEN_IMAGE=$frontendDigestImage"', publisher
        )
        for mutable_pointer in (
            'BACKEND_RELEASE_IMAGE=$backendTaggedImage',
            'BACKEND_GREEN_IMAGE=$backendTaggedImage',
            'BACKEND_WORKER_GREEN_IMAGE=$backendTaggedImage',
            'FRONTEND_GREEN_IMAGE=$frontendTaggedImage',
            'BACKEND_BLUE_IMAGE=$backendTaggedImage',
            'BACKEND_WORKER_IMAGE=$backendTaggedImage',
            'BACKEND_WORKER_BLUE_IMAGE=$backendTaggedImage',
            'FRONTEND_BLUE_IMAGE=$frontendTaggedImage',
        ):
            self.assertNotIn(mutable_pointer, publisher)
        self.assertIn("Candidate values intentionally exclude blue", publisher)

        first_build = publisher.index("docker build --pull")
        backend_prebuild_guard = publisher.index(
            'Get-RemoteShaTagReuseDecision -ImageName $backendImageName '
            '-Tag $Release -Phase "pre-build"'
        )
        frontend_prebuild_guard = publisher.index(
            'Get-RemoteShaTagReuseDecision -ImageName $frontendImageName '
            '-Tag $Release -Phase "pre-build"'
        )
        backend_prepush_guard = publisher.index(
            'Get-RemoteShaTagReuseDecision -ImageName $backendImageName '
            '-Tag $Release -Phase "pre-push"'
        )
        frontend_prepush_guard = publisher.index(
            'Get-RemoteShaTagReuseDecision -ImageName $frontendImageName '
            '-Tag $Release -Phase "pre-push"'
        )
        backend_push = publisher.index("docker push $backendTaggedImage")
        frontend_push = publisher.index("docker push $frontendTaggedImage")
        immutable_gates = []
        offset = 0
        for line in publisher.splitlines(keepends=True):
            if line.strip() == "Assert-RepositoryUsesImmutableTags":
                immutable_gates.append(offset)
            offset += len(line)
        self.assertLess(backend_prebuild_guard, first_build)
        self.assertLess(frontend_prebuild_guard, first_build)
        self.assertEqual(len(immutable_gates), 3)
        self.assertLess(immutable_gates[0], first_build)
        self.assertGreater(immutable_gates[1], first_build)
        self.assertLess(immutable_gates[1], backend_prepush_guard)
        self.assertGreater(immutable_gates[2], backend_push)
        self.assertLess(immutable_gates[2], frontend_prepush_guard)
        self.assertLess(backend_prepush_guard, backend_push)
        self.assertLess(frontend_prepush_guard, frontend_push)
        self.assertIn(
            "if (-not $reuseBackendTag) {\n"
            "            docker push $backendTaggedImage",
            publisher,
        )
        self.assertIn(
            "if (-not $reuseFrontendTag) {\n"
            "            docker push $frontendTaggedImage",
            publisher,
        )
        self.assertGreater(
            publisher.index(
                "$backendDigestImage = Resolve-PushedDigestReference",
                backend_push,
            ),
            backend_push,
        )
        self.assertLess(
            publisher.index(
                "$backendDigestImage = Resolve-PushedDigestReference",
                backend_push,
            ),
            frontend_push,
        )
        self.assertGreater(
            publisher.index(
                "$frontendDigestImage = Resolve-PushedDigestReference",
                frontend_push,
            ),
            frontend_push,
        )
        self.assertIn("Assert-ReusedBackendRevision", publisher)
        self.assertIn(
            "Reused backend digest revision does not match current Git HEAD",
            publisher,
        )

        provisioning_branch = publisher.index("if ($InitialProvisioning)")
        for retained_pointer in (
            'Write-Output "BACKEND_BLUE_RELEASE=',
            'Write-Output "BACKEND_WORKER_RELEASE=',
            'Write-Output "BACKEND_BLUE_IMAGE=',
            'Write-Output "BACKEND_WORKER_IMAGE=',
            'Write-Output "FRONTEND_BLUE_IMAGE=',
        ):
            self.assertGreater(publisher.index(retained_pointer), provisioning_branch)

    def test_worker_settings_are_preflighted_before_any_worker_is_changed(self):
        deploy = (ROOT / "scripts" / "deployment" / "deploy-workers.ps1").read_text(
            encoding="utf-8"
        )

        preflight = deploy.index("docker run --rm --network none --env-file")
        stop = deploy.index("stop activity-worker")
        recreate = deploy.index("--force-recreate --pull never")
        self.assertLess(preflight, stop)
        self.assertLess(preflight, recreate)
        self.assertIn("worker-settings-preflight.txt", deploy)
        self.assertIn("scripts.validate_runtime_settings", deploy)
        self.assertIn("if ($hasBakedRevision)", deploy)
        self.assertIn("$legacyPreflightCode", deploy)
        self.assertIn("-c $legacyPreflightCode", deploy)
        self.assertIn("LegacyEnvironmentMismatch", deploy)
        self.assertIn('$env:APP_ENV_FILE = $envPath', deploy)
        self.assertIn("originalProcessServiceEnvFile", deploy)
        self.assertIn("ConvertFrom-Json -ErrorAction Stop", deploy)
        self.assertIn("live-tier-preflight.txt", deploy)
        self.assertIn("no running worker was changed", deploy)

        validator = (
            ROOT / "backend" / "scripts" / "validate_runtime_settings.py"
        ).read_text(encoding="utf-8")
        self.assertIn("include_input=False", validator)
        self.assertNotIn("str(exc)", validator)

    def test_worker_rollout_correlates_heartbeats_to_exact_new_containers(self):
        deploy = (ROOT / "scripts" / "deployment" / "deploy-workers.ps1").read_text(
            encoding="utf-8"
        )
        heartbeat = (
            ROOT / "backend" / "app" / "core" / "worker_health.py"
        ).read_text(encoding="utf-8")
        verifier = (
            ROOT / "backend" / "scripts" / "verify_worker_heartbeats.py"
        ).read_text(encoding="utf-8")
        rollback = (
            ROOT / "scripts" / "deployment" / "rollback-blue-green.ps1"
        ).read_text(encoding="utf-8")

        for field in (
            '"release": settings.APP_RELEASE',
            '"image_revision": image_revision',
            '"deployment_tier": settings.DEPLOYMENT_TIER',
            '"deployment_instance_id": settings.DEPLOYMENT_INSTANCE_ID',
            '"started_at": started_at',
        ):
            self.assertIn(field, heartbeat)
        self.assertIn("scripts.verify_worker_heartbeats", deploy)
        self.assertIn("worker-container-identities.txt", deploy)
        self.assertIn("worker-heartbeat-identities.txt", deploy)
        self.assertIn("{{.State.Status}}|{{.RestartCount}}", deploy)
        self.assertIn('"instance_id": {"$regex":', verifier)
        self.assertIn('"image_revision": expected_release', verifier)
        self.assertIn('"deployment_tier": expected_tier', verifier)
        self.assertIn('"deployment_instance_id": expected_instance', verifier)
        self.assertIn('parser.add_argument("--expected-instance", required=True)', verifier)
        self.assertIn("--expected-instance", deploy)
        self.assertIn("running_writer_count=", deploy)
        self.assertIn("@('api1', 'api2')", deploy)
        self.assertIn("@('api1', 'api2')", rollback)

    def test_worker_transition_is_locked_recoverable_and_ordered(self):
        deployment = ROOT / "scripts" / "deployment"
        deploy = (deployment / "deploy-workers.ps1").read_text(encoding="utf-8")
        rollout = (deployment / "rollout-blue-green.ps1").read_text(encoding="utf-8")
        rollback = (deployment / "rollback-blue-green.ps1").read_text(encoding="utf-8")
        switch = (deployment / "switch-blue-green.ps1").read_text(encoding="utf-8")
        lock = (deployment / "deployment-lock.ps1").read_text(encoding="utf-8")
        source_guard = (deployment / "deployment-source-guard.ps1").read_text(
            encoding="utf-8"
        )

        self.assertIn('maian_global_deployment_lock', lock)
        self.assertIn('docker volume create', lock)
        self.assertIn('token-sha256', lock)
        self.assertIn('Assert-DeploymentLockIdentity', lock)
        self.assertIn("verified-reentrant", lock)
        self.assertIn("Do not remove $volumeName as stale", lock)
        self.assertIn("status --porcelain=v1 --untracked-files=all", source_guard)
        self.assertIn("Assert-NginxUpstreamTemplate", switch)
        self.assertIn("AbortSignal.timeout(10000)", switch)
        self.assertIn("$env:APP_ENV_FILE = $envPath", switch)

        self.assertIn("previous-worker-live-snapshot.txt", deploy)
        self.assertIn("worker-automatic-recovery.txt", deploy)
        self.assertIn("worker-recovery-heartbeats.txt", deploy)
        self.assertIn("--pull never", deploy)
        self.assertNotIn("pull @workers", deploy)
        self.assertIn("$pinnedWorkerImageId", deploy)
        self.assertIn("$resolvedWorkerImageId", deploy)
        self.assertIn("FinalizeDeferredActivityWorker", deploy)
        self.assertIn("retired_api_running_count=", deploy)

        route = rollout.index("$rolloutPhase = 'green-route-switch'")
        stop_legacy = rollout.index("$rolloutPhase = 'legacy-api-quiescence'")
        finalize = rollout.index("$rolloutPhase = 'dedicated-activity-finalize'")
        pointer = rollout.index("$rolloutPhase = 'durable-worker-pointer-commit'")
        self.assertLess(route, stop_legacy)
        self.assertLess(stop_legacy, finalize)
        self.assertLess(finalize, pointer)
        self.assertIn("Set-WorkerPointersAtomically", rollout)
        self.assertIn("$allWorkers + @('api1', 'api2')", rollout)
        worker_preflight = rollout.index("-PreflightOnly")
        pin_candidate = rollout.index(
            "$workerArguments.ExpectedWorkerImageId = $candidateWorkerImageId"
        )
        worker_mutation = rollout.index(
            "$rolloutPhase = 'candidate-base-worker-rollout'"
        )
        self.assertLess(worker_preflight, pin_candidate)
        self.assertLess(pin_candidate, worker_mutation)
        self.assertEqual(deploy.count("pull content-worker"), 1)

        stop_activity_and_workers = rollback.index(
            "$rollbackPhase = 'inverse-worker-transition'"
        )
        start_blue_api = rollback.index("$rollbackPhase = 'retained-blue-api-start'")
        switch_blue = rollback.index("$rollbackPhase = 'blue-route-switch'")
        blue_pointer = rollback.index(
            "$rollbackPhase = 'durable-blue-pointer-commit'"
        )
        self.assertLess(stop_activity_and_workers, start_blue_api)
        self.assertLess(start_blue_api, switch_blue)
        self.assertLess(switch_blue, blue_pointer)
        self.assertIn("$workers + @('api1', 'api2')", rollback)
        self.assertIn("Rollback requires the persisted initial route to be green", rollback)
        self.assertIn("changed during atomic pointer commit", rollback)

    def test_deployment_scripts_require_explicit_tier_and_compose_project(self):
        for filename in (
            "deploy-workers.ps1",
            "rollout-blue-green.ps1",
            "switch-blue-green.ps1",
            "rollback-blue-green.ps1",
        ):
            script = (
                ROOT / "scripts" / "deployment" / filename
            ).read_text(encoding="utf-8")
            self.assertIn("DeploymentTier", script)
            self.assertIn("ProjectName", script)
            self.assertIn("--project-name", script)
            self.assertIn("docker-compose.$DeploymentTier.yml", script)
            self.assertIn("inferred Compose project", script)
        for filename in ("deploy-workers.ps1", "switch-blue-green.ps1"):
            script = (
                ROOT / "scripts" / "deployment" / filename
            ).read_text(encoding="utf-8")
            self.assertIn("Read-EnvFileValue 'DEPLOYMENT_TIER'", script)

        runbook = (ROOT / "docs" / "release" / "RELEASE_RUNBOOK.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("APP_ENV_FILE=.env.production", runbook)
        self.assertIn('"--project-name", $ProductionProject', runbook)
        self.assertIn('"--env-file", ".env.production"', runbook)
        self.assertIn(
            "docker compose @ProductionCompose run --rm --no-deps database-verify",
            runbook,
        )
        self.assertNotIn(
            "\n   python -m scripts.migrations.repair_release_state", runbook
        )
        self.assertIn("server[[:space:]]+frontend1:3000", runbook)
        self.assertNotIn(
            "cmp -s /etc/nginx/conf.d/active-upstreams.conf "
            "/etc/nginx/upstreams/blue.conf",
            runbook,
        )
        nginx_candidate = runbook.index(
            "run --rm --no-deps --pull never --entrypoint /bin/sh nginx"
        )
        nginx_recreate = runbook.index(
            "up -d --no-deps --force-recreate nginx"
        )
        self.assertLess(nginx_candidate, nginx_recreate)
        self.assertIn(
            "cp /etc/nginx/upstreams/blue.conf "
            '"$r/.active-upstreams.bootstrap"',
            runbook,
        )
        self.assertIn("DEPLOYMENT_INSTANCE_ID must equal the reviewed", runbook)
        self.assertIn(".deployment-instance-id.bootstrap", runbook)
        self.assertIn('mv "$r/.deployment-instance-id.bootstrap"', runbook)
        self.assertIn(".route-bootstrap.lock", runbook)
        self.assertIn("live edge was not changed", runbook)

    def test_production_uses_only_supported_background_workers(self):
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        production = (ROOT / "docker-compose.production.yml").read_text(encoding="utf-8")
        docker_env = (ROOT / ".env.docker.example").read_text(encoding="utf-8")
        staging_env = (ROOT / ".env.staging.example").read_text(encoding="utf-8")
        deploy_workers = (ROOT / "scripts" / "deployment" / "deploy-workers.ps1").read_text(
            encoding="utf-8"
        )

        for worker in ("activity-worker", "content-worker", "system-monitor-worker"):
            self.assertIn(f"  {worker}:", compose)
            self.assertIn(f"  {worker}:", production)
            self.assertIn(worker, deploy_workers)
        for removed_worker in ("hr-worker", "sales-worker"):
            self.assertNotIn(f"  {removed_worker}:", compose)
            self.assertNotIn(f"  {removed_worker}:", production)
            self.assertNotIn(removed_worker, deploy_workers)
        for env in (docker_env, staging_env):
            self.assertIn("ACTIVITY_EMBEDDED_JOBS=false", env)

    def test_gemini_is_configured_and_ollama_is_optional_for_staging(self):
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        staging_env = (ROOT / ".env.staging.example").read_text(encoding="utf-8")
        deploy = (ROOT / "infrastructure" / "gcp" / "deploy-staging.sh").read_text(
            encoding="utf-8"
        )

        ollama_block = compose.split("  ollama:", 1)[1].split("  ollama-init:", 1)[0]
        self.assertIn('profiles: ["ollama"]', ollama_block)
        self.assertIn("ollama/ollama:0.32.5", ollama_block)
        self.assertNotIn("ports:", ollama_block)
        self.assertIn("AI_PROVIDER=gemini", staging_env)
        self.assertIn("GEMINI_MODEL=gemini-3.5-flash-lite", staging_env)
        self.assertIn("GEMINI_REQUIRED=true", staging_env)
        self.assertIn("OLLAMA_REQUIRED=false", staging_env)
        self.assertIn('if [[ "$AI_PROVIDER" == "ollama" ]]', deploy)
        self.assertIn("compose+=(--profile ollama)", deploy)
        self.assertIn('run --rm ollama-init', deploy)
        self.assertIn('DATABASE_BOOTSTRAP_MODE=fresh-only', staging_env)
        self.assertIn('expected_mongodb_url=', deploy)
        self.assertIn('fresh-database-${DATABASE_NAME}.initialized', deploy)
        self.assertIn('docker volume inspect', deploy)
        self.assertIn('python -m scripts.database_fresh_verify', deploy)

    def test_gcp_vm_authenticates_docker_and_supports_model_switches(self):
        provision = (ROOT / "scripts" / "deployment" / "provision-gcp-staging.ps1").read_text(
            encoding="utf-8"
        )
        bootstrap = (ROOT / "infrastructure" / "gcp" / "bootstrap-vm.sh").read_text(
            encoding="utf-8"
        )
        switch_model = (ROOT / "infrastructure" / "gcp" / "switch-ollama-model.sh").read_text(
            encoding="utf-8"
        )

        self.assertIn("iap.googleapis.com", provision)
        self.assertIn("artifact-registry-host=", provision)
        self.assertIn("--immutable-tags", provision)
        self.assertIn("dockerConfig.immutableTags", provision)
        self.assertIn("Existing Artifact Registry repository", provision)
        self.assertIn("Final staging service-account verification failed", provision)
        self.assertIn("function Assert-FirewallRule", provision)
        self.assertIn("does not match the approved staging policy", provision)
        self.assertIn("shieldedInstanceConfig.enableSecureBoot", provision)
        self.assertIn("does not match the approved topology/security policy", provision)
        self.assertIn("--project $Project --zone $Zone --format json", provision)
        self.assertIn("google-cloud-cli", bootstrap)
        self.assertIn("gcloud auth print-access-token", bootstrap)
        self.assertIn('gcloud auth configure-docker "$registry_host" --quiet', bootstrap)
        self.assertIn('Standalone Ollama model switching is disabled', switch_model)
        self.assertNotIn('--force-recreate', switch_model)
        self.assertNotIn('docker compose', switch_model)

    def test_gcp_provision_is_source_bound_locked_and_exactly_verified(self):
        provision = (ROOT / "scripts" / "deployment" / "provision-gcp-staging.ps1").read_text(
            encoding="utf-8"
        )
        source_guard = (ROOT / "scripts" / "deployment" / "deployment-source-guard.ps1").read_text(
            encoding="utf-8"
        )

        first_gcloud_mutation = provision.index("gcloud services enable")
        self.assertLess(provision.index("Assert-DeploymentSourceIdentity"), first_gcloud_mutation)
        self.assertLess(provision.index("--if-generation-match=0"), first_gcloud_mutation)
        self.assertIn("--if-generation-match=$lockGeneration", provision)
        self.assertIn("maian-tooling-release=", provision)
        self.assertIn("maian-startup-script-sha256=", provision)
        self.assertIn("maian-boot-image=", provision)
        self.assertIn("attachedScopes", provision)
        self.assertIn("ipCidrRange", provision)
        self.assertIn("autoCreateSubnetworks", provision)
        self.assertIn("diskState.sourceImage", provision)
        self.assertNotIn("gcloud config set project", provision)
        self.assertIn("storage.googleapis.com --project $Project", provision)
        for critical_path in (
            "infrastructure/gcp/bootstrap-vm.sh",
            "infrastructure/gcp/deploy-staging.sh",
            "infrastructure/gcp/switch-ollama-model.sh",
            "scripts/deployment/assert-deployment-source.ps1",
            "scripts/deployment/provision-gcp-staging.ps1",
        ):
            self.assertIn(critical_path, source_guard)

    def test_successful_green_release_has_a_locked_next_cycle_promotion(self):
        promotion = (ROOT / "scripts" / "deployment" / "promote-green-to-blue.ps1").read_text(
            encoding="utf-8"
        )
        source_guard = (ROOT / "scripts" / "deployment" / "deployment-source-guard.ps1").read_text(
            encoding="utf-8"
        )

        self.assertIn("Enter-DeploymentLock", promotion)
        self.assertIn("Assert-DeploymentSourceIdentity", promotion)
        self.assertIn("Promotion requires the exact persisted active route to be green", promotion)
        self.assertIn("--force-recreate --pull never api1 frontend1", promotion)
        route_switch = promotion.index("-Color blue")
        pointer_commit = promotion.index("Set-PromotionPointersAtomically -BackendImage")
        self.assertLess(route_switch, pointer_commit)
        self.assertIn("-Color green", promotion[pointer_commit:])
        self.assertIn("recovery-unproven-lock-preserved", promotion)
        self.assertIn("post-commit-verification-unproven-lock-preserved", promotion)
        for pointer in (
            "BACKEND_BLUE_IMAGE",
            "BACKEND_BLUE_RELEASE",
            "FRONTEND_BLUE_IMAGE",
            "BACKEND_WORKER_BLUE_IMAGE",
            "BACKEND_WORKER_BLUE_RELEASE",
            "BACKEND_WORKER_IMAGE",
            "BACKEND_WORKER_RELEASE",
            "ACTIVE_COLOR",
        ):
            self.assertIn(pointer, promotion)
        self.assertIn("scripts/deployment/promote-green-to-blue.ps1", source_guard)

    def test_staging_deploy_rejects_example_placeholders(self):
        deploy = (ROOT / "infrastructure" / "gcp" / "deploy-staging.sh").read_text(
            encoding="utf-8"
        )
        self.assertIn("example\\.com", deploy)
        self.assertIn("replace-", deploy)
        self.assertIn('COMPOSE_PROJECT_NAME" != "maian-staging', deploy)
        self.assertIn('DEPLOYMENT_TIER" != "staging', deploy)
        self.assertIn(
            'DEPLOYMENT_INSTANCE_ID" != "$COMPOSE_PROJECT_NAME',
            deploy,
        )
        self.assertIn("must not be a production maianhomes.vn hostname", deploy)
        self.assertIn("@sha256:[0-9a-fA-F]{64}", deploy)
        self.assertIn("application image must use an immutable digest", deploy)
        self.assertIn(
            "fresh-database-${COMPOSE_PROJECT_NAME}-${DATABASE_NAME}.initialized",
            deploy,
        )
        self.assertIn("verify_fresh_marker_identity", deploy)
        self.assertIn('marker_project" != "$COMPOSE_PROJECT_NAME', deploy)
        self.assertIn('marker_database" != "$DATABASE_NAME', deploy)
        self.assertIn("load_required_env", deploy)
        self.assertNotIn('. "$ENV_FILE"', deploy)
        self.assertIn(".initializing", deploy)
        fresh_verify = deploy.index("scripts.database_fresh_verify")
        initialized_marker = deploy.index(
            'write_fresh_marker "$fresh_host_marker" initialized',
            fresh_verify,
        )
        api_start = deploy.index('"${compose[@]}" up -d --no-deps api1 api2')
        self.assertLess(fresh_verify, initialized_marker)
        self.assertLess(initialized_marker, api_start)
        self.assertIn("--connect-timeout 5 --max-time 15", deploy)
        self.assertIn("after 30 bounded attempts", deploy)
        self.assertIn(
            "/etc/nginx/runtime/deployment-instance-id", deploy
        )
        self.assertIn("deployment_instance_id=%s", deploy)
        self.assertIn(".route-bootstrap.lock", deploy)

        release_shell_scripts = (
            "infrastructure/backup.sh",
            "infrastructure/switch-nginx-upstream.sh",
            "infrastructure/watch-nginx-certificates.sh",
            "infrastructure/gcp/bootstrap-vm.sh",
            "infrastructure/gcp/deploy-staging.sh",
            "infrastructure/gcp/switch-ollama-model.sh",
        )
        for relative_path in release_shell_scripts:
            payload = (ROOT / relative_path).read_bytes()
            self.assertTrue(payload.startswith(b"#!/"), relative_path)
            self.assertNotIn(b"\r", payload, relative_path)

        attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8")
        self.assertIn("*.sh text eol=lf", attributes)


if __name__ == "__main__":
    unittest.main()
