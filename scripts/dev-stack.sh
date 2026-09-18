#!/usr/bin/env bash
#
# dev-stack.sh — start or stop the local Canton dApp stack.
#
# The same sequence as README.md, in one command: the LocalNet, the DAR, the
# vesting bootstrap, the Wallet Gateway and the dApp.
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
#   ./scripts/dev-stack.sh up [dir]    # start the stack (LocalNet, DAR, bootstrap, gateway, dApp)
#   ./scripts/dev-stack.sh down [dir]  # stop the gateway + the dApp dev server, stop the LocalNet
#   ./scripts/dev-stack.sh docker-down # macOS only: quit Docker Desktop
#   ./scripts/dev-stack.sh status [dir] # show what is currently running
#
# [dir] is the LocalNet directory, and every menu action uses it.
#
# Flags, for `up` only and never both at once:
#   --json    one JSON object per line on stdout, the human log on stderr. A step
#             opens with 'start' and closes with 'ok' or 'error'; the run itself
#             closes with 'done', so the stream never stops without saying why
#   --quiet   only warnings, errors and the closing 'Stack is up:' block
#
# `up` runs numbered steps, ending with the Wallet Gateway on 3030 and the dApp dev server
# on 3012 in the background; the `step` calls in up() are the list. `down` kills both and
# stops the LocalNet, keeping its volumes.

set -euo pipefail

# Resolve repo root from this script's location so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RUN_DIR="${TMPDIR:-/tmp}/cn-dev-stack"
DAPP_LOG="$RUN_DIR/dapp-dev.log"
DAPP_PID="$RUN_DIR/dapp-dev.pid"
GW_LOG="$RUN_DIR/wallet-gateway.log"
GW_PID="$RUN_DIR/wallet-gateway.pid"

# Resolved in up(), once ./.env has been read.
JSON_API_URL=""

# Derive the DAR name from daml.yaml so renames and version bumps need no edit here.
DAML_DIR="dapp/daml"
DAR_NAME="$(awk '/^name:/{n=$2} /^version:/{v=$2} END{print n"-"v".dar"}' "$DAML_DIR/daml.yaml")"
DAR_PATH="$DAML_DIR/.daml/dist/$DAR_NAME"

# Flags are pulled out before the positional arguments, so `up --json <dir>` and
# `up <dir> --json` both work.
JSON_MODE=0
QUIET_MODE=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --json)  JSON_MODE=1 ;;
    --quiet) QUIET_MODE=1 ;;
    *)       ARGS+=("$arg") ;;
  esac
done
set -- ${ARGS[@]+"${ARGS[@]}"}

# Four sinks: fd 3 always shows, fd 5 is the chatter --quiet drops, fd 4 is the machine
# stream, and fd 1 is what child processes inherit. --json moves every human byte to
# stderr so nothing but JSON reaches stdout; --quiet drops the child output instead.
exec 3>&1 4>&1
if [ "$JSON_MODE" = 1 ]; then exec 3>&2 1>&2; fi
exec 5>&3
if [ "$QUIET_MODE" = 1 ]; then exec 5>/dev/null 1>/dev/null; fi

if [ -t 3 ]; then
  HUMAN_TTY=1
  P_STEP=$'\033[1;36m==>\033[0m' P_WARN=$'\033[1;33m[!]\033[0m' P_ERR=$'\033[1;31m[x]\033[0m'
else
  HUMAN_TTY=0
  P_STEP='==>' P_WARN='[!]' P_ERR='[x]'
fi

log()  { printf '%s %s\n' "$P_STEP" "$*" >&5; }
say()  { printf '%s %s\n' "$P_STEP" "$*" >&3; }
warn() { printf '%s %s\n' "$P_WARN" "$*" >&3; }
# The one human line outside the fd scheme: an error belongs on stderr in every mode.
die()  { json_event error "$*"; printf '%s %s\n' "$P_ERR" "$*" >&2; exit 1; }

# Keep in step with the `step` calls in up(), which are the list.
STEP_TOTAL=10
STEP_INDEX=0
STEP_NAME=stack
STEP_START=$SECONDS

json_event() { # json_event <status> [message]
  [ "$JSON_MODE" = 1 ] || return 0
  local message
  printf '{"step":"%s","index":%d,"total":%d,"status":"%s","elapsed":%d' \
    "$STEP_NAME" "$STEP_INDEX" "$STEP_TOTAL" "$1" "$((SECONDS - STEP_START))" >&4
  if [ -n "${2:-}" ]; then
    message="${2//\\/\\\\}"
    printf ',"message":"%s"' "${message//\"/\\\"}" >&4
  fi
  printf '}\n' >&4
}

