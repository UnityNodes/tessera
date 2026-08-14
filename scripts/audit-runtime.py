"""Level 4: how much the site weighs on other people's services and how fast it comes alive.

The question here is not "is the number right" but "will it hold". The public
RPC throttles under load and the covalidators refuse large batches; both have
already turned a live game into a dead picture once, and both have to be
measured rather than assumed.

    python3 audit-runtime.py [url]
"""

import collections
import sys
import re
import time

from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "https://tessera.unitynodes.com").rstrip("/")
MINUTE = 60_000

rows, fails = [], []


def check(name, ok, detail=""):
    rows.append(ok)
    print(f"  {'✓' if ok else '✗'} {name}{'  - ' + detail if detail else ''}")
    if not ok:
        fails.append(f"{name}: {detail}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # -- load on other people's services per minute of a tab's life ------
    print("\n-- load per minute --")
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    n = collections.Counter()

    def on_resp(r):
        if "sepolia.base.org" in r.url:
            n["rpc"] += 1
            if r.status == 429:
                n["429"] += 1
        if "inco.org" in r.url:
            n["inco"] += 1
            if r.status >= 500:
                n["inco5xx"] += 1

    page.on("response", on_resp)
    page.goto(f"{URL}/case/1", wait_until="load")
    page.wait_for_timeout(MINUTE)

    check("the public RPC does not throttle", n["429"] == 0, f"{n['rpc']} requests, 429s among them: {n['429']}")
    check(
        "there are not many RPC requests",
        n["rpc"] <= 40,
        f"{n['rpc']} per minute (ceiling 40)",
    )
    check(
        "the covalidators do not refuse",
        n["inco5xx"] == 0,
        f"{n['inco']} requests, 5xx among them: {n['inco5xx']}",
    )
    page.close()

    # -- a cold visit: how soon the strip is visible ---------------------
    print("\n-- a cold visit --")
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    page.goto(URL, wait_until="load")
    first = None
    t0 = time.time()
    # We look for a tile by data-drop rather than by the chest picture inside it.
    #
    # The old check demanded img[src*='/chests/'] and started to lie the day TESA
    # became a vector in <Shards>: six tiles on screen, and the check reported
    # "did not appear within 60 s". A false alarm in an audit is worse than a
    # missing check, people learn to scroll past it.
    for _ in range(30):
        page.wait_for_timeout(2000)
        tiles = page.locator("[data-drop]").count()
        if tiles:
            first = round(time.time() - t0)
            break
    check(
        "the drops strip appears quickly",
        first is not None and first <= 15,
        f"{first} s" if first else "it did not appear within 60 s",
    )
    page.close()

    # -- what manages to load before the first paint ---------------------
    #
    # The Inco SDK weighs 214 KB compressed and 780 unpacked: ML-KEM, Keccak and
    # effect. It is needed exactly when a player reveals a card, not when they
    # are looking at the catalogue. While the warmup stood as a bare line at
    # module level, it began together with the first paint and took the channel
    # away: on 3G the first deck appeared after 5.7 s instead of 2.7.
    #
    # Two halves, and each is misleading on its own. First: the heavy chunk must
    # not be there before the load event. Second: it STILL has to be fetched,
    # otherwise an "optimisation" that simply threw the warmup away would look
    # like a win here while the first open hung for forty nine seconds.
    print("\n-- what loads before the first paint --")
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    page.goto(URL, wait_until="load")
    early = page.evaluate(
        """() => {
          const load = performance.getEntriesByType('navigation')[0].loadEventEnd;
          const heavy = performance.getEntriesByType('resource')
            .filter(x => x.decodedBodySize > 600000);
          return {
            load: Math.round(load),
            before: heavy.filter(x => x.startTime < load).length,
            wire: Math.round(performance.getEntriesByType('resource')
              .filter(x => x.responseEnd <= load)
              .reduce((n, x) => n + x.encodedBodySize, 0) / 1024),
          };
        }"""
    )
    check(
        "the heavy SDK takes no part in the first paint",
        early["before"] == 0,
        f"{early['wire']} KB over the wire before load" if early["before"] == 0
        else f"heavy chunks before load: {early['before']}",
    )

    page.wait_for_timeout(12000)
    warmed = page.evaluate(
        """() => performance.getEntriesByType('resource')
             .some(x => x.decodedBodySize > 600000)"""
    )
    check("but it warms up right after", warmed, "it finished loading in the background" if warmed else "it never finished loading at all")
    page.close()

    # -- the numbers in the HTML itself ----------------------------------
    #
    # The most important thing measured here. The page frame appeared in 0.4 s
    # and the deck numbers at 12.4: they lived only in JavaScript, and until then
    # a person looked at empty frames. Now the server reads the game state and
    # puts it straight into the markup.
    #
    # THE HTML ITSELF is checked, without a browser: anything visible only after
    # hydration does not count here, and that is exactly what the problem was.
    print("\n-- the numbers in the markup --")
    # Through the Playwright client rather than urllib: a bare request with no
    # User-Agent is rejected by the server with a 403, and the check would fail on
    # something other than what it measures.
    html = browser.new_context().request.get(URL).text()
    sealed = re.findall(r"(\d+)</strong> sealed", html)
    check(
        "the deck numbers arrive in the HTML",
        len(sealed) >= 2,
        f"found {len(sealed)}: {', '.join(sealed[:4])}" if sealed else "the markup holds the frame alone",
    )
    drops = html.count("data-drop")
    check(
        "the drops strip arrives in the HTML",
        drops > 0,
        f"{drops} tiles" if drops else "the strip is drawn by script only",
    )

    browser.close()

print("\n" + "═" * 62)
print(f"passed {sum(rows)}, failed {len(fails)}")
for f in fails:
    print("  ✗", f)
sys.exit(1 if fails else 0)
