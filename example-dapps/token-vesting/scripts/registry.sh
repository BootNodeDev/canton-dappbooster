#!/usr/bin/env bash
#
# registry.sh start|stop: the canton-token-forge registry the dApp reads its instrument from.
#
# It runs from the .env.registry that bootstrap writes. dev-stack.sh calls it through the
# `stack:up` and `stack:down` scripts and passes DEV_STACK_RUN_DIR, where the registry's log goes.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${DEV_STACK_RUN_DIR:-$APP_DIR/.dev-stack}"
REGISTRY_ENV="$APP_DIR/.env.registry"
REGISTRY_LOG="$RUN_DIR/registry.log"

# The registry's own options, which bootstrap knows nothing about, passed through from the caller or .env.
REGISTRY_OPTION_KEYS=(
  CORS_ORIGINS
  DIRECT_TRANSFER_MARGIN_MS
  LEDGER_USER_ID
  SHUTDOWN_TIMEOUT_MS
)

log() { printf '==> %s\n' "$*"; }
die() {
  printf '[x] %s\n' "$*" >&2
  exit 1
}

# 3013 is the fallback for a `stop` that runs before bootstrap ever wrote the file.
registry_port() {
  local port=''
  if [ -f "$REGISTRY_ENV" ]; then
    port="$(sed -n 's/^PORT=//p' "$REGISTRY_ENV")"
  fi
  printf '%s' "${port:-3013}"
}

wait_until() { # wait_until <seconds> <command…>
  local deadline=$((SECONDS + $1))
  shift
  until "$@"; do
    [ "$SECONDS" -lt "$deadline" ] || return 1
    sleep 1
  done
}

port_free() { ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# Matched on the registry's own path too, so another service on the port is left alone.
stop_registry() {
  local pid
  for pid in $(lsof -t -nP -iTCP:"$(registry_port)" -sTCP:LISTEN 2>/dev/null); do
    if ps -p "$pid" -o args= 2>/dev/null | grep -q 'canton-token-forge/registry/dist'; then
      log "Stopping the token registry (pid $pid)"
      kill "$pid" 2>/dev/null || true
    fi
  done
}

start_registry() {
  local key port preset
  local -a options=()
  [ -f "$REGISTRY_ENV" ] || die "No $REGISTRY_ENV; run bootstrap first."
  port="$(registry_port)"

  # Re-applied after sourcing, so what the caller exported beats .env, as in deploy-dar.sh.
  preset="$(declare -p CANTON_BACKEND_TOKEN "${REGISTRY_OPTION_KEYS[@]}" 2>/dev/null || true)"
  if [ -f "$APP_DIR/.env" ]; then
    # shellcheck disable=SC1091
    source "$APP_DIR/.env"
  fi
  eval "$preset"
  [ -n "${CANTON_BACKEND_TOKEN:-}" ] || die "CANTON_BACKEND_TOKEN is empty; the registry reads the ledger with it."
  # Set but empty is passed on: for CORS_ORIGINS it is the only way to allow no origin at all.
  for key in "${REGISTRY_OPTION_KEYS[@]}"; do
    if [ -n "${!key+set}" ]; then
      options+=("$key=${!key}")
    fi
  done

  # Restarted rather than reused: a leftover one was configured by an earlier run, before any reset.
  if ! port_free "$port"; then
    log "Port $port in use; restarting the token registry."
    stop_registry
    # Past the registry's SHUTDOWN_TIMEOUT_MS, 8s by default, which a draining registry can take.
    wait_until 20 port_free "$port" || die "Port $port is still held after 20s; free it, then run 'up' again."
  fi

  mkdir -p "$RUN_DIR"
  log "Starting the token registry -> http://localhost:$port"
  # The token travels in the environment, where `ps` cannot show it.
  LEDGER_API_TOKEN="$CANTON_BACKEND_TOKEN" \
    nohup env DOTENV_CONFIG_PATH="$REGISTRY_ENV" ${options[@]+"${options[@]}"} \
    "$APP_DIR/node_modules/.bin/canton-token-forge-registry" >"$REGISTRY_LOG" 2>&1 &

  # /readyz reads the ledger end, so a 2xx proves the registry reaches the participant.
  wait_until 60 curl -fs -o /dev/null -m 2 "http://localhost:$port/readyz" \
    || die "The token registry is not ready on $port (log: $REGISTRY_LOG)."
  log "Token registry ready on http://localhost:$port (log: $REGISTRY_LOG)"
}

case "${1:-}" in
  start) start_registry ;;
  stop) stop_registry ;;
  *) die "Usage: scripts/registry.sh start|stop" ;;
esac
