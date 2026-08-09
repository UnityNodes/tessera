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
        """.

        ,
        . ,
        ; .

        inner_text ,
        text-transform DOM ,
        .
        """
        el = page.get_by_text(label, exact=True).first.locator("xpath=..")
        return num(re.sub(re.escape(label), "", el.inner_text(), flags=re.I))

    # ── ────────────────────────────────────────────────────
    #
    # :
    # , .
    # , .
    print("\n── ──")
    go("/")
    t = EXPECTED["totals"]
    same("opened so far= drawn ", t["drawn"], whole(label_value("opened so far")))

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

    # . ;
    # .
    decks_seen = page.locator("#decks h2").first.inner_text()
    same("N decks= ", t["decks"], whole(num(decks_seen)))

    for d in EXPECTED["decks"]:
        card = page.locator(f"a[href='/case/{d['id']}']").last
        txt = card.inner_text()
        sealed = num(re.search(r"Still sealed:\s*([\d\s,]+)", txt).group(1))
        same(f"#{d['id']}: still sealed", d["remaining"], whole(sealed))

        # TESA ,
        # . :
        # ,
        # , .
        if d["remaining"] > 0:
            if d["tesa"] > 0:
                m = re.search(r"([\d\s,]+)\s+TESA still in the deck", txt)
                same(
                    f"#{d['id']}: TESA ",
                    d["tesa"],
                    whole(num(m.group(1)) if m else None),
                )
            else:
                check(
                    f"#{d['id']}: , TESA ",
                    "no TESA in this deck" in txt,
                    "no TESA in this deck",
                )

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

    # ── ─────────────────────────────────
    print("\n── ──")
    # , :
    # , 404 -.
    # , .
    go("/case")
    check(
        "/case , 404",
        page.url.rstrip("/").endswith("#decks") or page.locator("#decks").count() == 1,
        f"{page.url}",
    )
    check(
        "cases",
        page.locator("header nav a[href='/case']").count() == 0,
        ", ",
    )

    # , :
    # , : .
    go("/leaderboard")
    same("players= ", t["players"], whole(label_value("players")))

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

    # ── ────────────────────────────────────────────────────────────
    print("\n── ──")
    # :
    # .
    # , , .
    #
    # , , :
    # , computed font-size computed color
    # , WCAG.
    #
    # :
    #   12px  ;
    #   4.5   ;
    #   3.0   (24px, 18.66px ).
    #
    # : disabled, opacity < 0.5,
    # . ,
    # .
    for path in ("/", "/case/1", "/battles", "/leaderboard", "/profile"):
        go(path, 3000)
        bad = page.evaluate(
            r"""
            () => {
              const lin = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
              const lum = ([r,g,b]) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
              const nums = s => (String(s).match(/[\d.]+/g) || []).map(Number);
              const bgOf = el => {
                for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
                  const st = getComputedStyle(n);
                  if (st.backgroundImage && st.backgroundImage !== "none") return null;
                  const c = nums(st.backgroundColor);
                  if (c.length >= 3 && (c[3] === undefined || c[3] > 0.55)) return c.slice(0, 3);
                }
                return [10, 15, 10];
              };
              const out = [];
              for (const el of document.querySelectorAll("body *")) {
                if (el.closest("[disabled],[aria-disabled='true']")) continue;
                const own = [...el.childNodes].filter(n => n.nodeType === 3)
                  .map(n => n.textContent.trim()).join(" ").trim();
                if (!own) continue;
                const r = el.getBoundingClientRect();
                if (r.width < 2 || r.height < 2) continue;
                const st = getComputedStyle(el);
                if (st.visibility === "hidden" || st.display === "none") continue;
                if (parseFloat(st.opacity) < 0.5) continue;
                const col = nums(st.color);
                if (col[3] !== undefined && col[3] < 0.55) continue;
                const size = parseFloat(st.fontSize);
                const weight = parseInt(st.fontWeight, 10) || 400;
                if (size < 12) { out.push({ why: "", size, text: own.slice(0, 40) }); continue; }
                const bg = bgOf(el);
                if (!bg) continue;
                const a = lum(col.slice(0,3)) + 0.05, b = lum(bg) + 0.05;
                const ratio = Math.max(a,b) / Math.min(a,b);
                const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3.0 : 4.5;
                if (ratio < need)
                  out.push({ why: "", size, ratio: Math.round(ratio*100)/100, need, text: own.slice(0, 40) });
              }
              return out;
            }
            """
        )
        detail = ""
        if bad:
            f = bad[0]
            why = f"{f['why']} {round(f['size'], 1)}px"
            if f["why"] == "":
                why += f", {f['ratio']} {f['need']}"
            detail = f"{len(bad)} , {why}: {f['text']!r}"
        check(f"{path}: ≥ 12px ", not bad, detail)

    # ── ───────────────────────────────────────────────────────────
    print("\n── ──")
    # 1280 :
    # ,
    # 768 1440 , .
    #
    # /case : /,
    # . ,
    # .
    pages = ("/", "/case/1", "/battles", "/battles/1", "/leaderboard", "/profile")
    for w in (360, 390, 768, 1280, 1440, 1920):
        page.set_viewport_size({"width": w, "height": 900})
        for path in pages:
            go(path, 3500)
            over = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            if over > 1:
                check(f"{w}px {path}: ", False, f"{over}px")
                break
        else:
            check(f"{w}px: ", True, f"{len(pages)} ")

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
