"""5: ~/brain.

, , .
, , : ,
, .

    python3 audit-brain.py [brain] [--project ]

, .
`--project` : '
ccpedia, partiq rampart
Tessera, .
.

, : `bugs/` ,
.
"""

import os
import re
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher

argv = [a for a in sys.argv[1:] if not a.startswith("--")]
BRAIN = os.path.expanduser(argv[0] if argv else "~/brain")
PROJECT = next(
    (a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--project=")),
    None,
)

rows, fails, notes = [], [], []


def check(name, ok, detail=""):
    rows.append(ok)
    print(f"  {'✓' if ok else '✗'} {name}{', ' + detail if detail else ''}")
    if not ok:
        fails.append(f"{name}: {detail}")


def note(text):
    notes.append(text)


def files(sub=""):
    root = os.path.join(BRAIN, sub)
    out = []
    for dirpath, _, names in os.walk(root):
        for n in names:
            if n.endswith(".md"):
                out.append(os.path.join(dirpath, n))
    return sorted(out)


def belongs(path):
    """, ."""
    if not PROJECT:
        return True
    if PROJECT in os.path.basename(path).lower():
        return True
    return PROJECT in open(path, encoding="utf-8", errors="replace").read().lower()


everything = files()
all_md = [f for f in everything if belongs(f)]
skipped = len(everything) - len(all_md)

by_dir = defaultdict(list)
for f in all_md:
    by_dir[os.path.relpath(os.path.dirname(f), BRAIN)].append(f)

print("\n── ──")
for d in sorted(by_dir):
    print(f"    {d:<16} {len(by_dir[d])}")
if PROJECT:
    # .
    # , .
    print(f"    {'()':<16} {skipped} ")
check("", len(all_md) > 0, f"{len(all_md)} " if PROJECT else f"{len(all_md)} ")

# ── ────────────────────────────────────────────────────────────────
# , : , .
# .
print("\n── ──")
def slug(path):
    n = os.path.basename(path)[:-3]
    return re.sub(r"^\d{4}-\d{2}(-\d{2})?-", "", n)


def is_log(path):
    """, ."""
    return re.fullmatch(r"\d{4}-\d{2}", os.path.basename(path)[:-3]) is not None


pairs = []
for d, group in by_dir.items():
    group = [f for f in group if not is_log(f)]
    for i, a in enumerate(group):
        for b in group[i + 1 :]:
            if SequenceMatcher(None, slug(a), slug(b)).ratio() < 0.72:
                continue
            # . :
            # ,
            # .
            ta = open(a, encoding="utf-8", errors="replace").read()
            tb = open(b, encoding="utf-8", errors="replace").read()
            r = SequenceMatcher(None, ta, tb).ratio()
            if r >= 0.6:
                pairs.append((round(r, 2), os.path.relpath(a, BRAIN), os.path.relpath(b, BRAIN)))
pairs.sort(reverse=True)
check("", len(pairs) == 0, f"{len(pairs)} ")
for r, a, b in pairs[:8]:
    note(f"({r}): {a}  ↔  {b}")

# ── ────────────────────────────────────────────────────────────
print("\n── ──")
names = {os.path.basename(f)[:-3] for f in all_md}
paths = {os.path.relpath(f, BRAIN) for f in all_md}
broken_wiki, broken_path = [], []
for f in all_md:
    # :
    # , Tessera, Celestia, ccpedia.
    # ,
    # .
    if PROJECT and is_log(f):
        continue
    body = open(f, encoding="utf-8", errors="replace").read()
    for m in re.findall(r"\[\[([^\]]+)\]\]", body):
        if m not in names:
            broken_wiki.append(f"{os.path.relpath(f, BRAIN)} → [[{m}]]")
    # , , , :
    # .
    for m in re.finditer(r"~/brain/([A-Za-z0-9\-_/]+\.md)`?(?P<tail>[^\n]{0,20})", body):
        target = m.group(1)
        if target in paths or "" in m.group("tail"):
            continue
        broken_path.append(f"{os.path.relpath(f, BRAIN)} → ~/brain/{target}")
#
# , . [[/]] :
# .
malformed = [b for b in broken_wiki if "/" in b.split("[[")[-1]]
check("", not malformed, f"{len(malformed)} .")
for b in malformed[:6]:
    note(f"[[…]]: {b}")
print(f"    : {len(broken_wiki) - len(malformed)} ()")
check("~/brain/… ", not broken_path, f"{len(broken_path)}")
for b in broken_path[:6]:
    note(f": {b}")

# ── ───────────────────────────────────────────────────────────────
print("\n── MEMORY.md ──")
idx_path = os.path.join(BRAIN, "MEMORY.md")
if not os.path.exists(idx_path):
    check("MEMORY.md ", False, "")
else:
    idx = open(idx_path, encoding="utf-8", errors="replace").read()
    linked = set(re.findall(r"\(([A-Za-z0-9\-_/]+\.md)\)", idx))
    # ,
    # . '.
    if PROJECT:
        linked = {l for l in linked if PROJECT in l.lower()}
    missing = [l for l in linked if l not in paths and os.path.basename(l)[:-3] not in names]
    check("", not missing, f"{len(missing)}")
    for m in missing[:6]:
        note(f": {m}")
    check("", len(linked) > 0, f"{len(linked)} ")

# ── '───────────────────────────────────
print("\n── bugs ──")
bugs = by_dir.get("bugs", [])
need = ("", "", "")
thin = []
for f in bugs:
    body = open(f, encoding="utf-8", errors="replace").read().lower()
    if not all(k in body for k in need):
        thin.append(os.path.relpath(f, BRAIN))
check(
    "/ / ",
    len(thin) <= len(bugs) * 0.15,
    f"{len(thin)} {len(bugs)} ",
)
for t in thin[:6]:
    note(f": {t}")

# ── ─────────────────────────────────────────────────────────────────
tags = Counter()
for f in bugs:
    body = open(f, encoding="utf-8", errors="replace").read()
    tags.update(re.findall(r"#([a-zA-Z][\w\-]+)", body))
print(f"\n  : {', '.join(f'#{t}×{n}' for t, n in tags.most_common(8))}")

# ── tessera: ────────────────────────
print("\n── tessera ──")
proj = os.path.join(BRAIN, "projects", "tessera.md")
check("", os.path.exists(proj), os.path.relpath(proj, BRAIN))
if os.path.exists(proj):
    body = open(proj, encoding="utf-8", errors="replace").read()
    for word, why in [
        ("DEPLOY", ""),
        ("browser-e2e", ""),
        ("api/opens", ""),
    ]:
        check(f"{why}", word in body, word)

print("\n" + "═" * 62)
print(f"{sum(rows)}, {len(fails)}")
for f in fails:
    print("  ✗", f)
if notes:
    print(f"\n({len(notes)}):")
    for n in notes[:20]:
        print("  ·", n)
sys.exit(1 if fails else 0)
