#!/bin/sh
set -eu

interval="${NGINX_CERT_CHECK_INTERVAL_SECONDS:-300}"
case "$interval" in
  ''|*[!0-9]*)
    echo "NGINX_CERT_CHECK_INTERVAL_SECONDS must be an integer" >&2
    exit 2
    ;;
esac
if [ "$interval" -lt 60 ] || [ "$interval" -gt 3600 ]; then
  echo "NGINX_CERT_CHECK_INTERVAL_SECONDS must be between 60 and 3600" >&2
  exit 2
fi

case "${ACTIVE_COLOR:-}" in
  blue|green) ;;
  *)
    echo "ACTIVE_COLOR must be blue or green" >&2
    exit 2
    ;;
esac

deployment_instance_id="${DEPLOYMENT_INSTANCE_ID:-}"
case "$deployment_instance_id" in
  ''|[!A-Za-z0-9]*|*[!A-Za-z0-9_.-]*)
    echo "DEPLOYMENT_INSTANCE_ID must be a plain deployment identifier" >&2
    exit 2
    ;;
esac
if [ "${#deployment_instance_id}" -lt 3 ] || [ "${#deployment_instance_id}" -gt 64 ]; then
  echo "DEPLOYMENT_INSTANCE_ID must contain between 3 and 64 characters" >&2
  exit 2
fi

runtime_dir="/etc/nginx/runtime"
active_config="$runtime_dir/active-upstreams.conf"
active_color_file="$runtime_dir/active-color"
instance_id_file="$runtime_dir/deployment-instance-id"
bootstrap_lock_dir="$runtime_dir/.route-bootstrap.lock"
route_lock_dir="$runtime_dir/.route-switch.lock"
active_config_tmp="$runtime_dir/.active-upstreams.bootstrap.$$"
color_file_tmp="$runtime_dir/.active-color.bootstrap.$$"
instance_id_tmp="$runtime_dir/.deployment-instance-id.bootstrap.$$"
bootstrap_lock_held=0

mkdir -p "$runtime_dir"
cleanup_bootstrap() {
  rm -f "$active_config_tmp" "$color_file_tmp" "$instance_id_tmp" || true
  if [ "$bootstrap_lock_held" -eq 1 ]; then
    echo "Incomplete Nginx route bootstrap lock retained for operator review: $bootstrap_lock_dir" >&2
  fi
}
trap cleanup_bootstrap EXIT

