"""Level 5: the integrity of the ~/brain knowledge base.

It changes nothing, it only shows what is worth merging, fixing or throwing
away. The base grows for years, and the only things that happen to it unattended
are duplicates, broken links and facts that used to be true.

    python3 audit-brain.py [path to brain] [--project name]

There is one base for every project, and the audit is run from a particular
repository. Without `--project` it reported on other people's entries:
seventy five dead index rows from ccpedia, partiq and rampart hung in red in the
Tessera audit, where nobody was going to touch them. A project audit has to
answer for the project, otherwise people learn to scroll past its red.

Membership is determined by the text of an entry rather than by the folder:
`bugs/` is shared, and sorting it by project would have to be done across the
whole base at once.
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
    print(f"  {'✓' if ok else '✗'} {name}{'  - ' + detail if detail else ''}")
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
    """Whether an entry concerns the project the audit was run for."""
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

print("\n-- the contents --")
for d in sorted(by_dir):
    print(f"    {d:<16} {len(by_dir[d])}")
if PROJECT:
    # How much is left out of the review, said out loud. A silent narrowing
    # would read as "everything was checked" when only part of it was.
    print(f"    {'(other projects)':<16} {skipped} not checked")
check("the base is in place", len(all_md) > 0, f"{len(all_md)} entries for the project" if PROJECT else f"{len(all_md)} entries")

# -- duplicates ----------------------------------------------------------
# The same case written down twice: different headings, one substance. We
# compare by the file name without the date, which is where the substance lives.
print("\n-- duplicates --")
def slug(path):
    n = os.path.basename(path)[:-3]
    return re.sub(r"^\d{4}-\d{2}(-\d{2})?-", "", n)


def is_log(path):
    """Monthly journals and wins are a series rather than duplicates."""
    return re.fullmatch(r"\d{4}-\d{2}", os.path.basename(path)[:-3]) is not None


pairs = []
for d, group in by_dir.items():
    group = [f for f in group if not is_log(f)]
    for i, a in enumerate(group):
        for b in group[i + 1 :]:
            if SequenceMatcher(None, slug(a), slug(b)).ratio() < 0.72:
                continue
            # A similar name is not the same case yet. The text decides: two
            # different defects with similar names turn up more often than real
            # duplicates.
            ta = open(a, encoding="utf-8", errors="replace").read()
            tb = open(b, encoding="utf-8", errors="replace").read()
            r = SequenceMatcher(None, ta, tb).ratio()
            if r >= 0.6:
                pairs.append((round(r, 2), os.path.relpath(a, BRAIN), os.path.relpath(b, BRAIN)))
pairs.sort(reverse=True)
check("similar enough to merge", len(pairs) == 0, f"{len(pairs)} pairs")
for r, a, b in pairs[:8]:
    note(f"similar ({r}): {a}  and  {b}")

# -- links ---------------------------------------------------------------
print("\n-- links --")
names = {os.path.basename(f)[:-3] for f in all_md}
paths = {os.path.relpath(f, BRAIN) for f in all_md}
broken_wiki, broken_path = [], []
for f in all_md:
    # The monthly journal and the wins mix projects by construction: one file
    # per month, and inside it Tessera, Celestia and ccpedia alike. A text
    # filter pulls in such a file whole, and then a link from somebody else's
    # entry hangs in a project's report as its own, which is exactly what
    # happened here.
    if PROJECT and is_log(f):
        continue
    body = open(f, encoding="utf-8", errors="replace").read()
    for m in re.findall(r"\[\[([^\]]+)\]\]", body):
        if m not in names:
            broken_wiki.append(f"{os.path.relpath(f, BRAIN)} → [[{m}]]")
    # A path marked "not written" is an intention rather than a broken link:
    # it promises nothing and for that very reason misleads nobody.
    for m in re.finditer(r"~/brain/([A-Za-z0-9\-_/]+\.md)`?(?P<tail>[^\n]{0,20})", body):
        target = m.group(1)
        if target in paths or "not written" in m.group("tail"):
            continue
        broken_path.append(f"{os.path.relpath(f, BRAIN)} → ~/brain/{target}")
# A link to an entry that has not been written yet is allowed by convention,
# it marks something worth writing. But [[with/a/slash]] will never match:
# that is a format error.
malformed = [b for b in broken_wiki if "/" in b.split("[[")[-1]]
check("there are no links with a malformed format", not malformed, f"{len(malformed)} of them")
for b in malformed[:6]:
    note(f"the [[...]] format: {b}")
print(f"    links to entries not written yet: {len(broken_wiki) - len(malformed)} (allowed by convention)")
check("the ~/brain/... paths lead to files that exist", not broken_path, f"{len(broken_path)} broken")
for b in broken_path[:6]:
    note(f"broken path: {b}")

# -- the index -----------------------------------------------------------
print("\n-- MEMORY.md as an index --")
idx_path = os.path.join(BRAIN, "MEMORY.md")
if not os.path.exists(idx_path):
    check("MEMORY.md exists", False, "none")
else:
    idx = open(idx_path, encoding="utf-8", errors="replace").read()
    linked = set(re.findall(r"\(([A-Za-z0-9\-_/]+\.md)\)", idx))
    # A dead row leads to a file that does not exist, so it cannot be read and
    # asked "whose are you". The name is all that is left, and it is also the
    # only honest filter.
    if PROJECT:
        linked = {l for l in linked if PROJECT in l.lower()}
    missing = [l for l in linked if l not in paths and os.path.basename(l)[:-3] not in names]
    check("the index rows lead to files that exist", not missing, f"{len(missing)} dead")
    for m in missing[:6]:
        note(f"the index leads nowhere: {m}")
    check("the index is not empty", len(linked) > 0, f"{len(linked)} links")

# -- required fields in bug write ups -----------------------------------
print("\n-- the format of the bugs entries --")
bugs = by_dir.get("bugs", [])
need = ("problem", "cause", "fix")
thin = []
for f in bugs:
    body = open(f, encoding="utf-8", errors="replace").read().lower()
    if not all(k in body for k in need):
        thin.append(os.path.relpath(f, BRAIN))
check(
    "every entry has a problem, a cause and a fix",
    len(thin) <= len(bugs) * 0.15,
    f"{len(thin)} of {len(bugs)} without the full set",
)
for t in thin[:6]:
    note(f"incomplete entry: {t}")

# -- tags ----------------------------------------------------------------
tags = Counter()
for f in bugs:
    body = open(f, encoding="utf-8", errors="replace").read()
    tags.update(re.findall(r"#([a-zA-Z][\w\-]+)", body))
print(f"\n  most frequent tags: {', '.join(f'#{t}x{n}' for t, n in tags.most_common(8))}")

# -- the tessera project: is it written down and has it gone stale -------
print("\n-- the tessera project --")
proj = os.path.join(BRAIN, "projects", "tessera.md")
check("there is project context", os.path.exists(proj), os.path.relpath(proj, BRAIN))
if os.path.exists(proj):
    body = open(proj, encoding="utf-8", errors="replace").read()
    for word, why in [
        ("DEPLOY", "how changes reach production"),
        ("browser-e2e", "what to check it with"),
        ("api/opens", "where the shared chain read lives"),
    ]:
        check(f"{why} is mentioned", word in body, word)

print("\n" + "═" * 62)
print(f"passed {sum(rows)}, failed {len(fails)}")
for f in fails:
    print("  ✗", f)
if notes:
    print(f"\nto look at by hand ({len(notes)}):")
    for n in notes[:20]:
        print("  ·", n)
sys.exit(1 if fails else 0)
