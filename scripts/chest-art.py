""", .

    python3 chest-art.py <> <'>
    python3 chest-art.py ../kungfumode.png kungfumode

web/public/chests <'>.webp, -md, -sm ,
`sized()` components/Chest.tsx:

    ≤ 80 → -sm (160)      ,
    ≤ 192       → -md (384)      ,
    →

, . : 44
760-128
, , 377 441
.

── ────────────────────────────────────────────

1. , . ,
   .
2. , .
   , .
3. : ,
   , .

, .
'; , ,
.
"""

import sys
import os
from PIL import Image

PAD = 0.06  #
SIZES = {"": None, "-md": 384, "-sm": 160}
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "chests")


def drop_white(im: Image.Image, cut: int = 238) -> Image.Image:
    """, .

    : .
    .
    """
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = [[False] * h for _ in range(w)]
    stack = [(x, y) for x in range(w) for y in (0, h - 1)]
    stack += [(x, y) for y in range(h) for x in (0, w - 1)]

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]:
            continue
        r, g, b, a = px[x, y]
        if a == 0:
            seen[x][y] = True
            continue
        if r < cut or g < cut or b < cut:
            continue
        seen[x][y] = True
        px[x, y] = (r, g, b, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


def square(im: Image.Image) -> Image.Image:
    """."""
    box = im.getbbox()
    if box:
        im = im.crop(box)
    side = int(max(im.size) * (1 + PAD * 2))
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return out


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, name = sys.argv[1], sys.argv[2]

    im = Image.open(src).convert("RGBA")
    # .
    corners = [im.getpixel(p) for p in ((0, 0), (im.width - 1, 0), (0, im.height - 1))]
    if all(c[3] > 200 for c in corners):
        print("")
        im = drop_white(im)
    else:
        print("")

    im = square(im)
    os.makedirs(OUT, exist_ok=True)

    for suffix, px in SIZES.items():
        out = im if px is None else im.resize((px, px), Image.LANCZOS)
        path = os.path.join(OUT, f"{name}{suffix}.webp")
        out.save(path, "WEBP", quality=88, method=6)
        print(f"  {os.path.basename(path):<28} {out.width}×{out.height}  {os.path.getsize(path) // 1024} ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
