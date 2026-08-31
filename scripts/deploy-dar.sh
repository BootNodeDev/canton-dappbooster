#!/usr/bin/env bash
set -euo pipefail

# pnpm 11 forwards the `--` separator to the script; drop it so `pnpm run
# deploy-dar -- <dar>` and a direct `deploy-dar.sh <dar>` both work.
[ "${1:-}" = "--" ] && shift

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/deploy-dar.sh path/to/file.dar" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Captured before sourcing so a value the caller exported beats .env, the same precedence
# mint-token.mjs uses. No `set -a`: curl takes the token as a header, so exporting the
# whole file would only hand CANTON_AUTH_SECRET to a child that has no use for it.
preset_token="${CANTON_BACKEND_TOKEN:-}"
preset_json_api_url="${CANTON_JSON_API_URL:-}"

if [ -f "$ROOT/.env" ]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi

token="${preset_token:-${CANTON_BACKEND_TOKEN:-}}"
# The same name .env and wallet-service use, so retargeting the participant moves the
# upload with it rather than only moving wallet-service.
json_api_url="${preset_json_api_url:-${CANTON_JSON_API_URL:-http://localhost:2975}}"

DAR_PATH="$1"

if [ ! -f "$DAR_PATH" ]; then
  echo "DAR not found: $DAR_PATH" >&2
  exit 1
fi

if [ -z "$token" ]; then
  echo "CANTON_BACKEND_TOKEN is required. Generate one with: pnpm run mint-token" >&2
  exit 1
fi

dar_name="$(basename "$DAR_PATH")"

echo "Uploading $dar_name to app-user JSON API at $json_api_url"

http_code="$(
  curl -sS -o /dev/null -w '%{http_code}' \
    -X POST \
    "$json_api_url/v2/packages" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$DAR_PATH"
)"

case "$http_code" in
  200 | 204)
    echo "deployed $dar_name to app-user"
    ;;
  409)
    echo "$dar_name already deployed to app-user"
    ;;
  *)
    echo "DAR upload failed with HTTP $http_code" >&2
    exit 1
    ;;
esac
