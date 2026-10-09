#!/usr/bin/env bash
#
# try.sh — use the scaffolder as if it were published, without publishing anything.
#
# Packs the package into ./.try and installs the tarball there with npm, so inside that directory
# `npm create canton-dappbooster` runs the local build: npm resolves a create-* package against the
# current project's dependencies before it asks the registry. pnpm has no such path — `pnpm create`
# is `pnpm dlx create-canton-dappbooster`, registry only — so its line is `pnpm dlx <tarball>`, the
# same mechanism with a local spec.
#
#   pnpm -C canton-create try          # then follow what it prints
#   pnpm -C canton-create try:clean    # wind down whatever was started, remove .try
set -euo pipefail

PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRY="$PKG/.try"

# Undo everything trying could have started: for each localnet-tier project, `dev-stack.sh down`
# (the Wallet Gateway, the dev server, the LocalNet) then `canton-barebones reset` (containers and
# volumes); any dev server still running from inside the sandbox; then the sandbox itself.
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

# dlx caches an install by its spec string, so a re-pack under the same name would keep serving the
# previous build for a day. A content hash in the name makes every build a new spec.
hash="$(shasum -a 256 "$packed" | cut -c1-8)"
tgz="${packed%.tgz}-$hash.tgz"
mv "$packed" "$tgz"

# npm, not pnpm: a pnpm install in a directory inside the monorepo lands in the root lockfile.
printf '{ "name": "try", "private": true }\n' >"$TRY/package.json"
(cd "$TRY" && npm install --no-audit --no-fund --loglevel=error "$tgz")

# The template pins the workspace's own library version. While that is not on npm, the CLI's
# install step would fail, so the printed flow skips it and adds the published libs by hand.
range="$(tar -xzOf "$tgz" package/scaffold/starter/package.json | node -e "process.stdin.on('data',(d)=>console.log(JSON.parse(d).dependencies['@bootnodedev/canton-connect']))")"
published="$(npm view @bootnodedev/canton-connect version 2>/dev/null || true)"
libs="@bootnodedev/canton-connect@^$published @bootnodedev/canton-dappbooster@^$published @bootnodedev/canton-theme@^$published"

# INIT_CWD is where `pnpm -C ... try` was typed; the script itself runs in the package dir.
rel="$(node -e "console.log(require('node:path').relative(process.env.INIT_CWD || process.cwd(), '$TRY') || '.')")"

printf '\nPacked %s into %s and installed it there. Now, as a user would:\n\n  cd %s\n' "$(basename "$tgz")" "$rel" "$rel"
if [ -n "$(npm view "@bootnodedev/canton-connect@$range" version 2>/dev/null)" ]; then
  cat <<TXT

  # npm
  npm create canton-dappbooster my-dapp
  cd my-dapp && npm run dev

  # pnpm
  pnpm dlx "\$PWD/$(basename "$tgz")" my-dapp
  cd my-dapp && pnpm dev                     # localnet tier: pnpm stack up   (Docker + dpm)
TXT
else
  cat <<TXT

  # npm
  npm create canton-dappbooster my-dapp -- --skip-install
  cd my-dapp && npm install $libs
  npm run dev

  # pnpm
  pnpm dlx "\$PWD/$(basename "$tgz")" my-dapp --skip-install
  cd my-dapp && pnpm add $libs
  pnpm dev                                   # localnet tier: pnpm stack up   (Docker + dpm)

  The template pins $range, which is not on npm while this branch sits on main; the published
  $published stands in. --skip-install and the install of the libs go away once the branch is rebased.
TXT
fi
printf '\nDone trying? pnpm -C canton-create try:clean  (stops the stack, resets the LocalNet, removes %s)\n' "$rel"
}

case "${1:-}" in
  "") main ;;
  clean) clean ;;
  *) echo "usage: try.sh [clean]" >&2; exit 2 ;;
esac
