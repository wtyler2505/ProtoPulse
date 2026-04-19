#!/usr/bin/env python3
"""
report.py — Emit a weekly vault health report.

Consumes:
  ops/index/plan-vault-backlinks.json (T3)
  ops/queue/gap-stubs.md              (T1)
  optional prior report in ops/health/ (for trend)

Writes:
  ops/health/YYYY-MM-DD-report.md      (default)
  stdout JSON                          (when --json)

Usage:
  report.py                          # write full report for today
  report.py --top 30                 # cap heatmap
  report.py --json                   # JSON to stdout; no file write
  report.py --compare auto           # auto-find prior report for trend
  report.py --compare path.md        # explicit prior
  report.py --dry-run                # print body, no write
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


def read_index(repo: Path) -> dict:
    p = repo / "ops/index/plan-vault-backlinks.json"
    if not p.exists():
        sys.stderr.write(f"ERROR: T3 index missing: {p}\n"
                         "Run: python3 .claude/skills/vault-index/scripts/build-index.py\n")
        sys.exit(2)
    return json.loads(p.read_text(encoding="utf-8"))


def read_queue(repo: Path) -> list[dict]:
    p = repo / "ops/queue/gap-stubs.md"
    if not p.exists():
        return []
    rows: list[dict] = []
    in_table = False
    for line in p.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s.startswith("|"):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if len(cells) < 7:
            continue
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


def find_prior_report(repo: Path) -> Path | None:
    hdir = repo / "ops/health"
    if not hdir.is_dir():
        return None
    today = dt.date.today().isoformat()
    candidates = sorted(
        p for p in hdir.glob("*-report.md")
        if p.stem.replace("-report", "") < today
    )
    return candidates[-1] if candidates else None


def parse_prior_stats(path: Path) -> dict[str, int]:
    """Extract headline numbers from a prior report's Summary section."""
    if not path or not path.exists():
        return {}
    text = path.read_text(encoding="utf-8", errors="ignore")
    stats = {}
    for k, pat in [
        ("notes",     r"Total notes:\s*(\d+)"),
        ("backlinks", r"Total backlinks:\s*(\d+)"),
        ("orphans",   r"Orphan count:\s*(\d+)"),
        ("errors",    r"(\d+)\s*error"),
        ("warnings",  r"(\d+)\s*warning"),
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            stats[k] = int(m.group(1))
    return stats


def rank_consumed(index: dict, n: int) -> list[tuple[str, int, int, int, int]]:
    ranked = []
    for slug, e in index["notes"].items():
        p = len(e.get("referenced_by_plans", []))
        c = len(e.get("consumed_by_code", []))
        r = len(e.get("incoming_related", []))
        total = p + c + r
        if total == 0:
            continue
        ranked.append((slug, p, c, r, total))
    ranked.sort(key=lambda t: t[-1], reverse=True)
    return ranked[:n]


def sample_orphans(index: dict, n: int) -> list[str]:
    return list(index.get("orphans", []))[:n]


def build_report(index: dict, queue: list[dict], prior: dict, top_n: int) -> dict:
    now = dt.datetime.now(dt.timezone.utc)
    stats = index.get("stats", {})
    consumed = rank_consumed(index, top_n)
    orphans_sample = sample_orphans(index, top_n)

    pending_gaps = [g for g in queue if g.get("status", "").startswith("pending") or g.get("status") == "in_progress"]
    pending_gaps.sort(key=lambda g: g.get("timestamp", ""))

    schema_drift = {}
    validate_json = run_validator_json()
    if validate_json:
        for v in validate_json.get("violations", []):
            sev = v.get("severity", "info")
            schema_drift[sev] = schema_drift.get(sev, 0) + 1

    trend = {}
    for k, cur in [
        ("notes", stats.get("notes_indexed", 0)),
        ("backlinks", stats.get("total_backlinks", 0)),
        ("orphans", stats.get("orphan_count", 0)),
        ("errors", schema_drift.get("error", 0)),
        ("warnings", schema_drift.get("warning", 0)),
    ]:
        if k in prior:
            trend[k] = {"prev": prior[k], "cur": cur, "delta": cur - prior[k]}

    return {
        "generated_at": now.isoformat(),
        "stats": {
            **stats,
            "schema_drift": schema_drift,
            "pending_gap_stubs": len(pending_gaps),
        },
        "top_consumed": [
            {"slug": s, "plans": p, "code": c, "related_in": r, "total": t}
            for s, p, c, r, t in consumed
        ],
        "top_orphaned": orphans_sample,
        "demand_gaps": pending_gaps[:top_n],
        "trend": trend,
    }


def run_validator_json() -> dict | None:
    """Invoke T2 validator JSON mode if available."""
    script = Path(".claude/skills/vault-validate/scripts/validate.py")
    if not script.exists():
        return None
    try:
        out = subprocess.check_output(
            ["python3", str(script), "--json"],
            stderr=subprocess.DEVNULL, text=True, timeout=120,
        )
        return json.loads(out)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
        return None


def render_markdown(report: dict, prior_path: Path | None) -> str:
    s = report["stats"]
    t = report.get("trend", {})
    total_notes = s.get("notes_indexed", 0)
    orphan_pct = (s.get("orphan_count", 0) / total_notes * 100) if total_notes else 0

    def delta(k: str) -> str:
        if k not in t:
            return ""
        d = t[k]["delta"]
        sign = "+" if d >= 0 else ""
        return f" (Δ {sign}{d})"

    lines = []
    lines.append(f"# Vault Health Report — {dt.date.today().isoformat()}\n")
    lines.append("## Summary\n")
    lines.append(f"- Total notes: {s.get('notes_indexed', 0)}{delta('notes')}")
    lines.append(f"- Total backlinks: {s.get('total_backlinks', 0)}{delta('backlinks')}")
    lines.append(f"- Orphan count: {s.get('orphan_count', 0)} ({orphan_pct:.1f}%){delta('orphans')}")
    sd = s.get("schema_drift", {})
    lines.append(f"- Schema drift: {sd.get('error', 0)} errors{delta('errors')}, "
                 f"{sd.get('warning', 0)} warnings{delta('warnings')}, "
                 f"{sd.get('info', 0)} info")
    lines.append(f"- Pending gap-stubs: {s.get('pending_gap_stubs', 0)}\n")

    lines.append("## Top-consumed notes\n")
    lines.append("| Rank | Slug | Plans | Code | Related-in | Total |")
    lines.append("|------|------|-------|------|-----------|-------|")
    if report["top_consumed"]:
        for i, row in enumerate(report["top_consumed"], 1):
            lines.append(f"| {i} | {row['slug']} | {row['plans']} | {row['code']} | {row['related_in']} | {row['total']} |")
    else:
        lines.append("| — | _(no consumed notes yet — vault integration campaign pending)_ | — | — | — | — |")
    lines.append("")

    lines.append("## Top-orphaned notes (sample)\n")
    if report["top_orphaned"]:
        for slug in report["top_orphaned"]:
            lines.append(f"- `{slug}`")
    else:
        lines.append("_(no orphans — vault fully consumed)_")
    lines.append(f"\n_Total orphans: {s.get('orphan_count', 0)}._\n")

    lines.append("## Demand-gap queue (pending T1 stubs)\n")
    if report["demand_gaps"]:
        lines.append("| Timestamp | Topic | Origin plan | Task | Coverage |")
        lines.append("|-----------|-------|-------------|------|----------|")
        for g in report["demand_gaps"]:
            lines.append(f"| {g['timestamp']} | {g['topic']} | {g['origin_plan']} | {g['task']} | {g['coverage']} |")
    else:
        lines.append("_(queue empty — run /vault-gap to surface gaps)_")
    lines.append("")

    if t:
        lines.append(f"## Trend (vs {prior_path.name if prior_path else 'prior report'})\n")
        for k, v in t.items():
            sign = "+" if v["delta"] >= 0 else ""
            lines.append(f"- {k}: {v['prev']} → {v['cur']} (Δ {sign}{v['delta']})")
        lines.append("")

    lines.append("## Recommended actions\n")
    recs = []
    if s.get("pending_gap_stubs", 0) > 0:
        recs.append(f"1. Process {s['pending_gap_stubs']} pending gap-stubs via `/extract` (see T15 priority ranking).")
    if sd.get("error", 0) > 0:
        recs.append(f"2. Run `/vault-validate --fix` to auto-remediate safe errors ({sd['error']} total).")
    if orphan_pct > 40 and s.get("notes_indexed", 0) > 0:
        recs.append(f"3. Review top-20 orphans; promote to MOCs or archive stale ones.")
    if not recs:
        recs.append("_Vault healthy. No immediate actions required._")
    lines.extend(recs)
    lines.append("")

    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--top", type=int, default=20)
    p.add_argument("--json", action="store_true")
    p.add_argument("--compare", default=None, help="'auto' or explicit path")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--repo-root", default=None)
    args = p.parse_args()

    repo = Path(args.repo_root or (
        subprocess.check_output(["git", "rev-parse", "--show-toplevel"],
                                text=True, stderr=subprocess.DEVNULL).strip()
        if Path(".git").exists() else os.getcwd()
    )).resolve()

    index = read_index(repo)
    queue = read_queue(repo)

    prior_path = None
    prior_stats = {}
    if args.compare:
        prior_path = find_prior_report(repo) if args.compare == "auto" else Path(args.compare)
        if prior_path and prior_path.exists():
            prior_stats = parse_prior_stats(prior_path)

    report = build_report(index, queue, prior_stats, args.top)

    if args.json:
        print(json.dumps(report, indent=2, default=str))
        return 0

    md = render_markdown(report, prior_path)

    if args.dry_run:
        print(md)
        return 0

    out_dir = repo / "ops/health"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{dt.date.today().isoformat()}-report.md"
    out.write_text(md, encoding="utf-8")

    # Append to history index
    idx = out_dir / "index.md"
    header = "# Vault Health — Report Index\n\n"
    line = (
        f"- [{dt.date.today().isoformat()}]({out.name}) — "
        f"notes={report['stats'].get('notes_indexed', 0)} "
        f"backlinks={report['stats'].get('total_backlinks', 0)} "
        f"orphans={report['stats'].get('orphan_count', 0)}\n"
    )
    if idx.exists():
        cur = idx.read_text(encoding="utf-8")
        idx.write_text(cur + line, encoding="utf-8")
    else:
        idx.write_text(header + line, encoding="utf-8")

    print(f"health report written → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
