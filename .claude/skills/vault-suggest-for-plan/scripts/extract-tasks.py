#!/usr/bin/env python3
"""
extract-tasks.py — Parse a plan markdown file into scannable task units.

Extracts Goal, Architecture, Coverage-row findings, Task headers, and Wave/Phase
descriptions. Emits JSON array of units for qmd batch-querying.

Usage:
  extract-tasks.py <plan.md>             # JSON to stdout
  extract-tasks.py <plan.md> --limit N   # cap at N units
  extract-tasks.py <plan.md> --preview   # human summary

Unit shape: {"kind": "task|goal|arch|coverage|wave", "id": "...", "name": "...",
             "description": "...", "query": "compressed concept keywords"}
"""

from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path


# -------- Extraction regexes --------

GOAL_RE = re.compile(r"^\*\*Goal:\*\*\s*(.+)$", re.MULTILINE)
ARCH_RE = re.compile(r"^\*\*Architecture:\*\*\s*(.+)$", re.MULTILINE)

# Task patterns: "- [ ] **Task N.M** — description" or "- [ ] **Task N** — ..."
TASK_LINE_RE = re.compile(
    r"^\s*-\s*\[[\sx]\]\s*\*\*Task\s+([\d.]+)\*\*\s*[—–-]?\s*(.*)$", re.MULTILINE
)
TASK_HEADER_RE = re.compile(
    r"^###?\s+Task\s+([\d.]+)\s*[—–-]?\s*(.*)$", re.MULTILINE
)

# Wave / Phase headers
WAVE_RE = re.compile(r"^###?\s+(?:Wave|Phase)\s+([\w.]+)\s*[—–-]\s*(.+)$", re.MULTILINE)

# Coverage table row: | E2E-XXX | severity | description | phase |
COVERAGE_ROW_RE = re.compile(
    r"^\|\s*(E2E-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", re.MULTILINE
)

E2E_ID_RE = re.compile(r"\bE2E-\d+\b")
FILE_PATH_RE = re.compile(r"\b[\w./-]+\.[a-z]{2,5}(:\d+)?\b")
MD_NOISE_RE = re.compile(r"[`*_~]+")
PAREN_CONTENT_RE = re.compile(r"\([^)]{10,}\)")  # long parentheticals
WHITESPACE_RE = re.compile(r"\s+")


def compress_to_query(description: str, max_words: int = 12) -> str:
    """Compress a task description to a qmd search query."""
    if not description:
        return ""
    s = description
    s = E2E_ID_RE.sub("", s)
    s = FILE_PATH_RE.sub("", s)
    s = MD_NOISE_RE.sub("", s)
    s = PAREN_CONTENT_RE.sub("", s)
    s = WHITESPACE_RE.sub(" ", s).strip()
    # Drop filler words; keep domain nouns
    stopwords = {"the", "a", "an", "and", "or", "of", "to", "for", "with",
                 "from", "in", "on", "at", "is", "are", "be", "that", "this",
                 "it", "as", "by", "so", "if", "via", "per", "vs"}
    words = [w for w in s.split() if w.lower() not in stopwords]
    return " ".join(words[:max_words])


def in_code_block(lines: list[str], idx: int) -> bool:
    """Return True if line idx sits inside a ``` fence."""
    fence_count = 0
    for i in range(idx):
        if lines[i].strip().startswith("```"):
            fence_count += 1
    return (fence_count % 2) == 1


def extract(text: str) -> list[dict]:
    units: list[dict] = []
    lines = text.splitlines()

    # Goal
    m = GOAL_RE.search(text)
    if m:
        desc = m.group(1).strip()
        units.append({
            "kind": "goal", "id": "goal", "name": "Goal",
            "description": desc, "query": compress_to_query(desc),
        })

    # Architecture
    m = ARCH_RE.search(text)
    if m:
        desc = m.group(1).strip()
        units.append({
            "kind": "arch", "id": "architecture", "name": "Architecture",
            "description": desc, "query": compress_to_query(desc),
        })

    # Tasks (checkbox form)
    for m in TASK_LINE_RE.finditer(text):
        line_idx = text[:m.start()].count("\n")
        if in_code_block(lines, line_idx):
            continue
        task_id, desc = m.group(1), m.group(2).strip()
        if not desc:
            continue
        units.append({
            "kind": "task", "id": f"task-{task_id}",
            "name": f"Task {task_id}",
            "description": desc, "query": compress_to_query(desc),
        })

    # Tasks (### header form)
    for m in TASK_HEADER_RE.finditer(text):
        task_id, desc = m.group(1), m.group(2).strip()
        if not desc:
            # Look at the next line as description
            start = m.end()
            nl = text.find("\n", start)
            desc = text[start:nl].strip() if nl > 0 else ""
        if not desc:
            continue
        # Dedup with TASK_LINE_RE matches
        already = any(u["id"] == f"task-{task_id}" for u in units)
        if already:
            continue
        units.append({
            "kind": "task", "id": f"task-{task_id}",
            "name": f"Task {task_id}",
            "description": desc, "query": compress_to_query(desc),
        })

    # Waves / Phases
    for m in WAVE_RE.finditer(text):
        wave_id, desc = m.group(1), m.group(2).strip()
        units.append({
            "kind": "wave", "id": f"wave-{wave_id}",
            "name": f"Wave/Phase {wave_id}",
            "description": desc, "query": compress_to_query(desc),
        })

    # Coverage rows — only if the third column has >3 words of real content
    for m in COVERAGE_ROW_RE.finditer(text):
        e2e_id, severity, finding = m.group(1), m.group(2).strip(), m.group(3).strip()
        if len(finding.split()) < 4:
            continue
        if "via " in finding.lower() or "handled by" in finding.lower():
            continue  # Routed to another plan
        units.append({
            "kind": "coverage", "id": e2e_id, "name": e2e_id,
            "description": finding, "query": compress_to_query(finding),
        })

    return units


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("plan_file", help="Plan markdown file to scan")
    p.add_argument("--limit", type=int, default=0, help="Cap at N units")
    p.add_argument("--preview", action="store_true", help="Human summary instead of JSON")
    args = p.parse_args()

    path = Path(args.plan_file)
    if not path.exists():
        sys.stderr.write(f"ERROR: {path} not found\n")
        return 1

    text = path.read_text(encoding="utf-8")
    units = extract(text)
    if args.limit:
        units = units[:args.limit]

    if args.preview:
        print(f"Plan: {path}")
        print(f"Units extracted: {len(units)}")
        by_kind = {}
        for u in units:
            by_kind.setdefault(u["kind"], 0)
            by_kind[u["kind"]] += 1
        for kind, count in sorted(by_kind.items()):
            print(f"  {kind}: {count}")
        print("\nSamples:")
        for u in units[:8]:
            print(f"  [{u['kind']}] {u['name']}: {u['query']}")
    else:
        print(json.dumps(units, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
