#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.staging}"
TOOLING_RELEASE="${2:-}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-maian-staging}"
readonly ROOT ENV_FILE TOOLING_RELEASE COMPOSE_PROJECT_NAME
export COMPOSE_PROJECT_NAME

if [[ "$COMPOSE_PROJECT_NAME" != "maian-staging" ]]; then
  echo "This staging-only script requires COMPOSE_PROJECT_NAME=maian-staging." >&2
  exit 2
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing staging env file: $ENV_FILE" >&2
  exit 2
fi
if grep -Eqi '^[A-Za-z_][A-Za-z0-9_]*=.*(replace-|example\.com)' "$ENV_FILE"; then
  echo "Replace all replace-* and example.com placeholders in $ENV_FILE before deployment." >&2
  exit 2
fi
if grep -Eq '^(ROOT|ENV_FILE|TOOLING_RELEASE|COMPOSE_PROJECT_NAME)=' "$ENV_FILE"; then
  echo "The staging env file must not redefine internal deployment variables." >&2
  exit 2
fi
command -v docker >/dev/null
docker compose version >/dev/null
command -v curl >/dev/null
command -v sha256sum >/dev/null
command -v od >/dev/null
command -v pwsh >/dev/null

if [[ ! "$TOOLING_RELEASE" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "The second argument must be the full reviewed ToolingRelease Git revision." >&2
  exit 2
fi

load_required_env() {
  local name="$1"
  local value
  local -a matches
  mapfile -t matches < <(grep -E "^${name}=" "$ENV_FILE" || true)
  if [[ "${#matches[@]}" -ne 1 ]]; then
    echo "Required variable must appear exactly once: $name" >&2
    exit 2
  fi
  value="${matches[0]#*=}"
  value="${value%$'\r'}"
  if [[ "${#value}" -ge 2 && "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${#value}" -ge 2 && "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
    value="${value:1:${#value}-2}"
  fi
  if [[ -z "$value" ]]; then
    echo "Required variable is empty: $name" >&2
    exit 2
  fi
  printf -v "$name" '%s' "$value"
  export "$name"
}

required=(
  STAGING_DOMAIN TLS_EMAIL ACTIVE_COLOR APP_RELEASE DEPLOYMENT_TIER DEPLOYMENT_INSTANCE_ID
  BACKEND_RELEASE_ID BACKEND_BLUE_RELEASE BACKEND_GREEN_RELEASE BACKEND_WORKER_RELEASE
  BACKEND_RELEASE_IMAGE BACKEND_BLUE_IMAGE BACKEND_GREEN_IMAGE
  BACKEND_WORKER_IMAGE FRONTEND_BLUE_IMAGE FRONTEND_GREEN_IMAGE
  AI_PROVIDER GEMINI_API_KEY GEMINI_MODEL GEMINI_REQUIRED DATABASE_BOOTSTRAP_MODE
  MONGODB_URL DATABASE_NAME
  CEO_EMAIL CEO_PROTECTED_EMAIL CEO_FULL_NAME CEO_PHONE CEO_BOOTSTRAP_PASSWORD
)
for name in "${required[@]}"; do
  load_required_env "$name"
done
if [[ "$DEPLOYMENT_TIER" != "staging" ]]; then
  echo "DEPLOYMENT_TIER must be staging for this staging-only script." >&2
  exit 2
fi
if [[ "$DEPLOYMENT_INSTANCE_ID" != "$COMPOSE_PROJECT_NAME" ]]; then
  echo "DEPLOYMENT_INSTANCE_ID must exactly match COMPOSE_PROJECT_NAME for heartbeat isolation." >&2
  exit 2
fi
case "${STAGING_DOMAIN,,}" in
  maianhomes.vn|www.maianhomes.vn|admin.maianhomes.vn)
    echo "STAGING_DOMAIN must not be a production maianhomes.vn hostname." >&2
    exit 2
    ;;
esac
if [[ ! "${STAGING_DOMAIN,,}" =~ ^[a-z0-9][a-z0-9.-]*[a-z0-9]$ || "$STAGING_DOMAIN" != *.* || "$STAGING_DOMAIN" == *..* ]]; then
  echo "STAGING_DOMAIN must be a plain DNS hostname." >&2
  exit 2
fi
if [[ "$ACTIVE_COLOR" != "blue" && "$ACTIVE_COLOR" != "green" ]]; then
  echo "ACTIVE_COLOR must be blue or green." >&2
  exit 2
fi
if [[ ! "$APP_RELEASE" =~ ^[0-9a-f]{40}$ ]]; then
  echo "APP_RELEASE must be the full lowercase Git commit SHA." >&2
  exit 2
fi
for release_identity in \
  "$BACKEND_RELEASE_ID" "$BACKEND_BLUE_RELEASE" \
  "$BACKEND_GREEN_RELEASE" "$BACKEND_WORKER_RELEASE"; do
  if [[ "$release_identity" != "$APP_RELEASE" ]]; then
    echo "Fresh staging requires every backend release identity to equal APP_RELEASE=$APP_RELEASE." >&2
    exit 2
  fi
done
case "$AI_PROVIDER" in
gemini)
  if [[ "$GEMINI_REQUIRED" != "true" ]]; then
    echo "GEMINI_REQUIRED must be true for Gemini staging deployment." >&2
    exit 2
  fi
  if [[ -z "$GEMINI_API_KEY" || "$GEMINI_API_KEY" == *"replace-"* || "$GEMINI_API_KEY" == *"change-me"* ]]; then
    echo "GEMINI_API_KEY must be configured in the staging secret store." >&2
    exit 2
  fi
  if [[ -z "$GEMINI_MODEL" || "$GEMINI_MODEL" == *"replace-"* ]]; then
    echo "GEMINI_MODEL must be a concrete Gemini model." >&2
    exit 2
  fi
  ;;
ollama)
  for name in OLLAMA_IMAGE OLLAMA_MODEL OLLAMA_REQUIRED; do
    load_required_env "$name"
  done
  if [[ "$OLLAMA_IMAGE" == *":latest" || "$OLLAMA_IMAGE" != *":"* ]]; then
    echo "OLLAMA_IMAGE must use a versioned tag: $OLLAMA_IMAGE" >&2
    exit 2
  fi
  if [[ "$OLLAMA_REQUIRED" != "true" ]]; then
    echo "OLLAMA_REQUIRED must be true for Ollama staging deployment." >&2
    exit 2
  fi
  ;;
*)
  echo "AI_PROVIDER must be gemini or ollama." >&2
  exit 2
  ;;
