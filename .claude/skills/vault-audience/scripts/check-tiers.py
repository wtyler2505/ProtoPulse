#!/usr/bin/env python3
"""
check-tiers.py — Validate audience-tier markers in vault note bodies.

Parses `### [beginner]` / `### [intermediate]` / `### [expert]` section headings and
compares to the note's `audience:` frontmatter. Reports:
  - declared-but-missing (audience tier listed, no matching section)
  - orphan-section (section present, tier not declared)
  - uncovered (no markers at all)

Usage:
  check-tiers.py                       # audit full vault
  check-tiers.py <slug>                # single note
  check-tiers.py --fill-stubs          # append missing-section stubs
  check-tiers.py --json
  check-tiers.py --tier beginner       # restrict audit to one tier

Exit codes:
  0 — ok
  1 — violations found
  2 — infrastructure error
"""

from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^(---\s*\n)(.*?)(\n---\s*)(?:\n|$)", re.DOTALL)
TIER_SECTION_RE = re.compile(
    r"^#{2,3}\s+\[(beginner|intermediate|expert)\]", re.MULTILINE | re.IGNORECASE
)
VALID_TIERS = {"beginner", "intermediate", "expert"}


def parse_note(path: Path) -> tuple[dict, str, set[str]]:
    """Return (frontmatter, body_text, tiers_present)."""
    text = path.read_text(encoding="utf-8", errors="ignore")
    m = FRONTMATTER_RE.match(text)
    if m:
        try:
            fm = yaml.safe_load(m.group(2)) or {}
            if not isinstance(fm, dict):
                fm = {}
        except yaml.YAMLError:
            fm = {}
        body = text[m.end():]
    else:
        fm = {}
        body = text
    tiers = {m.group(1).lower() for m in TIER_SECTION_RE.finditer(body)}
    return fm, body, tiers


def audit_note(path: Path, fm: dict, tiers_present: set[str]) -> dict:
    declared = set()
    for t in fm.get("audience") or []:
        if isinstance(t, str) and t.lower() in VALID_TIERS:
            declared.add(t.lower())

    missing = declared - tiers_present  # declared but no section
    orphans = tiers_present - declared   # section but not declared
    uncovered = not tiers_present and not declared

    return {
        "slug": path.stem,
        "file": str(path),
        "declared": sorted(declared),
        "present": sorted(tiers_present),
        "missing": sorted(missing),
        "orphans": sorted(orphans),
        "uncovered": uncovered,
    }


def iter_vault(repo: Path, single: str | None):
    if single:
        candidates = list((repo / "knowledge").rglob(f"{single}.md"))
        candidates = [c for c in candidates if "archive" not in c.parts]
        if not candidates:
            return
        yield candidates[0]
        return
    for p in (repo / "knowledge").rglob("*.md"):
        if "archive" in p.parts or p.name == "index.md":
            continue
        yield p


STUB_TEMPLATE = """
### [{tier}] _TODO_

_Stub appended by /vault-audience on {date}. Fill with {tier}-tier content: {guidance}_
"""

GUIDANCE = {
    "beginner": "plain-English explanation, no math, concrete scenario",
    "intermediate": "mechanism-level explanation with some math + 1-2 cross-links to adjacent notes",
    "expert": "edge cases, quirks, failure modes, contested data, workarounds",
}


def fill_stubs(path: Path, missing_tiers: set[str]) -> list[str]:
    if not missing_tiers:
        return []
    text = path.read_text(encoding="utf-8")
    today = dt.date.today().isoformat()
    appended = []
    addition = ""
    for tier in sorted(missing_tiers):
        addition += STUB_TEMPLATE.format(tier=tier, date=today, guidance=GUIDANCE[tier])
        appended.append(tier)
    new_text = text.rstrip() + "\n" + addition
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(new_text, encoding="utf-8")
    os.replace(tmp, path)
    return appended


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("slug", nargs="?", default=None)
    p.add_argument("--fill-stubs", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("--tier", choices=sorted(VALID_TIERS))
    p.add_argument("--repo-root", default=None)
    args = p.parse_args()

    repo = Path(args.repo_root or os.getcwd()).resolve()
    if not (repo / "knowledge").is_dir():
        for parent in repo.parents:
            if (parent / "knowledge").is_dir():
                repo = parent
                break

    reports = []
    for path in iter_vault(repo, args.slug):
        fm, _body, tiers = parse_note(path)
        r = audit_note(path, fm, tiers)
        if args.tier:
            r["missing"] = [t for t in r["missing"] if t == args.tier]
            r["present"] = [t for t in r["present"] if t == args.tier]
        reports.append(r)

    # Fill stubs mode
    fill_log = []
    if args.fill_stubs:
        for r in reports:
            missing = set(r["missing"])
            if args.tier:
                missing &= {args.tier}
            if missing:
                path = Path(r["file"])
                appended = fill_stubs(path, missing)
                fill_log.append({"slug": r["slug"], "appended": appended})

    # Aggregate
    totals = {
        "total_notes": len(reports),
        "uncovered": sum(1 for r in reports if r["uncovered"]),
        "any_section": sum(1 for r in reports if r["present"]),
        "missing_count": sum(len(r["missing"]) for r in reports),
        "orphan_count": sum(len(r["orphans"]) for r in reports),
    }
    per_tier_declared = Counter()
    per_tier_present = Counter()
    per_tier_missing = Counter()
    for r in reports:
        for t in r["declared"]:
            per_tier_declared[t] += 1
        for t in r["present"]:
            per_tier_present[t] += 1
        for t in r["missing"]:
            per_tier_missing[t] += 1

    out = {
        "totals": totals,
        "per_tier": {
            t: {
                "declared": per_tier_declared.get(t, 0),
                "present": per_tier_present.get(t, 0),
                "missing": per_tier_missing.get(t, 0),
            } for t in sorted(VALID_TIERS)
        },
        "fill_log": fill_log,
        "sample_violations": [r for r in reports if r["missing"] or r["orphans"]][:20],
    }

    if args.json:
        print(json.dumps(out, indent=2))
    else:
        print("## Vault Audience Coverage\n")
        print(f"Total notes:      {totals['total_notes']}")
        pct = (totals["any_section"] / totals["total_notes"] * 100) if totals["total_notes"] else 0
        print(f"With tiered:      {totals['any_section']} ({pct:.1f}%)")
        print(f"Uncovered legacy: {totals['uncovered']}\n")
        print("Per-tier coverage:")
        for t in sorted(VALID_TIERS):
            d = per_tier_declared.get(t, 0)
            pr = per_tier_present.get(t, 0)
            ms = per_tier_missing.get(t, 0)
            print(f"  {t:12s}  declared={d}  present={pr}  missing={ms}")
        if out["sample_violations"]:
            print("\nSample violations:")
            for r in out["sample_violations"][:10]:
                msg = []
                if r["missing"]: msg.append(f"missing={r['missing']}")
                if r["orphans"]: msg.append(f"orphan={r['orphans']}")
                print(f"  {r['slug']}: {', '.join(msg)}")
        if fill_log:
            print(f"\nStubs appended: {sum(len(f['appended']) for f in fill_log)} across {len(fill_log)} notes")

    violations = totals["missing_count"] + totals["orphan_count"]
    return 0 if violations == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
