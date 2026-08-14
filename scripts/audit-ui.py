"""Level 3: does what is on the screen equal what the chain counted.

The expected numbers arrive as a file from audit-chain.cjs, which is exactly why
this is a check rather than a self check: the numbers were taken from the
contract by an independent client, and here they are only compared with what is
written on the page.

Run it ONLY straight after audit-chain. The snapshot goes stale from the very
first case opened, and then a divergence shows the age of the file rather than a
fault in the site. audit.sh keeps that order itself.

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
    print(f"  {'✓' if ok else '✗'} {name}{'  - ' + detail if detail else ''}")
    if not ok:
        fails.append(f"{name}: {detail}")


def num(text):
    """A number out of a caption on the screen: "282 in 3" -> 282, "$ 8.10" -> 8.10."""
    m = re.search(r"-?[\d\s,]*\.?\d+", (text or "").replace(" ", " "))
    return float(m.group(0).replace(" ", "").replace(",", "")) if m else None


def same(name, expected, got, unit=""):
    check(name, expected == got, f"expected {expected}{unit}, on screen {got}{unit}")


# A deliberately impossible value: no number on the screen is ever like this.
MISSING = -10**9


def whole(value):
    """An int out of num() that does not confuse zero with "not found".

    It was `int(num(x) or -1)`. In Python 0.0 is falsy, so a real zero on the
    screen became -1, and the check failed on a working site: a fresh deck shows
    "0 drawn", and that is exactly where it was caught.

    More dangerous than an inconvenience. Zero here is not an edge case but the
    game's most important states: "0 cases left" is the end of a season, "0 still
    sealed" is an exhausted deck. A check that shouts exactly where it should
    have fired for real quickly teaches people to ignore it.
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
        """The number next to a caption.

        The caption and the number are neighbouring elements, so we take their
        common parent. The deepest element with this text is THE CAPTION itself,
        and there is no number in it; that is how the check failed on a working
        screen.

        inner_text hands over the VISIBLE text, and the captions are set in upper
        case through text-transform, so in the DOM they stay lower case; that is
        why we cut the caption out case insensitively.
        """
        el = page.get_by_text(label, exact=True).first.locator("xpath=..")
        return num(re.sub(re.escape(label), "", el.inner_text(), flags=re.I))

    # -- the world numbers ------------------------------------------------
    #
    # The counter bar above the pages is gone: it repeated two of the three
    # numbers that stand as cards on the home page. So every number is now checked
    # in the one place it is unique.
    print("\n-- the world numbers --")
    go("/")
    t = EXPECTED["totals"]
    same("'opened so far' equals drawn from the contract", t["drawn"], whole(label_value("opened so far")))

    # -- the deck cards on the home page ----------------------------------
    print("\n-- deck progress --")
    # The line under the action in the hero: "238 of 400 slots still sealed,
    # across every deck". There is no big counter there any more, the same number
    # already stands in the bar above and showing it twice was redundant.
    # The number and the caption have lived in different elements since the line
    # under the hero became a card: "401 of 600" on top, the caption below. We
    # take the card whole.
    hero = (
        page.locator("text=/still sealed, across every deck/")
        .first.locator("xpath=..")
        .inner_text()
    )
    same("the line under the hero equals the slots left", t["remaining"], whole(num(hero)))
    same("the line under the hero equals the size of every deck", t["size"], whole(num(hero.split("of")[1])))

    # Hidden decks are deliberately removed from the catalogue, and that is
    # exactly why the check has to know about them. Otherwise it would demand a
    # card for every deck in the chain and fail precisely when moderation
    # worked.
    hidden = set(page.request.get(URL + "/api/decks/hidden").json().get("hidden", []))
    print(f"  hidden from the catalogue: {sorted(hidden) or 'nothing'}")

    # How many decks there are at all. It used to be on a separate catalogue
    # page; there is one catalogue now and it lives here.
    decks_seen = page.locator("#decks h2").first.inner_text()
    # The heading counts the VISIBLE decks rather than every one in the chain:
    # hidden ones are removed from the catalogue, and writing "7 decks" above an
    # empty space would promise two cards that are not there.
    same("'N decks' equals the visible decks", t["decks"] - len(hidden), whole(num(decks_seen)))

    for d in EXPECTED["decks"]:
        if d["id"] in hidden:
            # Hidden means there must be NO card. That is a fact too, and it is
            # checked just as closely.
            check(
                f"deck #{d['id']}: hidden and there is no card",
                page.locator(f"a[href='/case/{d['id']}']").count() == 0,
                "there is a card even though the deck is hidden",
            )
            continue
        card = page.locator(f"a[href='/case/{d['id']}']").last
        txt = card.inner_text()
        # The card became square, and the caption went from "Still sealed: 95" to
        # "95 sealed": long lines ate a height a square does not have. Nothing
        # happened to the number, and the check has to read what is written now,
        # otherwise it fails on its own text change.
        # \s in the class captured a NEWLINE too, so in a card where the number is
        # a single digit the match dragged the tail of the previous line with it:
        # "- 30 TESA\n4 sealed" gave "\n4", and then float() failed on "4\n0". It
        # was caught exactly when deck #4 played down to one digit. A class
        # without the newline: the number and the spaces inside the line.
        m_sealed = re.search(r"(\d[\d ,]*)\s+sealed", txt)
        same(f"deck #{d['id']}: 'sealed'", d["remaining"], whole(num(m_sealed.group(1)) if m_sealed else None))

        # How much TESA is in the deck, the one place on the site that answers
        # "where do I get them at all". That is why it is checked: three decks out
        # of four give none whatsoever, and a mistake here would send a player off
        # to collect what is not in the deck by construction.
        if d["remaining"] > 0:
            if d["tesa"] > 0:
                # In the square this is a "- 40 TESA" badge next to the pill
                # rather than a sentence beneath it. The number is the same.
                m = re.search(r"([\d\s,]+)\s+TESA", txt)
                same(
                    f"deck #{d['id']}: TESA in the deck",
                    d["tesa"],
                    whole(num(m.group(1)) if m else None),
                )
            else:
                check(
                    f"deck #{d['id']}: no TESA promised",
                    "TESA" not in txt,
                    "the card mentions TESA although the deck has none",
                )

        if d["hasVault"]:
            # The "Vault:" label has gone from the card, in the square only the
            # amount is left to the right of "N sealed". The number did not
            # change.
            vault = re.search(r"\$([\d.,]+)", txt)
            # We expect the amount TOGETHER with the unswept share of the
            # commission: that is what claimVault will hand over, and that is what
            # the player has to see.
            check(
                f"deck #{d['id']}: the vault amount",
                vault and vault.group(1) == d["vaultUsd"],
                f"expected ${d['vaultUsd']} (${d['vaultBankedUsd']} in the vault plus commission), "
                f"on screen ${vault.group(1) if vault else '-'}",
            )
        else:
            check(
                f"deck #{d['id']}: no vault",
                "no vault" in txt.lower(),
                "the 'no vault' label",
            )

    # -- the case page -----------------------------------------------------
    print("\n-- the case page --")
    for d in EXPECTED["decks"]:
        go(f"/case/{d['id']}")
        # The numbers moved from three counters into a row of labelled chips: the
        # case page now has to fit the screen without scrolling, and no number is
        # worth a storey of its own. The numbers themselves are the same.
        # We take the text of THE CHIP rather than of the whole page: in the body
        # the captions of neighbouring chips stand across a newline, and a greedy
        # \s+ glued the "0" of one to the "92" of the next.
        def chip(label):
            return page.get_by_text(label, exact=True).last.locator("xpath=..").inner_text()

        head = re.search(r"([\d,\u00a0 ]+)of([\d,\u00a0 ]+)", chip("sealed"), re.I)
        check(f"deck #{d['id']}: the header chips are readable", bool(head), "N of M sealed")
        same(
            f"deck #{d['id']}: 'sealed'",
            d["remaining"],
            whole(num(head.group(1)) if head else None),
        )
        same(
            f"deck #{d['id']}: the deck size",
            d["size"],
            whole(num(head.group(2)) if head else None),
        )
        same(f"deck #{d['id']}: 'drawn'", d["drawn"], whole(num(chip("drawn"))))

        # The case page does not scroll, and that is a property of the screen
        # rather than a preference: there is one action here, and everything for
        # it has to be in front of you at once. The check is right here because it
        # breaks on any added panel and shows nothing of itself but a scrollbar.
        fits = page.evaluate(
            "() => document.documentElement.scrollHeight - window.innerHeight <= 1"
        )
        check(f"deck #{d['id']}: the page does not scroll", fits, "it fits the screen")

    # -- the old catalogue and the players table ----------------------------
    print("\n-- old links and players --")
    # There is no separate catalogue page, but the route stayed: it could have
    # been linked from outside, and a silent 404 is worse than any page. What is
    # checked is exactly what WOULD BREAK if the file were deleted.
    go("/case")
    check(
        "/case leads to the catalogue rather than a 404",
        page.url.rstrip("/").endswith("#decks") or page.locator("#decks").count() == 1,
        f"ended up on {page.url}",
    )
    check(
        "there is no 'cases' tab in the header",
        page.locator("header nav a[href='/case']").count() == 0,
        "the tab leads back where you came from",
    )

    # "Players" lives next to the list of players rather than above every page:
    # there you can see what it was counted from, the list itself.
    go("/leaderboard")
    same("'players' equals the unique players in the events", t["players"], whole(label_value("players")))

    # -- the arena ----------------------------------------------------------
    print("\n-- the arena --")
    go("/battles")
    allt = page.locator("div", has=page.get_by_text("all time", exact=True)).last.inner_text()
    same("'all time' equals the battles in the contract", EXPECTED["battles"], whole(num(allt.replace("all time", ""))))

    # The stake has to be visible BEFORE payment.
    #
    # A battle is the one place where a dollar does not buy a ticket right away
    # but is staked: the winner takes both, the loser is left with nothing. While
    # that was not in the contract, the arena honestly said the opposite, "your
    # dollar buys you a real ticket either way". One unfixed line means a person
    # learns about the stake once they have already lost.
    arena = page.locator("body").inner_text().lower()
    check(
        "the arena calls the dollar a stake",
        "stake" in arena and "takes both tickets" in arena,
        "the stake is named" if "stake" in arena else "the word 'stake' is not on the page",
    )
    stale = [s for s in ("still buys your ticket", "buys you a real ticket either way") if s in arena]
    check("the arena does not promise a ticket either way", not stale, "; ".join(stale) or "there are no old promises")

    # -- the battle strip ---------------------------------------------------
    #
    # The most expensive fault caught here: the strip braking onto the wrong card.
    # Its contents are built from what is still in the pool, and the empty tier in
    # a full deck did not fit into the cycle at all, so whoever drew nothing saw
    # "Denarius +1" under the marker. Both sides of the screen were sound in
    # themselves at the time: the caption named grout and the picture named a
    # prize.
    #
    # So it is those two that are compared: the tier name computed from the
    # revealed value, and the tier the strip physically stopped on.
    print("\n-- the battle strip --")
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
                f"battle #{bid}: the strip stopped on what the chain handed over",
                side["named"] == side["under"],
                f"the card is {side['named']}, under the marker {side['under']}",
            )
        if seen >= 2:
            break
    check("a settled battle was found to check the strip with", seen > 0, f"sides checked: {seen}")

    # -- the mark -----------------------------------------------------------
    print("\n-- the mark --")
    # The mark breaks the most quietly of anything on the site: an empty space in
    # the header does not fail the build and writes nothing to the console. So
    # what is measured is not the presence of a tag but that the mark TOOK UP
    # SPACE on the screen.
    go("/", 3000)
    marks = page.evaluate(
        """() => [...document.querySelectorAll('[data-mark]')].map(el => {
             const r = el.getBoundingClientRect();
             return { kind: el.dataset.mark, w: Math.round(r.width), h: Math.round(r.height),
                      color: getComputedStyle(el).color };
           })"""
    )
    check("the mark was found in the header and the footer", len(marks) >= 2, f"found {len(marks)}")
    for m in marks:
        check(f"the '{m['kind']}' mark is drawn", m["w"] > 8 and m["h"] > 8, f"{m['w']}x{m['h']}")

        # The mark is monochrome, and that is a decision rather than a taste: in
        # this language a saturated colour names a rarity tier, and gold is
        # already taken by the vault. A coloured logotype in the header would make
        # gold mean two different things two centimetres apart.
        #
        # What is measured is saturation specifically rather than "is this not
        # gold": forbidding one shade means letting the next one through.
        rgb = [int(v) for v in re.findall(r"\d+", m["color"])[:3]]
        spread = (max(rgb) - min(rgb)) / max(max(rgb), 1)
        check(
            f"the '{m['kind']}' mark is monochrome",
            spread < 0.2,
            f"{m['color']}, saturation {spread:.0%}",
        )

    # The tab icons and the preview in messengers. No screen shows them, so they
    # can break for a long time and unnoticed.
    head = page.evaluate(
        """() => ({
             icons: [...document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')]
                      .map(l => l.getAttribute('href')),
             theme: document.querySelector('meta[name="theme-color"]')?.content ?? null,
             og: document.querySelector('meta[property="og:image"]')?.content ?? null,
           })"""
    )
    check("the tab icon is declared", len(head["icons"]) >= 2, f"{head['icons']}")
    check("the browser bar colour is declared", bool(head["theme"]), f"{head['theme']}")
    check("the messenger preview is declared", bool(head["og"]), f"{head['og']}")

    for href in [*head["icons"], head["og"]]:
        if not href:
            continue
        path = href if href.startswith("http") else URL + href
        r = page.request.get(path)
        check(f"{href.split('/')[-1]} is served", r.status == 200, f"HTTP {r.status}")

    # The icon on a phone's home screen. Another path that is nowhere visible
    # from a browser and breaks silently: the manifest points at its own sizes,
    # and no page points at them.
    mf = page.request.get(URL + "/manifest.webmanifest")
    check("the manifest is served", mf.status == 200, f"HTTP {mf.status}")
    if mf.status == 200:
        for icon in mf.json().get("icons", []):
            r = page.request.get(URL + icon["src"])
            check(
                f"manifest: {icon['src'].split('/')[-1]} is served",
                r.status == 200,
                f"HTTP {r.status}",
            )

    # -- red ----------------------------------------------------------------
    print("\n-- red --")
    # Red in this language means exactly one thing: something went wrong.
    #
    # For a long time it also meant "battle": that same #ff2d55 painted five arena
    # buttons, the creation panel border, the chosen deck and the "running" pill,
    # and simultaneously all seven error messages. A colour that means two things
    # means none, and here the second meaning poisoned the first as well: the
    # battles page looked like a page with an accident on it.
    #
    # The check walks the pages in a calm state, with no error on screen at all,
    # and demands that there be no red ANYWHERE. If any turned up, something has
    # been decorated with it again.
    DANGER = [(255, 45, 85), (255, 85, 119)]
    for path in ("/", "/battles", "/case/1", "/profile"):
        go(path, 3000)
        red = page.evaluate(
            """(danger) => {
              // Every rgb() in the value rather than the first three numbers of
              //
              // the string. The first attempt took exactly the first three and
              // silently missed the main thing: in
              // "linear-gradient(135deg, rgb(255,45,85), ...)" the triple came
              // out as (135, 255, 45), that is, matched nothing at all. Measured
              // with an old red button planted in the page: the check did NOT
              // see it. The same with a shadow, where the string starts with the
              // offsets "0 0 22px".
              const near = (s) => {
                for (const m of String(s).matchAll(/rgba?\\(([^)]+)\\)/g)) {
                  const n = (m[1].match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
                  if (n.length < 3) continue;
                  if (danger.some(d =>
                        Math.abs(d[0]-n[0]) + Math.abs(d[1]-n[1]) + Math.abs(d[2]-n[2]) < 30))
                    return true;
                }
                return false;
              };
              const out = [];
              for (const el of document.querySelectorAll("body *")) {
                const r = el.getBoundingClientRect();
                if (r.width < 2 || r.height < 2) continue;
                const st = getComputedStyle(el);
                for (const prop of ["color", "backgroundColor", "borderTopColor", "borderLeftColor", "boxShadow", "backgroundImage"]) {
                  if (near(st[prop])) {
                    out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0,40)} → ${prop}`);
                    break;
                  }
                }
              }
              return out;
            }""",
            DANGER,
        )
        check(
            f"{path}: red only in errors (there are no errors here)",
            not red,
            "" if not red else f"{len(red)} elements, the first is {red[0]}",
        )

    # -- the setting --------------------------------------------------------
    print("\n-- the setting --")
    # There was one complaint about every page: "the text is very small and hard
    # to read". It cannot be fixed by eye, only the place you are looking at can
    # be fixed while the rest is left as it is.
    #
    # So what is measured is not the intent but what is IN THE BROWSER RIGHT NOW:
    # a walk over every element with text of its own, computed font-size and
    # computed color against the real background beneath it, contrast by the WCAG
    # formula.
    #
    # The thresholds:
    #   12px  below this there should be no text on the site at all;
    #   4.5   the norm for ordinary text;
    #   3.0   for large text (24px, or 18.66px semibold).
    #
    # Deliberately dimmed things are skipped: disabled, opacity < 0.5, transparent
    # ink. And text on a gradient: there is no single background colour under it,
    # and an invented number here is worse than a skip.
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
                if (size < 12) { out.push({ why: "too small", size, text: own.slice(0, 40) }); continue; }
                const bg = bgOf(el);
                if (!bg) continue;
                const a = lum(col.slice(0,3)) + 0.05, b = lum(bg) + 0.05;
                const ratio = Math.max(a,b) / Math.min(a,b);
                const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3.0 : 4.5;
                if (ratio < need)
                  out.push({ why: "too dim", size, ratio: Math.round(ratio*100)/100, need, text: own.slice(0, 40) });
              }
              return out;
            }
            """
        )
        detail = ""
        if bad:
            f = bad[0]
            why = f"{f['why']} {round(f['size'], 1)}px"
            if f["why"] == "too dim":
                why += f", contrast {f['ratio']} against {f['need']}"
            detail = f"{len(bad)} places, the first is {why}: {f['text']!r}"
        check(f"{path}: all text is 12px or more and passes contrast", not bad, detail)

    # -- widths -------------------------------------------------------------
    print("\n-- widths --")
    # 1280 is in the list not for completeness: it is exactly where the catalogue
    # filter group ran off the right edge, and the check did not see it, between
    # 768 and 1440 the width was nowhere measured, and the broken thing lived
    # there for weeks.
    #
    # /case left the list along with the page: it is now a redirect to "/", so it
    # would measure the home page twice. In its place is the shelf, which was
    # never measured here.
    pages = ("/", "/case/1", "/battles", "/battles/1", "/leaderboard", "/profile")
    for w in (360, 390, 768, 1280, 1440, 1920):
        page.set_viewport_size({"width": w, "height": 900})
        for path in pages:
            go(path, 3500)
            over = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            if over > 1:
                check(f"{w}px {path}: no horizontal overflow", False, f"{over}px too many")
                break
        else:
            check(f"{w}px: no page runs sideways", True, f"{len(pages)} pages")

    # -- the header does not ask for what has already been given -------------
    #
    # On the server nobody has a wallet, so a bright green "Connect wallet" button
    # ended up in the markup, and on a phone it hung there for the whole two and a
    # half seconds until hydration and then disappeared. The page flashed and
    # asked someone already connected to connect.
    #
    # THE MARKUP ITSELF is checked: anything that appears after hydration does not
    # count here.
    print("\n-- the header in the markup --")
    raw = browser.new_context().request.get(URL).text()
    check(
        "the markup does not ask you to connect a wallet",
        "Connect wallet" not in raw,
        "the placeholder is in place" if "Connect wallet" not in raw else "the green button is in the HTML",
    )

    # -- the wallet choice ---------------------------------------------------
    #
    # The connector list is assembled by wagmi, and it cannot be shown as it is.
    # Besides the two declared ones, EVERY wallet that announced itself over
    # EIP-6963 ends up in it. That is good, a person sees their own wallet under
    # its own name. What is not good is that the bare `injected()` stays there in
    # the process: wagmi removes duplicates only for connectors with an `rdns`,
    # and it has none. A person with MetaMask ended up with two rows that do the
    # same thing, and the second was called "Injected".
    #
    # It is checked from both sides, and neither on its own proves anything. An
    # empty browser would show no duplicate simply because there is nothing to
    # duplicate; and the mere fact that an EIP-6963 wallet is visible would not
    # say whether the redundant row is gone. So there are two runs here: without a
    # wallet and with one injected.
    print("\n-- the wallet choice --")

    ANNOUNCE = """
    () => {
      const info = {
        uuid: "11111111-2222-3333-4444-555555555555",
        name: "Nebula Wallet",
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
        rdns: "app.nebula",
      };
      const provider = {
        request: async () => { throw new Error("no"); },
        on() {}, removeListener() {},
      };
      const detail = Object.freeze({ info, provider });
      const announce = () =>
        window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    }
    """

    def wallet_names(ctx):
        page = ctx.new_page()
        page.goto(URL, wait_until="load")
        page.wait_for_timeout(2500)
        page.get_by_text("Connect wallet").first.click()
        page.wait_for_timeout(700)
        out = page.eval_on_selector_all(
            "details div button",
            "els => els.map(e => e.textContent.trim()).filter(Boolean)",
        )
        page.close()
        return out

    plain = wallet_names(browser.new_context(viewport={"width": 1400, "height": 900}))
    check("there is something to choose with no wallet at all", len(plain) > 0, ", ".join(plain) or "empty")
    check(
        "no row is called 'Injected'",
        "Injected" not in plain,
        ", ".join(plain),
    )

    found = browser.new_context(viewport={"width": 1400, "height": 900})
    found.add_init_script(f"({ANNOUNCE})()")
    named = wallet_names(found)
    check(
        "the browser wallet comes first and under its own name",
        named[:1] == ["Nebula Wallet"],
        ", ".join(named),
    )
    check(
        "there is no generic duplicate beside it",
        not any(n in ("Injected", "Browser wallet") for n in named),
        ", ".join(named),
    )

    # -- moderation: renewing a deck ------------------------------------------
    #
    # The one page that cannot be seen anonymously: it asks the chain for owner()
    # and compares it with the connected wallet. So a READ ONLY wallet is injected
    # here, the owner's address alone with no key at all. It can sign nothing, and
    # it does not need to: what is checked is what is on the screen, not what is
    # in the chain.
    #
    # Nobody refills a played out deck, so the only renewal is a fresh copy beside
    # it. The button for that exists on house decks exactly: a copy of somebody
    # else's made from here would pay the creator's share to nobody.
    print("\n-- moderation --")
    boss = EXPECTED.get("owner")
    house = EXPECTED.get("recutableDecks") or []
    if not boss:
        check("the owner is known from the chain", False, "there is no owner in audit-expected.json")
    else:
        provider = (
            "(() => {"
            "  const listeners = {};"
            "  const provider = {"
            "    isMetaMask: true,"
            "    request: async ({ method, params }) => {"
            f"      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return ['{boss}'];"
            "      if (method === 'eth_chainId') return '0x14a34';"
            "      if (method === 'net_version') return '84532';"
            "      if (method === 'wallet_switchEthereumChain') return null;"
            "      const r = await fetch('https://sepolia.base.org', {"
            "        method: 'POST', headers: { 'content-type': 'application/json' },"
            "        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? [] }),"
            "      });"
            "      const j = await r.json();"
            "      if (j.error) throw new Error(j.error.message);"
            "      return j.result;"
            "    },"
            "    on: (e, fn) => { (listeners[e] ||= []).push(fn); return provider; },"
            "    removeListener: () => provider,"
            "  };"
            "  window.ethereum = provider;"
            "  const info = { uuid: '00000000-0000-4000-8000-000000000001',"
            "    name: 'Audit Wallet', rdns: 'dev.tessera.audit',"
            "    icon: 'data:image/svg+xml;base64,PHN2Zy8+' };"
            "  const announce = () => window.dispatchEvent(new CustomEvent("
            "    'eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));"
            "  window.addEventListener('eip6963:requestProvider', announce);"
            "  announce();"
            "})();"
        )
        mod = browser.new_context(viewport={"width": 1600, "height": 1000})
        mod.add_init_script(provider)
        mp = mod.new_page()
        mp.goto(URL + "/moderation", wait_until="load")
        mp.wait_for_timeout(2500)
        for name in ("Audit Wallet", "Connect wallet", "Connect"):
            btn = mp.get_by_text(name, exact=False)
            if btn.count():
                try:
                    btn.first.click(timeout=2500)
                    mp.wait_for_timeout(1500)
                except Exception:
                    pass
        mp.wait_for_timeout(6000)

        body = mp.locator("body").inner_text()
        check("the owner sees moderation", "Moderation" in body, body[:60].replace("\n", " "))
        # The text has to say what the contract does. The rule changed, a deck now
        # reshuffles itself, so the check asserts the new thing rather than the
        # old. Leaving "cannot be refilled" here would mean demanding a lie from
        # the site and failing on the truth.
        deals = "deals itself again" in body
        check(
            "it says the deck reshuffles itself",
            deals,
            "the explanation is in place" if deals else "the explanation is gone",
        )
        # And separately, where the money for it comes from. A mechanic that
        # depends on an outside balance would look eternal without this line.
        fund = "Reseal fund" in body
        check(
            "it says what the reshuffles are paid with",
            fund,
            "the fund is shown" if fund else "not a word about the fund",
        )

        cuts = mp.get_by_role("button", name=re.compile("Cut a fresh copy"))
        # Not "on house decks" but "on those whose table fits the budget". A deck
        # that promises beyond the commission cannot have a copy: the contract
        # will reject it, and the button would be a promise of a revert.
        check(
            "the copy button is on exactly the decks that fit the budget",
            cuts.count() == len(house),
            f"buttons {cuts.count()}, eligible decks {len(house)}",
        )

        if cuts.count():
            cuts.first.click()
            mp.wait_for_timeout(2500)
            panel = mp.locator("body").inner_text()
            # The Inco fee has to be a NUMBER rather than "unknown": without it
            # the owner signs a transaction without knowing the price.
            fee = re.search(r"([\d.]+) ETH", panel)
            check("the copy panel shows the fee as a number", bool(fee), fee.group(0) if fee else "none")
            check(
                "the copy panel shows the drop table",
                "drop table" in panel and "→" in panel,
                "the table is in place" if "drop table" in panel else "there is no table",
            )
            check(
                "the copy panel does not promise a refill",
                "does not refill" in panel,
                "said outright" if "does not refill" in panel else "the promise is ambiguous",
            )
        mod.close()

    browser.close()

print("\n" + "═" * 62)
print(f"passed {sum(rows) }, failed {len(fails)}")
for f in fails:
    print("  ✗", f)
print(f"\nconsole errors: {len(set(console))}")
for c in list(dict.fromkeys(console))[:6]:
    print("  ", c)
print(f"4xx/5xx responses: {len(set(bad_http))}")
for b in list(dict.fromkeys(bad_http))[:6]:
    print("  ", b)
sys.exit(1 if fails else 0)
