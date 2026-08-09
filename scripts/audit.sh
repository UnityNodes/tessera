#!/usr/bin/env bash
# .
#
#   cd scripts && set -a && . ../.env && set +a && ./audit.sh
#
# : audit-chain
# , audit-ui .
# .
set -uo pipefail
cd "$(dirname "$0")"

URL="${1:-https://tessera.unitynodes.com}"
export SHOT_DIR="${SHOT_DIR:-/tmp/tessera-audit}"
mkdir -p "$SHOT_DIR"
: "${CHROME_BIN:=$HOME/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome}"
export CHROME_BIN
FAILED=()

run() {
  local name="$1"; shift
  echo
  echo "══════ $name ══════"
  if "$@"; then echo "── $name: "; else FAILED+=("$name"); echo "── $name: "; fi
}

run "" bash -c 'cd ../contracts && forge test --summary 2>&1 | tail -22'
run "→ " node audit-chain.cjs "$URL"
run "→ " python3 audit-ui.py "$URL"
run "" python3 audit-runtime.py "$URL"
run "" python3 audit-brain.py

# , : OPENS=3 ./audit.sh
if [ -n "${OPENS:-}" ]; then
  run "" node browser-e2e.cjs "$URL"
fi

# , : . :
# BATTLE=1 ./audit.sh, DECK=3 .
#
# , ', .
#
# openBattle() ,
# . audit.sh ,
# , .
if [ -n "${BATTLE:-}" ]; then
  run "" node e2e-battle.cjs
  # , :
  # .
  # .
  run "" env BATTLE_UI=1 OPENS=0 node browser-e2e.cjs "$URL"
fi

echo
echo "════════════════════════════════════════════════"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo ""
else
  echo ": ${FAILED[*]}"
  exit 1
fi
