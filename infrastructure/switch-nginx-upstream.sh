#!/bin/sh
set -eu

color="${1:-}"
case "$color" in
  blue|green) ;;
  *)
    echo "Usage: switch-nginx-upstream.sh blue|green" >&2
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
source_config="/etc/nginx/upstreams/${color}.conf"
lock_dir="$runtime_dir/.route-switch.lock"
candidate="$runtime_dir/.active-upstreams.candidate.$$"
backup="$runtime_dir/.active-upstreams.backup.$$"
restore_candidate="$runtime_dir/.active-upstreams.restore.$$"
color_file_tmp="$runtime_dir/.active-color.$$"
committed=0
backup_ready=0
backup_sha256=""
route_disk_mutation_started=0
route_reload_attempted=0
previous_color=""

case "$color" in
  blue)
    expected_frontend="frontend1:3000"
    expected_api="api1:8000"
    ;;
  green)
    expected_frontend="frontend2:3000"
    expected_api="api2:8000"
    ;;
esac
server_count="$(grep -Ec '^[[:space:]]*server[[:space:]]+' "$source_config" || true)"
frontend_count="$(grep -Ec "^[[:space:]]*server[[:space:]]+${expected_frontend};[[:space:]]*$" "$source_config" || true)"
api_count="$(grep -Ec "^[[:space:]]*server[[:space:]]+${expected_api};[[:space:]]*$" "$source_config" || true)"
server_count="${server_count:-0}"
frontend_count="${frontend_count:-0}"
api_count="${api_count:-0}"
if [ "$server_count" -ne 2 ] || [ "$frontend_count" -ne 1 ] || [ "$api_count" -ne 1 ]; then
  echo "Selected upstream template does not contain only the exact approved $color targets" >&2
  exit 1
fi

if [ ! -d "$runtime_dir" ] || [ ! -s "$active_config" ] ||
  [ ! -s "$active_color_file" ] || [ ! -s "$instance_id_file" ]; then
  echo "Persistent Nginx routing state is not initialized" >&2
  exit 1
fi
if [ -e "$bootstrap_lock_dir" ] || [ -L "$bootstrap_lock_dir" ]; then
  echo "Nginx routing-state bootstrap is incomplete or still active" >&2
  exit 1
fi
if [ ! -f "$instance_id_file" ] || [ -L "$instance_id_file" ] ||
  ! printf '%s\n' "$deployment_instance_id" | cmp -s - "$instance_id_file"; then
  echo "Persistent Nginx routing state is not owned by this exact deployment instance" >&2
  exit 1
fi
if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "Another route switch is active; inspect and remove stale lock only after verification" >&2
  exit 1
fi

finish_transaction() {
  status="$?"
  trap - EXIT HUP INT TERM
  recovery_failed=0
  route_recovered=0
  current_backup_sha256=""

  if [ "$committed" -ne 1 ] && [ "$route_disk_mutation_started" -eq 1 ]; then
    if [ "$backup_ready" -ne 1 ] || [ ! -s "$backup" ]; then
      echo "No verified route backup is available; refusing an unsafe restore" >&2
      recovery_failed=1
    elif ! current_backup_sha256_output="$(sha256sum "$backup")"; then
      echo "Unable to verify the retained route backup before restore" >&2
      recovery_failed=1
    else
      current_backup_sha256="${current_backup_sha256_output%% *}"
      case "$current_backup_sha256" in
        ''|*[!0-9a-f]*)
          echo "The retained route backup returned an invalid SHA-256 digest" >&2
          recovery_failed=1
          ;;
      esac
      if [ "${#current_backup_sha256}" -ne 64 ]; then
        echo "The retained route backup returned a non-SHA-256 digest" >&2
        recovery_failed=1
      fi
    fi
    if [ "$recovery_failed" -eq 0 ] && [ "$current_backup_sha256" != "$backup_sha256" ]; then
      echo "The retained route backup changed after verification; refusing restore" >&2
      recovery_failed=1
    fi
    if [ "$recovery_failed" -eq 0 ] && ! cp "$backup" "$restore_candidate"; then
      echo "Failed to copy the verified route backup into a restore candidate" >&2
      recovery_failed=1
    fi
    if [ "$recovery_failed" -eq 0 ] && ! cmp -s "$backup" "$restore_candidate"; then
      echo "The route restore candidate does not match the verified backup" >&2
      recovery_failed=1
    fi
    if [ "$recovery_failed" -eq 0 ] && ! mv "$restore_candidate" "$active_config"; then
      echo "Failed to restore the previous route on disk" >&2
      recovery_failed=1
    fi
    if [ "$recovery_failed" -eq 0 ] && ! cmp -s "$backup" "$active_config"; then
      echo "The restored route on disk does not match the verified backup" >&2
      recovery_failed=1
    fi
    if [ "$recovery_failed" -eq 0 ] && ! nginx -t; then
      echo "Previous route was restored on disk but failed validation" >&2
      recovery_failed=1
    fi
    if [ "$recovery_failed" -eq 0 ] &&
      [ "$route_reload_attempted" -eq 1 ] && ! nginx -s reload; then
      echo "Previous route was restored on disk but reload failed" >&2
      recovery_failed=1
    fi
    if [ "$recovery_failed" -eq 0 ]; then
      route_recovered=1
    fi

    if [ "$route_recovered" -eq 1 ]; then
      if ! printf '%s\n' "$previous_color" > "$color_file_tmp" ||
        ! mv "$color_file_tmp" "$active_color_file"; then
        echo "Route recovery succeeded but its persistent color marker could not be restored" >&2
        recovery_failed=1
      elif ! restored_color="$(cat "$active_color_file")"; then
        echo "Route recovery succeeded but its persistent color marker is unreadable" >&2
        recovery_failed=1
      elif [ "$restored_color" != "$previous_color" ]; then
        echo "Route recovery succeeded but its persistent color marker is inconsistent" >&2
        recovery_failed=1
      fi
    fi
  fi

  if [ "$recovery_failed" -eq 1 ]; then
    echo "Route recovery is incomplete; preserving $backup and $lock_dir for operator recovery" >&2
    exit 1
  fi
  if ! rm -f "$candidate" "$backup" "$restore_candidate" "$color_file_tmp"; then
    echo "Route transaction cleanup failed; preserving the route lock for operator review" >&2
    exit 1
  fi
  if ! rmdir "$lock_dir" 2>/dev/null; then
    echo "Route transaction lock could not be released; inspect it before another switch" >&2
    status=1
  fi
  exit "$status"
}
trap finish_transaction EXIT
trap 'exit 130' HUP INT TERM

