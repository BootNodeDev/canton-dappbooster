#!/usr/bin/env bash
# Runs the CLI and the example dApps from ./.try as if they were published.
#
#   pnpm -C canton-create try          # then follow what it prints
#   pnpm -C canton-create try:clean    # wind down whatever was started, remove .try
set -euo pipefail

PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(dirname "$PKG")"
TRY="$PKG/.try"

clean() {
  if [ ! -d "$TRY" ]; then
    echo "nothing to clean: $TRY does not exist"
    return
  fi
  local project pid cwd
  for project in "$TRY"/*/; do
    [ -f "$project/scripts/dev-stack.sh" ] && [ -d "$project/node_modules" ] || continue
    echo "==> winding down $(basename "$project")"
    (cd "$project" && bash scripts/dev-stack.sh down) || true
    if [ -f "$project/.canton-localnet/canton-barebones.config.json" ]; then
      if docker info >/dev/null 2>&1; then
        (cd "$project/.canton-localnet" && "$project/node_modules/.bin/canton-barebones" reset) || true
      else
        echo "[!] Docker is not running: the LocalNet volumes of $(basename "$project") were not removed"
      fi
    fi
  done
  local real
  real="$(cd "$TRY" && pwd -P)"
  for pid in $(lsof -nP -iTCP -sTCP:LISTEN -t 2>/dev/null | sort -u); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)"
    case "$cwd" in "$real"/*) echo "==> stopping pid $pid ($cwd)"; kill "$pid" 2>/dev/null || true ;; esac
  done
  rm -rf "$TRY"
  echo "removed $TRY"
}

main() {
mkdir -p "$TRY"
find "$TRY" -maxdepth 1 -name '*.tgz' -delete
rm -rf "$TRY/node_modules" "$TRY/package-lock.json"
packed="$(cd "$PKG" && pnpm pack --pack-destination "$TRY" | tail -1)"

# dlx caches an install by its spec string, so a content hash in the name makes every build a new spec.
hash="$(shasum -a 256 "$packed" | cut -c1-8)"
tgz="${packed%.tgz}-$hash.tgz"
mv "$packed" "$tgz"

# npm, not pnpm: a pnpm install in a directory inside the monorepo lands in the root lockfile.
printf '{ "name": "try", "private": true }\n' >"$TRY/package.json"
(cd "$TRY" && npm install --no-audit --no-fund --loglevel=error "$tgz")

# Extracted, not installed: the CLI only copies an example's files, and npm would pull its whole tree.
examples=()
for manifest in "$ROOT"/example-dapps/*/package.json; do
  [ -f "$manifest" ] || continue
  name="$(node -p "require('$manifest').name")"
  example_tgz="$(cd "$(dirname "$manifest")" && pnpm pack --pack-destination "$TRY" | tail -1)"
  mkdir -p "$TRY/node_modules/$name"
  tar -xzf "$example_tgz" -C "$TRY/node_modules/$name" --strip-components=1
  rm "$example_tgz"
  examples+=("${name#@bootnodedev/canton-example-}")
done

# While the scaffold's library range is not on npm, the printed flow skips the install and adds the published libs.
range="$(tar -xzOf "$tgz" package/scaffold/starter/package.json | node -e "process.stdin.on('data',(d)=>console.log(JSON.parse(d).dependencies['@bootnodedev/canton-connect']))")"
published="$(npm view @bootnodedev/canton-connect version 2>/dev/null || true)"
libs="@bootnodedev/canton-connect@^$published @bootnodedev/canton-dappbooster@^$published @bootnodedev/canton-theme@^$published"

# INIT_CWD is where `pnpm -C ... try` was typed; the script itself runs in the package dir.
rel="$(node -e "console.log(require('node:path').relative(process.env.INIT_CWD || process.cwd(), '$TRY') || '.')")"

printf '\nPacked %s into %s and installed it there, with the examples: %s. Now, as a user would:\n\n  cd %s\n' \
  "$(basename "$tgz")" "$rel" "${examples[*]:-none}" "$rel"
if [ -n "$(npm view "@bootnodedev/canton-connect@$range" version 2>/dev/null)" ]; then
  cat <<TXT

  # npm
  npm create canton-dappbooster my-dapp

  # pnpm
  pnpm dlx "\$PWD/$(basename "$tgz")" my-dapp
TXT
else
  cat <<TXT

  # npm
  npm create canton-dappbooster my-dapp -- --skip-install
  cd my-dapp && npm install $libs

  # pnpm
  pnpm dlx "\$PWD/$(basename "$tgz")" my-dapp --skip-install
  cd my-dapp && pnpm add $libs

  The scaffold pins $range, which is not on npm yet, so the published $published stands in.
TXT
fi
cat <<TXT

  The CLI asks for the local network and the dApp, then prints the next steps. --localnet and
  --example <name> answer those questions, and --help lists every flag (after a -- with npm).
TXT
printf '\nDone trying? pnpm -C canton-create try:clean  (stops the stack, resets the LocalNet, removes %s)\n' "$rel"
}

case "${1:-}" in
  "") main ;;
  clean) clean ;;
  *) echo "usage: try.sh [clean]" >&2; exit 2 ;;
esac
