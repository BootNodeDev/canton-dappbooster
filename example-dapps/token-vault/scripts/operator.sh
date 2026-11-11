#!/usr/bin/env bash
#
# operator.sh start|stop: the vault operator, run through `stack:up` and `stack:down`.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${DEV_STACK_RUN_DIR:-$APP_DIR/.dev-stack}"
OPERATOR="$APP_DIR/scripts/vault-operator.mjs"
OPERATOR_LOG="$RUN_DIR/vault-operator.log"
PID_FILE="$RUN_DIR/vault-operator.pid"

log() { printf '==> %s\n' "$*"; }
die() {
  printf '[x] %s\n' "$*" >&2
  exit 1
}

wait_until() { # wait_until <seconds> <command…>
  local deadline=$((SECONDS + $1))
  shift
  until "$@"; do
    [ "$SECONDS" -lt "$deadline" ] || return 1
    sleep 1
  done
}

# By pidfile, and by this app's own script path for one whose pidfile is gone.
operator_pids() {
  local pid
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE")"
    if ps -p "$pid" -o args= 2>/dev/null | grep -qF "$OPERATOR"; then
      printf '%s\n' "$pid"
    fi
  fi
  pgrep -f -- "$OPERATOR" 2>/dev/null || true
}

no_operator() { [ -z "$(operator_pids)" ]; }

stop_operator() {
  local pid
  for pid in $(operator_pids | sort -u); do
    log "Stopping the vault operator (pid $pid)"
    kill "$pid" 2>/dev/null || true
  done
  wait_until 10 no_operator || die "The vault operator is still running after 10s; stop it, then run 'up' again."
  rm -f "$PID_FILE"
}

operator_ready() { grep -q 'polling every' "$OPERATOR_LOG" 2>/dev/null; }

operator_alive() { ps -p "$(cat "$PID_FILE")" >/dev/null 2>&1; }

start_operator() {
  # Restarted rather than reused: a leftover one discovered the vault before this run's bootstrap.
  stop_operator
  mkdir -p "$RUN_DIR"
  log "Starting the vault operator"
  nohup node "$OPERATOR" >"$OPERATOR_LOG" 2>&1 &
  printf '%s\n' "$!" >"$PID_FILE"

  local deadline=$((SECONDS + 60))
  until operator_ready; do
    operator_alive || die "The vault operator exited (log: $OPERATOR_LOG)."
    [ "$SECONDS" -lt "$deadline" ] || die "The vault operator found no vault within 60s (log: $OPERATOR_LOG)."
    sleep 1
  done
  log "Vault operator polling (log: $OPERATOR_LOG)"
}

case "${1:-}" in
  start) start_operator ;;
  stop) stop_operator ;;
  *) die "Usage: scripts/operator.sh start|stop" ;;
esac
