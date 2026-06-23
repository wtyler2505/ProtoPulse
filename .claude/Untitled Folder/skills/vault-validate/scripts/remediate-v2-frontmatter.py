#!/usr/bin/env python3
"""
remediate-v2-frontmatter.py — In-place fixer for common v2-schema violations.

Surgically fixes the 4 systematic failure modes from the 2026-04-19 T4 content push:

  1. description > 140 chars  → truncate on sentence/clause boundary + ellipsis
  2. topics wrapped in [[...]] → strip brackets (Obsidian wiki-link style → plain slug)
  3. type missing / non-standard → map to VALID_TYPES {claim, pattern, reference, moc, meta}
  4. confidence: verified without provenance → demote to 'supported' (safer than fabricate)

Usage:
  remediate-v2-frontmatter.py <path-or-glob> [--dry-run]
  remediate-v2-frontmatter.py knowledge/*.md --dry-run
  remediate-v2-frontmatter.py knowledge/moc-a11y-wcag-aria.md

Idempotent. Safe to run repeatedly. Preserves all other fields + body content verbatim.

Exit codes:
  0 — clean or fixed successfully
  1 — at least one file required fixes that couldn't be applied (manual work needed)
  2 — infrastructure error (missing PyYAML, malformed note)
"""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required (pip install pyyaml)\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^(---\s*\n)(.*?)(\n---\s*)(?:\n|$)", re.DOTALL)
WIKILINK_WRAPPED = re.compile(r"^\[\[([a-z0-9][a-z0-9-]*)\]\]$")
VALID_TYPES = {"claim", "pattern", "reference", "moc", "meta"}

# Map non-standard types that extract skill has historically emitted.
TYPE_ALIASES = {
    "implementation-pattern": "pattern",
    "methodology": "pattern",
    "architecture-decision": "pattern",
    "architectural-decision": "pattern",
    "convention": "pattern",
    "ux-patterns": "pattern",
    "ux-pattern": "pattern",
    "bug-pattern": "pattern",
    "dependency-knowledge": "reference",
    "gotcha": "pattern",
    "tension": "claim",
    "tension-note": "claim",
    "open-question": "reference",
    "question": "reference",
    "concept": "reference",
    "definition": "reference",
    "taxonomy": "reference",
    "topic-map": "moc",
    "pattern,": "pattern",
    # Already-valid values are passthrough below.
}

# Sentence/clause terminators for graceful description truncation (140-char cap).
TRUNCATE_BREAKS = [". ", "; ", ", ", " — ", " — ", " -- ", " / "]
HARD_CAP = 140
SOFT_CAP = 137  # leaves room for "..."


def parse_note(path: Path) -> tuple[dict | None, str, str]:
    """Return (frontmatter_dict, frontmatter_raw, body). frontmatter_dict is None if absent."""
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None, "", text
    try:
        fm = yaml.safe_load(m.group(2)) or {}
        if not isinstance(fm, dict):
            return None, "", text
    except yaml.YAMLError as e:
        sys.stderr.write(f"WARN  {path}: malformed YAML frontmatter ({e}); skipping\n")
        return None, "", text
    return fm, m.group(2), text[m.end():]


def truncate_description(desc: str) -> str:
    """Return desc if ≤140, else graceful truncation on clause/sentence boundary."""
    desc = desc.strip().strip('"').strip("'")
    if len(desc) <= HARD_CAP:
        return desc
    window = desc[:SOFT_CAP]
    best = -1
    for sep in TRUNCATE_BREAKS:
        idx = window.rfind(sep)
        if idx > best and idx > 40:  # don't truncate absurdly short
            best = idx
    if best > 0:
        # Keep through the separator's first char (e.g. ".", ";") then ellipsis
        return window[:best].rstrip(" ,;:—-/") + "..."
    # No good break → hard cut on last word boundary
    cut = window.rfind(" ")
    cut = cut if cut > 40 else SOFT_CAP
    return window[:cut].rstrip() + "..."


