#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

log "Stopping wallet-service"
docker compose --project-directory "$ROOT" down

if [ -f "$LOCALNET_DIR/compose.yaml" ]; then
  log "Stopping Splice LocalNet containers, preserving data volumes"
  splice_compose down
else
  warn "Splice bundle is not present; skipping LocalNet down"
fi
