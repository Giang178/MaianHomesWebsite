# Production release runbook

This runbook is the mandatory release gate for the website-only runtime: public
site, CMS, workspaces, recruitment, website leads, Identity and Marketing.

## 1. Freeze and evidence

1. Freeze merges for 48 hours and nominate one UAT owner per department.
2. Run:
   `powershell -File scripts/deployment/capture-baseline.ps1 -Release <sha> -PublicBaseUrl <staging-url>`
3. Store the ignored `.release-artifacts/baseline-<sha>` folder with the release evidence.
4. Require a reviewed, immutable commit SHA. Never commit runtime uploads or test results.
5. Build and push immutable candidate images from the exact reviewed HEAD:

   ```powershell
   $ImmutableTags = (gcloud artifacts repositories describe maian --project <project-id> --location asia-southeast1 --format="value(dockerConfig.immutableTags)").Trim().ToLowerInvariant()
   if ($ImmutableTags -ne "true") { throw "Artifact Registry immutable tags are not enabled." }
   $Release = (git rev-parse --verify HEAD).Trim()
   powershell -File scripts/deployment/publish-gcp-images.ps1 -Project <project-id> -Release $Release
   ```

   The publisher rejects any supplied release that does not resolve to current
   HEAD, and it rejects every dirty worktree. It requires Artifact Registry
   `dockerConfig.immutableTags=true`, rechecks that repository setting and both
   remote SHA tags immediately before push, and refuses an existing tag by
   default. Registry immutability closes the check/push race by preventing a
   tag from moving to another digest. The script never changes that repository
   setting. It resolves the authoritative Artifact Registry digests after push.
   Update only the printed
   `BACKEND_GREEN_IMAGE`, `BACKEND_WORKER_GREEN_IMAGE`,
   `BACKEND_RELEASE_IMAGE` and `FRONTEND_GREEN_IMAGE` digest-qualified
   (`name@sha256:...`) pointers; retain every blue image pointer unchanged for
   rollback. `BACKEND_PUBLISHED_TAG` and `FRONTEND_PUBLISHED_TAG` are evidence,
   not deployment pointers.
6. Record every image digest and the baseline commit SHA in the release evidence.

## 2. Required gates

- Backend compile, full unittest discovery, dependency audit and all three infrastructure integrations.
- Frontend Vitest, lint, typecheck, production build and Playwright on all configured viewports.
- Gitleaks, Trivy and Compose smoke.
- Database bootstrap twice followed by database verify.
- UAT sign-off recorded in `UAT_MATRIX.md`.
- Backup/restore drill:
  `powershell -File scripts/deployment/backup-restore-drill.ps1 -Database <database>`

Any failed gate blocks the release. No exception is accepted verbally.

The capacity gate must follow `CAPACITY_1000_VU_ROLLOUT.md`. Run the read-only
mixed profile at separate 125, 250, 500, 750 and 1,000 VU ceilings on isolated
staging; never use production as a load target. A source-level optimization or
successful build does not replace measured capacity evidence.

### 2.1 Migrate and validate the existing environment

Do not replace the deployed secret file with an example file. Update the
existing secret-managed `.env.production` in place, retain its current secret
values, and archive only a redacted key/value-presence report. This release is
fail closed and will not start in production until these non-secret settings
are explicit:

```env
ENVIRONMENT=production
DEPLOYMENT_TIER=production
DEPLOYMENT_INSTANCE_ID=<exact-existing-production-compose-project>
APP_ENV_FILE=.env.production
APP_RELEASE=<immutable-git-sha-or-release-id>
LOAD_TEST_TARGET_MARKER=
BACKEND_RELEASE_ID=<candidate-git-sha>
BACKEND_BLUE_RELEASE=<retained-blue-git-sha>
BACKEND_GREEN_RELEASE=<candidate-green-git-sha>
BACKEND_WORKER_RELEASE=<currently-active-worker-git-sha>
BACKEND_WORKER_BLUE_RELEASE=<retained-blue-git-sha>
BACKEND_WORKER_GREEN_RELEASE=<candidate-green-git-sha>
BACKEND_WORKER_BLUE_IMAGE=<retained-immutable-blue-image>
BACKEND_WORKER_GREEN_IMAGE=<candidate-immutable-green-image>

ACTIVITY_EMBEDDED_JOBS=false
MARKETING_EMBEDDED_JOBS=false
WS_ALLOW_QUERY_TOKEN=false

MONGODB_CONNECT_TIMEOUT_MS=3000
MONGODB_SOCKET_TIMEOUT_MS=15000
MONGODB_WAIT_QUEUE_TIMEOUT_MS=2000
REDIS_MAX_CONNECTIONS=64
REDIS_COMMAND_SOCKET_TIMEOUT_SECONDS=3
REDIS_POOL_WAIT_TIMEOUT_SECONDS=2
S3_MAX_POOL_CONNECTIONS=64
S3_MAX_CONCURRENCY=32
S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS=2
BCRYPT_MAX_WORKERS=2
WS_SESSION_RECHECK_SECONDS=60
```

