#!/usr/bin/env bash
# Push to GitHub as 0xFearless-1.
#
#   ./scripts/push.sh            # the current branch
#   ./scripts/push.sh main       # a particular branch
#   DRY=1 ./scripts/push.sh      # only show what would go
#   FORCE=1 ./scripts/push.sh    # after a history rewrite, and only then
#
# FORCE uses --force-with-lease rather than --force: the lease refuses if
# somebody else pushed since we last fetched, which is the one case where
# overwriting really would destroy work. Plain --force cannot tell that case
# from a rewrite of our own commits.
#
# Why a script of its own rather than a plain `git push`.
#
# The key GitHub accepts for UnityNodes/tessera lives in /root/.ssh and can only
# be read as root. The repository itself belongs to the claude user. So a push
# consists of three steps, and every one of them is easy to forget:
#
#   1. sudo, otherwise ssh will not read the key;
#   2. safe.directory, git as root refuses to work in somebody else's directory
#      ("detected dubious ownership");
#   3. chown back to claude, git as root leaves root owned files behind in .git,
#      and the VERY NEXT ordinary command fails.
#
# The third step is the most treacherous: the push goes through all the same, and
# everything breaks afterwards and apparently for no reason.
#
# The other keys in /root/.ssh do not fit: github_deploy_key is a deploy key for
# the custis repository, and GitHub rejects github_deploy_rsa and claude_ssh_key.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
KEY=/root/.ssh/fearless
BRANCH="${1:-$(git -C "$REPO" rev-parse --abbrev-ref HEAD)}"

if ! sudo -n test -r "$KEY" 2>/dev/null; then
  echo "cannot read $KEY, passwordless sudo is required" >&2
  exit 2
fi

# Who .git will belong to afterwards: we take it beforehand rather than guess.
OWNER="$(stat -c '%u:%g' "$REPO/.git")"

run() {
  sudo git -c safe.directory="$REPO" -C "$REPO" \
    -c core.sshCommand="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    push "$@"
}

LEASE=()
[ -n "${FORCE:-}" ] && LEASE=(--force-with-lease)

echo "> $BRANCH -> origin (fearless key, account 0xFearless-1)${FORCE:+ [rewrite]}"
run --dry-run "${LEASE[@]}" origin "$BRANCH"

if [ -n "${DRY:-}" ]; then
  echo "DRY=1, going no further"
else
  run "${LEASE[@]}" origin "$BRANCH"
fi

sudo chown -R "$OWNER" "$REPO/.git"
git -C "$REPO" status -sb | head -1
