#!/usr/bin/env python3
"""
validate.py — Validate vault notes against the v2 frontmatter schema.

Usage:
  validate.py <path-or-glob> [--fix] [--json] [--strict] [--fail-on error|warning|info]

Default target: knowledge/**/*.md (relative to repo root).

Exit codes:
  0 — no violations at/above --fail-on threshold
  1 — violations found at/above threshold
  2 — infrastructure error (schema missing, etc.)

Design notes:
  - Schema loaded from SKILL_DIR/assets/frontmatter-v2.schema.json.
  - Uses jsonschema if available, falls back to a minimal in-tree validator.
  - Severity: error (required-field missing, broken link) / warning (recommended missing,
    orphan) / info (advisory staleness, borderline description length).
  - --fix: atomic frontmatter rewrite for the safe-auto-fix catalog only. Never touches body.
"""

from __future__ import annotations
import argparse
import datetime as dt
import glob
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required. pip install --user pyyaml\n")
    sys.exit(2)

try:
    import jsonschema  # type: ignore
    HAVE_JSONSCHEMA = True
except ImportError:
    HAVE_JSONSCHEMA = False

SKILL_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = SKILL_DIR / "assets" / "frontmatter-v2.schema.json"
FRONTMATTER_RE = re.compile(r"^(---\s*\n)(.*?)(\n---\s*)(?:\n|$)", re.DOTALL)
SEVERITY_ORDER = {"info": 0, "warning": 1, "error": 2}


@dataclass
class Violation:
    file: str
    field: str
    rule: str
    severity: str
    message: str
    autofixable: bool = False

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "field": self.field,
            "rule": self.rule,
            "severity": self.severity,
            "message": self.message,
            "autofixable": self.autofixable,
        }


@dataclass
class NoteValidation:
    file: str
    violations: list[Violation] = field(default_factory=list)
    parse_error: str | None = None


def load_schema() -> dict:
    if not SCHEMA_PATH.exists():
        sys.stderr.write(f"ERROR: schema not found at {SCHEMA_PATH}\n")
        sys.exit(2)
    return json.loads(SCHEMA_PATH.read_text())