esac
if [[ "$DATABASE_BOOTSTRAP_MODE" != "fresh-only" ]]; then
  echo "Staging deployment requires DATABASE_BOOTSTRAP_MODE=fresh-only." >&2
  exit 2
fi
if [[ ! "$DATABASE_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "DATABASE_NAME must contain only letters, digits and underscores." >&2
  exit 2
fi
expected_mongodb_url="mongodb://mongo1:27017/${DATABASE_NAME}?replicaSet=rs0"
if [[ "$MONGODB_URL" != "$expected_mongodb_url" ]]; then
  echo "Fresh staging must use its internal MongoDB replica set: $expected_mongodb_url" >&2
  exit 2
fi
if [[ "${CEO_EMAIL,,}" != "${CEO_PROTECTED_EMAIL,,}" ]]; then
  echo "CEO_EMAIL and CEO_PROTECTED_EMAIL must identify the same fresh CEO account." >&2
  exit 2
fi
for image in \
  "$BACKEND_RELEASE_IMAGE" "$BACKEND_BLUE_IMAGE" "$BACKEND_GREEN_IMAGE" \
  "$BACKEND_WORKER_IMAGE" "$FRONTEND_BLUE_IMAGE" "$FRONTEND_GREEN_IMAGE"; do
  if [[ ! "$image" =~ @sha256:[0-9a-fA-F]{64}$ ]]; then
    echo "Every staging application image must use an immutable digest: $image" >&2
    exit 2
  fi
done

# Verify the exact Git root, clean worktree, full reviewed revision and the
# deployment-critical manifest before acquiring the runtime mutation lock.
source_evidence="$ROOT/.release-artifacts/staging-source-$TOOLING_RELEASE"
mkdir -p "$source_evidence"
pwsh -NoProfile -NonInteractive -File \
  "$ROOT/scripts/deployment/assert-deployment-source.ps1" \
  -Workspace "$ROOT" \
  -ToolingRelease "$TOOLING_RELEASE" \
  -EvidenceDirectory "$source_evidence"

# Serialize every deployment writer on the selected Docker daemon, including
# PowerShell blue/green orchestration launched from another checkout.
deployment_lock_volume="maian_global_deployment_lock"
deployment_lock_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
deployment_lock_token_sha256="$(printf '%s' "$deployment_lock_token" | sha256sum | awk '{print $1}')"
deployment_lock_owned=false
runtime_mutation_started=false

read_lock_label() {
  local label="$1"
  case "$label" in
    com.maianhomes.deployment-lock.schema|\
    com.maianhomes.deployment-lock.token-sha256|\
    com.maianhomes.deployment-lock.tier|\
    com.maianhomes.deployment-lock.project) ;;
    *)
      echo "Unsupported deployment-lock label." >&2
      return 2
      ;;
  esac
  docker volume inspect --format '{{ index .Labels "'"$label"'" }}' "$deployment_lock_volume"
}

