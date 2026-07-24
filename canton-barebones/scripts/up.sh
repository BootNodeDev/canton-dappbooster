#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and retry."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."

require_backend_token
check_docker_memory
check_localnet_hosts
ensure_splice_bundle

log "Pulling Splice LocalNet images"
splice_compose pull --quiet || splice_compose pull

log "Starting Splice LocalNet profiles: ${SPLICE_PROFILES[*]}"
COMPOSE_IGNORE_ORPHANS=true splice_compose up -d

wait_http "http://localhost:4903/api/validator/readyz" "sv validator" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"
wait_http "http://localhost:2903/api/validator/readyz" "app-user validator" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"
wait_http "http://localhost:2975/readyz" "app-user JSON API" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"

log "Starting wallet-service"
COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "$ROOT" up -d --build wallet-service
wait_http "http://localhost:${WALLET_SERVICE_PORT:-3010}/health" "wallet-service" "${WALLET_SERVICE_HEALTH_TIMEOUT_SECONDS:-120}"

cat <<EOF

Local stack is up:
  wallet-service          http://localhost:${WALLET_SERVICE_PORT:-3010}
  app-user wallet UI      http://wallet.localhost:2000
  app-user JSON API       http://localhost:2975
  app-user Ledger API     grpc://localhost:2901
  app-user Validator API  http://localhost:2903
  Scan UI                 http://scan.localhost:4000
  SV UI                   http://sv.localhost:4000
EOF
