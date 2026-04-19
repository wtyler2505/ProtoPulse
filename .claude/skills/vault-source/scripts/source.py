#!/usr/bin/env python3
"""
source.py — Render provenance block of a vault note + vault-wide coverage.

Usage:
  source.py <slug>                 # render a single note's provenance
  source.py --coverage             # vault-wide coverage report
  source.py --unverified           # list notes missing provenance when confidence=verified
  source.py <slug> --json          # JSON output
  source.py --coverage --json

Exit codes:
  0 — ok
  1 — slug not found / no knowledge/
  2 — schema violation found (when using --unverified with --fail-on)
"""

from __future__ import annotations
import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required. pip install --user pyyaml\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)

KIND_EMOJI = {
    "datasheet": "📖",
    "standard": "🏛️ ",
    "vendor-doc": "📖",
    "textbook": "📚",
    "paper": "📄",
    "community": "💬",
    "experiment": "🧪",
    "ai-suggested": "🤖",
    "code": "💻",
    "other": "❓",
}


def read_frontmatter(path: Path) -> dict:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return {}
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    try:
        data = yaml.safe_load(m.group(1))
        return data if isinstance(data, dict) else {}
    except yaml.YAMLError:
        return {}


def find_note(repo: Path, slug: str) -> Path | None:
    candidates = list((repo / "knowledge").rglob(f"{slug}.md"))
    candidates = [c for c in candidates if "archive" not in c.parts]
    return candidates[0] if candidates else None


def render_single(path: Path, fm: dict, as_json: bool) -> str:
    if as_json:
        return json.dumps({
            "slug": path.stem,
            "file": str(path),
            "confidence": fm.get("confidence"),
            "reviewed": fm.get("reviewed"),
            "provenance": fm.get("provenance", []),
        }, indent=2, default=str)

    lines = []
    lines.append(f"## {path.stem}\n")
    lines.append(f"Confidence: {fm.get('confidence', '(unset)')}")
    rev = fm.get("reviewed")
    lines.append(f"Reviewed:   {rev or '(never)'}\n")

    prov = fm.get("provenance") or []
    if not prov:
        lines.append("Provenance: **none**")
        if fm.get("confidence") == "verified":
            lines.append("⚠ Schema violation: confidence=verified requires provenance.")
        return "\n".join(lines)

    lines.append(f"Provenance ({len(prov)} source{'s' if len(prov) != 1 else ''}):\n")
    for entry in prov:
        if not isinstance(entry, dict):
            continue
        kind = entry.get("source", "other")
        emoji = KIND_EMOJI.get(kind, "❓")
        reliability = entry.get("reliability", "")
        head = f"  {emoji} {kind.upper()}"
        if reliability:
            head += f" — {reliability}"
        lines.append(head)
        title = entry.get("title") or ""
        page = entry.get("page")
        loc = f"page {page}" if page else ""
        detail = " ".join(x for x in [title, loc] if x).strip()
        if detail:
            lines.append(f"     {detail}")
        url = entry.get("url")
        if url:
            lines.append(f"     {url}")
        verified = entry.get("verified")
        verifier = entry.get("verified-by")
        if verified or verifier:
            parts = []
            if verified:
                parts.append(f"Verified: {verified}")
            if verifier:
                parts.append(f"by {verifier}")
            lines.append(f"     {' '.join(parts)}")
        lines.append("")
    return "\n".join(lines)


