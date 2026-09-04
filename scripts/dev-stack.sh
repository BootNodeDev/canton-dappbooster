#!/usr/bin/env bash
#
# dev-stack.sh — start or stop the local Canton dApp stack.
#
# The same sequence as README.md, in one command. The CIP-0103 browser wallet
# lives outside this repository and is run from there; this script brings up
# everything the wallet talks to: the LocalNet, wallet-service and the dApp.
#
# The LocalNet belongs to @bootnodedev/canton-barebones, pinned in the root
# package.json and driven from the directory holding its config. `up` scaffolds that
# directory itself, at the gitignored ./.canton-localnet; point elsewhere with a
# second argument or with CANTON_LOCALNET_DIR, in that order of precedence.
#
# Docker lifecycle is managed separately from the stack: start/quit Docker with
# `docker-up` / `docker-down` (macOS only), the Docker app, or your CLI. `up`
# and `down` assume Docker is already running and never start or quit it.
#
# Usage:
#   ./scripts/dev-stack.sh [dir]       # interactive arrow-key menu (default)
#   ./scripts/dev-stack.sh menu [dir]  # same as above
#   ./scripts/dev-stack.sh install     # install + link every workspace from the repo root (pnpm install)
#   ./scripts/dev-stack.sh docker-up   # macOS only: launch Docker Desktop, wait for the daemon
#   ./scripts/dev-stack.sh up [dir]    # start the stack (LocalNet, DARs, wallet-service, bootstrap, registry, dApp)
#   ./scripts/dev-stack.sh down [dir]  # stop the dApp dev server, the token registry and wallet-service, stop the LocalNet
#   ./scripts/dev-stack.sh docker-down # macOS only: quit Docker Desktop
#   ./scripts/dev-stack.sh status [dir] # show what is currently running
#
# [dir] is the LocalNet directory, and every menu action uses it.
#
# What `up` starts (in order; Docker must already be running):
#   1. LocalNet containers           (canton-barebones start)
#   2. Builds and deploys the amulet-vesting DAR, then the two vendored DARs
#   3. wallet-service                -> http://localhost:3010  (background)
#   4. Bootstraps the vesting operator, its factory and the DBT instrument
#   5. Token registry                -> http://localhost:3013  (background)
#   6. dApp frontend dev server      -> http://localhost:3012  (background)
#
# `down` reverses 6, 5 and 3 (kills the background processes) and stops the
# LocalNet, keeping its volumes.

set -euo pipefail

# Resolve repo root from this script's location so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RUN_DIR="${TMPDIR:-/tmp}/cn-dev-stack"
DAPP_LOG="$RUN_DIR/dapp-dev.log"
DAPP_PID="$RUN_DIR/dapp-dev.pid"
WS_LOG="$RUN_DIR/wallet-service.log"
WS_PID="$RUN_DIR/wallet-service.pid"
REGISTRY_LOG="$RUN_DIR/registry.log"
REGISTRY_PID="$RUN_DIR/registry.pid"
BOOTSTRAP_LOG="$RUN_DIR/bootstrap.log"

# The registry variables bootstrap prints and this script reads back. LEDGER_API_TOKEN
# is deliberately absent: bootstrap never sees the bearer, so it is supplied here from
# .env instead. scripts/bootstrap-vesting.test.mjs holds the two lists together.
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

# Resolved in up(), once ./.env has been read.
JSON_API_URL=""

# Derive the DAR name from daml.yaml so renames and version bumps need no edit here.
DAML_DIR="dapp/daml"
DAR_NAME="$(awk '/^name:/{n=$2} /^version:/{v=$2} END{print n"-"v".dar"}' "$DAML_DIR/daml.yaml")"
DAR_PATH="$DAML_DIR/.daml/dist/$DAR_NAME"

# Vendored binaries, not built here. canton-token-forge goes first: vesting
# data-depends on it. See vendor/PROVENANCE.md.
VENDOR_DARS=(vendor/canton-token-forge.dar vendor/vesting.dar)

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# A half-parsed daml.yaml yields a name like '-.dar', which would deploy nothing.
case "$DAR_NAME" in
  -.dar | -*.dar | *-.dar) die "Could not derive DAR name from $DAML_DIR/daml.yaml (got '$DAR_NAME')" ;;
esac

ACTION="${1:-menu}"
LOCALNET_ARG="${2:-}"