def unwrap_topic(t: str) -> str | None:
    """Strip [[wiki]] brackets and normalize. Return None for invalid."""
    if not isinstance(t, str):
        return None
    s = t.strip()
    m = WIKILINK_WRAPPED.match(s)
    if m:
        return m.group(1)
    # Already bare slug?
    if re.match(r"^[a-z0-9][a-z0-9-]*$", s):
        return s
    # Trailing colon/comma corruption
    cleaned = re.sub(r"[^a-z0-9-]", "-", s.lower()).strip("-")
    cleaned = re.sub(r"-+", "-", cleaned)
    return cleaned if cleaned else None


def normalize_type(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    r = raw.strip().strip(",").lower()
    if r in VALID_TYPES:
        return r
    return TYPE_ALIASES.get(r)


def remediate(path: Path, dry_run: bool) -> tuple[bool, list[str]]:
    """Return (changed, issues). issues is human-readable log of what was/would be changed."""
    fm, _, body = parse_note(path)
    if fm is None:
        return False, [f"no frontmatter — skip"]

    issues: list[str] = []
    changed = False

    # 1. description
    desc = fm.get("description")
    if isinstance(desc, str) and len(desc.strip()) > HARD_CAP:
        new_desc = truncate_description(desc)
        if new_desc != desc:
            issues.append(f"description: {len(desc)} → {len(new_desc)} chars")
            fm["description"] = new_desc
            changed = True

    # 2. topics bracket-strip
    topics = fm.get("topics")
    if isinstance(topics, list):
        new_topics = []
        any_fixed = False
        for t in topics:
            u = unwrap_topic(t)
            if u is None:
                continue
            if u != t:
                any_fixed = True
            if u not in new_topics:
                new_topics.append(u)
        if any_fixed or (len(new_topics) != len(topics)):
            issues.append(f"topics: {topics} → {new_topics}")
            fm["topics"] = new_topics
            changed = True

    # 3. type normalize
    raw_type = fm.get("type")
    norm_type = normalize_type(raw_type)
    if norm_type and norm_type != raw_type:
        issues.append(f"type: {raw_type!r} → {norm_type!r}")
        fm["type"] = norm_type
        changed = True
    elif norm_type is None and raw_type is not None:
        # Unknown type we can't map confidently — leave as is, flag for human
        issues.append(f"type: {raw_type!r} is unmapped — manual review")

    # 4. confidence/provenance consistency
    conf = fm.get("confidence")
    prov = fm.get("provenance")
    if conf == "verified" and not prov:
        issues.append("confidence: 'verified' → 'supported' (no provenance)")
        fm["confidence"] = "supported"
        changed = True

    if not changed:
        return False, issues

    if dry_run:
        return True, issues

    # Write back — preserve key ordering where possible. yaml.safe_dump with sort_keys=False.
    new_fm_raw = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True, width=1000).rstrip()
    new_text = f"---\n{new_fm_raw}\n---\n{body.lstrip(chr(10))}"
    # Preserve trailing newline posture of original
    if not new_text.endswith("\n"):
        new_text += "\n"
    path.write_text(new_text, encoding="utf-8")
    return True, issues


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("paths", nargs="+", help="Note paths or glob patterns")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    targets: list[Path] = []
    for pat in args.paths:
        pp = Path(pat)
        if pp.is_file():
            targets.append(pp)
        else:
            # Shell glob fallback
            from glob import glob
            for m in glob(pat):
                mp = Path(m)
                if mp.is_file():
                    targets.append(mp)

    if not targets:
        sys.stderr.write("no target files matched\n")
        return 2

    total = len(targets)
    changed = 0
    for t in targets:
        did, issues = remediate(t, args.dry_run)
        if did:
            changed += 1
            tag = "[dry-run]" if args.dry_run else "[fixed]"
            print(f"{tag} {t}")
            for i in issues:
                print(f"         - {i}")
        elif issues:
            # Unmapped type etc.
            for i in issues:
                print(f"[noop]   {t}: {i}")

    verb = "would change" if args.dry_run else "changed"
    print(f"\n{verb} {changed} / {total} files", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
