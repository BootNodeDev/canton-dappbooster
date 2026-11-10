#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${DEV_STACK_RUN_DIR:-$APP_DIR/.dev-stack}"
SERVER_LOG="$RUN_DIR/server.log"
SERVER_ENTRY="$APP_DIR/server/src/index.ts"
COMPOSE=(docker compose -f "$APP_DIR/server/compose.yaml")

log() { printf '==> %s\n' "$*"; }
die() {
  printf '[x] %s\n' "$*" >&2
  exit 1
}

# Read through server/src/env.ts, so the script and the server can never disagree on the port.
server_port() {
  node -e "import('$APP_DIR/server/src/env.ts').then((env) => process.stdout.write(String(env.PORT)))"
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

# Matched on this app's entry path too, so another service on the port is left alone.
stop_server() {
  local pid
  for pid in $(lsof -t -nP -iTCP:"$(server_port)" -sTCP:LISTEN 2>/dev/null); do
    if ps -p "$pid" -o args= 2>/dev/null | grep -qF "$SERVER_ENTRY"; then
      log "Stopping the wallet-less server (pid $pid)"
      kill "$pid" 2>/dev/null || true
    fi
  done
}

start() {
  local port
  port="$(server_port)"

  log "Starting Postgres (server/compose.yaml)"
  "${COMPOSE[@]}" up -d --wait || die "Postgres did not come up; is port 5433 free?"

  # Restarted rather than reused: a leftover one started before this run's bootstrap.
  if ! port_free "$port"; then
    log "Port $port in use; restarting the wallet-less server."
    stop_server
    wait_until 20 port_free "$port" || die "Port $port is still held after 20s; free it, then run 'up' again."
  fi

  mkdir -p "$RUN_DIR"
  log "Starting the wallet-less server -> http://localhost:$port"
  nohup node "$SERVER_ENTRY" >"$SERVER_LOG" 2>&1 &

  wait_until 60 curl -fs -o /dev/null -m 2 "http://localhost:$port/api/status" \
    || die "The wallet-less server is not answering on $port (log: $SERVER_LOG)."
  log "Server ready: $(curl -fs -m 2 "http://localhost:$port/api/status") (log: $SERVER_LOG)"
}

stop() {
  stop_server
  if docker info >/dev/null 2>&1; then
    log "Stopping Postgres (volume kept)"
    # No -v: accounts survive a down and up, as the ledger does.
    "${COMPOSE[@]}" down
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  *) die "Usage: scripts/server.sh start|stop" ;;
esac
