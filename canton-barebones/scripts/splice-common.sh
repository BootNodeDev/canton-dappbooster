#!/usr/bin/env bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

EXTERNAL_SPLICE_IMAGE_TAG="${SPLICE_IMAGE_TAG:-}"
EXTERNAL_SPLICE_BUNDLE_DIR="${SPLICE_BUNDLE_DIR:-}"
EXTERNAL_IMAGE_TAG="${IMAGE_TAG:-}"
EXTERNAL_LOCALNET_DIR="${LOCALNET_DIR:-}"
EXTERNAL_LOCALNET_ENV_DIR="${LOCALNET_ENV_DIR:-}"
EXTERNAL_SPLICE_COMPOSE_PROJECT_NAME="${SPLICE_COMPOSE_PROJECT_NAME:-}"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

[ -n "$EXTERNAL_SPLICE_IMAGE_TAG" ] && SPLICE_IMAGE_TAG="$EXTERNAL_SPLICE_IMAGE_TAG"
[ -n "$EXTERNAL_SPLICE_BUNDLE_DIR" ] && SPLICE_BUNDLE_DIR="$EXTERNAL_SPLICE_BUNDLE_DIR"
[ -n "$EXTERNAL_IMAGE_TAG" ] && IMAGE_TAG="$EXTERNAL_IMAGE_TAG"
[ -n "$EXTERNAL_LOCALNET_DIR" ] && LOCALNET_DIR="$EXTERNAL_LOCALNET_DIR"
[ -n "$EXTERNAL_LOCALNET_ENV_DIR" ] && LOCALNET_ENV_DIR="$EXTERNAL_LOCALNET_ENV_DIR"
[ -n "$EXTERNAL_SPLICE_COMPOSE_PROJECT_NAME" ] && SPLICE_COMPOSE_PROJECT_NAME="$EXTERNAL_SPLICE_COMPOSE_PROJECT_NAME"

SPLICE_IMAGE_TAG="${SPLICE_IMAGE_TAG:-${IMAGE_TAG:-0.5.18}}"
IMAGE_TAG="${IMAGE_TAG:-$SPLICE_IMAGE_TAG}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-canton-barebones}"
SPLICE_BUNDLE_DIR="${SPLICE_BUNDLE_DIR:-$HOME/.canton-dappbooster/splice-localnet}"
LOCALNET_DIR="${LOCALNET_DIR:-$SPLICE_BUNDLE_DIR/splice-node/docker-compose/localnet}"
LOCALNET_ENV_DIR="${LOCALNET_ENV_DIR:-$LOCALNET_DIR/env}"
SPLICE_COMPOSE_PROJECT_NAME="${SPLICE_COMPOSE_PROJECT_NAME:-$COMPOSE_PROJECT_NAME}"
CANTON_BAREBONES_DIR="$ROOT"
SPLICE_PROFILES=(sv app-user)

export COMPOSE_PROJECT_NAME SPLICE_IMAGE_TAG IMAGE_TAG SPLICE_BUNDLE_DIR LOCALNET_DIR LOCALNET_ENV_DIR SPLICE_COMPOSE_PROJECT_NAME CANTON_BAREBONES_DIR

# Prints a compact status line so stack scripts are easy to scan.
log() {
  printf '\033[1;36m==>\033[0m %s\n' "$*"
}

# Prints a warning without failing the stack startup.
warn() {
  printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2
}

# Prints an error and exits so callers fail before half-starting infrastructure.
die() {
  printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2
  exit 1
}

# Expands to the official LocalNet docker compose command with our fixed profiles.
splice_compose() {
  docker compose \
    --project-name "$SPLICE_COMPOSE_PROJECT_NAME" \
    --env-file "$LOCALNET_DIR/compose.env" \
    --env-file "$LOCALNET_DIR/env/common.env" \
    -f "$LOCALNET_DIR/compose.yaml" \
    -f "$LOCALNET_DIR/resource-constraints.yaml" \
    -f "$ROOT/config/splice/localnet-overrides.yaml" \
    --profile "${SPLICE_PROFILES[0]}" \
    --profile "${SPLICE_PROFILES[1]}" \
    "$@"
}

# Downloads the official Splice LocalNet bundle once and reuses it on later runs.
ensure_splice_bundle() {
  local compose_file="$LOCALNET_DIR/compose.yaml"
  if [ -f "$compose_file" ]; then
    log "Splice LocalNet bundle already present at $SPLICE_BUNDLE_DIR"
    return 0
  fi

  local tarball="$SPLICE_BUNDLE_DIR/${SPLICE_IMAGE_TAG}_splice-node.tar.gz"
  local url="${SPLICE_BUNDLE_URL:-https://github.com/digital-asset/decentralized-canton-sync/releases/download/v${SPLICE_IMAGE_TAG}/${SPLICE_IMAGE_TAG}_splice-node.tar.gz}"

  log "Downloading Splice LocalNet bundle v${SPLICE_IMAGE_TAG}"
  mkdir -p "$SPLICE_BUNDLE_DIR"
  curl -fsSL --location "$url" -o "$tarball"

  log "Extracting Splice LocalNet bundle"
  tar -xzf "$tarball" -C "$SPLICE_BUNDLE_DIR"
  rm -f "$tarball"

  [ -f "$compose_file" ] || die "Splice LocalNet compose file not found after extraction: $compose_file"
}

# Waits for an HTTP endpoint to return success before the caller proceeds.
wait_http() {
  local url="$1"
  local label="$2"
  local timeout="${3:-300}"
  local deadline=$((SECONDS + timeout))

  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$label ready"
      return 0
    fi
    if ((SECONDS >= deadline)); then
      die "$label did not become ready at $url within ${timeout}s"
    fi
    sleep 5
  done
}

# Verifies local hostnames used by the official LocalNet nginx routes.
check_localnet_hosts() {
  local missing=()
  local domain
  for domain in wallet.localhost scan.localhost sv.localhost; do
    if ! grep -q "$domain" /etc/hosts 2>/dev/null; then
      missing+=("$domain")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    warn "Missing /etc/hosts entries: ${missing[*]}"
    warn "Add: 127.0.0.1 wallet.localhost scan.localhost sv.localhost"
  fi
}

# Reports low Docker memory before LocalNet fails with opaque container errors.
check_docker_memory() {
  local bytes gb
  bytes="$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0)"
  gb=$((bytes / 1024 / 1024 / 1024))
  if [ "$gb" -lt 7 ]; then
    warn "Docker reports ~${gb}GB memory; Splice LocalNet needs about 8GB."
  fi
}

# Ensures the real wallet-service has the explicit token required by LocalNet.
require_backend_token() {
  if [ "${WALLET_SERVICE_MOCK:-}" = "1" ]; then
    return 0
  fi
  [ -n "${CANTON_BACKEND_TOKEN:-}" ] || die "CANTON_BACKEND_TOKEN is required. Generate one with: npm run canton:token -- ledger-api-user"
}
