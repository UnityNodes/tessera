#!/usr/bin/env bash
# The whole check in one command.
#
#   cd scripts && set -a && . ../.env && set +a && ./audit.sh
#
# The order is not accidental: audit-chain leaves behind a file of expected
# numbers, and audit-ui compares the screen against them. The end to end open is
# last, it is the only one that spends real slots out of a deck.
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
  if "$@"; then echo "-- $name: clean"; else FAILED+=("$name"); echo "-- $name: THERE IS SOMETHING TO LOOK AT"; fi
}

# `| tail` cost a lot here: a pipeline's exit code is the code of the LAST
# command, that is, of tail itself, and that always succeeds. Because of it the
# audit wrote "contracts: clean" on a run where five tests failed. A check that
# cannot say "no" is worse than none, and that is exactly what it was.
#
# pipefail does not save it: bash -c starts its own shell without inherited
# options. So forge's exit code is taken from PIPESTATUS explicitly.
run "the contracts" bash -c 'cd ../contracts && forge test --summary 2>&1 | tail -22; exit ${PIPESTATUS[0]}'
run "chain to server" node audit-chain.cjs "$URL"
# The creation form against the real contract, on a fork. The place here is not
# accidental: a cut depends on the vault share, and audit-chain has just read it,
# and it was precisely the divergence from it that made EVERY cut a revert.
run "your own deck from the form" node audit-create.cjs
run "server to screen" python3 audit-ui.py "$URL"
run "load" python3 audit-runtime.py "$URL"
run "the knowledge base" python3 audit-brain.py --project=tessera

# An open spends slots, so only when asked: OPENS=3 ./audit.sh
if [ -n "${OPENS:-}" ]; then
  run "a real open" node browser-e2e.cjs "$URL"
fi

# A battle is slots too, and two at once: for the creator and for the opponent.
# So separately: BATTLE=1 ./audit.sh, and DECK=3 picks the season.
#
# It has to be HERE rather than only in the memory of whoever wrote it. The
# battle script lay broken from the very move to several decks, calling
# openBattle() with no arguments, and told nobody about it, because nobody ran
# it. A check outside audit.sh is dead, and you do not learn about its death
# until you need it.
if [ -n "${BATTLE:-}" ]; then
  run "a real battle" node e2e-battle.cjs
  # The same battle but through a player's eyes in a browser: does it land them
  # in their own room after payment. The chain script above does not see that, it
  # never visits the site.
  run "a battle in the browser" env BATTLE_UI=1 OPENS=0 node browser-e2e.cjs "$URL"
fi

# Every open multiplier: x1 x2 x3 x4 x5 x10, end to end in a browser.
# Twenty five real slots per run, so behind a flag.
if [ -n "${BATCH:-}" ]; then
  run "every multiplier" node e2e-batch.cjs
fi

# Cutting your own deck through the form. Apart from the rest, because the price
# here is not only gas: the deck stays in the catalogue FOREVER, nobody can remove
# it from the chain. So CREATE=1 and no automatic runs.
if [ -n "${CREATE:-}" ]; then
  run "your own deck through the form" env CREATE_UI=1 OPENS=0 node browser-e2e.cjs "$URL"
fi

echo
echo "════════════════════════════════════════════════"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "all clean"
else
  echo "needs attention: ${FAILED[*]}"
  exit 1
fi
