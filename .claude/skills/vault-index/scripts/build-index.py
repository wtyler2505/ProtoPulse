#!/usr/bin/env python3
"""
build-index.py — Build the plan↔vault↔code backlink index.

Scans:
  - docs/superpowers/plans/**/*.md for references to knowledge/<slug>
  - client/src/**/*.{ts,tsx,js,jsx} and server/**/*.{ts,js} for VaultHoverCard /
    VaultExplainer / useVaultNote / useVaultSearch slug usages
  - knowledge/**/*.md frontmatter for `related` / `supersedes` / `superseded-by`

Emits ops/index/plan-vault-backlinks.json (schema v1).

Usage:
  build-index.py                  # rebuild
  build-index.py --json           # emit result summary to stdout
  build-index.py --query <slug>   # show backlinks for one note
  build-index.py --orphans        # list orphan notes
  build-index.py --stale-days N   # flag stale backlinks (default 90)
  build-index.py --repo-root /path

Exit codes:
  0 — ok
  1 — no notes found (unexpected)
  2 — write failure
"""

from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required. pip install --user pyyaml\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)

# Plan/code reference patterns (capture group = slug)
PLAN_PATTERNS = [
    re.compile(r"knowledge/([a-z0-9][a-z0-9-]*)\.md"),
    re.compile(r"\[\[([a-z0-9][a-z0-9-]*)\]\]"),
    re.compile(r'slug="([a-z0-9][a-z0-9-]*)"'),
    re.compile(r"slug='([a-z0-9][a-z0-9-]*)'"),
]
CODE_PATTERNS = [
    re.compile(r'<VaultHoverCard[^>]*\bslug=["\']([a-z0-9][a-z0-9-]*)["\']'),
    re.compile(r'<VaultExplainer[^>]*\bslug=["\']([a-z0-9][a-z0-9-]*)["\']'),
    re.compile(r'useVaultNote\(["\']([a-z0-9][a-z0-9-]*)["\']'),
    re.compile(r'useVaultQuickFetch\(["\']([a-z0-9][a-z0-9-]*)["\']'),
]

EXCLUDE_DIRS = {"node_modules", "dist", "build", "coverage", ".git",
                ".cache", ".next", "tmp", "archive"}


def extract_frontmatter(text: str) -> dict:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    try:
        data = yaml.safe_load(m.group(1))
        return data if isinstance(data, dict) else {}
    except yaml.YAMLError:
        return {}


def iter_files(root: Path, relative_dir: str, exts: set[str]):
    base = root / relative_dir
    if not base.is_dir():
        return
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue
        if any(part in EXCLUDE_DIRS for part in p.parts):
            continue
        yield p


def git_mtime(path: Path) -> dt.datetime | None:
    try:
        out = subprocess.check_output(
            ["git", "log", "-1", "--format=%cI", "--", str(path)],
            stderr=subprocess.DEVNULL, text=True,
        ).strip()
        if not out:
            return None
        return dt.datetime.fromisoformat(out)
    except (subprocess.CalledProcessError, OSError, ValueError):
        return None


def scan_refs(path: Path, patterns: list[re.Pattern]) -> list[tuple[int, str, str]]:
    """Return list of (line_number_1based, slug, excerpt)."""
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []
    hits = []
    lines = text.splitlines()
    for i, line in enumerate(lines, start=1):
        for pat in patterns:
            for m in pat.finditer(line):
                slug = m.group(1)
                excerpt = line.strip()[:200]
                hits.append((i, slug, excerpt))
    return hits


