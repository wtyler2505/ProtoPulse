#!/usr/bin/env python3
"""
rank.py — Priority-rank inbox stubs from ops/queue/gap-stubs.md.

Consumes T1's gap-stubs queue + each stub's `unblocks:` frontmatter and scores them
for /extract to process in order.

Usage:
  rank.py [--json] [--limit N] [--queue path/to/gap-stubs.md] [--repo-root /path]

Exit codes:
  0 — ranked list emitted (may be empty)
  1 — queue file unreadable
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
    sys.stderr.write("ERROR: PyYAML required. pip install --user pyyaml\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)
TIER_AB_RE = re.compile(r"/0[123]-[a-z0-9-]+\.md$")


def parse_queue(path: Path) -> list[dict]:
    """Parse the markdown-table gap-stubs queue. Returns list of dicts."""
    if not path.exists():
        return []
    rows: list[dict] = []
    lines = path.read_text(encoding="utf-8").splitlines()
    in_table = False
    for line in lines:
        s = line.strip()
        if not s.startswith("|"):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if len(cells) < 7:
            continue
        # Skip header + divider
        if cells[0].lower() == "timestamp":
            in_table = True
            continue
        if set(cells[0]) <= {"-", ":", " "}:
            continue
        if not in_table:
            continue
        rows.append({
            "timestamp": cells[0],
            "topic": cells[1].strip('"'),
            "slug": cells[2],
            "origin_plan": cells[3],
            "task": cells[4],
            "coverage": cells[5],
            "status": cells[6],
        })
    return rows


def read_stub_frontmatter(inbox: Path, slug: str) -> dict:
    """Find any inbox file with the slug; parse its frontmatter. Empty dict if absent."""
    candidates = list(inbox.glob(f"*{slug}*.md"))
    if not candidates:
        return {}
    # Prefer the vault-gap stub naming (YYYY-MM-DD-<slug>.md)
    candidates.sort()
    text = candidates[0].read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    try:
        data = yaml.safe_load(m.group(1))
        return data if isinstance(data, dict) else {}
    except yaml.YAMLError:
        return {}


def score_row(row: dict, stub: dict, plan_counts: Counter, today: dt.date) -> tuple[float, dict]:
    unblocks = stub.get("unblocks") or []
    if not isinstance(unblocks, list):
        unblocks = []

    # Recency bonus: 0..1 over last 30d
    try:
        ts = row["timestamp"].replace("Z", "+00:00")
        captured = dt.datetime.fromisoformat(ts).date()
        days = (today - captured).days
        recency = max(0.0, (30 - days) / 30)
    except (ValueError, KeyError):
        recency = 0.5

    tier_ab = 1 if TIER_AB_RE.search(row.get("origin_plan", "")) else 0
    missing = 1 if row.get("coverage") == "missing" else 0
    plan_refs = plan_counts.get(row.get("origin_plan", ""), 0)

    score = (
        5 * len(unblocks)
        + 3 * recency
        + 2 * tier_ab
        + 1 * missing
        + 0.5 * plan_refs
    )
    breakdown = {
        "unblocks_count": len(unblocks),
        "recency_bonus": round(recency, 3),
        "tier_ab": tier_ab,
        "coverage_missing": missing,
        "plan_references": plan_refs,
    }
    return score, breakdown


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--json", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--queue", default=None)
    p.add_argument("--repo-root", default=None)
    args = p.parse_args()

    repo = Path(args.repo_root or os.getcwd()).resolve()
    queue_path = Path(args.queue) if args.queue else repo / "ops/queue/gap-stubs.md"
    inbox = repo / "inbox"

    rows = parse_queue(queue_path)
    if not rows:
        out = {"queue": str(queue_path), "total": 0, "ranked": []}
        print(json.dumps(out, indent=2) if args.json else f"no pending rows in {queue_path}")
        return 0

    pending = [r for r in rows if r.get("status", "pending") in ("pending", "in_progress")]
    plan_counts = Counter(r["origin_plan"] for r in pending)
    today = dt.date.today()

    ranked = []
    for r in pending:
        stub = read_stub_frontmatter(inbox, r["slug"])
        score, breakdown = score_row(r, stub, plan_counts, today)
        ranked.append({
            "score": round(score, 3),
            "slug": r["slug"],
            "topic": r["topic"],
            "origin_plan": r["origin_plan"],
            "task": r["task"],
            "coverage": r["coverage"],
            "status": r["status"],
            "unblocks": stub.get("unblocks") or [],
            "breakdown": breakdown,
            "inbox_file": next(
                (str(p.relative_to(repo)) for p in inbox.glob(f"*{r['slug']}*.md")),
                None,
            ),
        })

    ranked.sort(key=lambda x: x["score"], reverse=True)
    if args.limit:
        ranked = ranked[:args.limit]

    if args.json:
        print(json.dumps({"queue": str(queue_path), "total": len(ranked), "ranked": ranked}, indent=2))
    else:
        print(f"vault-extract-priority — {len(ranked)} pending stub(s) ranked\n")
        for i, r in enumerate(ranked, 1):
            print(f"{i:2d}. [score={r['score']}]  {r['slug']}")
            print(f"      topic: {r['topic']}")
            print(f"      origin: {r['origin_plan']}#{r['task']}  coverage={r['coverage']}")
            if r["unblocks"]:
                print(f"      unblocks: {', '.join(r['unblocks'])}")
            print(f"      breakdown: {r['breakdown']}")
            if r["inbox_file"]:
                print(f"      file: {r['inbox_file']}")
            print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