release_deployment_lock() {
  local exit_code=$?
  trap - EXIT
  if [[ "$deployment_lock_owned" == "true" ]]; then
    if [[ "$exit_code" -ne 0 && "$runtime_mutation_started" == "true" ]]; then
      echo "Staging mutation failed; preserving $deployment_lock_volume until the exact stack state is recovered." >&2
      exit "$exit_code"
    fi
    actual_lock_hash="$(read_lock_label 'com.maianhomes.deployment-lock.token-sha256' 2>/dev/null || true)"
    if [[ "$actual_lock_hash" == "$deployment_lock_token_sha256" ]]; then
      if ! docker volume rm "$deployment_lock_volume" >/dev/null; then
        echo "Unable to release owned Docker deployment lock $deployment_lock_volume; review it before retrying." >&2
        exit_code=1
      fi
    else
      echo "Deployment lock ownership changed; refusing to remove another operation's lock." >&2
      exit_code=1
    fi
  fi
  exit "$exit_code"
}
trap release_deployment_lock EXIT

docker volume create \
  --label 'com.maianhomes.deployment-lock.schema=3' \
  --label "com.maianhomes.deployment-lock.token-sha256=$deployment_lock_token_sha256" \
  --label 'com.maianhomes.deployment-lock.tier=staging' \
  --label "com.maianhomes.deployment-lock.project=$COMPOSE_PROJECT_NAME" \
  --label "com.maianhomes.deployment-lock.acquired-at-utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$deployment_lock_volume" >/dev/null
if [[ "$(read_lock_label 'com.maianhomes.deployment-lock.schema')" != "3" \
  || "$(read_lock_label 'com.maianhomes.deployment-lock.token-sha256')" != "$deployment_lock_token_sha256" \
  || "$(read_lock_label 'com.maianhomes.deployment-lock.tier')" != "staging" \
  || "$(read_lock_label 'com.maianhomes.deployment-lock.project')" != "$COMPOSE_PROJECT_NAME" ]]; then
  echo "Another deployment holds $deployment_lock_volume; inspect the exact active stack state before any stale-lock recovery." >&2
  exit 2
fi
deployment_lock_owned=true

export APP_ENV_FILE="$ENV_FILE"
mkdir -p "$ROOT/.release-artifacts"
fresh_host_marker="$ROOT/.release-artifacts/fresh-database-${COMPOSE_PROJECT_NAME}-${DATABASE_NAME}.initialized"
initializing_host_marker="$ROOT/.release-artifacts/fresh-database-${COMPOSE_PROJECT_NAME}-${DATABASE_NAME}.initializing"
legacy_fresh_host_marker="$ROOT/.release-artifacts/fresh-database-${DATABASE_NAME}.initialized"

verify_fresh_marker_identity() {
  local marker="$1"
  local expected_phase="${2:-}"
  local project_count database_count phase_count marker_project marker_database marker_phase
  if [[ -L "$marker" || ! -f "$marker" ]]; then
    echo "Fresh-database marker must be a regular non-symlink file: $marker" >&2
    exit 2
  fi
  project_count="$(grep -c '^project=' "$marker" || true)"
  database_count="$(grep -c '^database=' "$marker" || true)"
  if [[ "$project_count" != "1" || "$database_count" != "1" ]]; then
    echo "Fresh-database marker has an invalid identity schema: $marker" >&2
    exit 2
  fi
  marker_project="$(grep '^project=' "$marker")"
  marker_project="${marker_project#project=}"
  marker_database="$(grep '^database=' "$marker")"
  marker_database="${marker_database#database=}"
  if [[ "$marker_project" != "$COMPOSE_PROJECT_NAME" || "$marker_database" != "$DATABASE_NAME" ]]; then
    echo "Fresh-database marker identity does not match the selected staging project/database." >&2
    exit 2
  fi
  if [[ -n "$expected_phase" ]]; then
    phase_count="$(grep -c '^phase=' "$marker" || true)"
    marker_phase="$(grep '^phase=' "$marker" || true)"
    marker_phase="${marker_phase#phase=}"
    if [[ "$phase_count" != "1" || "$marker_phase" != "$expected_phase" ]]; then
      echo "Fresh-database marker phase is invalid for $marker." >&2
      exit 2
    fi
  fi
}