def extract_frontmatter(text: str) -> tuple[str | None, str | None]:
    """Return (yaml_body, rest_of_file) or (None, None) if no frontmatter."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None, None
    body = m.group(2)
    rest = text[m.end():]
    return body, rest


def validate_one(path: Path, schema: dict, existing_slugs: set[str]) -> NoteValidation:
    nv = NoteValidation(file=str(path))
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        nv.parse_error = f"read failed: {e}"
        return nv

    body, _ = extract_frontmatter(text)
    if body is None:
        nv.violations.append(Violation(str(path), "<frontmatter>", "presence", "error",
                                       "no frontmatter block found"))
        return nv

    try:
        data = yaml.safe_load(body) or {}
    except yaml.YAMLError as e:
        nv.parse_error = f"invalid YAML: {e}"
        nv.violations.append(Violation(str(path), "<frontmatter>", "yaml", "error",
                                       f"invalid YAML: {e}"))
        return nv

    # Schema validation
    if HAVE_JSONSCHEMA:
        v = jsonschema.Draft202012Validator(schema)
        for err in v.iter_errors(data):
            field_path = ".".join(str(p) for p in err.absolute_path) or "<root>"
            nv.violations.append(Violation(
                str(path), field_path, "schema", "error",
                err.message,
            ))
    else:
        # Minimal fallback: check required fields only
        for req in schema.get("required", []):
            if req not in data:
                nv.violations.append(Violation(str(path), req, "required", "error",
                                               f"missing required field '{req}'"))

    # Cross-link integrity
    for field_name in ("related", "supersedes", "superseded-by"):
        refs = data.get(field_name) or []
        if isinstance(refs, list):
            for ref in refs:
                if isinstance(ref, str) and ref not in existing_slugs:
                    nv.violations.append(Violation(
                        str(path), field_name, "cross-link", "error",
                        f"referenced slug '{ref}' not found in knowledge/",
                    ))

    # MOC membership (non-moc/meta)
    note_type = data.get("type")
    if note_type not in ("moc", "meta"):
        topics = data.get("topics") or []
        if isinstance(topics, list) and topics:
            has_moc = any(t in existing_slugs for t in topics if isinstance(t, str))
            # Heuristic: a topic is "a MOC" if a file named <topic>.md exists.
            # We don't differentiate topic tags vs MOCs perfectly, so warning only.
            if not has_moc:
                nv.violations.append(Violation(
                    str(path), "topics", "moc-membership", "warning",
                    "no topic corresponds to a known MOC slug — note may be orphaned",
                ))

    # Description quality
    desc = data.get("description", "")
    if isinstance(desc, str):
        if len(desc) > 140:
            nv.violations.append(Violation(
                str(path), "description", "length", "error",
                f"description is {len(desc)} chars, max 140",
            ))
        elif len(desc) > 130:
            nv.violations.append(Violation(
                str(path), "description", "length", "info",
                f"description is {len(desc)} chars — tight; consider shortening",
            ))
        if desc.strip().lower() in {"todo", "tbd", "", "(placeholder)"}:
            nv.violations.append(Violation(
                str(path), "description", "quality", "error",
                "description is a placeholder",
            ))

    # Freshness (reviewed date)
    reviewed = data.get("reviewed")
    if isinstance(reviewed, (str, dt.date)):
        try:
            if isinstance(reviewed, dt.date):
                r_date = reviewed
            else:
                r_date = dt.date.fromisoformat(str(reviewed))
            age_days = (dt.date.today() - r_date).days
            confidence = data.get("confidence", "")
            limit = 365 if confidence == "verified" else 730
            if age_days > limit:
                nv.violations.append(Violation(
                    str(path), "reviewed", "freshness", "info",
                    f"reviewed {age_days}d ago (limit {limit}d for confidence={confidence or 'unset'})",
                ))
        except (ValueError, TypeError):
            nv.violations.append(Violation(
                str(path), "reviewed", "format", "error",
                f"not a valid ISO date: {reviewed}",
            ))

    # Confidence == verified implies provenance present
    if data.get("confidence") == "verified" and not data.get("provenance"):
        nv.violations.append(Violation(
            str(path), "provenance", "required-for-verified", "error",
            "confidence=verified requires at least one provenance entry",
        ))

    # Recommended fields (warnings if missing on non-meta/moc)
    if note_type not in ("moc", "meta"):
        for recommended in ("audience", "reviewed", "confidence"):
            if recommended not in data:
                nv.violations.append(Violation(
                    str(path), recommended, "recommended", "warning",
                    f"recommended field '{recommended}' is missing",
                ))

    return nv


def collect_slugs(root: Path) -> set[str]:
    """Return the set of bare slugs (filename stems) under knowledge/."""
    slugs = set()
    for md in (root / "knowledge").rglob("*.md"):
        if "archive" in md.parts:
            continue
        slugs.add(md.stem)
    return slugs


def autofix(path: Path, note_v: NoteValidation, schema: dict) -> tuple[bool, list[str]]:
    """Apply safe auto-fixes. Returns (modified, list-of-fix-descriptions)."""
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return False, []
    body = m.group(2)
    try:
        data = yaml.safe_load(body) or {}
    except yaml.YAMLError:
        return False, []

    fixes: list[str] = []
    original = json.dumps(data, sort_keys=True, default=str)

    # Lowercase + trim topics
    if "topics" in data and isinstance(data["topics"], list):
        new_topics = [str(t).strip().lower() for t in data["topics"] if isinstance(t, (str, int))]
        new_topics = sorted(set(new_topics))
        if new_topics != data["topics"]:
            data["topics"] = new_topics
            fixes.append("normalized topics (lowercase, trimmed, deduped, sorted)")

    # Normalize audience
    if "audience" in data and isinstance(data["audience"], list):
        new_aud = sorted({str(a).strip().lower() for a in data["audience"] if isinstance(a, str)})
        valid_aud = [a for a in new_aud if a in ("beginner", "intermediate", "expert")]
        if valid_aud != data["audience"]:
            data["audience"] = valid_aud
            fixes.append("normalized audience")

    # Convert datetime → date for reviewed / captured_date
    for k in ("reviewed", "captured_date"):
        v = data.get(k)
        if isinstance(v, str) and "T" in v:
            data[k] = v.split("T", 1)[0]
            fixes.append(f"truncated {k} datetime to date")

    # Dedup + sort related / supersedes / superseded-by
    for k in ("related", "supersedes", "superseded-by"):
        if k in data and isinstance(data[k], list):
            deduped = sorted(set(x for x in data[k] if isinstance(x, str)))
            if deduped != data[k]:
                data[k] = deduped
                fixes.append(f"deduped + sorted {k}")

    if not fixes:
        return False, []

    # Atomic write: tmp + rename
    new_yaml = yaml.safe_dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)
    new_text = f"---\n{new_yaml}---\n" + text[m.end():]

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(new_text, encoding="utf-8")
    os.replace(tmp, path)
    return True, fixes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", nargs="?", default="knowledge/**/*.md",
                        help="File or glob (default: knowledge/**/*.md)")
    parser.add_argument("--fix", action="store_true", help="Apply safe auto-fixes")
    parser.add_argument("--json", action="store_true", help="Emit JSON report")
    parser.add_argument("--strict", action="store_true", help="Warnings become blocking")
    parser.add_argument("--fail-on", choices=["error", "warning", "info"], default=None,
                        help="Exit-code threshold (default: error; strict implies warning)")
    parser.add_argument("--repo-root", default=None, help="Override repo root (default: CWD)")
    args = parser.parse_args()

    repo = Path(args.repo_root or os.getcwd()).resolve()
    schema = load_schema()

    # Enumerate files
    pattern = args.target
    if not Path(pattern).is_absolute():
        pattern = str(repo / pattern)
    files = sorted(Path(p) for p in glob.glob(pattern, recursive=True))
    files = [f for f in files if f.is_file() and "archive" not in f.parts and f.name != "index.md"]

    if not files:
        sys.stderr.write(f"WARN: no files matched: {pattern}\n")
        return 0

    slugs = collect_slugs(repo)
    results: list[NoteValidation] = []
    for f in files:
        nv = validate_one(f, schema, slugs)
        results.append(nv)
        if args.fix and nv.violations:
            modified, fixes = autofix(f, nv, schema)
            if modified:
                nv.violations.append(Violation(
                    str(f), "<autofix>", "fixed", "info",
                    "applied: " + "; ".join(fixes),
                    autofixable=True,
                ))

    # Compute threshold
    threshold = args.fail_on or ("warning" if args.strict else "error")
    thr_level = SEVERITY_ORDER[threshold]

    fail_count = 0
    all_violations = []
    for nv in results:
        for v in nv.violations:
            all_violations.append(v)
            if SEVERITY_ORDER[v.severity] >= thr_level and v.rule != "fixed":
                fail_count += 1

    # Emit report
    if args.json:
        report = {
            "files_checked": len(files),
            "violations": [v.to_dict() for v in all_violations],
            "threshold": threshold,
            "fail_count": fail_count,
        }
        print(json.dumps(report, indent=2))
    else:
        by_sev = {"error": [], "warning": [], "info": []}
        for v in all_violations:
            by_sev.setdefault(v.severity, []).append(v)
        print(f"vault-validate: {len(files)} file(s) checked")
        for sev in ("error", "warning", "info"):
            entries = by_sev.get(sev, [])
            if not entries:
                continue
            print(f"\n=== {sev.upper()} ({len(entries)}) ===")
            for v in entries:
                print(f"  {v.file}:{v.field}  [{v.rule}]  {v.message}")
        print(f"\nThreshold: {threshold} — failing: {fail_count}")

    return 1 if fail_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
