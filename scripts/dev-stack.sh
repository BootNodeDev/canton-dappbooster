#!/usr/bin/env bash
#
# dev-stack.sh — start or stop the local Canton dApp stack.
#
# The Carpincho wallet lives in its own repository
# (github.com/BootNodeDev/carpincho-wallet) and is run from there. This script
# brings up everything the wallet talks to: the Splice LocalNet containers,
# wallet-service, and the dApp frontend.
#
# Docker lifecycle is managed separately from the stack: start/quit Docker with
# `docker-up` / `docker-down` (macOS only), the Docker app, or your CLI. `up`
# and `down` assume Docker is already running and never start or quit it.
#
# Usage:
#   ./scripts/dev-stack.sh             # interactive arrow-key menu (default)
#   ./scripts/dev-stack.sh menu        # same as above
#   ./scripts/dev-stack.sh install     # install + link every workspace from the repo root (pnpm install)
#   ./scripts/dev-stack.sh docker-up   # macOS only: launch Docker Desktop, wait for the daemon
#   ./scripts/dev-stack.sh up          # start the stack (containers, DAR, dApp dev server)
#   ./scripts/dev-stack.sh down        # stop the dApp dev server and tear down containers
#   ./scripts/dev-stack.sh docker-down # macOS only: quit Docker Desktop
#   ./scripts/dev-stack.sh status      # show what is currently running
#   ./scripts/dev-stack.sh mock-up     # mock-only: mocked wallet-service (no Docker)
#   ./scripts/dev-stack.sh mock-down   # stop the mocked wallet-service only
#
# What `up` starts (in order; Docker must already be running):
#   1. Splice LocalNet bundle + wallet-service containers (pnpm run canton:up)
#   2. Health checks (canton + wallet-service)
#   3. Builds and deploys the Daml DAR (name derived from daml.yaml)
#   4. dApp frontend dev server     -> http://localhost:3012  (background)
#
# `down` reverses 4 (kills the dApp dev server) and tears down the containers.

set -euo pipefail

# Resolve repo root from this script's location so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RUN_DIR="${TMPDIR:-/tmp}/cn-dev-stack"
DAPP_LOG="$RUN_DIR/dapp-dev.log"
DAPP_PID="$RUN_DIR/dapp-dev.pid"
MOCK_WS_LOG="$RUN_DIR/mock-wallet-service.log"
MOCK_WS_PID="$RUN_DIR/mock-wallet-service.pid"

# Derive the DAR name from daml.yaml so renames/bumps need no edits here.
DAML_DIR="dapp/daml"
DAR_NAME="$(awk '/^name:/{n=$2} /^version:/{v=$2} END{print n"-"v".dar"}' "$DAML_DIR/daml.yaml")"
DAR_PATH="$DAML_DIR/.daml/dist/$DAR_NAME"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

case "$DAR_NAME" in
  -.dar | -*.dar | *-.dar) die "Could not derive DAR name from $DAML_DIR/daml.yaml (got '$DAR_NAME')" ;;
esac

wait_for() { # wait_for <seconds> <logfile> <grep-pattern> <label>
  local timeout="$1" file="$2" pattern="$3" label="$4" i
  for ((i = 0; i < timeout; i++)); do
    if [ -f "$file" ] && grep -qiE "$pattern" "$file" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  warn "$label did not report ready within ${timeout}s (check $file)"
  return 1
}

install_deps() { # one root pnpm install links every workspace
  log "Installing workspace dependencies (root pnpm install)..."
  pnpm install
  log "Workspaces installed and linked."
}

docker_up() { # macOS only — launch Docker Desktop and wait for the daemon
  if [ "$(uname -s)" != "Darwin" ]; then
    warn "docker-up is macOS only. Start Docker with your platform's tools, then run 'up'."
    return 0
  fi
  if docker info >/dev/null 2>&1; then
    log "Docker daemon already running."
    return 0
  fi
  log "Starting Docker Desktop and waiting for the daemon..."
  open -a Docker
  local i
  for ((i = 0; i < 120; i++)); do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker info >/dev/null 2>&1 || die "Docker daemon did not come up within 120s"
  log "Docker daemon is ready."
}