write_fresh_marker() {
  local marker="$1"
  local phase="$2"
  local marker_tmp="${marker}.tmp.$$"
  (
    umask 077
    printf 'project=%s\ndatabase=%s\nrelease=%s\nphase=%s\n' \
      "$COMPOSE_PROJECT_NAME" "$DATABASE_NAME" "$APP_RELEASE" "$phase" > "$marker_tmp"
  )
  mv -f -- "$marker_tmp" "$marker"
  verify_fresh_marker_identity "$marker" "$phase"
}

if [[ ! -e "$fresh_host_marker" && ! -L "$fresh_host_marker" ]] \
  && [[ -e "$legacy_fresh_host_marker" || -L "$legacy_fresh_host_marker" ]]; then
  verify_fresh_marker_identity "$legacy_fresh_host_marker"
  write_fresh_marker "$fresh_host_marker" initialized
fi

initial_fresh_deploy=false
if [[ -e "$fresh_host_marker" || -L "$fresh_host_marker" ]]; then
  verify_fresh_marker_identity "$fresh_host_marker" initialized
  if [[ -e "$initializing_host_marker" || -L "$initializing_host_marker" ]]; then
    verify_fresh_marker_identity "$initializing_host_marker" initializing
    rm -f -- "$initializing_host_marker"
  fi
elif [[ -e "$initializing_host_marker" || -L "$initializing_host_marker" ]]; then
  verify_fresh_marker_identity "$initializing_host_marker" initializing
  initial_fresh_deploy=true
else
  initial_fresh_deploy=true
  for volume in mongo1_data; do
    if docker volume inspect "${COMPOSE_PROJECT_NAME}_${volume}" >/dev/null 2>&1; then
      echo "Existing MongoDB volume found before fresh deployment: ${COMPOSE_PROJECT_NAME}_${volume}" >&2
      echo "Use a new VM, or deliberately remove the old staging volumes before retrying." >&2
      exit 2
    fi
  done
  write_fresh_marker "$initializing_host_marker" initializing
fi
sed \
  -e "s/maianhomes.vn www.maianhomes.vn admin.maianhomes.vn/$STAGING_DOMAIN/g" \
  -e "s#/live/maianhomes.vn/#/live/$STAGING_DOMAIN/#g" \
  "$ROOT/infrastructure/nginx.production.conf" \
  > "$ROOT/.release-artifacts/nginx.staging.conf"

compose=(
  docker compose --project-name "$COMPOSE_PROJECT_NAME"
  --env-file "$ENV_FILE"
  -f "$ROOT/docker-compose.yml"
  -f "$ROOT/docker-compose.staging.yml"
)
if [[ "$AI_PROVIDER" == "ollama" ]]; then
  compose+=(--profile ollama)
fi

"${compose[@]}" config --quiet
runtime_mutation_started=true
"${compose[@]}" pull
for image in \
  "$BACKEND_RELEASE_IMAGE" "$BACKEND_BLUE_IMAGE" \
  "$BACKEND_GREEN_IMAGE" "$BACKEND_WORKER_IMAGE"; do
  baked_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")"
  if [[ "$baked_revision" != "$APP_RELEASE" ]]; then
    echo "Backend image revision mismatch: $image reports $baked_revision, expected $APP_RELEASE." >&2
    exit 2
  fi
done
settings_preflight="$ROOT/.release-artifacts/staging-settings-preflight.json"
if ! docker run --rm --network none --env-file "$ENV_FILE" \
  --env "APP_RELEASE=$BACKEND_RELEASE_ID" --entrypoint python \
  "$BACKEND_RELEASE_IMAGE" -m scripts.validate_runtime_settings \
  > "$settings_preflight"; then
  echo "Candidate settings preflight failed before any staging service was changed." >&2
  exit 2
fi
if [[ "$AI_PROVIDER" == "ollama" ]]; then
  "${compose[@]}" up -d --wait mongo1 redis minio clamav ollama
  "${compose[@]}" run --rm ollama-init
else
  "${compose[@]}" up -d --wait mongo1 redis minio clamav
