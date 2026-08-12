#!/usr/bin/env sh
# Push the project branches to the GitHub remote (origin by default).
#
# Auth:
#   - If GITHUB_TOKEN is set (Freebuff Keys tab / CI), it is used as a
#     personal access token for an HTTPS push. The token is never written
#     to .git/config: it is injected into the one-off push URL only.
#   - Otherwise git's normal credential helper is used.
#
# Usage:
#   sh ./scripts/push.sh                 # push develop + main to origin
#   sh ./scripts/push.sh origin develop  # push a single branch

set -e

REMOTE="${1:-origin}"
BRANCHES="${2:-develop main}"

if ! git ls-remote --exit-code "$REMOTE" >/dev/null 2>&1; then
  echo "error: remote '$REMOTE' is not reachable yet." >&2
  echo "Connect the workspace to GitHub (or run 'git remote add origin <url>') first." >&2
  exit 1
fi

url=$(git remote get-url "$REMOTE")
case "$url" in
  https://*)
    if [ -n "$GITHUB_TOKEN" ]; then
      # https://x-access-token:TOKEN@github.com/owner/repo.git
      authed=$(printf '%s' "$url" | sed "s#https://#https://x-access-token:${GITHUB_TOKEN}@#")
      echo "Using GITHUB_TOKEN for authentication."
    else
      authed=""
    fi
    ;;
  git@*)
    authed="" # SSH: no token needed
    ;;
  *)
    echo "error: unsupported remote URL scheme: $url" >&2
    exit 1
    ;;
esac

for branch in $BRANCHES; do
  if ! git show-ref --verify --quiet "refs/heads/$branch"; then
    echo "skipping $branch: no local branch with that name"
    continue
  fi
  if [ -n "$authed" ]; then
    git push "$authed" "refs/heads/$branch:refs/heads/$branch"
  else
    git push "$REMOTE" "refs/heads/$branch:refs/heads/$branch"
  fi
  # Set upstream tracking on the clean remote name (never the tokenized URL).
  git config "branch.$branch.remote" "$REMOTE"
  git config "branch.$branch.merge" "refs/heads/$branch"
  echo "pushed $branch -> $REMOTE"
done

echo "done."