runtime_state_is_empty() {
  for state_path in "$runtime_dir"/* "$runtime_dir"/.[!.]* "$runtime_dir"/..?*; do
    if [ -e "$state_path" ] || [ -L "$state_path" ]; then
      return 1
    fi
  done
  return 0
}

runtime_state_contains_only_bootstrap_lock() {
  for state_path in "$runtime_dir"/* "$runtime_dir"/.[!.]* "$runtime_dir"/..?*; do
    if [ ! -e "$state_path" ] && [ ! -L "$state_path" ]; then
      continue
    fi
    if [ "$state_path" != "$bootstrap_lock_dir" ]; then
      return 1
    fi
  done
  return 0
}

certificate_checksum() {
  certificate_files="$({
    find -L /etc/letsencrypt/live -type f \
      \( -name fullchain.pem -o -name privkey.pem \) -print
  } | sort)"
  [ -n "$certificate_files" ] || return 1
  printf '%s\n' "$certificate_files" |
    while IFS= read -r certificate_file; do
      sha256sum "$certificate_file"
    done |
    sha256sum |
    awk '{print $1}'
}

if [ -e "$bootstrap_lock_dir" ] || [ -L "$bootstrap_lock_dir" ]; then
  echo "Nginx routing state has an incomplete or concurrent bootstrap lock" >&2
  exit 1
fi

bootstrap_required=0
if [ ! -s "$instance_id_file" ]; then
  if ! runtime_state_is_empty; then
    echo "Existing Nginx routing state has no deployment-instance owner; controlled migration is required" >&2
    exit 1
  fi
  if ! mkdir "$bootstrap_lock_dir" 2>/dev/null; then
    echo "Another Nginx routing-state bootstrap won the atomic lock" >&2
    exit 1
  fi
  bootstrap_lock_held=1
  if ! runtime_state_contains_only_bootstrap_lock; then
    echo "Nginx routing state changed while the bootstrap lock was acquired" >&2
    exit 1
  fi
  bootstrap_required=1
  persisted_color="$ACTIVE_COLOR"
else
  if [ ! -f "$instance_id_file" ] || [ -L "$instance_id_file" ]; then
    echo "Persistent Nginx deployment-instance owner is not a regular file" >&2
    exit 1
  fi
  if ! printf '%s\n' "$deployment_instance_id" | cmp -s - "$instance_id_file"; then
    echo "Persistent Nginx routing state belongs to a different deployment instance" >&2
    exit 1
  fi
  if [ ! -s "$active_color_file" ] || [ ! -f "$active_color_file" ] || [ -L "$active_color_file" ]; then
    echo "Owned persistent Nginx routing state has no valid active-color marker" >&2
    exit 1
  fi
  persisted_color="$(cat "$active_color_file")"
fi

case "$persisted_color" in
  blue|green) ;;
  *)
    echo "Persisted Nginx route color is not blue or green" >&2
    exit 1
    ;;
esac
if [ "$bootstrap_required" -ne 1 ] &&
  ! printf '%s\n' "$persisted_color" | cmp -s - "$active_color_file"; then
  echo "Persistent Nginx active-color marker is not an exact single-line value" >&2
  exit 1
fi
if [ "$persisted_color" != "$ACTIVE_COLOR" ]; then
  echo "Persisted Nginx route '$persisted_color' overrides ACTIVE_COLOR='$ACTIVE_COLOR'"
fi

case "$persisted_color" in
  blue)
    expected_frontend="frontend1:3000"
    expected_api="api1:8000"
    ;;
  green)
    expected_frontend="frontend2:3000"
    expected_api="api2:8000"
    ;;
esac
persisted_template="/etc/nginx/upstreams/${persisted_color}.conf"
server_count="$(grep -Ec '^[[:space:]]*server[[:space:]]+' "$persisted_template" || true)"
frontend_count="$(grep -Ec "^[[:space:]]*server[[:space:]]+${expected_frontend};[[:space:]]*$" "$persisted_template" || true)"
api_count="$(grep -Ec "^[[:space:]]*server[[:space:]]+${expected_api};[[:space:]]*$" "$persisted_template" || true)"
server_count="${server_count:-0}"
frontend_count="${frontend_count:-0}"
api_count="${api_count:-0}"
if [ "$server_count" -ne 2 ] || [ "$frontend_count" -ne 1 ] || [ "$api_count" -ne 1 ]; then
  echo "Persisted-color upstream template does not contain only the exact approved targets" >&2
  exit 1
fi

# The color marker is canonical. Rebuild the generated include on every
# container start so a reviewed future update to a blue/green template does not
# make the persisted state incompatible with the new image/config checkout.
if ! cp "$persisted_template" "$active_config_tmp" ||
  ! cmp -s "$persisted_template" "$active_config_tmp"; then
  echo "Unable to create an exact generated Nginx route candidate" >&2
  exit 1
fi

if [ "$bootstrap_required" -eq 1 ]; then
  if ! printf '%s\n' "$persisted_color" > "$color_file_tmp" ||
    ! printf '%s\n' "$deployment_instance_id" > "$instance_id_tmp"; then
    echo "Unable to create Nginx routing-state bootstrap markers" >&2
    exit 1
  fi
  if ! printf '%s\n' "$deployment_instance_id" | cmp -s - "$instance_id_tmp"; then
    echo "Nginx routing-state owner bootstrap candidate is not exact" >&2
    exit 1
  fi
  if ! mv "$active_config_tmp" "$active_config" ||
    ! cmp -s "$persisted_template" "$active_config" ||
    ! mv "$color_file_tmp" "$active_color_file"; then
    echo "Unable to install the initial Nginx route under the bootstrap lock" >&2
    exit 1
  fi
  if ! printf '%s\n' "$persisted_color" | cmp -s - "$active_color_file"; then
    echo "Initial Nginx active-color marker is not exact" >&2
    exit 1
  fi
  if ! nginx -t; then
    echo "Initial Nginx route failed validation; bootstrap lock retained" >&2
    exit 1
  fi
  if ! mv "$instance_id_tmp" "$instance_id_file" ||
    ! printf '%s\n' "$deployment_instance_id" | cmp -s - "$instance_id_file"; then
    echo "Unable to commit the exact Nginx routing-state owner" >&2
    exit 1
  fi
  if ! rmdir "$bootstrap_lock_dir"; then
    echo "Nginx route bootstrap completed but its lock could not be released" >&2
    exit 1
  fi
  bootstrap_lock_held=0
  echo "Initialized persistent Nginx route for deployment instance $deployment_instance_id from ACTIVE_COLOR=${ACTIVE_COLOR}"
else
  if ! mv "$active_config_tmp" "$active_config" ||
    ! cmp -s "$persisted_template" "$active_config"; then
    echo "Unable to rebuild the owned persistent Nginx route" >&2
    exit 1
  fi
  nginx -t
fi
previous_checksum="$(certificate_checksum)" || {
  echo "No readable TLS certificate/key pair found" >&2
  exit 1
}

cleanup_bootstrap
trap - EXIT

watch_certificates() {
  certificate_route_lock_owned=0
  certificate_reload_attempted=0

  finish_certificate_watcher() {
    watcher_status="$?"
    trap - EXIT HUP INT TERM
    if [ "$certificate_route_lock_owned" -eq 1 ]; then
      if [ "$certificate_reload_attempted" -eq 1 ]; then
        echo "Certificate reload outcome is uncertain; preserving $route_lock_dir for operator review" >&2
        watcher_status=1
      elif ! rmdir "$route_lock_dir" 2>/dev/null; then
        echo "Certificate watcher could not release the route lock" >&2
        watcher_status=1
      fi
    fi
    exit "$watcher_status"
  }

  release_certificate_route_lock() {
    if ! rmdir "$route_lock_dir" 2>/dev/null; then
      echo "Certificate watcher could not safely release the route lock" >&2
      return 1
    fi
    certificate_route_lock_owned=0
    return 0
  }

  trap finish_certificate_watcher EXIT
  trap 'exit 130' HUP INT TERM
  while sleep "$interval"; do
    if ! mkdir "$route_lock_dir" 2>/dev/null; then
      echo "Route switch in progress; deferring certificate reload"
      continue
    fi
    certificate_route_lock_owned=1
    certificate_reload_attempted=0
    if ! current_checksum="$(certificate_checksum)"; then
      echo "TLS certificate checksum unavailable; keeping current Nginx workers" >&2
      if ! release_certificate_route_lock; then
        exit 1
      fi
      continue
    fi
    if [ "$current_checksum" = "$previous_checksum" ]; then
      if ! release_certificate_route_lock; then
        exit 1
      fi
      continue
    fi

    if ! nginx -t; then
      echo "Changed TLS certificate failed validation; Nginx was not reloaded" >&2
      if ! release_certificate_route_lock; then
        exit 1
      fi
      continue
    fi
    certificate_reload_attempted=1
    if ! nginx -s reload; then
      echo "Changed TLS certificate reload failed; route lock retained for operator review" >&2
      exit 1
    fi
    previous_checksum="$current_checksum"
    certificate_reload_attempted=0
    if ! release_certificate_route_lock; then
      exit 1
    fi
    echo "TLS certificate change validated and Nginx reloaded"
  done
}

watch_certificates &
exec nginx -g 'daemon off;'
