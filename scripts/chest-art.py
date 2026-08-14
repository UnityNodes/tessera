"""Cut a chest picture into the three sizes the site shows it at.

    python3 chest-art.py <source> <name>
    python3 chest-art.py ../kungfumode.png kungfumode

It puts three files into web/public/chests, <name>.webp, -md and -sm, exactly
the ones `sized()` in components/Chest.tsx expects:

    <= 80 displayed -> -sm (160)    the thumbnail in the contents table, the strip
    <= 192          -> -md (384)    the deck card, the choice in a battle
    larger          -> the original the hero of the case page

Why three files rather than one. Measured earlier: a thumbnail at 44 pixels
pulled a 760 pixel file of 128 KB, seventeen times larger than the space it is
put into, and six such thumbnails gave 377 KB out of the whole page's 441 KB.

-- What is done to the picture ----------------------------------------

1. The white background is cut out if there is one. On the site a chest stands
   on a dark ground, and a white rectangle around it is visible from across the
   screen.
2. The transparent margins are cropped and the item is centred in a square.
   Without this two neighbouring rungs of the ladder are drawn at different
   sizes simply because one source has more emptiness at the edges.
3. A small margin around it: the tier glow is drawn as a shadow OUTSIDE the
   picture, but the corners of the item must not touch the edge, otherwise the
   mask cuts them off.

Keying out the white is a fallback rather than a method. It leaves a light halo
on soft edges; if there is a source with a transparent background, take it, and
the script will simply crop and align.
"""

import sys
import os
from PIL import Image

PAD = 0.06  # the share of a side given to the margin around the item
SIZES = {"": None, "-md": 384, "-sm": 160}
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "chests")


def drop_white(im: Image.Image, cut: int = 238) -> Image.Image:
    """Remove the white background if the picture arrived on white.

    It works from the EDGE inward only: a flood fill from the frame. Otherwise
    the white highlights on the chest itself, and every chest has them, would
    become holes in the item.
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
    """Crop the transparent margins and centre the item in a square."""
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
    # If the corners are already transparent there is no background to remove and
    # no need to.
    corners = [im.getpixel(p) for p in ((0, 0), (im.width - 1, 0), (0, im.height - 1))]
    if all(c[3] > 200 for c in corners):
        print("the background is opaque, cutting the white from the edges")
        im = drop_white(im)
    else:
        print("the background is already transparent, leaving it as it is")

    im = square(im)
    os.makedirs(OUT, exist_ok=True)

    for suffix, px in SIZES.items():
        out = im if px is None else im.resize((px, px), Image.LANCZOS)
        path = os.path.join(OUT, f"{name}{suffix}.webp")
        out.save(path, "WEBP", quality=88, method=6)
        print(f"  {os.path.basename(path):<28} {out.width}x{out.height}  {os.path.getsize(path) // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