`docker compose --env-file .env.production` uses that file for Compose
interpolation; it does not by itself replace each service's `env_file`.
`APP_ENV_FILE=.env.production` is therefore mandatory in the production
file. At the start of the release PowerShell session, also pin the resolved
path so every manual Compose command uses the intended secret-managed file:

```powershell
$env:APP_ENV_FILE = (Resolve-Path .env.production).Path
docker ps --filter "label=com.docker.compose.service=nginx" --format "{{.ID}} {{.Names}}"
$ProductionNginxId = "<reviewed-running-production-nginx-container-id>"
$ProductionProject = (docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' $ProductionNginxId).Trim()
if (-not $ProductionProject) { throw "Unable to prove the existing production Compose project." }
$ProductionInstanceLines = @(Get-Content -LiteralPath .env.production | Where-Object { $_ -match '^[ ]*DEPLOYMENT_INSTANCE_ID[ ]*=' })
if ($ProductionInstanceLines.Count -ne 1) { throw "DEPLOYMENT_INSTANCE_ID must occur exactly once in .env.production." }
$ProductionInstance = (($ProductionInstanceLines[0] -split '=', 2)[1]).Trim().Trim('"').Trim("'")
if ($ProductionInstance -ne $ProductionProject) { throw "DEPLOYMENT_INSTANCE_ID must equal the reviewed production Compose project." }
$ProductionCompose = @(
    "--project-name", $ProductionProject,
    "-f", "docker-compose.yml",
    "-f", "docker-compose.production.yml",
    "--env-file", ".env.production"
)
docker compose @ProductionCompose config --quiet
if ($LASTEXITCODE -ne 0) { throw "Production Compose preflight failed." }
```

Select the Nginx container ID after reviewing the printed names; never infer or
invent a project name. Keep `$ProductionProject` and `$ProductionCompose` in
the same release shell. Every PowerShell deployment script requires the exact
project name and rejects an inferred default. `deploy-workers.ps1` applies and
restores the service-env override itself.

Every release value must identify its exact immutable image. Generic values
such as `production`, `latest`, `main`, `unknown`, blank values and
`replace-*` placeholders are rejected. Production must keep
`LOAD_TEST_TARGET_MARKER` empty. Isolated staging instead uses
`DEPLOYMENT_TIER=staging` and a unique, non-placeholder marker.

Backend images must be built through `publish-gcp-images.ps1` (or with the
equivalent `--build-arg APP_RELEASE=<git-sha>`). The build writes the revision
both to the OCI `org.opencontainers.image.revision` label and to a read-only
file inside the image. Do not change the retained blue image/release variables
when preparing green; they are the rollback identity. `APP_RELEASE` is not
accepted as blue/green proof by itself.
The publish script prints green candidate variables by default and deliberately
omits blue/current-worker pointers. `-InitialProvisioning` is for a new isolated
environment only and must not be used for a normal production release. A
pre-existing SHA tag is a release blocker. The
`-BreakGlassReuseExistingImmutableShaTag` override is reserved for recovery
from a documented partial publication approved by the release owner; it is
never part of the normal release command. The repository must remain immutable.
The publisher does not push or move an existing tag: it resolves and reuses its
digest, pulls a reused backend digest and requires its baked OCI revision to
match current HEAD. Re-review both resolved digests and their scan/provenance
evidence before consuming any printed environment value.

