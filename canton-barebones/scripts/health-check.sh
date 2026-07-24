#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

status=0

# Checks one HTTP endpoint and records a non-zero final exit if it is down.
check_http() {
  local label="$1"
  local url="$2"
  printf '%-32s' "$label"
  if curl -fsS "$url" >/dev/null 2>&1; then
    printf 'UP   %s\n' "$url"
  else
    printf 'DOWN %s\n' "$url"
    status=1
  fi
}

echo "Splice LocalNet"
check_http "sv validator" "http://localhost:4903/api/validator/readyz"
check_http "app-user validator" "http://localhost:2903/api/validator/readyz"
check_http "app-user JSON API" "http://localhost:2975/readyz"
check_http "app-user wallet UI" "http://wallet.localhost:2000"
check_http "Scan UI" "http://scan.localhost:4000"
check_http "SV UI" "http://sv.localhost:4000"

echo ""
echo "Carpincho bridge"
check_http "wallet-service" "http://localhost:${WALLET_SERVICE_PORT:-3010}/health"

echo ""
if docker info >/dev/null 2>&1; then
  if [ "$SPLICE_COMPOSE_PROJECT_NAME" = "$COMPOSE_PROJECT_NAME" ]; then
    echo "Docker compose project: $COMPOSE_PROJECT_NAME"
    COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "$ROOT" ps
  else
    echo "wallet-service compose:"
    COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "$ROOT" ps
    if [ -f "$LOCALNET_DIR/compose.yaml" ]; then
      echo ""
      echo "Splice compose:"
      splice_compose ps
    fi
  fi
else
  warn "Docker is not running; skipping container status"
fi

exit "$status"
