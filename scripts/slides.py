"""Screenshots of the live game, laid out as a deck a judge can read.

    python3 slides.py [url]            -> /tmp/tessera-slides/tessera.pdf

Every frame here is the running site at tessera.unitynodes.com, taken by a
browser, not a mockup and not a render. Two of them come out of the demo film
instead: the roll and the reveal only exist while a real transaction is in
flight, and a screenshot cannot wait six seconds for the covalidators without
spending somebody's slot.

The wallet is injected read only: an address and nothing else, no key. It cannot
sign, which is the point. The shelf and the header show what that address really
holds on chain, and no transaction can happen by accident while the deck is being
made.

Each slide says one fact. A caption that repeats the picture is dead weight, so
every caption here names something the picture cannot say by itself: a number
from the chain, or the rule the screen is enforcing.
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "https://tessera.unitynodes.com").rstrip("/")
OUT = os.environ.get("OUT", "/tmp/tessera-slides")
FILM = os.environ.get("FILM", "/root/tessera/web/public/demo/tessera.mp4")

# The address the frames are taken under. It has the most opens on the board, so
# its shelf is not empty; read only, so it can look and never touch.
PLAYER = os.environ.get("PLAYER", "0xAe389544FBb71850e32d20829f48F6c26B5c46ad")

W, H = 1920, 1080
GROUND = (10, 15, 10)
PANEL = (15, 23, 18)
INK = (233, 240, 235)
DIM = (124, 144, 131)
ACCENT = (57, 255, 136)

# The same pair the site is set in, vendored next to this file so the deck comes
# out the same on a machine that has neither installed. See fonts/README.txt.
HERE = os.path.dirname(os.path.abspath(__file__))
ORBITRON = os.path.join(HERE, "fonts", "Orbitron-Bold.ttf")
INTER = os.path.join(HERE, "fonts", "Inter-Medium.ttf")
FALLBACK = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def font(path, size):
    return ImageFont.truetype(path if os.path.exists(path) else FALLBACK, size)


F_NUM = font(ORBITRON, 26)
F_TITLE = font(ORBITRON, 46)
F_CAP = font(INTER, 27)
F_FOOT = font(INTER, 21)
F_HERO = font(ORBITRON, 92)
F_LEAD = font(INTER, 31)
F_CHIP = font(ORBITRON, 20)

# A slide is a page, a caption and the shot it belongs to. Order is the order a
# person meets the product in: the promise, the pool, one case, the wait, the
# prize, the two extra rooms.
SLIDES = [
    ("home", "/", "The promise",
     "One dollar buys a real Megapot lottery ticket. The case rides on top of it.",
     "All three numbers under the hero are read from the chain, not written by us."),
    ("decks", "/#decks", "The decks",
     "Six decks, each a finite pool cut once and drawn without replacement.",
     "The payout rate on every card is arithmetic anyone can repeat from public events."),
    ("curve", "/#decks", "How a deck drained",
     "The back of a card plots the pool against real block time.",
     "An even slope and a batch opened in one minute look nothing alike, and that difference is the point."),
    ("case", "/case/4", "One case, one action",
     "Everything this deck holds, counted: 1 vault, 2 porphyry, 2 aureus, 30 TESA, 165 empty.",
     "The page does not scroll. The item, the price, the multiplier and the whole drop table sit on one screen."),
    ("roll", None, "The wait is the proof",
     "Inco covalidators take six to nine seconds to decrypt the slot.",
     "The strip runs at a constant speed and promises nothing, because the time is not ours to promise."),
    ("prize", None, "The chain answers first",
     "Only after the value arrives does the strip brake onto it.",
     "Nine cases in ten add nothing on top of the ticket, and the game says so plainly."),
    ("battles", "/battles", "Case battles",
     "Two players, one card each, and the higher card takes both tickets.",
     "The creator's card stays encrypted until an opponent has paid, so nobody can pick easy fights."),
    ("create", "/create", "Anyone can cut a deck",
     "Name it, colour it, choose the shape, and the contract shuffles it on chain.",
     "The contract refuses any table that promises more than its own commission earns."),
]


def shoot(page, path, url, hold=3500):
    page.goto(URL + url, wait_until="load")
    page.wait_for_timeout(hold)
    page.screenshot(path=path)


def capture():
    """The live pages, under a wallet that can look and cannot sign."""
    provider = """(() => {
      const provider = {
        isMetaMask: true,
        request: async ({ method, params }) => {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') return ['%s'];
          if (method === 'eth_chainId') return '0x14a34';
          if (method === 'net_version') return '84532';
          if (method === 'wallet_switchEthereumChain') return null;
          const r = await fetch('https://sepolia.base.org', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? [] }),
          });
          const j = await r.json();
          if (j.error) throw new Error(j.error.message);
          return j.result;
        },
        on: () => provider,
        removeListener: () => provider,
      };
      window.ethereum = provider;
      const info = { uuid: '00000000-0000-4000-8000-000000000002',
        name: 'Tessera', rdns: 'app.tessera.viewer',
        icon: 'data:image/svg+xml;base64,PHN2Zy8+' };
      const announce = () => window.dispatchEvent(new CustomEvent(
        'eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
      window.addEventListener('eip6963:requestProvider', announce);
      announce();
    })();""" % PLAYER

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--force-color-profile=srgb"])
        ctx = browser.new_context(viewport={"width": 1600, "height": 1000},
                                  device_scale_factor=2)
        ctx.add_init_script(provider)
        page = ctx.new_page()

        # Connect once. wagmi keeps it in localStorage, so the rest of the pages
        # open already connected.
        page.goto(URL, wait_until="load")
        page.wait_for_timeout(2500)
        for name in ("Tessera", "Connect wallet", "Connect"):
            btn = page.get_by_role("button", name=name, exact=False)
            if btn.count():
                try:
                    btn.first.click(timeout=2500)
                    page.wait_for_timeout(1200)
                except Exception:
                    pass
        page.wait_for_timeout(3000)

        for key, url, *_ in SLIDES:
            if url is None:
                continue
            path = f"{OUT}/shot-{key}.png"
            if key == "curve":
                # The curve lives on the back of a card, and on a wide screen a
                # card is one of six, so the line reads as a smudge. A narrow
                # viewport is the same page at a size where the curve is the
                # subject rather than a detail.
                narrow = ctx.browser.new_context(
                    viewport={"width": 900, "height": 1000}, device_scale_factor=3)
                narrow.add_init_script(provider)
                np = narrow.new_page()
                np.goto(URL + "/#decks", wait_until="load")
                np.wait_for_timeout(4000)
                flip = np.get_by_label("Show how this deck emptied")
                if not flip.count():
                    raise SystemExit("the flip button moved, the curve slide would be a copy")
                # The deck that has actually been played, not the first in the
                # row: a curve that never fell proves nothing.
                flip.nth(min(1, flip.count() - 1)).click()
                np.wait_for_timeout(2200)
                card = np.locator("[data-deck]").nth(min(1, flip.count() - 1))
                (card if card.count() else np).screenshot(path=path)
                narrow.close()
            else:
                shoot(page, path, url)
            print("  ", key)
        browser.close()


def from_film():
    """The two frames a screenshot cannot take without spending a slot."""
    for key, at in (("roll", 41.5), ("prize", 47.5)):
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(at), "-i", FILM,
                        "-frames:v", "1", f"{OUT}/shot-{key}.png", "-y"], check=True)
        print("  ", key, f"(film, {at}s)")


# What the curve is actually saying. It sits beside the card rather than under
# the title, because each line points at a different part of the same picture.
NOTES = {
    "curve": [
        ("THE LINE", "It can only fall. The pool is drawn without replacement, so a "
                     "card that leaves never comes back."),
        ("THE STEPS", "Flat stretches are quiet days, cliffs are somebody opening a "
                      "batch. Time is block time, not one pixel per open."),
        ("THE VAULT", "$1.50 is real money sitting in this deck, waiting for whoever "
                      "draws the one slot that opens it."),
    ],
}


def wrap(text, fnt, width, d):
    words, lines, line = text.split(), [], ""
    for w in words:
        probe = f"{line} {w}".strip()
        if d.textlength(probe, font=fnt) <= width:
            line = probe
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def rounded(img, radius=14):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *[v - 1 for v in img.size]],
                                           radius=radius, fill=255)
    out = Image.new("RGB", img.size, GROUND)
    out.paste(img, (0, 0), mask)
    return out


def cover():
    img = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 6], fill=ACCENT)
    d.text((110, 300), "TESSERA", font=F_HERO, fill=INK)
    d.text((114, 430), "A case opener where the odds are a fact you can recount.",
           font=F_LEAD, fill=INK)
    d.text((114, 486), "One dollar buys a real Megapot ticket. The case comes on top.",
           font=F_LEAD, fill=DIM)

    x = 114
    for chip in ("BASE SEPOLIA", "INCO LIGHTNING", "MEGAPOT", "SOLIDITY 0.8.30", "NEXT.JS 16"):
        w = d.textlength(chip, font=F_CHIP)
        d.rounded_rectangle([x, 600, x + w + 36, 646], radius=8,
                            outline=(40, 60, 48), width=2)
        d.text((x + 18, 613), chip, font=F_CHIP, fill=DIM)
        x += w + 52

    d.text((114, 900), "tessera.unitynodes.com", font=F_CAP, fill=ACCENT)
    d.text((114, 944), "tessera.unitynodes.com/demo   ·   github.com/UnityNodes/tessera",
           font=F_FOOT, fill=DIM)
    return img


def slide(n, key, title, line, note):
    img = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(img)

    d.text((110, 62), f"{n:02d}", font=F_NUM, fill=ACCENT)
    d.text((172, 56), title, font=F_TITLE, fill=INK)
    d.text((174, 124), line, font=F_CAP, fill=INK)
    d.text((174, 164), note, font=F_CAP, fill=DIM)

    shot = Image.open(f"{OUT}/shot-{key}.png").convert("RGB")
    tall = shot.width / shot.height < 1.3

    # A wide screenshot fills the slide. A single card does not: centred, it
    # leaves two hands of empty ground either side. So a tall shot goes left and
    # the room it frees pays for the reading of it.
    box_w = (W - 380) // 2 if tall else W - 300
    box_h = H - 340
    scale = min(box_w / shot.width, box_h / shot.height)
    shot = shot.resize((int(shot.width * scale), int(shot.height * scale)), Image.LANCZOS)
    shot = rounded(shot)
    x = 174 if tall else (W - shot.width) // 2
    y = 232
    d.rounded_rectangle([x - 2, y - 2, x + shot.width + 1, y + shot.height + 1],
                        radius=16, outline=(38, 58, 46), width=3)
    img.paste(shot, (x, y))

    for i, (head, body) in enumerate(NOTES.get(key, [])):
        top = y + 40 + i * 172
        left = x + shot.width + 96
        d.text((left, top), head, font=F_NUM, fill=ACCENT)
        wrapped = wrap(body, F_CAP, W - left - 150, d)
        for j, ln in enumerate(wrapped):
            d.text((left, top + 46 + j * 40), ln, font=F_CAP, fill=INK if j == 0 else DIM)

    d.text((110, H - 58), "tessera.unitynodes.com", font=F_FOOT, fill=DIM)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    print("live pages:")
    capture()
    print("from the film:")
    from_film()

    pages = [cover()]
    for i, (key, _, title, line, note) in enumerate(SLIDES, start=1):
        pages.append(slide(i, key, title, line, note))

    pdf = f"{OUT}/tessera.pdf"
    pages[0].save(pdf, save_all=True, append_images=pages[1:],
                  resolution=150.0, quality=88)
    size = os.path.getsize(pdf)
    print(f"\ndone: {pdf}  {len(pages)} slides, {size // 1024} KB")
    if size > 10 * 1024 * 1024:
        print("  over the 10 MB the form allows, drop the quality")


if __name__ == "__main__":
    main()