# A bare `dev-stack.sh <dir>` opens the menu against that directory, which is how the stack
# is normally driven. Only a path-shaped first argument is read that way, so a mistyped
# subcommand still fails instead of silently opening the menu.
case "$ACTION" in
  menu | install | docker-up | docker-down | up | down | status) ;;
  /* | ./* | ../* | ~*) LOCALNET_ARG="$ACTION"; ACTION=menu ;;
  *)
    [ -d "$ACTION" ] \
      || die "Usage: $0 {menu|install|docker-up|up|down|docker-down|status} [localnet-dir]"
    LOCALNET_ARG="$ACTION"
    ACTION=menu
    ;;
esac

LOCALNET_DIR="${LOCALNET_ARG:-${CANTON_LOCALNET_DIR:-$ROOT_DIR/.canton-localnet}}"
# A quoted '~/dir' reaches us unexpanded, and bash never expands a tilde held in a variable.
LOCALNET_DIR="${LOCALNET_DIR/#\~/$HOME}"

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

# `any` waits only out curl's 000 ("could not connect"), so an auth rejection from a
# participant still counts as up; `ok` demands 2xx, which is what tells our own service
# apart from something unrelated holding the same port. Budgets are wall-clock, not
# iterations: a socket that accepts TCP without answering costs the full -m per probe.
wait_for_http() { # wait_for_http <seconds> <url> <label> <any|ok>
  local timeout="$1" url="$2" label="$3" mode="$4" deadline code
  deadline=$((SECONDS + timeout))
  while [ "$SECONDS" -lt "$deadline" ]; do
    code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$url" 2>/dev/null || true)"
    case "$mode" in
      any) [ "$code" != "000" ] && return 0 ;;
      ok) [ "${code:0:1}" = 2 ] && return 0 ;;
    esac
    sleep 1
  done
  warn "$label did not answer at $url within ${timeout}s"
  return 1
}

# `kill` returns before the process has released its socket, so a restart needs this
# between the stop and the next bind.
wait_for_port_free() { # wait_for_port_free <seconds> <port>
  local timeout="$1" port="$2" deadline
  deadline=$((SECONDS + timeout))
  while [ "$SECONDS" -lt "$deadline" ]; do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || return 0
    sleep 1
  done
  return 1
}

# Returns non-zero rather than exiting, so `down` still stops the host processes and
# `status` still prints the ports when the LocalNet itself is unreachable.
localnet() { # localnet <start|stop|reset|status|logs> [args…]
  # The CLI reads canton-barebones.config.json from its own cwd, so it runs in the LocalNet
  # directory; the binary is spelled by path because `pnpm exec` resolves from cwd and finds
  # nothing once that directory sits outside the workspace.
  ( cd "$LOCALNET_DIR" && "$ROOT_DIR/node_modules/.bin/canton-barebones" "$@" )
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

# wallet-service ships from BootNodeDev/canton-wallet-service and runs on the host.
# It loads dotenv from its working directory, which is the repo root here, so the
# LocalNet URLs its container used to receive come from ./.env.
start_wallet_service() {
  if lsof -nP -iTCP:3010 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3010 already in use; skipping wallet-service."
  else
    log "Starting wallet-service -> http://localhost:3010"
    nohup pnpm exec canton-wallet-service >"$WS_LOG" 2>&1 &
    echo $! >"$WS_PID"
  fi

  # A 2xx /health is the only gate: it proves readiness on its own, it also catches
  # something unrelated holding 3010 (bootstrap goes through /rpc and would fail
  # obscurely), and it does not pin us to a log string another repo owns.
  wait_for_http 60 "http://localhost:3010/health" "wallet-service" ok \
    || die "wallet-service is not answering on 3010 (log: $WS_LOG)."
}

# Read one KEY=value line out of the block bootstrap printed, dropping the single
# quotes the template ids carry for the paste-into-a-.env case. Keys come from
# REGISTRY_ENV_KEYS and nowhere else, so the sed pattern is never caller data.
read_bootstrap_env() { # read_bootstrap_env <key>
  local value
  value="$(sed -n "s/^$1=//p" "$BOOTSTRAP_LOG" | tail -n1)"
  value="${value#\'}"
  printf '%s' "${value%\'}"
}

# The registry ships from BootNodeDev/canton-token-forge as a git dependency and runs
# on the host. It is read-only and takes the same bearer the DAR upload does, so no
# new secret is introduced. It also loads dotenv from its cwd, which is the repo root:
# harmless, because everything below is passed through the environment and dotenv
# never overrides a variable that is already set.
start_registry() {
  local key value port
  local -a registry_env=()
  for key in "${REGISTRY_ENV_KEYS[@]}"; do
    value="$(read_bootstrap_env "$key")"
    [ -n "$value" ] || die "bootstrap printed no $key; cannot configure the registry (log: $BOOTSTRAP_LOG)"
    registry_env+=("$key=$value")
  done
  port="$(read_bootstrap_env PORT)"

  # Restarted rather than skipped: bootstrap mints a fresh admin party each run, so a
  # leftover registry serves a superseded instrument and still answers /readyz.
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    log "Port $port in use; restarting the token registry."
    stop_pidfile "$REGISTRY_PID" "token registry"
    pkill -f "canton-token-forge/registry/dist" 2>/dev/null || true
    wait_for_port_free 10 "$port" \
      || die "Port $port is held by something other than the token registry; free it, then run 'up'."
  fi

  log "Starting the token registry -> http://localhost:$port"
  # The bearer goes in the environment rather than through `env`'s argv, where `ps`
  # would show it to every local user for the life of the process.
  LEDGER_API_TOKEN="$CANTON_BACKEND_TOKEN" \
    nohup env "${registry_env[@]}" pnpm exec canton-token-forge-registry >"$REGISTRY_LOG" 2>&1 &
  echo $! >"$REGISTRY_PID"

  # /readyz rather than /healthz: it reads the ledger end, so a 2xx proves the
  # registry can reach the participant and not merely that something holds the port.
  wait_for_http 60 "http://localhost:$port/readyz" "token registry" ok \
    || die "The token registry is not ready on $port (log: $REGISTRY_LOG)."
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

  # The DAR build needs dpm; check here so a missing SDK fails before the
  # containers come up rather than after.
  command -v dpm >/dev/null 2>&1 \
    || die "dpm not found on PATH. Install the DAML SDK (3.4.11), then run 'up'."

  # ./.env is wallet-service's whole configuration, the mint recipe and the DAR
  # upload token. Minting is offline, so this needs nothing running.
  [ -f .env ] || { log "Creating .env from .env.example"; cp .env.example .env; }

  # After the copy, because mint-token.mjs reads the recipe from .env; before the source
  # below, or the shell would carry the empty entry .env.example ships with.
  if grep -qE '^[[:space:]]*CANTON_BACKEND_TOKEN=.+' .env; then
    log "CANTON_BACKEND_TOKEN already set in .env."
  else
    log "Minting CANTON_BACKEND_TOKEN for wallet-service..."
    local token_line tmp_env
    # mint-token.mjs prints a full 'CANTON_BACKEND_TOKEN=<jwt>' line; capture it
    # without echoing the secret to the terminal.
    token_line="$(pnpm run mint-token 2>/dev/null \
      | grep -m1 -E '^[[:space:]]*CANTON_BACKEND_TOKEN=' \
      | sed -E 's/^[[:space:]]*//')" || true
    [ -n "$token_line" ] \
      || die "Failed to mint CANTON_BACKEND_TOKEN. Check CANTON_AUTH_SECRET / CANTON_AUTH_AUDIENCE in .env."
    # Replace the existing (empty) entry, else append — never print the token.
    tmp_env="$(mktemp)"
    grep -vE '^[[:space:]]*CANTON_BACKEND_TOKEN=' .env >"$tmp_env" || true
    printf '%s\n' "$token_line" >>"$tmp_env"
    mv "$tmp_env" .env
    log "Wrote CANTON_BACKEND_TOKEN to .env."
  fi

  # Read it here rather than defaulting the URLs again, so the file every other step
  # resolves config from also moves this readiness probe. A caller-exported value wins,
  # matching deploy-dar.sh and mint-token.mjs; nothing is exported, because each step
  # reads .env for itself and only the mint recipe would travel.
  local preset_json_api_url="${CANTON_JSON_API_URL:-}"
  # shellcheck disable=SC1091
  source .env
  JSON_API_URL="${preset_json_api_url:-${CANTON_JSON_API_URL:-http://localhost:2975}}"

  # Nothing about the LocalNet config is committed: it is scaffolded from the pinned
  # tool's own template, and re-scaffolded when that template moves past it.
  log "Preparing the LocalNet config in $LOCALNET_DIR..."
  node scripts/localnet-config.mjs "$LOCALNET_DIR" \
    || die "Could not prepare the LocalNet config in $LOCALNET_DIR."

  # 1. LocalNet. `canton-barebones start` is `docker compose up -d`, so it returns as
  # soon as the containers exist; Splice takes minutes more to answer, and the DAR
  # upload below would die on a refused connection without this wait.
  log "Starting the LocalNet from $LOCALNET_DIR..."
  localnet start || die "LocalNet did not start."
  log "Waiting for the app-user JSON API on $JSON_API_URL..."
  wait_for_http 300 "$JSON_API_URL/v2/version" "app-user JSON API" any \
    || die "The LocalNet is up but its JSON API never answered. Check 'canton-barebones logs' in $LOCALNET_DIR, then run 'up' again."

  # 2. Build + deploy the DAR, which needs the participant but not wallet-service. The build
  # fetches the Splice DARs amulet-vesting data-depends on the first time, and after a Splice bump.
  log "Building the $DAR_NAME DAR..."
  pnpm run build-dar
  log "Deploying $DAR_PATH to Canton..."
  pnpm run deploy-dar -- "$DAR_PATH"
  local dar
  for dar in "${VENDOR_DARS[@]}"; do
    log "Deploying $dar to Canton..."
    pnpm run deploy-dar -- "$dar"
  done

  # 3. wallet-service (3010)
  start_wallet_service

  # 4. Bootstrap, which goes through wallet-service's /rpc. Its stdout is teed rather
  # than swallowed: the registry's whole non-secret configuration is in it, and a
  # manual run still wants to read the block. `set -o pipefail` is on, so a failing
  # bootstrap still fails here.
  # The URL is passed explicitly, which bootstrap's own --env-file loses to: otherwise a
  # caller override moves the upload and the probe but not what the registry points at.
  log "Bootstrapping the vesting operator, factory and DBT instrument..."
  CANTON_JSON_API_URL="$JSON_API_URL" pnpm run bootstrap | tee "$BOOTSTRAP_LOG"

  # 5. Token registry (3013), which needs the admin party bootstrap just created
  start_registry

  # 6. dApp frontend dev server (3012)
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
   wallet-service          http://localhost:3010   (log: $WS_LOG)
   token registry          http://localhost:3013   (log: $REGISTRY_LOG)
   dApp frontend           http://localhost:3012   (log: $DAPP_LOG)
   app-user wallet UI      http://wallet.localhost:2000
   app-user JSON API       $JSON_API_URL
   app-user Ledger API     grpc://localhost:2901
   app-user Validator API  http://localhost:2903
   Scan UI                 http://scan.localhost:4000
   SV UI                   http://sv.localhost:4000
   PostgreSQL              localhost:5432
