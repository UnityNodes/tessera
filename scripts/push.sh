#!/usr/bin/env bash
# GitHub 0xFearless-1.
#
#   ./scripts/push.sh            #
#   ./scripts/push.sh main       #
#   DRY=1 ./scripts/push.sh      # ,
#
# , `git push`.
#
# , GitHub UnityNodes/tessera, /root/.ssh
# root. claude.
# , :
#
#   1. sudo ssh ;
#   2. safe.directory git root
#      (detected dubious ownership);
#   3. chown claude git root
#      .git, .
#
# : ,
# .
#
# /root/.ssh : github_deploy_key deploy-
# custis, github_deploy_rsa claude_ssh_key GitHub .
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
KEY=/root/.ssh/fearless
BRANCH="${1:-$(git -C "$REPO" rev-parse --abbrev-ref HEAD)}"

if ! sudo -n test -r "$KEY" 2>/dev/null; then
  echo "$KEY sudo " >&2
  exit 2
fi

# .git , .
OWNER="$(stat -c '%u:%g' "$REPO/.git")"

run() {
  sudo git -c safe.directory="$REPO" -C "$REPO" \
    -c core.sshCommand="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    push "$@"
}

echo "▶ $BRANCH → origin (fearless, 0xFearless-1)"
run --dry-run origin "$BRANCH"

if [ -n "${DRY:-}" ]; then
  echo "DRY=1 "
else
  run origin "$BRANCH"
fi

sudo chown -R "$OWNER" "$REPO/.git"
git -C "$REPO" status -sb | head -1
