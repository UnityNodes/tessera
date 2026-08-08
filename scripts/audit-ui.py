"""3: , , , .

audit-chain.cjs ,
: ,
.

audit-chain.
, , .
audit.sh .

    SHOT_DIR=/tmp python3 audit-ui.py [url]
"""

import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "https://tessera.unitynodes.com").rstrip("/")
OUT = os.environ.get("SHOT_DIR", "/tmp")
EXPECTED = json.load(open(os.path.join(OUT, "audit-expected.json")))

rows, fails = [], []
console, bad_http = [], []


def check(name, ok, detail=""):
    rows.append(ok)
    print(f"  {'✓' if ok else '✗'} {name}{', ' + detail if detail else ''}")
    if not ok:
        fails.append(f"{name}: {detail}")


def num(text):
    """: 282 in 3→ 282, $ 8.10→ 8.10."""
    m = re.search(r"-?[\d\s,]*\.?\d+", (text or "").replace(" ", " "))
    return float(m.group(0).replace(" ", "").replace(",", "")) if m else None


def same(name, expected, got, unit=""):
    check(name, expected == got, f"{expected}{unit}, {got}{unit}")


# : .
MISSING = -10**9


def whole(value):
    """int num(), .

    `int(num(x) or -1)`. Python 0.0 ,
    -1, :
    0 drawn, .

    . ,
    : 0 cases left, 0 still sealed
    . , ,
    -, .
    """
    return MISSING if value is None else int(value)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1600, "height": 1000})
    page = ctx.new_page()
    page.on("console", lambda m: console.append(m.text[:130]) if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {str(e)[:130]}"))
    page.on(
        "response",
        lambda r: bad_http.append(f"{r.status} {r.url[:90]}") if r.status >= 400 else None,
    )

    def go(path, settle=6000):
        page.goto(URL + path, wait_until="load")
        page.wait_for_timeout(settle)

    def label_value(label):
        """."""
        el = page.locator("div", has=page.get_by_text(label, exact=True)).last
        return num(el.inner_text().replace(label, ""))

    # ── ────────────────────────────────────────────────
    print("\n── ──")
    go("/")
    t = EXPECTED["totals"]
    same("cases opened= drawn ", t["drawn"], whole(label_value("cases opened")))
    same("players= ", t["players"], whole(label_value("players")))
    left = page.locator("div", has=page.get_by_text("cases left", exact=True)).last.inner_text()
    same("cases left= ", t["remaining"], whole(num(left.split("in")[0])))
    same("in N= ", t["decks"], whole(num(left.split("in")[1])))

    # ── ─────────────────────────────────────────
    print("\n── ──")
    # : 238 of 400 slots still sealed, across every
    # deck.
    # , .
    # ,
    # : 401 of 600, . .
    hero = (
        page.locator("text=/still sealed, across every deck/")
        .first.locator("xpath=..")
        .inner_text()
    )
    same("= ", t["remaining"], whole(num(hero)))
    same("= ", t["size"], whole(num(hero.split("of")[1])))
    for d in EXPECTED["decks"]:
        card = page.locator(f"a[href='/case/{d['id']}']").last
        txt = card.inner_text()
        sealed = num(re.search(r"Still sealed:\s*([\d\s,]+)", txt).group(1))
        same(f"#{d['id']}: still sealed", d["remaining"], whole(sealed))
        if d["hasVault"]:
            vault = re.search(r"Vault:\s*\$([\d.,]+)", txt)
            # :
            # claimVault, .
            check(
                f"#{d['id']}: ",
                vault and vault.group(1) == d["vaultUsd"],
                f"${d['vaultUsd']} (${d['vaultBankedUsd']} + ), "
                f"${vault.group(1) if vault else ''}",
            )
        else:
            check(f"#{d['id']}: ", "No vault" in txt, "No vault")

    # ── ───────────────────────────────────────────────────
    print("\n── ──")
    for d in EXPECTED["decks"]:
        go(f"/case/{d['id']}")
        # : , ,
        # of M. , ,
        # -, .
        tally = page.locator("div", has=page.get_by_text("still sealed", exact=True)).last
        # inner_text , ,
        # text-transform DOM .
        # re.I .
        head = re.search(
            r"still sealed\s+([\d\s,]+)\s+of\s+([\d\s,]+)", tally.inner_text(), re.I
        )
        check(f"#{d['id']}: ", bool(head), "still sealed / N / of M")
        same(
            f"#{d['id']}: still sealed",
            d["remaining"],
            whole(num(head.group(1)) if head else None),
        )
        same(
            f"#{d['id']}: ",
            d["size"],
            whole(num(head.group(2)) if head else None),
        )

        grid = page.get_by_role("img", name=re.compile(r"slots still sealed")).get_attribute(
            "aria-label"
        )
        same(f"#{d['id']}: ", d["remaining"], whole(num(grid)))

        strip = page.locator("text=/\\d+ drawn · \\d+ sealed/").first.inner_text()
        same(f"#{d['id']}: ()", d["drawn"], whole(num(strip)))

    # ── ────────────────────────────────────────────────────────────
    print("\n── ──")
    go("/battles")
    allt = page.locator("div", has=page.get_by_text("all time", exact=True)).last.inner_text()
    same("all time= ", EXPECTED["battles"], whole(num(allt.replace("all time", ""))))

    # ── ──────────────────────────────────────────────────────
    #
    # , : .
    # , ,
    # ,
    # , Denarius +1.
    # : grout, .
    #
    # : ',
    # , , .
    print("\n── ──")
    UNDER_MARK = """() => {
      const out = [];
      document.querySelectorAll('[data-roll]').forEach((reel) => {
        const card = reel.closest('[data-card]');
        const box = reel.getBoundingClientRect();
        const mark = box.left + box.width / 2;
        let under = null;
        reel.querySelectorAll('[data-roll-item]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.left <= mark && r.right >= mark) under = el.dataset.tierName;
        });
        out.push({ named: card ? card.dataset.card : null, under });
      });
      return out;
    }"""
    seen = 0
    for bid in range(1, EXPECTED["battles"] + 1):
        go(f"/battles/{bid}", 4000)
        for side in page.evaluate(UNDER_MARK):
            if not side["named"] or side["named"] in ("sealed", "pending") or not side["under"]:
                continue
            seen += 1
            check(
                f"#{bid}: , ",
                side["named"] == side["under"],
                f"{side['named']}, {side['under']}",
            )
        if seen >= 2:
            break
    check("", seen > 0, f": {seen}")

    # ── ───────────────────────────────────────────────────────────
    print("\n── ──")
    # 1280 :
    # ,
    # 768 1440 , .
    for w in (360, 390, 768, 1280, 1440, 1920):
        page.set_viewport_size({"width": w, "height": 900})
        for path in ("/", "/case", "/case/1", "/battles", "/battles/1"):
            go(path, 3500)
            over = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            if over > 1:
                check(f"{w}px {path}: ", False, f"{over}px")
                break
        else:
            check(f"{w}px: ", True, "5 ")

    browser.close()

print("\n" + "═" * 62)
print(f"{sum(rows) }, {len(fails)}")
for f in fails:
    print("  ✗", f)
print(f"\n: {len(set(console))}")
for c in list(dict.fromkeys(console))[:6]:
    print("  ", c)
print(f"4xx/5xx: {len(set(bad_http))}")
for b in list(dict.fromkeys(bad_http))[:6]:
    print("  ", b)
sys.exit(1 if fails else 0)