step() { # step <name> <human text>
  [ "$STEP_INDEX" -eq 0 ] || json_event ok
  STEP_INDEX=$((STEP_INDEX + 1))
  STEP_NAME="$1"
  STEP_START=$SECONDS
  log "[$STEP_INDEX/$STEP_TOTAL] $2"
  json_event start
}

# A budgeted wait looks the same as a hang, so it counts out loud. On a terminal the
# counter rewrites one line; piped, it prints every 30s so the log stays readable.
TICK_LAST=0

tick() { # tick <label> <elapsed> <timeout>
  if [ "$HUMAN_TTY" = 1 ]; then
    printf '\r    %s %ds / %ds' "$1" "$2" "$3" >&5
  # Measured against the last line printed, never against divisibility: a probe that
  # costs several seconds skips over whichever multiples it likes.
  elif [ "$(($2 - TICK_LAST))" -ge 30 ]; then
    TICK_LAST="$2"
    printf '    %s %ds / %ds\n' "$1" "$2" "$3" >&5
  fi
}

tick_end() {
  TICK_LAST=0
  if [ "$HUMAN_TTY" = 1 ]; then printf '\r\033[2K' >&5; fi
}

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

if [ "$JSON_MODE" = 1 ] || [ "$QUIET_MODE" = 1 ]; then
  [ "$ACTION" = up ] || die "--json and --quiet only apply to 'up'."
  if [ "$JSON_MODE$QUIET_MODE" = 11 ]; then
    die "--json and --quiet cannot be combined; --json already keeps the human log off stdout."
  fi
fi

LOCALNET_DIR="${LOCALNET_ARG:-${CANTON_LOCALNET_DIR:-$ROOT_DIR/.canton-localnet}}"
# A quoted '~/dir' reaches us unexpanded, and bash never expands a tilde held in a variable.
LOCALNET_DIR="${LOCALNET_DIR/#\~/$HOME}"

wait_for() { # wait_for <seconds> <logfile> <grep-pattern> <label>
  local timeout="$1" file="$2" pattern="$3" label="$4" i
  for ((i = 0; i < timeout; i++)); do
    if [ -f "$file" ] && grep -qiE "$pattern" "$file" 2>/dev/null; then
      tick_end
      return 0
    fi
    tick "$label" "$i" "$timeout"
    sleep 1
  done
  tick_end
  warn "$label did not report ready within ${timeout}s (check $file)"
  return 1
}

# `any` waits only out curl's 000 ("could not connect"), so an auth rejection from a
# participant still counts as up; `ok` demands 2xx, which is what tells our own service
# apart from something unrelated holding the same port. Budgets are wall-clock, not
# iterations: a socket that accepts TCP without answering costs the full -m per probe.
wait_for_http() { # wait_for_http <seconds> <url> <label> <any|ok>
  local timeout="$1" url="$2" label="$3" mode="$4" start deadline code
  start=$SECONDS
  deadline=$((start + timeout))
  while [ "$SECONDS" -lt "$deadline" ]; do
    code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$url" 2>/dev/null || true)"
    case "$mode" in
      any) [ "$code" != "000" ] ;;
      ok) [ "${code:0:1}" = 2 ] ;;
    esac && { tick_end; return 0; }
    tick "$label" "$((SECONDS - start))" "$timeout"
    sleep 1
  done
  tick_end
  warn "$label did not answer at $url within ${timeout}s"
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
  pnpm install || die "pnpm install failed."
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

# The Wallet Gateway ships from canton-network/wallet and runs on the host. Its config
# names the app-user participant, so it needs the LocalNet answering before it starts.
start_wallet_gateway() {
  if lsof -nP -iTCP:3030 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3030 already in use; skipping the Wallet Gateway."
  else
    # 3>&- 4>&- or the two dups above outlive the script in this child, holding a
    # reader's pipe open long after `up` has returned.
    nohup pnpm run wallet-gateway >"$GW_LOG" 2>&1 3>&- 4>&- &
    echo $! >"$GW_PID"
  fi

  # 2xx on the UI root, so something unrelated holding 3030 fails too; the dApp API is POST-only.
  wait_for_http 60 "http://localhost:3030/" "Wallet Gateway" ok \
    || die "The Wallet Gateway is not answering on 3030 (log: $GW_LOG)."
}

