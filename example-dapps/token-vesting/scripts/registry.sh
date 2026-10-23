#!/usr/bin/env bash
#
# registry.sh: start or stop the canton-token-forge registry the dApp reads its instrument from.
#
# dev-stack.sh runs it through the `stack:up` and `stack:down` scripts, after bootstrap, and passes
# DEV_STACK_RUN_DIR: bootstrap's output is read from there, and the registry's log and pid go there.
#
# Usage:
#   scripts/registry.sh start
#   scripts/registry.sh stop

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${DEV_STACK_RUN_DIR:?DEV_STACK_RUN_DIR is unset; run this through dev-stack.sh}"
BOOTSTRAP_LOG="$RUN_DIR/bootstrap.log"
REGISTRY_LOG="$RUN_DIR/registry.log"
REGISTRY_PID="$RUN_DIR/registry.pid"

# The keys bootstrap prints and this script reads back; bootstrap-vesting.test.mjs holds the two lists together.
REGISTRY_ENV_KEYS=(
  LEDGER_API_URL
  ADMIN_PARTY
  INSTRUMENT_CONFIG_TEMPLATE_ID
  PREAPPROVAL_TEMPLATE_ID
  LOCKED_TOKEN_TEMPLATE_ID
  TRANSFER_INSTRUCTION_TEMPLATE_ID
  ALLOCATION_TEMPLATE_ID
  PORT
)

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

# Drops the single quotes bootstrap puts around the template ids; keys only come from the lists above.
read_bootstrap_env() { # read_bootstrap_env <key>
  local value
  value="$(sed -n "s/^$1=//p" "$BOOTSTRAP_LOG" | tail -n1)"
  value="${value#\'}"
  printf '%s' "${value%\'}"
}

# 3013 is the fallback for a `stop` that never saw bootstrap's output.
registry_port() {
  local port=''
  if [ -f "$BOOTSTRAP_LOG" ]; then
    port="$(read_bootstrap_env PORT)"
  fi
  printf '%s' "${port:-3013}"
}

# Matched on the port too, so a registry someone runs on another port is left alone.
kill_registry_on_port() { # kill_registry_on_port <port>
  local pid
  for pid in $(lsof -t -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null); do
    if ps -p "$pid" -o args= 2>/dev/null | grep -q 'canton-token-forge/registry/dist'; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

stop_registry() {
  local pid
  if [ -f "$REGISTRY_PID" ]; then
    pid="$(cat "$REGISTRY_PID" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping the token registry (pid $pid)"
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$REGISTRY_PID"
  fi
  kill_registry_on_port "$(registry_port)"
}

wait_for_port_free() { # wait_for_port_free <seconds> <port>
  local deadline=$((SECONDS + $1))
  while [ "$SECONDS" -lt "$deadline" ]; do
    lsof -nP -iTCP:"$2" -sTCP:LISTEN >/dev/null 2>&1 || return 0
    sleep 1
  done
  return 1
}

wait_for_ok() { # wait_for_ok <seconds> <url>
  local deadline=$((SECONDS + $1)) code
  while [ "$SECONDS" -lt "$deadline" ]; do
    code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$2" 2>/dev/null || true)"
    if [ "${code:0:1}" = 2 ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_registry() {
  local key value port token
  local -a registry_env=() preset_options=()
  [ -f "$BOOTSTRAP_LOG" ] || die "No bootstrap output at $BOOTSTRAP_LOG; run bootstrap first."
  for key in "${REGISTRY_ENV_KEYS[@]}"; do
    value="$(read_bootstrap_env "$key")"
    [ -n "$value" ] || die "bootstrap printed no $key; cannot configure the registry (log: $BOOTSTRAP_LOG)"
    registry_env+=("$key=$value")
  done

  # Captured before sourcing, so a value the caller exported beats .env, as in deploy-dar.sh.
  token="${CANTON_BACKEND_TOKEN:-}"
  for key in "${REGISTRY_OPTION_KEYS[@]}"; do
    if [ -n "${!key+set}" ]; then
      preset_options+=("$key=${!key}")
    fi
  done
  if [ -f "$APP_DIR/.env" ]; then
    # shellcheck disable=SC1091
    source "$APP_DIR/.env"
  fi
  token="${token:-${CANTON_BACKEND_TOKEN:-}}"
  [ -n "$token" ] || die "CANTON_BACKEND_TOKEN is empty; the registry reads the ledger with it."
  for value in ${preset_options[@]+"${preset_options[@]}"}; do
    printf -v "${value%%=*}" '%s' "${value#*=}"
  done
  # Set but empty is passed on: for CORS_ORIGINS it is the only way to allow no origin at all.
  for key in "${REGISTRY_OPTION_KEYS[@]}"; do
    if [ -n "${!key+set}" ]; then
      registry_env+=("$key=${!key}")
    fi
  done
  port="$(read_bootstrap_env PORT)"

  # Restarted rather than reused: a leftover one was configured by an earlier run, before any reset.
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    log "Port $port in use; restarting the token registry."
    stop_registry
    # Past the registry's SHUTDOWN_TIMEOUT_MS, 8s by default, which a draining registry can take.
    wait_for_port_free 20 "$port" || die "Port $port is still held after 20s; free it, then run 'up' again."
  fi

  mkdir -p "$RUN_DIR"
  log "Starting the token registry -> http://localhost:$port"
  # The token travels in the environment, where `ps` cannot show it; /dev/null keeps the registry off .env.
  LEDGER_API_TOKEN="$token" \
    nohup env DOTENV_CONFIG_PATH=/dev/null "${registry_env[@]}" pnpm exec canton-token-forge-registry \
    >"$REGISTRY_LOG" 2>&1 &
  echo $! >"$REGISTRY_PID"

  # /readyz reads the ledger end, so a 2xx proves the registry reaches the participant.
  wait_for_ok 60 "http://localhost:$port/readyz" \
    || die "The token registry is not ready on $port (log: $REGISTRY_LOG)."
  log "Token registry ready on http://localhost:$port (log: $REGISTRY_LOG)"
}

case "${1:-}" in
  start) start_registry ;;
  stop) stop_registry ;;
  *) die "Usage: scripts/registry.sh start|stop" ;;
esac
