#!/usr/bin/env python3
"""Recount MASTER_BACKLOG item tables and verify the Quick Stats block.

Deterministic counter for docs/MASTER_BACKLOG.md: walks the P0-P3 sections,
classifies every `| BL-XXXX | ...` row by its STATUS cell (exact-match per
table field, so status words inside description prose never false-hit),
prints the true counts, and diffs them against the numbers currently in the
Quick Stats table. Exit 0 = in sync, exit 1 = drift (with a precise diff).

Usage:
  python3 recount.py [path-to-MASTER_BACKLOG.md]      # verify (default)
  python3 recount.py --json [path]                     # machine-readable
"""
import json
import re
import sys
from pathlib import Path

# Observed status vocabulary (2026-07-01 live inventory of all 500+ rows):
# OPEN, PARTIAL, BLOCKED [on ...], DONE, DONE (Wave 67), DONE (Wave E),
# DONE (verified Wave 106), DONE (Wave N) — trailing prose, DONE-BY-BL-XXXX,
# SPLIT (closed by splitting into follow-ups), OBSOLETE (added 2026-07-10 by
# BL-0908 reconciliation — the finding's target surface no longer exists, so
# it's moot rather than fixed; counts on the closed side like DONE) —
# optionally **bold**-wrapped.
STATUS_RX = re.compile(
    r"^(?:\*\*)?(OPEN|PARTIAL|BLOCKED(?:\s+on[^|]*)?|DONE(?:\s*\([^)]*\))?(?:\s*[-—–].*)?|DONE-BY-BL-\d{4}|SPLIT|OBSOLETE(?:\s*\([^)]*\))?)(?:\*\*)?$"
)
ROW_RX = re.compile(r"^\|\s*(BL-\d{4})\s*\|")
SECTION_RX = re.compile(r"^##\s+(P[0-3])\s+—")
END_RX = re.compile(r"^##\s+Completed Work Summary")
QS_ROW_RX = re.compile(
    r"^\|\s*(?:\*\*)?(P[0-3]|Total)(?:\*\*)?\s*\|\s*(?:\*\*)?(\d+)(?:\*\*)?\s*\|\s*(?:\*\*)?(\d+)(?:\*\*)?\s*\|"
)

OPEN_STATES = ("OPEN", "PARTIAL", "BLOCKED")


def classify(row: str):
    """Return the status token of a BL table row, or None."""
    for field in (f.strip() for f in row.split("|")):
        m = STATUS_RX.match(field)
        if m:
            return m.group(1)
    return None


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    as_json = "--json" in sys.argv
    path = Path(args[0]) if args else Path("docs/MASTER_BACKLOG.md")
    if not path.exists():
        print(f"recount: {path} not found", file=sys.stderr)
        return 2

    counts = {p: {"open": 0, "done": 0} for p in ("P0", "P1", "P2", "P3")}
    open_rows: list[str] = []  # BL ids currently open (for actionable drift)
    heading = ""  # nearest ### sub-heading, for locating clusters
    ids_seen: dict[str, str] = {}
    dupes: list[str] = []
    unclassified: list[str] = []
    section = None

    quick_stats: dict[str, tuple[int, int]] = {}

    all_ids = set()
    for line in path.read_text().splitlines():
        m_any = re.match(r"^\|\s*(BL-\d{4})\s*\|", line)
        if m_any:
            all_ids.add(m_any.group(1))
        if line.startswith("###"):
            heading = line.strip("# ").strip()
        sm = SECTION_RX.match(line)
        if sm:
            section = sm.group(1)
            continue
        if END_RX.match(line):
            section = None
            continue
        qm = QS_ROW_RX.match(line)
        if qm and qm.group(1) not in quick_stats:
            quick_stats[qm.group(1)] = (int(qm.group(2)), int(qm.group(3)))
        if section is None:
            continue
        rm = ROW_RX.match(line)
        if not rm:
            continue
        bl_id = rm.group(1)
        status = classify(line)
        if status is None:
            unclassified.append(f"{section} {bl_id}")
            continue
        if bl_id in ids_seen:
            dupes.append(f"{bl_id} (in {ids_seen[bl_id]} and {section})")
            continue
        ids_seen[bl_id] = section
        bucket = "open" if status.startswith(OPEN_STATES) else "done"
        counts[section][bucket] += 1
        if bucket == "open":
            open_rows.append(f"{bl_id} [{section} · {heading[:60]}]")

    total_open = sum(c["open"] for c in counts.values())
    total_done = sum(c["done"] for c in counts.values())

    result = {
        "computed": {**counts, "Total": {"open": total_open, "done": total_done}},
        "quick_stats": {
            k: {"open": v[0], "done": v[1]} for k, v in quick_stats.items()
        },
        "duplicates": dupes,
        "unclassified": unclassified,
        "tracked_in_sections": len(ids_seen),
        "unique_ids_docwide": len(all_ids),
        "open_rows": open_rows,
    }

    drift = []
    for key in ("P0", "P1", "P2", "P3", "Total"):
        comp = result["computed"][key]
        qs = result["quick_stats"].get(key)
        if qs is None:
            drift.append(f"{key}: missing from Quick Stats")
        elif (qs["open"], qs["done"]) != (comp["open"], comp["done"]):
            drift.append(
                f"{key}: Quick Stats says {qs['open']} open/{qs['done']} done, "
                f"tables say {comp['open']} open/{comp['done']} done"
            )
    result["drift"] = drift

    if as_json:
        print(json.dumps(result, indent=2))
    else:
        print(
            f"items in P0-P3 tables: {len(ids_seen)}  (unique BL ids doc-wide: {len(all_ids)})"
        )
        for key in ("P0", "P1", "P2", "P3", "Total"):
            c = result["computed"][key]
            print(f"  {key}: {c['open']} open / {c['done']} done")
        if dupes:
            print(f"duplicate ids: {dupes}")
        if unclassified:
            print(f"unclassified rows (no status cell matched): {unclassified}")
        if drift:
            print("DRIFT vs Quick Stats:")
            for d in drift:
                print(f"  ✗ {d}")
            if open_rows:
                print(f"rows currently OPEN in tables ({len(open_rows)}):")
                for r in open_rows[:20]:
                    print(f"    {r}")
                if len(open_rows) > 20:
                    print(f"    … and {len(open_rows)-20} more")
        else:
            print("Quick Stats: in sync ✓")

    return 1 if drift else 0


if __name__ == "__main__":
    sys.exit(main())