For an existing mutable repository, first list and archive all current tags,
confirm that no release process depends on moving/deleting them, and have an
Artifact Registry administrator enable immutability explicitly:

```powershell
gcloud artifacts docker tags list asia-southeast1-docker.pkg.dev/<project-id>/maian
gcloud artifacts repositories update maian --project <project-id> --location asia-southeast1 --immutable-tags
```

Do not disable immutable tags to make a repeated publication succeed.

Before changing traffic, validate the selected immutable backend image with the
real environment file and prove that `/health/ready` reports the exact
`environment`, `deployment_tier`, runtime `release`, and independently baked
`image_revision`; production must report an empty `load_test_marker`. Treat a
validation failure as a configuration
blocker—do not weaken the validator.

### 2.2 One-time persistent Nginx route migration

This subsection is mandatory for the first deployment containing
`nginx_active_state`. Skip it only when read-only `docker inspect` evidence
already proves that the running Nginx container has a named volume mounted at
`/etc/nginx/runtime` and the volume's exact `deployment-instance-id` marker
equals the reviewed `$ProductionProject`. Existing route state without that
owner marker is never adopted automatically. Never delete
`maian_production_nginx_active_state`; its exact deployment-instance owner and
validated active color are the canonical routing state.

1. Before recreating Nginx, prove semantically that the legacy active include
   has exactly two server targets, `frontend1:3000` and `api1:8000`, and no
   green target. Do not compare the whole file with the new `blue.conf` because
   this release intentionally adds zone/keepalive directives. This is a
   read-only transition check and does not use the new switch script:

   ```powershell
   docker compose @ProductionCompose exec -T nginx sh -c 'p=/etc/nginx/conf.d/active-upstreams.conf; test "$(grep -Ec "^[[:space:]]*server[[:space:]]+" "$p")" -eq 2 && test "$(grep -Ec "^[[:space:]]*server[[:space:]]+frontend1:3000;" "$p")" -eq 1 && test "$(grep -Ec "^[[:space:]]*server[[:space:]]+api1:8000;" "$p")" -eq 1 && ! grep -Eq "frontend2:3000|api2:8000" "$p"'
   if ($LASTEXITCODE -ne 0) { throw "Legacy Nginx route is not proven blue." }
   ```

   A non-zero result blocks the migration. Determine the real active route and
   reconcile it under incident/release-owner control; do not guess a color.
2. Prove `api1` and `frontend1` are ready with direct in-container checks,
   and record the legacy Nginx container ID plus the two checks as evidence:

   ```powershell
   docker compose @ProductionCompose exec -T api1 python -c "import json,urllib.request; p=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready',timeout=10)); assert p['status']=='ready'"
   if ($LASTEXITCODE -ne 0) { throw "Blue API is not ready." }
   docker compose @ProductionCompose exec -T frontend1 node -e "fetch('http://127.0.0.1:3000',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
   if ($LASTEXITCODE -ne 0) { throw "Blue frontend is not ready." }
   ```
