#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git gnupg gettext-base jq

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
printf '%s\n' \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list

curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
  | gpg --dearmor --yes -o /etc/apt/keyrings/google-cloud.gpg
chmod a+r /etc/apt/keyrings/google-cloud.gpg
printf '%s\n' \
  "deb [signed-by=/etc/apt/keyrings/google-cloud.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
  > /etc/apt/sources.list.d/google-cloud-sdk.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin google-cloud-cli
systemctl enable --now docker

registry_host="$(curl -fsS \
  -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/artifact-registry-host)"
if [[ -z "$registry_host" || "$registry_host" != *.pkg.dev ]]; then
  echo "Invalid or missing artifact-registry-host instance metadata." >&2
  exit 1
fi
# The deployment is executed with sudo, so Docker reads root's config here.
gcloud auth print-access-token >/dev/null
gcloud auth configure-docker "$registry_host" --quiet

install -d -m 2775 -o root -g docker /opt/maian
install -d -m 0750 -o root -g docker /opt/maian/secrets

cat >/etc/logrotate.d/maian-docker <<'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 5
  daily
  compress
  size 20M
  missingok
  copytruncate
}
EOF