def compute_coverage(repo: Path) -> dict:
    knowledge = repo / "knowledge"
    total = 0
    with_prov = 0
    kind_counts: Counter = Counter()
    reliability_counts: Counter = Counter()
    violating_verified_no_prov = []
    violating_verified_no_date = []

    for md in knowledge.rglob("*.md"):
        if "archive" in md.parts or md.name == "index.md":
            continue
        total += 1
        fm = read_frontmatter(md)
        prov = fm.get("provenance") or []
        is_verified = fm.get("confidence") == "verified"
        if prov:
            with_prov += 1
            for entry in prov:
                if isinstance(entry, dict):
                    kind = entry.get("source", "other")
                    kind_counts[kind] += 1
                    rel = entry.get("reliability")
                    if rel:
                        reliability_counts[rel] += 1
        elif is_verified:
            violating_verified_no_prov.append(md.stem)

        if is_verified and prov:
            if not any(isinstance(e, dict) and e.get("verified") for e in prov):
                violating_verified_no_date.append(md.stem)

    pct = (with_prov / total * 100) if total else 0

    return {
        "total_notes": total,
        "with_provenance": with_prov,
        "without_provenance": total - with_prov,
        "coverage_pct": round(pct, 1),
        "kind_counts": dict(kind_counts),
        "reliability_counts": dict(reliability_counts),
        "violating_verified_no_prov": violating_verified_no_prov,
        "violating_verified_no_date": violating_verified_no_date,
    }


def render_coverage(cov: dict, as_json: bool) -> str:
    if as_json:
        return json.dumps(cov, indent=2)

    lines = []
    lines.append(f"## Vault Provenance Coverage\n")
    lines.append(f"Total notes:          {cov['total_notes']}")
    lines.append(f"With any provenance:  {cov['with_provenance']} ({cov['coverage_pct']}%)")
    lines.append(f"Without provenance:   {cov['without_provenance']}\n")

    if cov["kind_counts"]:
        lines.append("Breakdown by source kind:")
        for kind, count in sorted(cov["kind_counts"].items(), key=lambda x: -x[1]):
            emoji = KIND_EMOJI.get(kind, "❓")
            warn = " ← pending human verification" if kind == "ai-suggested" else ""
            lines.append(f"  {emoji} {kind:14s} {count}{warn}")
        lines.append("")

    if cov["reliability_counts"]:
        lines.append("Reliability breakdown:")
        for rel, count in sorted(cov["reliability_counts"].items(), key=lambda x: -x[1]):
            lines.append(f"  {rel:15s} {count}")
        lines.append("")

    vvnp = cov["violating_verified_no_prov"]
    vvnd = cov["violating_verified_no_date"]
    lines.append(f"Schema violations:")
    lines.append(f"  confidence=verified, no provenance: {len(vvnp)} {'← FIX IT' if vvnp else '← clean'}")
    lines.append(f"  confidence=verified, no verified date: {len(vvnd)}")

    if vvnp:
        lines.append("\nFirst 10 violating notes (verified without provenance):")
        for s in vvnp[:10]:
            lines.append(f"  - {s}")
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("slug", nargs="?", default=None)
    p.add_argument("--coverage", action="store_true")
    p.add_argument("--unverified", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("--repo-root", default=None)
    args = p.parse_args()

    repo = Path(args.repo_root or os.getcwd()).resolve()
    if not (repo / "knowledge").is_dir():
        # walk up looking for it
        for parent in repo.parents:
            if (parent / "knowledge").is_dir():
                repo = parent
                break

    if args.coverage or args.unverified:
        cov = compute_coverage(repo)
        if args.unverified:
            vvnp = cov["violating_verified_no_prov"]
            if args.json:
                print(json.dumps({"unverified": vvnp}, indent=2))
            else:
                print(f"Unverified (confidence=verified, no provenance): {len(vvnp)}")
                for s in vvnp:
                    print(f"  - {s}")
            return 0
        print(render_coverage(cov, args.json))
        return 0

    if not args.slug:
        sys.stderr.write("ERROR: slug required (or use --coverage / --unverified)\n")
        return 1

    path = find_note(repo, args.slug)
    if not path:
        sys.stderr.write(f"ERROR: knowledge/{args.slug}.md not found\n")
        return 1

    fm = read_frontmatter(path)
    print(render_single(path, fm, args.json))
    return 0


if __name__ == "__main__":
    sys.exit(main())
