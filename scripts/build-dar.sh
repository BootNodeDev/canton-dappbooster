#!/usr/bin/env bash
set -euo pipefail

# pnpm 11 forwards the `--` separator to the script; drop it so `pnpm run
# build-dar -- <dir>` and a direct `build-dar.sh <dir>` both work.
[ "${1:-}" = "--" ] && shift

if [ "$#" -ne 1 ]; then
  echo "Usage: pnpm run build-dar -- path/to/daml/project" >&2
  exit 1
fi

PROJECT_DIR="$1"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "DAML project directory not found: $PROJECT_DIR" >&2
  exit 1
fi

command -v dpm >/dev/null 2>&1 || { echo "dpm not found on PATH" >&2; exit 1; }

cd "$PROJECT_DIR"
dpm build
