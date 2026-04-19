#!/usr/bin/env python3
"""
gate.py — Quality gate for vault notes (deterministic checks + review bouncer).

Runs a 13-rule deterministic checklist against a candidate knowledge/*.md. Notes that
fail are moved to inbox/review/ with an adjacent .review.md summarizing flagged concerns.

Usage:
  gate.py <note-path>                          # gate one note
  gate.py knowledge/*.md --dry-run             # audit all; don't move anything
  gate.py <note-path> --json                   # JSON output
  gate.py <note-path> --fail-on all            # warnings also fail

Exit codes:
  0 — note passes
  1 — note fails; bounced to inbox/review/ (unless --dry-run)
  2 — infrastructure error
"""

from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^(---\s*\n)(.*?)(\n---\s*)(?:\n|$)", re.DOTALL)
WIKILINK_RE = re.compile(r"\[\[([a-z0-9][a-z0-9-]*)\]\]")
KNOWLEDGE_REF_RE = re.compile(r"knowledge/([a-z0-9][a-z0-9-]*)\.md")
URL_RE = re.compile(r"https?://[^\s\)]+")
VALID_TYPES = {"claim", "pattern", "reference", "moc", "meta"}
TODO_MARKERS = re.compile(r"\b(TODO|FIXME|_TBD_|XXX)\b", re.IGNORECASE)
AUDIENCE_MARKER_RE = re.compile(r"#{2,3}\s+\[(beginner|intermediate|expert)\]", re.MULTILINE)


def parse_note(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(2)) or {}
        if not isinstance(fm, dict):
            fm = {}
    except yaml.YAMLError:
        fm = {}
    body = text[m.end():]
    return fm, body


def find_repo(start: Path) -> Path:
    start = start.resolve()
    if (start / "knowledge").is_dir():
        return start
    for parent in start.parents:
        if (parent / "knowledge").is_dir():
            return parent
    return start


def is_topic_an_existing_moc(topic: str, repo: Path) -> bool:
    return (repo / "knowledge" / f"{topic}.md").exists()


def run_checks(path: Path, fm: dict, body: str, repo: Path) -> list[dict]:
    overrides = {o.get("rule") for o in (fm.get("gate-overrides") or []) if isinstance(o, dict)}
    findings: list[dict] = []

    def add(rule: str, severity: str, msg: str):
        if rule in overrides:
            findings.append({"rule": rule, "severity": "override", "message": msg, "overridden": True})
            return
        findings.append({"rule": rule, "severity": severity, "message": msg})

    # description
    desc = fm.get("description", "")
    if not isinstance(desc, str) or not desc.strip():
        add("description-present", "error", "missing or empty description")
    else:
        if len(desc) > 140:
            add("description-length", "error", f"description is {len(desc)} chars (max 140)")
        placeholder = desc.strip().lower() in {"todo", "tbd", "(placeholder)", ""}
        rehash = fm.get("name") and desc.strip().lower() == str(fm["name"]).strip().lower()
        if placeholder or rehash:
            add("description-not-placeholder", "error", f"description is placeholder or title-rehash: {desc!r}")

    # topics
    topics = fm.get("topics") or []
    if not isinstance(topics, list) or len(topics) == 0:
        add("topics-present", "error", "topics must be a non-empty list")
    else:
        note_type = fm.get("type")
        if note_type not in ("moc", "meta"):
            has_moc = any(is_topic_an_existing_moc(t, repo) for t in topics if isinstance(t, str))
            if not has_moc:
                add("topics-moc-membership", "error",
                    "no topic corresponds to an existing MOC (knowledge/<topic>.md)")

    # type
    note_type = fm.get("type")
    if note_type not in VALID_TYPES:
        add("type-valid", "error", f"type must be one of {sorted(VALID_TYPES)}; got {note_type!r}")

    # body length
    if len(body.strip()) < 200:
        add("body-min-length", "warning", f"body is {len(body.strip())} chars (recommend ≥200)")

    # body claim
    has_claim_section = bool(re.search(r"^#{2,3}\s+(Claim|Summary|Assertion)\b", body, re.MULTILINE | re.IGNORECASE))
    # opens declarative = first non-blank line after frontmatter is a sentence ending in .
    first_line = next((line.strip() for line in body.splitlines() if line.strip()), "")
    starts_declarative = first_line and not first_line.startswith("#") and first_line.endswith(".")
    if not (has_claim_section or starts_declarative):
        add("body-has-claim-section", "warning",
            "no `## Claim` or `## Summary` heading, and body doesn't open with a declarative sentence")

    # evidence
    has_evidence_section = bool(re.search(r"^#{2,3}\s+(Evidence|Why|Reasoning|Derivation|Background)\b",
                                          body, re.MULTILINE | re.IGNORECASE))
    has_citation = bool(URL_RE.search(body)) or bool(fm.get("provenance"))
    if not (has_evidence_section or has_citation):
        add("body-has-evidence-section", "warning",
            "no `## Evidence`/`## Why` section, no URL citation, no provenance[] entry")

    # application
    has_application = bool(re.search(r"^#{2,3}\s+(Application|When to use|Usage|Guidance|How to apply)\b",
                                     body, re.MULTILINE | re.IGNORECASE))
    if not has_application:
        add("body-has-application-section", "info",
            "no `## Application` or `## When to use` section — pedagogy suffers")

    # cross-links
    wikilinks = WIKILINK_RE.findall(body)
    krefs = KNOWLEDGE_REF_RE.findall(body)
    total_links = len(wikilinks) + len(krefs)
    if total_links < 2:
        add("body-cross-links", "warning",
            f"only {total_links} cross-link(s); recommend ≥2 to build the graph")

    # confidence/provenance consistency
    if fm.get("confidence") == "verified" and not fm.get("provenance"):
        add("confidence-provenance-consistency", "error",
            "confidence=verified requires at least one provenance entry")

    # related resolves
    for field in ("related", "supersedes", "superseded-by"):
        refs = fm.get(field) or []
        if isinstance(refs, list):
            for ref in refs:
                if isinstance(ref, str) and not (repo / "knowledge" / f"{ref}.md").exists():
                    add("related-resolves", "error",
                        f"{field}[] references nonexistent slug: {ref!r}")

    # TODO markers (excluding audience stub sections)
    stripped_body = re.sub(r"### \[(?:beginner|intermediate|expert)\].*?(?=\n#|\Z)", "", body, flags=re.DOTALL)
    if TODO_MARKERS.search(stripped_body):
        add("no-todo-markers", "warning",
            "body contains TODO/FIXME/TBD/XXX markers outside audience stubs")

    return findings