docker_down() { # macOS only — quit Docker Desktop
  if [ "$(uname -s)" != "Darwin" ]; then
    warn "docker-down is macOS only. Stop Docker with your platform's tools."
    return 0
  fi
  log "Quitting Docker Desktop..."
  osascript -e 'quit app "Docker Desktop"' 2>/dev/null \
    || osascript -e 'quit app "Docker"' 2>/dev/null \
    || warn "Could not quit Docker Desktop (already closed?)"
}

up() {
  mkdir -p "$RUN_DIR"

  # A fresh clone may have no deps yet; one root install links every workspace.
  if [ ! -d node_modules ]; then
    install_deps
  fi

  # Docker must already be running (start it via 'docker-up', the app, or your CLI).
  docker info >/dev/null 2>&1 \
    || die "Docker daemon not reachable. Start Docker first (menu: docker-up, the Docker app, or your CLI), then run 'up'."

  # canton .env (README step) — create from example if missing.
  if [ ! -f canton-barebones/.env ]; then
    log "Creating canton-barebones/.env from .env.example"
    cp canton-barebones/.env.example canton-barebones/.env
  fi

  # Splice LocalNet requires CANTON_BACKEND_TOKEN unless wallet-service runs in
  # mock mode; splice-common.sh's require_backend_token hard-fails without it.
  if [ "${WALLET_SERVICE_MOCK:-}" = "1" ] \
    || grep -qE '^[[:space:]]*WALLET_SERVICE_MOCK=1' canton-barebones/.env; then
    log "WALLET_SERVICE_MOCK=1 — skipping CANTON_BACKEND_TOKEN."
  elif grep -qE '^[[:space:]]*CANTON_BACKEND_TOKEN=.+' canton-barebones/.env; then
    log "CANTON_BACKEND_TOKEN already set in canton-barebones/.env."
  else
    log "Minting CANTON_BACKEND_TOKEN for the LocalNet wallet-service..."
    local token_line tmp_env
    # mint-token.mjs prints a full 'CANTON_BACKEND_TOKEN=<jwt>' line; capture it
    # without echoing the secret to the terminal.
    token_line="$(pnpm run canton:token -- ledger-api-user 2>/dev/null \
      | grep -m1 -E '^[[:space:]]*CANTON_BACKEND_TOKEN=' \
      | sed -E 's/^[[:space:]]*//')" || true
    [ -n "$token_line" ] \
      || die "Failed to mint CANTON_BACKEND_TOKEN (pnpm run canton:token -- ledger-api-user). Check CANTON_AUTH_SECRET / CANTON_AUTH_AUDIENCE in canton-barebones/.env."
    # Replace any existing (empty) entry, else append — never print the token.
    tmp_env="$(mktemp)"
    grep -vE '^[[:space:]]*CANTON_BACKEND_TOKEN=' canton-barebones/.env >"$tmp_env" || true
    printf '%s\n' "$token_line" >>"$tmp_env"
    mv "$tmp_env" canton-barebones/.env
    log "Wrote CANTON_BACKEND_TOKEN to canton-barebones/.env."
  fi

  # 1. Containers
  log "Bringing up the Splice LocalNet bundle + wallet-service containers..."
  pnpm run canton:up

  # 2. Health
  log "Checking Canton health..."
  pnpm run canton:health
  log "Checking wallet-service health..."
  pnpm run wallet-service:health && echo

  # 3. Build + deploy DAR
  log "Building the $DAR_NAME DAR..."
  pnpm run build-dar -- "$DAML_DIR"
  log "Deploying the DAR to Canton..."
  pnpm run deploy-dar -- "$DAR_PATH"

  # 4. dApp frontend dev server (3012)
  if lsof -nP -iTCP:3012 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3012 already in use; skipping dApp dev server."
  else
    log "Starting dApp frontend dev server -> http://localhost:3012"
    nohup pnpm run app:dev >"$DAPP_LOG" 2>&1 &
    echo $! >"$DAPP_PID"
    wait_for 60 "$DAPP_LOG" "ready in|localhost:3012" "dApp dev server" || true
  fi

  echo
  log "Stack is up:"
  cat <<EOF
   wallet-service          http://localhost:3010
   dApp frontend           http://localhost:3012   (log: $DAPP_LOG)
   app-user wallet UI      http://wallet.localhost:2000
   app-user JSON API       http://localhost:2975
   app-user Ledger API     grpc://localhost:2901
   app-user Validator API  http://localhost:2903
   Scan UI                 http://scan.localhost:4000
   SV UI                   http://sv.localhost:4000
   PostgreSQL              localhost:5432
EOF
  echo "   Run the Carpincho wallet from its own repo (github.com/BootNodeDev/carpincho-wallet) at http://localhost:3011"
}