def build(root: Path, stale_days: int) -> dict:
    knowledge = root / "knowledge"
    if not knowledge.is_dir():
        sys.stderr.write(f"ERROR: {knowledge} not found\n")
        sys.exit(1)

    # Collect knowledge slugs and frontmatter
    notes: dict[str, dict[str, Any]] = {}
    for md in knowledge.rglob("*.md"):
        if any(part == "archive" for part in md.parts):
            continue
        if md.name == "index.md":
            continue
        slug = md.stem
        text = md.read_text(encoding="utf-8", errors="ignore")
        fm = extract_frontmatter(text)
        notes[slug] = {
            "file": str(md.relative_to(root)),
            "referenced_by_plans": [],
            "consumed_by_code": [],
            "outgoing_related": list(fm.get("related") or []),
            "outgoing_supersedes": list(fm.get("supersedes") or []),
            "outgoing_superseded_by": list(fm.get("superseded-by") or []),
            "incoming_related": [],
            "last_indexed": None,
        }

    # Scan plans
    plan_count = 0
    for md in iter_files(root, "docs/superpowers/plans", {".md"}):
        plan_count += 1
        for line, slug, excerpt in scan_refs(md, PLAN_PATTERNS):
            if slug in notes:
                notes[slug]["referenced_by_plans"].append({
                    "plan": str(md.relative_to(root)),
                    "line": line,
                    "excerpt": excerpt,
                })

    # Scan code
    code_count = 0
    for base_dir, exts in [
        ("client/src", {".ts", ".tsx", ".js", ".jsx"}),
        ("server",     {".ts", ".js"}),
    ]:
        for src in iter_files(root, base_dir, exts):
            code_count += 1
            for line, slug, excerpt in scan_refs(src, CODE_PATTERNS):
                if slug in notes:
                    notes[slug]["consumed_by_code"].append({
                        "file": str(src.relative_to(root)),
                        "line": line,
                        "context": excerpt[:100],
                    })

    # Build reverse-adjacency for `related`
    for slug, entry in notes.items():
        for other in entry["outgoing_related"]:
            if other in notes:
                notes[other]["incoming_related"].append(slug)

    # Broken references (related / supersedes pointing to nonexistent slugs)
    broken: list[dict[str, Any]] = []
    for slug, entry in notes.items():
        for field in ("outgoing_related", "outgoing_supersedes", "outgoing_superseded_by"):
            for ref in entry[field]:
                if ref not in notes:
                    broken.append({
                        "from": entry["file"],
                        "field": field.replace("outgoing_", ""),
                        "to_slug": ref,
                        "severity": "error",
                    })

    # Orphans
    orphans = [
        slug for slug, e in notes.items()
        if not e["referenced_by_plans"]
        and not e["consumed_by_code"]
        and not e["incoming_related"]
    ]

    # Timestamps
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    for e in notes.values():
        e["last_indexed"] = now

    total_backlinks = sum(
        len(e["referenced_by_plans"]) + len(e["consumed_by_code"])
        for e in notes.values()
    )

    return {
        "version": 1,
        "generated_at": now,
        "repo_root": str(root),
        "notes": notes,
        "orphans": sorted(orphans),
        "broken_references": broken,
        "stats": {
            "notes_indexed": len(notes),
            "plans_scanned": plan_count,
            "code_files_scanned": code_count,
            "total_backlinks": total_backlinks,
            "orphan_count": len(orphans),
            "broken_refs": len(broken),
        },
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--rebuild", action="store_true", default=True)
    p.add_argument("--json", action="store_true")
    p.add_argument("--query", default=None)
    p.add_argument("--orphans", action="store_true")
    p.add_argument("--stale-days", type=int, default=90)
    p.add_argument("--repo-root", default=None)
    args = p.parse_args()

    repo = Path(args.repo_root or (
        subprocess.check_output(["git", "rev-parse", "--show-toplevel"],
                                text=True, stderr=subprocess.DEVNULL).strip()
        if Path(".git").exists() else os.getcwd()
    )).resolve()

    index = build(repo, args.stale_days)

    # Write index
    out_dir = repo / "ops/index"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "plan-vault-backlinks.json"
    tmp = out_file.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(index, indent=2, default=str), encoding="utf-8")
    os.replace(tmp, out_file)

    # Views
    if args.query:
        entry = index["notes"].get(args.query)
        if not entry:
            print(f"no note '{args.query}' in index")
            return 0
        if args.json:
            print(json.dumps(entry, indent=2))
        else:
            print(f"## {args.query}\n")
            print(f"file: {entry['file']}")
            print(f"plans ({len(entry['referenced_by_plans'])}):")
            for r in entry["referenced_by_plans"][:20]:
                print(f"  - {r['plan']}:{r['line']}  {r['excerpt'][:80]}")
            print(f"code ({len(entry['consumed_by_code'])}):")
            for r in entry["consumed_by_code"][:20]:
                print(f"  - {r['file']}:{r['line']}  {r['context'][:80]}")
            print(f"outgoing related: {entry['outgoing_related']}")
            print(f"incoming related: {entry['incoming_related'][:20]}")
        return 0

    if args.orphans:
        if args.json:
            print(json.dumps({"orphans": index["orphans"]}, indent=2))
        else:
            print(f"orphans ({len(index['orphans'])}):")
            for s in index["orphans"][:100]:
                print(f"  - {s}")
            if len(index["orphans"]) > 100:
                print(f"  ... and {len(index['orphans']) - 100} more")
        return 0

    # Default summary
    stats = index["stats"]
    if args.json:
        print(json.dumps({"stats": stats, "output": str(out_file)}, indent=2))
    else:
        print(f"vault-index rebuilt → {out_file}")
        print(f"  notes_indexed:      {stats['notes_indexed']}")
        print(f"  plans_scanned:      {stats['plans_scanned']}")
        print(f"  code_files_scanned: {stats['code_files_scanned']}")
        print(f"  total_backlinks:    {stats['total_backlinks']}")
        print(f"  orphan_count:       {stats['orphan_count']}")
        print(f"  broken_refs:        {stats['broken_refs']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