fi
"${compose[@]}" up mongo-init
"${compose[@]}" up storage-init database-bootstrap database-verify
"${compose[@]}" run --rm database-bootstrap
"${compose[@]}" run --rm database-verify
if [[ "$initial_fresh_deploy" == "true" ]]; then
  "${compose[@]}" run --rm database-verify python -m scripts.database_fresh_verify
  write_fresh_marker "$fresh_host_marker" initialized
  rm -f -- "$initializing_host_marker"
fi

"${compose[@]}" up -d --no-deps api1 api2
"${compose[@]}" up -d --no-deps activity-worker content-worker system-monitor-worker
"${compose[@]}" up -d --no-deps frontend1 frontend2

for service in api1 api2 frontend1 frontend2; do
  container_id="$("${compose[@]}" ps -q "$service")"
  for attempt in $(seq 1 60); do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
    [[ "$health" == "healthy" ]] && break
    if [[ "$attempt" == 60 ]]; then
      echo "$service did not become healthy" >&2
      docker logs --tail 200 "$container_id" >&2
      exit 1
    fi
    sleep 5
  done
done

for identity_spec in "api1:$BACKEND_BLUE_RELEASE" "api2:$BACKEND_GREEN_RELEASE"; do
  service="${identity_spec%%:*}"
  expected_revision="${identity_spec#*:}"
  "${compose[@]}" exec -T "$service" python -c \
    "import json, urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=10)); assert payload.get('status') == 'ready'; assert payload.get('release') == '$expected_revision'; assert payload.get('image_revision') == '$expected_revision'"
done

docker volume create maian_staging_letsencrypt >/dev/null
docker volume create maian_staging_certbot_webroot >/dev/null
if ! docker run --rm \
  -v maian_staging_letsencrypt:/etc/letsencrypt \
  alpine:3.22 test -f "/etc/letsencrypt/live/$STAGING_DOMAIN/fullchain.pem"; then
  docker run --rm -p 80:80 \
    -v maian_staging_letsencrypt:/etc/letsencrypt \
    certbot/certbot:v3.1.0 certonly --standalone \
    --non-interactive --agree-tos --no-eff-email \
    --email "$TLS_EMAIL" -d "$STAGING_DOMAIN"
fi

"${compose[@]}" up -d --no-deps nginx certbot
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
    "https://$STAGING_DOMAIN/" >/dev/null \
    && curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
      "https://$STAGING_DOMAIN/api/public/jobs" >/dev/null; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    echo "Staging public readiness did not pass after 30 bounded attempts." >&2
    exit 1
  fi
  sleep 5
done

nginx_id="$("${compose[@]}" ps -q nginx)"
if [[ -z "$nginx_id" ]]; then
  echo "Staging Nginx container is not running." >&2
  exit 1
fi
routing_mount="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/runtime"}}{{.Type}}:{{.Name}}{{end}}{{end}}' "$nginx_id")"
if [[ "$routing_mount" != "volume:maian_staging_nginx_active_state" ]]; then
  echo "Staging Nginx is missing its persistent routing volume: $routing_mount" >&2
  exit 1
fi
persisted_instance="$("${compose[@]}" exec -T nginx cat /etc/nginx/runtime/deployment-instance-id)"
if [[ "$persisted_instance" != "$DEPLOYMENT_INSTANCE_ID" ]]; then
  echo "Staging Nginx routing volume belongs to a different deployment instance." >&2
  exit 1
fi
"${compose[@]}" exec -T nginx sh -ec '
  test ! -e /etc/nginx/runtime/.route-bootstrap.lock
  printf "%s\n" "$DEPLOYMENT_INSTANCE_ID" |
    cmp -s - /etc/nginx/runtime/deployment-instance-id
'
persisted_color="$("${compose[@]}" exec -T nginx cat /etc/nginx/runtime/active-color)"
case "$persisted_color" in
  blue|green) ;;
  *)
    echo "Staging Nginx persisted an invalid active color." >&2
    exit 1
    ;;
esac
"${compose[@]}" exec -T nginx cmp -s /etc/nginx/runtime/active-upstreams.conf "/etc/nginx/upstreams/$persisted_color.conf"
"${compose[@]}" exec -T nginx nginx -t
printf 'mount=%s\ndeployment_instance_id=%s\nactive_color=%s\nrelease=%s\n' \
  "$routing_mount" "$persisted_instance" "$persisted_color" "$APP_RELEASE" \
  > "$ROOT/.release-artifacts/nginx-route-state-$APP_RELEASE.txt"

"${compose[@]}" ps
printf 'Staging deployment passed: https://%s (release %s)\n' "$STAGING_DOMAIN" "$APP_RELEASE"