up() {
  local stack_start=$SECONDS total
  mkdir -p "$RUN_DIR"

  step preflight "Checking Docker, dpm and the workspace dependencies..."

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

  # ./.env is the mint recipe, the DAR upload token and the bootstrap token.
  # Minting is offline, so this needs nothing running.
  step env "Preparing .env and the participant token..."
  [ -f .env ] || { log "Creating .env from .env.example"; cp .env.example .env; }

  # After the copy, because mint-token.mjs reads the recipe from .env; before the source
  # below, or the shell would carry the empty entry .env.example ships with.
  if grep -qE '^[[:space:]]*CANTON_BACKEND_TOKEN=.+' .env; then
    log "CANTON_BACKEND_TOKEN already set in .env."
  else
    log "Minting CANTON_BACKEND_TOKEN..."
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
  step localnet-config "Preparing the LocalNet config in $LOCALNET_DIR..."
  node scripts/localnet-config.mjs "$LOCALNET_DIR" \
    || die "Could not prepare the LocalNet config in $LOCALNET_DIR."

  # `canton-barebones start` is `docker compose up -d`, so it returns as soon as the
  # containers exist; Splice takes minutes more to answer, and the DAR upload below
  # would die on a refused connection without the wait that follows.
  step localnet "Starting the LocalNet from $LOCALNET_DIR..."
  localnet start || die "LocalNet did not start."

  step json-api "Waiting for the app-user JSON API on $JSON_API_URL..."
  wait_for_http 300 "$JSON_API_URL/v2/version" "app-user JSON API" any \
    || die "The LocalNet is up but its JSON API never answered. Check 'canton-barebones logs' in $LOCALNET_DIR, then run 'up' again."

  # The build fetches the Splice DARs amulet-vesting data-depends on the first time,
  # and after a Splice bump.
  step build-dar "Building the $DAR_NAME DAR..."
  pnpm run build-dar || die "The $DAR_NAME build failed."

  step deploy-dar "Deploying $DAR_PATH to Canton..."
  pnpm run deploy-dar -- "$DAR_PATH" || die "Uploading $DAR_PATH to Canton failed."

  step bootstrap "Bootstrapping the vesting operator and factory..."
  pnpm run bootstrap || die "Bootstrapping the vesting operator and factory failed."

  step wallet-gateway "Starting the Wallet Gateway -> http://localhost:3030"
  start_wallet_gateway

  step dapp "Starting dApp frontend dev server -> http://localhost:3012"
  if lsof -nP -iTCP:3012 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3012 already in use; skipping dApp dev server."
  else
    nohup pnpm run app:dev >"$DAPP_LOG" 2>&1 3>&- 4>&- &
    echo $! >"$DAPP_PID"
    wait_for 60 "$DAPP_LOG" "ready in|localhost:3012" "dApp dev server" || true
  fi

  json_event ok
  total=$((SECONDS - stack_start))
  # The run as a whole, in the shape of a step. 'done' rather than a tenth 'ok', so
  # counting the ok events still counts steps.
  STEP_NAME=stack STEP_START=$stack_start
  json_event done

  # Shown even under --quiet: it is the one thing that run was for.
  printf '\n' >&3
  say "$(printf 'Stack is up in %dm%02ds:' "$((total / 60))" "$((total % 60))")"
  cat >&3 <<EOF
   dApp frontend           http://localhost:3012   (log: $DAPP_LOG)
   Wallet Gateway          http://localhost:3030   (log: $GW_LOG)
   app-user wallet UI      http://wallet.localhost:2000
   app-user JSON API       $JSON_API_URL
   app-user Ledger API     grpc://localhost:2901
   app-user Validator API  http://localhost:2903
   Scan UI                 http://scan.localhost:4000
   SV UI                   http://sv.localhost:4000
   PostgreSQL              localhost:5432
EOF
  echo "   Log in to the Wallet Gateway with client secret 'unsafe', then connect the dApp" >&3
}

stop_pidfile() { # stop_pidfile <pidfile> <label>
  local pidfile="$1" label="$2" pid
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping $label (pid $pid)"
      # pnpm forwards SIGTERM to what it spawned, so one kill reaches vite two levels down.
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

# Catches a listener no pidfile knows about, left by a crashed `up` or a dev server
# started by hand. The cwd match is what keeps another checkout's stack alone.
stop_port() { # stop_port <port> <label>
  local port="$1" label="$2" pid cwd
  for pid in $(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    case "$cwd" in "$ROOT_DIR" | "$ROOT_DIR"/*) ;; *) continue ;; esac
    log "Freeing port $port from a stray $label (pid $pid)"
    kill "$pid" 2>/dev/null || true
  done
}

down() {
  # 1. Background processes
  stop_pidfile "$DAPP_PID" "dApp dev server"
  stop_port 3012 "dApp dev server"
  stop_pidfile "$GW_PID" "Wallet Gateway"
  stop_port 3030 "Wallet Gateway"

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
  log "Dev-server ports 3012 and 3030:"
  if lsof -nP -iTCP:3012 -iTCP:3030 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3012 -iTCP:3030 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
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
    "start LocalNet, deploy DAR, bootstrap, gateway, dApp"
    "stop the gateway + dApp dev server, stop the LocalNet"
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
  log "Dev-server ports 3012 and 3030:"
  if lsof -nP -iTCP:3012 -iTCP:3030 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3012 -iTCP:3030 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
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