3. Set `ACTIVE_COLOR=blue` and
   `DEPLOYMENT_INSTANCE_ID=$ProductionProject` in the existing secret-managed
   `.env.production`, keep `APP_ENV_FILE=.env.production`, and validate the
   rendered Compose model. Before touching the live edge, require the new named
   route volume to be absent, let an isolated one-shot container create and seed
   it with the reviewed blue template, and run the exact candidate Nginx config,
   mounts, certificates and networks through `nginx -t`. The one-shot container
   does not publish ports and does not stop the live Nginx:

   ```powershell
   docker compose @ProductionCompose config --quiet
   if ($LASTEXITCODE -ne 0) { throw "Production Compose preflight failed." }
   $DockerVolumes = @(docker volume ls --quiet)
   if ($LASTEXITCODE -ne 0) { throw "Unable to inspect Docker volumes." }
   if (@($DockerVolumes | Where-Object { $_ -eq "maian_production_nginx_active_state" }).Count -ne 0) {
       throw "The routing volume already exists but is not mounted by live Nginx; inspect the interrupted migration instead of overwriting it."
   }
   docker compose @ProductionCompose run --rm --no-deps --pull never --entrypoint /bin/sh nginx -ec 'r=/etc/nginx/runtime; test -z "$(find "$r" -mindepth 1 -maxdepth 1 -print -quit)"; lock="$r/.route-bootstrap.lock"; mkdir "$lock"; test -z "$(find "$r" -mindepth 1 -maxdepth 1 ! -path "$lock" -print -quit)"; trap "echo Incomplete Nginx route bootstrap lock retained at $lock >&2" EXIT; cp /etc/nginx/upstreams/blue.conf "$r/.active-upstreams.bootstrap"; cmp -s /etc/nginx/upstreams/blue.conf "$r/.active-upstreams.bootstrap"; printf "blue\n" > "$r/.active-color.bootstrap"; printf "%s\n" "$DEPLOYMENT_INSTANCE_ID" > "$r/.deployment-instance-id.bootstrap"; printf "%s\n" "$DEPLOYMENT_INSTANCE_ID" | cmp -s - "$r/.deployment-instance-id.bootstrap"; mv "$r/.active-upstreams.bootstrap" "$r/active-upstreams.conf"; mv "$r/.active-color.bootstrap" "$r/active-color"; nginx -t; mv "$r/.deployment-instance-id.bootstrap" "$r/deployment-instance-id"; printf "%s\n" "$DEPLOYMENT_INSTANCE_ID" | cmp -s - "$r/deployment-instance-id"; rmdir "$lock"; trap - EXIT'
   if ($LASTEXITCODE -ne 0) {
       throw "Isolated candidate Nginx runtime validation failed; live edge was not changed. Preserve and inspect the newly created routing volume."
   }
   ```

   Only after that isolated runtime validation passes, recreate the live Nginx:

   ```powershell
   docker compose @ProductionCompose up -d --no-deps --force-recreate nginx
   if ($LASTEXITCODE -ne 0) { throw "Persistent Nginx migration failed." }
   ```

4. Require `/etc/nginx/runtime/deployment-instance-id` to exactly equal the
   reviewed production Compose project, require `active-color` to contain exactly `blue`,
   require the generated active include to match `blue.conf`, run
   `nginx -t`, and execute public health/smoke checks before deploying green.
   Archive the named-volume mount name and checks.

   ```powershell
   $NginxId = (docker compose @ProductionCompose ps -q nginx).Trim()
   if (-not $NginxId) { throw "Recreated Nginx is not running." }
   $RoutingMount = (docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/runtime"}}{{.Type}}:{{.Name}}{{end}}{{end}}' $NginxId).Trim()
   if ($RoutingMount -ne "volume:maian_production_nginx_active_state") { throw "Wrong Nginx routing volume: $RoutingMount" }
   docker compose @ProductionCompose exec -T nginx sh -ec 'printf "%s\n" "$DEPLOYMENT_INSTANCE_ID" | cmp -s - /etc/nginx/runtime/deployment-instance-id; test "$(cat /etc/nginx/runtime/active-color)" = blue; cmp -s /etc/nginx/runtime/active-upstreams.conf /etc/nginx/upstreams/blue.conf; test ! -e /etc/nginx/runtime/.route-bootstrap.lock; nginx -t'
   if ($LASTEXITCODE -ne 0) { throw "Persistent blue route verification failed." }
   ```
5. On isolated staging, restart and separately force-recreate Nginx, then prove
   the selected color and public route remain unchanged both times. The current
   topology has one edge Nginx, so the first production migration has a brief
   edge restart window. Schedule it as maintenance or provide an external
   redundant load balancer; this migration is not claimed as zero-downtime.

After initialization, `ACTIVE_COLOR` is only a bootstrap seed. The exact
`DEPLOYMENT_INSTANCE_ID` owner must match on every start and switch; a different
Compose project cannot adopt the fixed named volume merely by starting Nginx.
The validated `blue|green` marker wins on every restart, and the watcher rebuilds
the generated include from the current reviewed template. A stale
`.route-switch.lock` must be removed only after an operator has verified the
live route, persisted owner/color markers and both upstream templates. A stale
`.route-bootstrap.lock` always means initialization is incomplete and requires
operator review; the watcher never removes or adopts it automatically.

### 2.3 Use a new website-only database

Production supports one database path: a brand-new empty database with
DATABASE_BOOTSTRAP_MODE=fresh-only.