EOF
  echo "   Run a CIP-0103 browser wallet from its own repo (it serves on http://localhost:3011)"
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
  # 1. Background processes
  stop_pidfile "$DAPP_PID" "dApp dev server"
  # Belt-and-suspenders: kill any stray vite on our port.
  pkill -f "vite --host localhost --port 3012" 2>/dev/null || true
  stop_pidfile "$REGISTRY_PID" "token registry"
  pkill -f "canton-token-forge/registry/dist" 2>/dev/null || true
  stop_pidfile "$WS_PID" "wallet-service"
  pkill -f "canton-wallet-service" 2>/dev/null || true

  # 2. LocalNet (only if the daemon is reachable). Volumes are kept, so the ledger
  # survives; drop them with 'canton-barebones reset'. Docker itself is left
  # running — quit it separately with 'docker-down', the app, or your CLI.
  if docker info >/dev/null 2>&1; then
    log "Stopping the LocalNet..."
    localnet stop || warn "canton-barebones stop reported an error"
  else
    warn "Docker daemon not reachable; skipping the LocalNet stop"
  fi

  echo
  log "Dev-server ports 3010-3013:"
  if lsof -nP -iTCP:3010-3013 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010-3013 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (all free)"
  fi
}

menu() {
  if [ ! -t 0 ] || [ ! -t 1 ]; then
    die "The menu needs an interactive terminal. Run a subcommand directly instead."
  fi

  # Display label per item; `keys` is the matching action dispatched on select.
  local keys=(install docker-up docker-down up down quit)
  local labels=("Install" "Docker up" "Docker down" "Stack up" "Stack down" "Quit")
  local descs=(
    "install + link every workspace"
    "start Docker Desktop (macOS)"
    "quit Docker Desktop (macOS)"
    "start LocalNet, deploy DARs, wallet-service, bootstrap, registry, dApp"
    "stop dApp dev server, token registry, wallet-service, stop the LocalNet"
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
    esac
    printf '\n  \033[2mPress Enter to return to the menu...\033[0m'
    read -r _ || true
    tput civis 2>/dev/null || true
  done

  tput cnorm 2>/dev/null || true
  clear
}

status() {
  log "LocalNet:"
  if docker info >/dev/null 2>&1; then
    localnet status || warn "canton-barebones status reported an error"
  else
    echo "   (docker daemon not running)"
  fi
  log "Dev-server ports 3010-3013:"
  if lsof -nP -iTCP:3010-3013 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010-3013 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (none)"
  fi
}

case "$ACTION" in
  menu)        menu ;;
  install)     install_deps ;;
  docker-up)   docker_up ;;
  up)          up ;;
  down)        down ;;
  docker-down) docker_down ;;
  status)      status ;;
esac
