#!/usr/bin/env bash
set -euo pipefail

# Deliberately fail closed. Changing OLLAMA_MODEL changes backend startup
# settings and therefore belongs to the same reviewed, immutable blue/green
# release transaction as the backend image. An out-of-band model switch can
# restart both APIs, race worker handoff and revive legacy embedded consumers.
echo "Standalone Ollama model switching is disabled." >&2
echo "Publish a reviewed release with the desired OLLAMA_MODEL, then use the locked blue/green rollout and rollback runbooks." >&2
exit 2