if [ -e "$bootstrap_lock_dir" ] || [ -L "$bootstrap_lock_dir" ] ||
  ! printf '%s\n' "$deployment_instance_id" | cmp -s - "$instance_id_file"; then
  echo "Nginx routing-state ownership changed while the route lock was acquired" >&2
  exit 1
fi

previous_color="$(cat "$active_color_file")"
case "$previous_color" in
  blue|green) ;;
  *)
    echo "Current persistent route color is not blue or green" >&2
    exit 1
    ;;
esac
if ! printf '%s\n' "$previous_color" | cmp -s - "$active_color_file"; then
  echo "Current persistent route color marker is not an exact single-line value" >&2
  exit 1
fi

if ! cp "$source_config" "$candidate" || ! cmp -s "$source_config" "$candidate"; then
  echo "Failed to create an exact candidate copy of the selected route" >&2
  exit 1
fi
if ! cp "$active_config" "$backup" || ! cmp -s "$active_config" "$backup"; then
  echo "Failed to create an exact backup of the active route before mutation" >&2
  exit 1
fi
if ! backup_sha256_output="$(sha256sum "$backup")"; then
  echo "Failed to record the verified route backup signature before mutation" >&2
  exit 1
fi
backup_sha256="${backup_sha256_output%% *}"
case "$backup_sha256" in
  ''|*[!0-9a-f]*)
    echo "Verified route backup returned an invalid SHA-256 digest" >&2
    exit 1
    ;;
esac
if [ "${#backup_sha256}" -ne 64 ]; then
  echo "Verified route backup returned a non-SHA-256 digest" >&2
  exit 1
fi
backup_ready=1
if ! cmp -s "$source_config" "$candidate"; then
  echo "Selected route or its candidate changed before mutation" >&2
  exit 1
fi

route_disk_mutation_started=1
if ! mv "$candidate" "$active_config"; then
  echo "Failed to install the candidate route; transaction will restore the verified backup" >&2
  exit 1
fi
if ! cmp -s "$source_config" "$active_config"; then
  echo "Installed candidate route does not match its selected template" >&2
  exit 1
fi

if ! nginx -t; then
  echo "Candidate route failed validation; transaction will restore the previous route" >&2
  exit 1
fi

route_reload_attempted=1
if ! nginx -s reload; then
  echo "Nginx reload failed; transaction will restore the previous route" >&2
  exit 1
fi

if ! printf '%s\n' "$color" > "$color_file_tmp" ||
  ! mv "$color_file_tmp" "$active_color_file"; then
  echo "Nginx reloaded but the persistent route marker commit failed" >&2
  exit 1
fi
if ! persisted_color="$(cat "$active_color_file")" || [ "$persisted_color" != "$color" ]; then
  echo "Nginx reloaded but the persistent route marker could not be verified" >&2
  exit 1
fi
committed=1
echo "Persistent Nginx route switched to $color"