Before initialization, inspect the target database and archive the result. If it
contains any data or has a foreign system_bootstrap/current marker, stop and
select a new database name. legacy-adopt is intentionally unsupported for the
website-only release, and auto is rejected when ENVIRONMENT=production.

The bootstrap is additive and idempotent only after it has written the
fresh-bootstrap / website-only-v1 marker. It creates the standalone CEO
account, identity defaults, website permissions, CMS pages, settings, media
references, and only the Identity/Marketing/Website indexes.
## 3. Deploy green while blue serves traffic

1. Confirm blue is active:
   `powershell -File scripts/deployment/switch-blue-green.ps1 -Color blue -ProjectName $ProductionProject -ToolingRelease (git rev-parse HEAD)`.
   On the one transition where retained blue predates the baked revision label,
   use `-AllowLegacyBackendWithoutRevision`, archive the exact inspected image
   ID, and never use that exception for green.
2. Pull the exact candidate jobs, API and frontend:

   ```powershell
   docker compose @ProductionCompose pull storage-init database-bootstrap database-verify api2 frontend2
   if ($LASTEXITCODE -ne 0) { throw "Candidate image pull failed." }
   ```

3. Confirm DATABASE_BOOTSTRAP_MODE=fresh-only and that the selected database
   is empty. A populated or foreign-marked database is a hard stop; do not run
   repair, adoption, HR, IT, or Sales migrations.
4. Initialize object storage, run the idempotent website bootstrap twice, then
   run both read-only verification commands:

       docker compose @ProductionCompose run --rm --no-deps storage-init
       if ($LASTEXITCODE -ne 0) { throw "Object-storage initialization failed." }
       docker compose @ProductionCompose run --rm --no-deps database-bootstrap
       if ($LASTEXITCODE -ne 0) { throw "First database bootstrap failed." }
       docker compose @ProductionCompose run --rm --no-deps database-bootstrap
       if ($LASTEXITCODE -ne 0) { throw "Second database bootstrap failed." }
       docker compose @ProductionCompose run --rm --no-deps database-verify
       if ($LASTEXITCODE -ne 0) { throw "Database verification failed." }
       docker compose @ProductionCompose run --rm --no-deps database-verify python -m scripts.database_fresh_verify
       if ($LASTEXITCODE -ne 0) { throw "Fresh website baseline verification failed." }

5. Archive the JSON verification report. It must show one protected CEO,
   website-only roles, all CMS pages, all required indexes, and no department
   collections.
6. Keep CEO_BOOTSTRAP_PASSWORD only through the one-time bootstrap and first
   login. Change the CEO password immediately, then remove the bootstrap secret
   from the long-running API/worker environment.
