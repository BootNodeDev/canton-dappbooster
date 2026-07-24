# Shared gitleaks preflight, sourced by pre-commit and pre-push.
# Ensures the pinned gitleaks (see .gitleaks-version) is installed into <repo>/bin,
# then puts it first on PATH so local and CI apply the exact same version and rules.
# Fails closed under the hook's set -e: a leaked secret cannot be un-leaked.
repo_root=$(cd "$(dirname "$0")/.." && pwd)
"$repo_root/scripts/install-gitleaks.sh"
PATH="$repo_root/bin:$PATH"
