""", .

    python3 chest-cut.py ../kungfumode.png ../kungfumode-chest.png

, , :
, ,
, .
.

── ──────────────────────────────────────────────────────

:
. , .

, ; ,
.

1. '. :
   , , .
   , .

2. . , ,
   .
   .

3. . ,
   . ,
   , .

3 2. '
, ,
. : 5
.
"""

import sys
from collections import deque
import colorsys
from PIL import Image, ImageFilter

# , . ,
# .
WINDOW = (430, 600, 1000, 1024)
OPEN_RADIUS = 13


def chest_mask(im: Image.Image, box) -> Image.Image:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    px = im.load()
    mask = Image.new("L", (w, h), 0)
    m = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x0 + x, y0 + y]
            if a < 30:
                continue
            hue, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            pink = hue < 0.06 or hue > 0.85
            if (pink and s > 0.55) or (v < 0.42 and s > 0.30):
                m[x, y] = 255
    return mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))


def keep_largest(mask: Image.Image) -> None:
    w, h = mask.size
    m = mask.load()
    label = [[0] * h for _ in range(w)]
    best = (0, None)
    seq = 0
    for sx in range(w):
        for sy in range(h):
            if m[sx, sy] == 0 or label[sx][sy]:
                continue
            seq += 1
            size = 0
            q = deque([(sx, sy)])
            label[sx][sy] = seq
            while q:
                x, y = q.popleft()
                size += 1
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not label[nx][ny] and m[nx, ny]:
                        label[nx][ny] = seq
                        q.append((nx, ny))
            if size > best[0]:
                best = (size, seq)
    for x in range(w):
        for y in range(h):
            if label[x][y] != best[1]:
                m[x, y] = 0


def fill_holes(mask: Image.Image) -> None:
    """, , ."""
    w, h = mask.size
    m = mask.load()
    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if m[x, y] == 0 and not seen[x][y]:
                seen[x][y] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if m[x, y] == 0 and not seen[x][y]:
                seen[x][y] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and m[nx, ny] == 0:
                seen[nx][ny] = True
                q.append((nx, ny))
    for x in range(w):
        for y in range(h):
            if m[x, y] == 0 and not seen[x][y]:
                m[x, y] = 255


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]

    im = Image.open(src).convert("RGBA")
    mask = chest_mask(im, WINDOW)

    keep_largest(mask)
    fill_holes(mask)
    mask = mask.filter(ImageFilter.MinFilter(OPEN_RADIUS))
    keep_largest(mask)
    mask = mask.filter(ImageFilter.MaxFilter(OPEN_RADIUS))
    fill_holes(mask)
    # :
    # , .
    mask = mask.filter(ImageFilter.GaussianBlur(1.0))

    out = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    out.paste(im.crop(WINDOW), (0, 0), mask)
    out = out.crop(out.getbbox())
    out.save(dst)
    print(f"{out.width}×{out.height} → {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