stop_pidfile() { # stop_pidfile <pidfile> <label>
  local pidfile="$1" label="$2" pid
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping $label (pid $pid)"
      # kill the dev-server process group so child vite dies too
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

down() {
  # 1. Dev servers
  stop_pidfile "$DAPP_PID" "dApp dev server"
  # Belt-and-suspenders: kill any stray vite on our port.
  pkill -f "vite --host localhost --port 3012" 2>/dev/null || true

  # 2. Containers (only if the daemon is reachable). Docker itself is left
  # running — quit it separately with 'docker-down', the app, or your CLI.
  if docker info >/dev/null 2>&1; then
    log "Tearing down Canton containers..."
    pnpm run canton:down || warn "canton:down reported an error"
  else
    warn "Docker daemon not reachable; skipping canton:down"
  fi

  echo
  log "Dev-server ports 3010-3012:"
  if lsof -nP -iTCP:3010-3012 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010-3012 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (all free)"
  fi
  log "LocalNet containers:"
  docker ps --filter "name=canton-barebones" --format '   {{.Names}}  {{.Status}}' 2>/dev/null \
    || echo "   (docker daemon not running)"
}

wait_http() { # wait_http <seconds> <url> <label>
  local timeout="$1" url="$2" label="$3" i
  for ((i = 0; i < timeout; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  warn "$label did not answer at $url within ${timeout}s"
  return 1
}

mock_up() {
  mkdir -p "$RUN_DIR"

  # Mock mode needs no Docker — it short-circuits the Canton SDK. A fresh clone
  # may have no deps yet; one root install links every workspace, including the
  # wallet-service started below.
  if [ ! -d node_modules ]; then
    install_deps
  fi

  # Mocked data server (wallet-service in MOCK MODE) -> http://localhost:3010
  if lsof -nP -iTCP:3010 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3010 already in use; skipping mocked wallet-service."
  else
    log "Starting mocked wallet-service (MOCK MODE) -> http://localhost:3010"
    WALLET_SERVICE_MOCK=1 nohup pnpm run wallet-service:dev >"$MOCK_WS_LOG" 2>&1 &
    echo $! >"$MOCK_WS_PID"
    wait_http 60 "http://localhost:3010/health" "mocked wallet-service" || true
  fi

  echo
  log "Mock stack is up:"
  cat <<EOF
   mocked wallet-service  http://localhost:3010   (log: $MOCK_WS_LOG)
EOF
  echo "   No Docker / Canton / dApp frontend in this mode. Point the Carpincho wallet"
  echo "   (from its own repo) at http://localhost:3010. Stop with: $0 mock-down"
}

mock_down() {
  stop_pidfile "$MOCK_WS_PID" "mocked wallet-service"
  # Belt-and-suspenders for stray processes on our port.
  pkill -f "WALLET_SERVICE_MOCK" 2>/dev/null || true
  pkill -f "tsx watch src/server.ts" 2>/dev/null || true

  echo
  log "Mock stack is down. Port 3010:"
  if lsof -nP -iTCP:3010 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (free)"
  fi
}

menu() {
  if [ ! -t 0 ] || [ ! -t 1 ]; then
    die "The menu needs an interactive terminal. Run a subcommand directly instead."
  fi

  # Display label per item; `keys` is the matching action dispatched on select.
  local keys=(install docker-up docker-down up down mock-up mock-down quit)
  local labels=("Install" "Docker up" "Docker down" "Stack up" "Stack down" "Mock up" "Mock down" "Quit")
  local descs=(
    "install + link every workspace"
    "start Docker Desktop (macOS)"
    "quit Docker Desktop (macOS)"
    "start containers, dApp dev server, build DAR"
    "stop dApp dev server + tear down containers"
    "start mocked wallet-service (no Docker)"
    "stop the mocked wallet-service"
    "exit"
  )
  local n=${#keys[@]} sel=0 key rest i num choice

  tput civis 2>/dev/null || true                       # hide cursor
  trap 'tput cnorm 2>/dev/null || true' EXIT INT TERM  # restore on exit

  while true; do
    clear
    printf '\n  \033[1mCanton dApp dev stack\033[0m\n\n'
    for i in "${!keys[@]}"; do
      num=$((i + 1))
      if [ "$i" -eq "$sel" ]; then
        printf '  \033[7m  %d- %-16s %s  \033[0m\n' "$num" "${labels[$i]}" "${descs[$i]}"
      else
        printf '     %d- %-16s %s\n' "$num" "${labels[$i]}" "${descs[$i]}"
      fi
    done
    printf '\n  \033[2m[1-%d] jump    [up/down or j/k] move    [enter] select    [q] quit\033[0m\n' "$n"

    IFS= read -rsn1 key
    case "$key" in
      $'\033')                       # escape sequence (arrow keys)
        IFS= read -rsn2 rest
        case "$rest" in
          '[A') sel=$(((sel - 1 + n) % n)) ;;
          '[B') sel=$(((sel + 1) % n)) ;;
        esac
        continue ;;
      k) sel=$(((sel - 1 + n) % n)); continue ;;
      j) sel=$(((sel + 1) % n)); continue ;;
      [1-9])                          # number key jumps the highlight
        [ "$key" -le "$n" ] && sel=$((key - 1))
        continue ;;
      q | Q) break ;;
      '') ;;                          # Enter -> dispatch below
      *) continue ;;
    esac

    choice="${keys[$sel]}"
    [ "$choice" = "quit" ] && break

    tput cnorm 2>/dev/null || true
    clear
    printf '\n'
    # Run in a subshell so a failing action returns to the menu instead of
    # killing the whole script under `set -e`.
    case "$choice" in
      install)     ( install_deps ) || warn "install did not finish cleanly" ;;
      docker-up)   ( docker_up ) || warn "docker-up did not finish cleanly" ;;
      docker-down) ( docker_down ) || warn "docker-down did not finish cleanly" ;;
      up)          ( up ) || warn "up did not finish cleanly (see output above)" ;;
      down)        ( down ) || warn "down did not finish cleanly" ;;
      mock-up)     ( mock_up ) || warn "mock-up did not finish cleanly" ;;
      mock-down)   ( mock_down ) || warn "mock-down did not finish cleanly" ;;
    esac
    printf '\n  \033[2mPress Enter to return to the menu...\033[0m'
    read -r _ || true
    tput civis 2>/dev/null || true
  done

  tput cnorm 2>/dev/null || true
  clear
}

status() {
  log "LocalNet containers (canton-barebones compose project):"
  docker ps --filter "name=canton-barebones" --format '   {{.Names}}  {{.Status}}' 2>/dev/null \
    || echo "   (docker daemon not running)"
  log "Dev-server ports 3010-3012:"
  if lsof -nP -iTCP:3010-3012 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010-3012 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (none)"
  fi
  echo "   Backend health: run 'pnpm run canton:health'"
}

case "${1:-menu}" in
  menu)        menu ;;
  install)     install_deps ;;
  docker-up)   docker_up ;;
  up)          up ;;
  down)        down ;;
  docker-down) docker_down ;;
  status)      status ;;
  mock-up)     mock_up ;;
  mock-down)   mock_down ;;
  *)           die "Usage: $0 {menu|install|docker-up|up|down|docker-down|status|mock-up|mock-down}" ;;
esac
