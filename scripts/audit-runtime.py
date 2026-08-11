"""4: .

, . RPC ,
, , .

    python3 audit-runtime.py [url]
"""

import collections
import sys
import time

from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "https://tessera.unitynodes.com").rstrip("/")
MINUTE = 60_000

rows, fails = [], []


def check(name, ok, detail=""):
    rows.append(ok)
    print(f"  {'✓' if ok else '✗'} {name}{', ' + detail if detail else ''}")
    if not ok:
        fails.append(f"{name}: {detail}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ── ────────────
    print("\n── ──")
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

    check("RPC ", n["429"] == 0, f"{n['rpc']} , 429 {n['429']}")
    check(
        "RPC ",
        n["rpc"] <= 40,
        f"{n['rpc']} (40)",
    )
    check(
        "",
        n["inco5xx"] == 0,
        f"{n['inco']} , 5xx {n['inco5xx']}",
    )
    page.close()

    # ── : ────────────────────────
    print("\n── ──")
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    page.goto(URL, wait_until="load")
    first = None
    t0 = time.time()
    # data-drop, .
    #
    # img[src*='/chests/']
    # , TESA <Shards>: ,
    # 60 '.
    # .
    for _ in range(30):
        page.wait_for_timeout(2000)
        tiles = page.locator("[data-drop]").count()
        if tiles:
            first = round(time.time() - t0)
            break
    check(
        "'",
        first is not None and first <= 15,
        f"{first} " if first else "60 '",
    )
    page.close()

    # ── ───────────────────
    #
    # SDK Inco 214 780 : ML-KEM, Keccak
    # effect. , ,
    # , .
    # , :
    # 3G '5.7 2.7.
    #
    # , . :
    # load. :
    # , ,
    # , '.
    print("\n── ──")
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
        "SDK ",
        early["before"] == 0,
        f"{early['wire']} load" if early["before"] == 0
        else f"load: {early['before']}",
    )

    page.wait_for_timeout(12000)
    warmed = page.evaluate(
        """() => performance.getEntriesByType('resource')
             .some(x => x.decodedBodySize > 600000)"""
    )
    check("", warmed, "" if warmed else "")
    page.close()
    browser.close()

print("\n" + "═" * 62)
print(f"{sum(rows)}, {len(fails)}")
for f in fails:
    print("  ✗", f)
sys.exit(1 if fails else 0)
