#!/usr/bin/env python3
"""
prefetch.py — Session-start vault pre-fetch.

Maps cwd + recent git activity to a set of topics, queries the vault by grep-first (MCP-free
for speed; hook runs async), writes a digest to ops/cache/prefetch-<branch>.md.

Usage:
  prefetch.py                         # auto-detect context + write cache
  prefetch.py --cwd path              # override cwd
  prefetch.py --max-mocs 5 --max-notes 10
  prefetch.py --dry-run               # print digest to stdout
  prefetch.py --json                  # JSON output
  prefetch.py --force                 # ignore fresh-cache check

Exit codes:
  0 — cache written (or dry-run completed)
  1 — repo/knowledge not found
  2 — infrastructure error
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

try:
    import yaml
except ImportError:
    sys.stderr.write("ERROR: PyYAML required\n")
    sys.exit(2)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)

# Path prefix → topic keywords to search for
SIGNAL_MAP: list[tuple[str, list[str]]] = [
    ("client/src/components/schematic", ["schematic", "net", "erc", "pin", "react-flow"]),
    ("client/src/components/circuit-editor/breadboard", ["breadboard", "wiring", "esp32", "attiny85", "passive"]),
    ("client/src/components/circuit-editor/PCBLayout", ["pcb", "layer", "copper", "trace", "fabrication"]),
    ("client/src/components/views/Architecture", ["architecture", "mcu", "power", "communication"]),
    ("client/src/components/views/ComponentEditor", ["component", "pin", "footprint", "mpn", "package"]),
    ("client/src/components/views/ArduinoWorkbench", ["arduino", "board", "verify", "upload", "serial"]),
    ("client/src/components/views/SimulationPanel", ["simulation", "spice", "dc-operating-point", "transient"]),
    ("client/src/components/views/GenerativeDesignView", ["genetic-algorithm", "fitness", "optimization"]),
    ("server/services/drc", ["drc", "electrical-rule", "floating-input", "multi-driver"]),
    ("server/routes/knowledge-vault", ["vault", "consumption", "ai-context"]),
    ("docs/superpowers/plans", ["methodology", "architecture-decisions", "maker-ux"]),
    ("inbox", ["extraction-pipeline", "gap"]),
]

DEFAULT_TOPICS = ["methodology", "architecture-decisions"]


def detect_repo() -> Path:
    try:
        out = subprocess.check_output(["git", "rev-parse", "--show-toplevel"],
                                      text=True, stderr=subprocess.DEVNULL).strip()
        return Path(out)
    except (subprocess.CalledProcessError, OSError):
        return Path(os.getcwd())


def detect_signals(repo: Path, cwd_override: str | None) -> dict:
    cwd = Path(cwd_override).resolve() if cwd_override else Path(os.getcwd()).resolve()
    try:
        cwd_rel = str(cwd.relative_to(repo))
    except ValueError:
        cwd_rel = ""

    recent: list[str] = []
    try:
        out = subprocess.check_output(
            ["git", "-C", str(repo), "log", "-n", "20", "--name-only", "--pretty=format:"],
            text=True, stderr=subprocess.DEVNULL,
        )
        recent = sorted(set(line for line in out.splitlines() if line.strip()))[:30]
    except (subprocess.CalledProcessError, OSError):
        pass

    diff: list[str] = []
    try:
        out = subprocess.check_output(
            ["git", "-C", str(repo), "diff", "--name-only"],
            text=True, stderr=subprocess.DEVNULL,
        )
        diff = [l.strip() for l in out.splitlines() if l.strip()]
    except (subprocess.CalledProcessError, OSError):
        pass

    branch = "main"
    try:
        branch = subprocess.check_output(
            ["git", "-C", str(repo), "branch", "--show-current"],
            text=True, stderr=subprocess.DEVNULL,
        ).strip() or "main"
    except (subprocess.CalledProcessError, OSError):
        pass

    return {
        "cwd": cwd_rel,
        "recent_paths": recent,
        "diff_paths": diff,
        "branch": branch,
    }


def signals_to_topics(signals: dict) -> list[str]:
    hits: set[str] = set()
    candidates = [signals["cwd"]] + list(signals["recent_paths"]) + list(signals["diff_paths"])
    for path in candidates:
        if not path:
            continue
        for prefix, topics in SIGNAL_MAP:
            if path.startswith(prefix):
                hits.update(topics)
                break
    if not hits:
        hits.update(DEFAULT_TOPICS)
    return sorted(hits)


def sanitize_branch(name: str) -> str:
    safe = name.replace("/", "--").replace("\\", "--")
    safe = re.sub(r"[^A-Za-z0-9._-]", "", safe)
    safe = safe.strip(".-")
    if len(safe) > 80:
        safe = safe[:80].rstrip(".-")
    return safe or "branch"


def search_vault_local(repo: Path, topics: list[str], max_notes: int) -> tuple[list[dict], list[dict]]:
    """Grep-only pass (fast; no MCP dependency in hook context). Returns (MOCs, top_notes)."""
    knowledge = repo / "knowledge"
    if not knowledge.is_dir():
        return [], []

    score: dict[str, tuple[int, dict]] = {}
    for md in knowledge.rglob("*.md"):
        if "archive" in md.parts or md.name == "index.md":
            continue
        try:
            text = md.read_text(encoding="utf-8", errors="ignore").lower()
        except OSError:
            continue

        m = FRONTMATTER_RE.match(text)
        fm = {}
        if m:
            try:
                fm = yaml.safe_load(m.group(1)) or {}
                if not isinstance(fm, dict):
                    fm = {}
            except yaml.YAMLError:
                fm = {}

        hits = sum(1 for t in topics if t in md.stem or t in (fm.get("description", "") or "").lower())
        if hits == 0:
            continue
        score[md.stem] = (hits, {
            "slug": md.stem,
            "description": fm.get("description", ""),
            "type": fm.get("type", ""),
            "topics": fm.get("topics", []),
            "file": str(md.relative_to(repo)),
        })

    ranked = sorted(score.values(), key=lambda x: -x[0])
    mocs = [entry for (_s, entry) in ranked if entry.get("type") == "moc"][:5]
    top_notes = [entry for (_s, entry) in ranked if entry.get("type") != "moc"][:max_notes]
    return mocs, top_notes


def render_digest(signals: dict, topics: list[str], mocs: list[dict],
                  top_notes: list[dict], max_mocs: int, max_notes: int) -> str:
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    branch = sanitize_branch(signals["branch"])
    lines = []
    lines.append("---")
    lines.append(f"name: \"Vault prefetch — {branch} — {now}\"")
    lines.append(f"description: \"Session-start pre-fetch based on cwd + recent git activity.\"")
    lines.append(f"generated_at: {now}")
    lines.append(f"branch: {branch}")
    lines.append("signals:")
    lines.append(f"  cwd: {signals['cwd'] or '(repo root)'}")
    lines.append("  recent_paths:")
    for p in signals["recent_paths"][:10]:
        lines.append(f"    - {p}")
    lines.append("topics_queried:")
    for t in topics:
        lines.append(f"  - {t}")
    lines.append("---\n")
    lines.append("## Vault context for this session\n")
    lines.append("### Relevant topic maps (MOCs)\n")
    if mocs:
        for moc in mocs[:max_mocs]:
            desc = moc.get("description") or "(no description)"
            lines.append(f"- **{moc['slug']}** — {desc}")
    else:
        lines.append("_(no matching MOCs in vault — consider /vault-gap)_")
    lines.append("")
    lines.append("### Top notes this session may need\n")
    if top_notes:
        for n in top_notes[:max_notes]:
            desc = n.get("description") or ""
            lines.append(f"- `{n['slug']}` — {desc}")
    else:
        lines.append("_(no strong matches — qmd_deep_search recommended for deeper coverage)_")
    lines.append("")
    lines.append("### Usage\n")
    lines.append("When writing code that touches these areas, prefer consuming via:")
    lines.append("- `<VaultHoverCard slug=\"...\">` for inline tooltips")
    lines.append("- `useVaultNote(\"...\")` for structured data")
    lines.append("- Run `/vault-prefetch` again if you pivot to a different area.\n")
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--cwd", default=None)
    p.add_argument("--max-mocs", type=int, default=5)
    p.add_argument("--max-notes", type=int, default=10)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("--force", action="store_true")
    args = p.parse_args()

    repo = detect_repo()
    if not (repo / "knowledge").is_dir():
        sys.stderr.write(f"ERROR: {repo}/knowledge not found\n")
        return 1

    signals = detect_signals(repo, args.cwd)
    topics = signals_to_topics(signals)
    mocs, top_notes = search_vault_local(repo, topics, args.max_notes)
    digest = render_digest(signals, topics, mocs, top_notes, args.max_mocs, args.max_notes)

    if args.dry_run:
        if args.json:
            print(json.dumps({
                "signals": signals, "topics": topics,
                "mocs": mocs, "top_notes": top_notes,
            }, indent=2))
        else:
            print(digest)
        return 0

    cache_dir = repo / "ops/cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    branch = sanitize_branch(signals["branch"])
    cache_path = cache_dir / f"prefetch-{branch}.md"

    # Fresh-cache skip (unless --force)
    if not args.force and cache_path.exists():
        age = dt.datetime.now().timestamp() - cache_path.stat().st_mtime
        if age < 3600:  # 1 hour
            msg = {"ok": True, "cache": str(cache_path.relative_to(repo)),
                   "reused": True, "age_seconds": int(age)}
            if args.json:
                print(json.dumps(msg, indent=2))
            else:
                print(f"Fresh cache ({int(age)}s old) — skipping prefetch. Use --force to refresh.")
            return 0

    tmp = cache_path.with_suffix(".md.tmp")
    tmp.write_text(digest, encoding="utf-8")
    os.replace(tmp, cache_path)

    msg = {
        "ok": True,
        "cache": str(cache_path.relative_to(repo)),
        "signals": signals,
        "topics": topics,
        "moc_count": len(mocs),
        "note_count": len(top_notes),
    }
    if args.json:
        print(json.dumps(msg, indent=2))
    else:
        print(f"Prefetch written → {cache_path.relative_to(repo)}")
        print(f"  Topics: {', '.join(topics)}")
        print(f"  MOCs: {len(mocs)}  Notes: {len(top_notes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