7. Run the locked transactional rollout from the exact clean reviewed checkout:

   ```powershell
   $ToolingRelease = git rev-parse HEAD
   if ($LASTEXITCODE -ne 0) { throw "Unable to resolve ToolingRelease." }
   powershell -File scripts/deployment/rollout-blue-green.ps1 `
     -ProjectName $ProductionProject -ToolingRelease $ToolingRelease
   if ($LASTEXITCODE -ne 0) { throw "Transactional green rollout failed." }
   ```

   The orchestrator owns one Docker-daemon-global atomic lock for the whole
   operation. It starts `api2/frontend2` from already-pulled local image IDs,
   preflights candidate and retained worker settings before mutation, and uses
   `--pull never` after image resolution. During the one legacy Activity
   transition it deploys only the four base workers, permits the candidate
   readiness gate to omit only `activity-worker`, switches the persistent
   route, stops and proves `api1=0`, then starts the dedicated Activity worker.
   Full exact-container heartbeats and full `/health/ready` are mandatory
   before the script atomically commits `BACKEND_WORKER_IMAGE` and
   `BACKEND_WORKER_RELEASE` to green. A failure restores route/API/workers and
   the durable pointer; if recovery cannot be proven, both APIs and every queue
   worker are stopped and verified zero.
8. Run database-verify and scripts.database_fresh_verify once more after the
   candidate API becomes ready; archive both reports.
9. Execute the approved website smoke tests against the public green route.

The switch script compares the configured immutable image with the actual
container image ID, checks both `release` and `image_revision`, validates both
green services, and refuses to proceed without the named routing-state volume.
It transactionally replaces the generated include, runs `nginx -t`, reloads,
then atomically commits the color marker. A validation, reload, write or handled
signal failure restores the previous include/color and reloads the previous
route when necessary. The public URL, route layout and interaction flow do not
change. A later Nginx/VM restart rebuilds the route from the persisted marker
instead of reverting to the stale `ACTIVE_COLOR` bootstrap seed.

## 4. Production UAT and monitoring

Department owners execute the preselected real transactions and record their
business IDs. Monitor for two hours and keep release hypercare for 48 hours.

Rollback immediately if any of these occurs:

- readiness fails twice;
- 5xx exceeds 1 percent for five minutes;
- p95 latency exceeds twice the baseline for ten minutes;
- login, authorization or a critical workflow cannot complete;
- audit/data integrity differs from the business transaction;
- a severe public visual regression is observed.

## 5. Rollback

1. From the same exact clean checkout, run
   `powershell -File scripts/deployment/rollback-blue-green.ps1 -ProjectName $ProductionProject -ToolingRelease (git rev-parse HEAD)`.
   For the one retained blue image proven to predate the Activity-worker
   capability label, add `-AllowLegacyBlueWithoutActivityWorker`.
   If it also predates `org.opencontainers.image.revision`, add
   `-AllowLegacyBlueWithoutImageRevision` and retain the inspected image ID in
   rollback evidence.
   Under the same Docker-daemon-global deployment lock, it first restores blue workers
   from the retained local image. For legacy blue this stops and proves the
   dedicated Activity worker is zero before starting the embedded blue API.
   It then verifies blue API/frontend, switches the route, and atomically
   commits the generic worker pointer to blue only after exact worker
   container/heartbeat checks.
2. If rollback or its green recovery fails, the script attempts to stop both
   APIs and every queue worker, then independently requires zero running writer
   container IDs. If either the stop command or verification fails, treat
   writes as not isolated and immediately isolate the data plane.
3. Preserve logs, image digests, request IDs, department UAT transaction IDs and
   rollback evidence for the incident review.
4. Do not restore the database for a normal rollback: this release permits only
   additive and backward-compatible data changes.
5. A database restore requires incident commander approval and the verified backup.

Blue may be refreshed to the successful release only after the 48-hour hypercare
window, preserving a working rollback target during the whole window. After the
window closes and the release is formally accepted, promote the exact running
green release to the next blue baseline from the same clean reviewed checkout:

```powershell
$ToolingRelease = (git rev-parse HEAD).Trim()
powershell -File scripts/deployment/promote-green-to-blue.ps1 `
  -ProjectName $ProductionProject -ToolingRelease $ToolingRelease
if ($LASTEXITCODE -ne 0) { throw "Green-to-blue baseline promotion failed." }
```

The promotion holds the same Docker-daemon-global lock, requires green route,
API, frontend and all five workers to remain on exact local immutable image IDs,
recreates only the blue candidate with `--pull never`, switches through the
validated routing transaction, and atomically updates blue/current pointers.
Failure before pointer commit restores green; any unproven recovery or
post-commit verification failure preserves the global lock for operator review.
Do not begin the next rollout until this promotion completes and its evidence is
archived.

## 6. Interrupted-operation lock recovery

`maian_global_deployment_lock` deliberately survives process termination and any
unproven recovery. Its presence blocks every deployment checkout sharing that
Docker daemon. Never remove it merely because no shell process is visible.

Before stale-lock removal, an incident commander and a second operator must:

1. archive `docker volume inspect maian_global_deployment_lock` and the newest
   non-secret `.release-artifacts/*phase*`/recovery evidence;
2. prove no release, rollback, promotion, staging deploy, certificate reload or
   model operation is still running;
3. prove the persisted Nginx owner/color/include are exact and either the active
   API plus the complete expected worker set are stable on one immutable release,
   or both APIs and all five workers are stopped and independently reported zero;
4. reconcile the env pointers with that proven state and choose the documented
   rollout or rollback entry point;
5. only then remove the exact named lock volume, recording both approvers and
   immediately execute the selected recovery transaction.

If any proof is missing, keep the lock and isolate writes. A retained lock is an
intentional safety quarantine, not a cleanup task.
