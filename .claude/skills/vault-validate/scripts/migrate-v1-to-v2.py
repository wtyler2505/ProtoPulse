#!/usr/bin/env python3
"""
migrate-v1-to-v2.py — Create inbox remediation stubs for notes that need v2-schema upgrades.

This script does NOT edit notes directly. It scans `knowledge/` for frontmatter that's
missing required or strongly-recommended v2 fields, and for each such note writes an inbox
stub at `inbox/migration-v2-<slug>.md` with instructions for `/extract` or `/revisit` to
re-process the note with the upgraded schema.

Why inbox stubs instead of direct edits: v2 adds fields (audience, confidence, provenance)
that require domain judgment. Auto-guessing destroys provenance. /extract (or a human) reads
the source + current note and produces a correct v2 frontmatter, which then replaces the
legacy note through the pipeline.

Usage:
  migrate-v1-to-v2.py                         # dry-run: report what would be stubbed
  migrate-v1-to-v2.py --write                 # actually write stubs to inbox/
  migrate-v1-to-v2.py --limit 50              # cap to first N candidates (for batching)
  migrate-v1-to-v2.py --require audience      # only stub notes missing this field
  migrate-v1-to-v2.py --json                  # emit JSON report

Exit codes:
  0 — success (dry-run or write)
  1 — no frontmatter-less files found (unexpected)
  2 — infrastructure error
"""

from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required. pip install --user pyyaml\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)

V2_REQUIRED = {"name", "description", "type", "topics"}
V2_RECOMMENDED = {"audience", "reviewed", "confidence"}
V2_ALL = V2_REQUIRED | V2_RECOMMENDED


def extract(text: str) -> dict | None:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    try:
        data = yaml.safe_load(m.group(1))
        return data if isinstance(data, dict) else None
    except yaml.YAMLError:
        return None


def missing_fields(data: dict) -> set[str]:
    return V2_ALL - set(data.keys())


STUB_TEMPLATE = """---
name: "Migrate to v2 schema — {slug}"
description: "Upgrade frontmatter of knowledge/{slug}.md to v2 (missing: {missing_csv})."
captured_date: {today}
extraction_status: pending
triage_status: migration-v2
source_type: schema-migration
origin:
  plan: docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md
  task: "T2 v1→v2 migration"
target_note: knowledge/{slug}.md
missing_fields:
{missing_list}
topics:
  - schema-migration
  - v2-upgrade
---

## Migration context

The note at `knowledge/{slug}.md` has v1 frontmatter and lacks v2 fields the validator requires/recommends.

**Missing fields:** {missing_csv}

## Instructions for `/extract` (or manual reviewer)

1. Read the existing note body at `knowledge/{slug}.md`.
2. Read the v2 schema at `.claude/skills/vault-validate/assets/frontmatter-v2.schema.json`.
3. Read the v2 template at `.claude/skills/vault-validate/templates/v2-note-template.md`.
4. Produce a new frontmatter block that:
   - Keeps existing `name` and `description` if they pass v2 constraints (≤140 chars for description).
   - Adds `type`: `claim | pattern | reference | moc | meta` (choose based on note content).
   - Adds `topics`: move existing tags here; include at least one existing MOC slug.
   - Adds `audience`: `[beginner]` / `[intermediate]` / `[expert]` or multiple.
   - Adds `confidence`: `speculative | emerging | supported | verified | established` — infer from body certainty; prefer lower-confidence when unsure.
   - Adds `reviewed`: today's date if you (the human / agent) have verified the claim; otherwise leave for future /revisit.
   - If `confidence: verified`, adds `provenance[]` with at least one citation.
   - Preserves legacy v1 fields (captured_date, etc.) — they're tolerated.
5. Replace the note's frontmatter block atomically. Do NOT touch the body.
6. Run `/vault-validate knowledge/{slug}.md --strict` to confirm the upgrade.
7. After successful upgrade, archive this stub: `mv inbox/migration-v2-{slug}.md inbox/archive/`.

## Anti-patterns

- Do NOT guess `audience` or `confidence` by scanning keywords. If uncertain, read the source cited in the note (or note the gap and ask the user).
- Do NOT fabricate `provenance[]`. If the note lacks a citation, downgrade `confidence` to `emerging` or `supported` — do not claim `verified`.
- Do NOT rewrite the note body as part of the migration. That's scope creep and invalidates the original author's work.
"""


def build_stub(slug: str, missing: set[str]) -> str:
    missing_sorted = sorted(missing)
    return STUB_TEMPLATE.format(
        slug=slug,
        missing_csv=", ".join(missing_sorted),
        missing_list="\n".join(f"  - {f}" for f in missing_sorted),
        today=dt.date.today().isoformat(),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Actually write stubs (default: dry-run)")
    parser.add_argument("--limit", type=int, default=0, help="Cap candidates to N (0=all)")
    parser.add_argument("--require", action="append", default=[],
                        help="Only stub notes missing ALL of these fields (repeatable)")
    parser.add_argument("--json", action="store_true", help="Emit JSON report")
    parser.add_argument("--repo-root", default=None)
    args = parser.parse_args()

    repo = Path(args.repo_root or os.getcwd()).resolve()
    knowledge = repo / "knowledge"
    inbox = repo / "inbox"

    if not knowledge.is_dir():
        sys.stderr.write(f"ERROR: {knowledge} not found\n")
        return 2
    if args.write and not inbox.is_dir():
        inbox.mkdir(parents=True)

    require = set(args.require)
    candidates: list[dict] = []

    for note in knowledge.rglob("*.md"):
        if "archive" in note.parts:
            continue
        if note.name == "index.md":
            continue
        try:
            text = note.read_text(encoding="utf-8")
        except OSError:
            continue
        data = extract(text)
        if data is None:
            candidates.append({"file": str(note.relative_to(repo)), "slug": note.stem,
                               "missing": sorted(V2_ALL), "reason": "no-frontmatter"})
            continue
        missing = missing_fields(data)
        if require and not require.issubset(missing):
            continue
        if not missing:
            continue
        candidates.append({
            "file": str(note.relative_to(repo)),
            "slug": note.stem,
            "missing": sorted(missing),
            "reason": "partial-v1",
        })

    if args.limit:
        candidates = candidates[:args.limit]

    written: list[str] = []
    if args.write:
        for c in candidates:
            stub_path = inbox / f"migration-v2-{c['slug']}.md"
            if stub_path.exists():
                continue  # idempotent
            stub_path.write_text(build_stub(c["slug"], set(c["missing"])), encoding="utf-8")
            written.append(str(stub_path.relative_to(repo)))

    report = {
        "total_candidates": len(candidates),
        "stubs_written": len(written),
        "dry_run": not args.write,
        "limit": args.limit,
        "require": sorted(require),
        "samples": candidates[:10],
        "written": written[:50] if written else [],
    }

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        mode = "WRITE" if args.write else "DRY-RUN"
        print(f"migrate-v1-to-v2 ({mode}): {len(candidates)} candidate(s)")
        if args.require:
            print(f"  filter: missing {sorted(require)}")
        for c in candidates[:20]:
            print(f"  {c['file']}  missing: {c['missing']}")
        if len(candidates) > 20:
            print(f"  ... and {len(candidates) - 20} more")
        if args.write:
            print(f"\nWrote {len(written)} stub(s) to inbox/")

    return 0


if __name__ == "__main__":
    sys.exit(main())