def verdict_from(findings: list[dict], fail_on: str) -> str:
    severities = [f["severity"] for f in findings if not f.get("overridden")]
    if "error" in severities:
        return "review"
    if fail_on == "all" and "warning" in severities:
        return "review"
    return "ship"


def move_to_review(path: Path, findings: list[dict], repo: Path) -> tuple[Path, Path]:
    review_dir = repo / "inbox/review"
    review_dir.mkdir(parents=True, exist_ok=True)

    dest_note = review_dir / path.name
    dest_review = review_dir / f"{path.stem}.review.md"

    # Move the note atomically
    shutil.move(str(path), str(dest_note))

    det_fails = [f for f in findings if f["severity"] == "error"]
    warn_fails = [f for f in findings if f["severity"] == "warning"]

    lines = []
    lines.append("---")
    lines.append(f"name: \"Review: {path.stem}\"")
    lines.append(f"description: \"Quality gate flagged on {dt.date.today().isoformat()}. "
                 f"{len(det_fails)} error(s), {len(warn_fails)} warning(s).\"")
    lines.append(f"captured_date: {dt.date.today().isoformat()}")
    lines.append("extraction_status: needs-revision")
    lines.append("triage_status: quality-gate-fail")
    lines.append("source_type: review-bounce")
    lines.append(f"origin_note: inbox/review/{path.name}")
    lines.append("topics:")
    lines.append("  - quality-gate")
    lines.append("---")
    lines.append("")
    lines.append(f"## Why this note bounced\n")
    lines.append(f"### Blocking errors ({len(det_fails)})\n")
    for f in det_fails:
        lines.append(f"- **{f['rule']}** — {f['message']}")
    lines.append("")
    lines.append(f"### Warnings ({len(warn_fails)})\n")
    for f in warn_fails:
        lines.append(f"- **{f['rule']}** — {f['message']}")
    lines.append("")
    lines.append("## Fix protocol\n")
    lines.append(f"1. Edit `inbox/review/{path.name}` to address each blocking error.")
    lines.append(f"2. Re-run: `python3 .claude/skills/vault-quality-gate/scripts/gate.py inbox/review/{path.name}`")
    lines.append(f"3. On PASS: `mv inbox/review/{path.name} knowledge/{path.name} && rm inbox/review/{path.stem}.review.md`")
    lines.append(f"4. Commit with the gate pass message in the commit body.\n")
    dest_review.write_text("\n".join(lines), encoding="utf-8")

    return dest_note, dest_review


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("note_path", help="Path to note under knowledge/")
    p.add_argument("--ai-review", action="store_true", help="(Reserved) run AI semantic pass")
    p.add_argument("--fail-on", choices=["deterministic", "all"], default="deterministic")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("--repo-root", default=None)
    args = p.parse_args()

    path = Path(args.note_path).resolve()
    if not path.exists():
        sys.stderr.write(f"ERROR: {path} not found\n")
        return 2

    repo = Path(args.repo_root).resolve() if args.repo_root else find_repo(path)

    fm, body = parse_note(path)
    findings = run_checks(path, fm, body, repo)
    verdict = verdict_from(findings, args.fail_on)

    moved = None
    if verdict == "review" and not args.dry_run:
        try:
            dest_note, dest_review = move_to_review(path, findings, repo)
            moved = {"note": str(dest_note.relative_to(repo)),
                     "review": str(dest_review.relative_to(repo))}
        except Exception as e:
            sys.stderr.write(f"ERROR moving to review: {e}\n")
            return 2

    result = {
        "note": str(path.relative_to(repo)) if not moved else moved["note"],
        "verdict": verdict,
        "findings": findings,
        "fail_on": args.fail_on,
        "dry_run": args.dry_run,
        "moved": moved,
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"{result['note']} → {verdict.upper()}")
        for f in findings:
            prefix = {"error": "✗", "warning": "⚠", "info": "ℹ", "override": "~"}.get(f["severity"], "?")
            print(f"  {prefix} [{f['severity']:8s}] {f['rule']}: {f['message']}")
        if moved:
            print(f"\nMoved → {moved['note']}")
            print(f"Review → {moved['review']}")

    return 0 if verdict == "ship" else 1


if __name__ == "__main__":
    sys.exit(main())
