#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/deploy-dar.sh path/to/file.dar" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DAR_PATH="$1"

if [ ! -f "$DAR_PATH" ]; then
  echo "DAR not found: $DAR_PATH" >&2
  exit 1
fi

if [ -z "${CANTON_BACKEND_TOKEN:-}" ]; then
  echo "CANTON_BACKEND_TOKEN is required. Generate one with: npm run canton:token -- ledger-api-user" >&2
  exit 1
fi

json_api_url="${APP_USER_JSON_API_URL:-http://localhost:2975}"
dar_name="$(basename "$DAR_PATH")"

echo "Uploading $dar_name to app-user JSON API at $json_api_url"

http_code="$(
  curl -sS -o /dev/null -w '%{http_code}' \
    -X POST \
    "$json_api_url/v2/packages" \
    -H "Authorization: Bearer $CANTON_BACKEND_TOKEN" \
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
