---
name: bl
description: Manage docs/MASTER_BACKLOG.md items with deterministic counting — add, close, or flag BL-XXXX items and keep the Quick Stats block honest. Use when adding a backlog item, closing/flipping a BL item, updating Quick Stats, checking backlog counts, reconciling backlog drift, or when the user says "file a BL", "close BL-XXXX", "backlog stats", "recount the backlog".
allowed-tools: Read, Edit, Grep, Bash
---

# bl — MASTER_BACKLOG manager

The backlog's own law: item status and Quick Stats update **in the same edit** so
they never drift. Humans (and models) doing that arithmetic by hand is how the
ledger rotted: on 2026-07-01 the first deterministic recount found Quick Stats
claiming 1 open / 513 done while the tables actually held **158 OPEN rows** — an
entire E2E-triage cohort (~186 items) had never entered the stats at all
(BL-0908). This skill exists so numbers come from code and only prose comes
from the model.

## The one rule

**Never hand-compute a Quick Stats number.** Every count comes from:

```bash
python3 .claude/skills/bl/scripts/recount.py          # human-readable + drift check
python3 .claude/skills/bl/scripts/recount.py --json   # machine-readable
```

Exit 0 = tables and Quick Stats agree. Exit 1 = drift, with a per-priority diff
and the list of OPEN rows (with section · sub-heading locations).

## Operations

### `/bl stats` — verify
Run recount. If in sync, report the numbers. If drifted, report the diff and
the open-row clusters; do NOT silently "fix" — drift usually means item rows
were mass-closed by decree or a cohort bypassed the stats (see BL-0908 for the
canonical example). Fixing rows vs fixing stats is a judgment call: determine
which side reflects reality (git history, wave records) before editing either.

### `/bl add <P0|P1|P2|P3> <title/description>` — file a new item
1. Next id = highest existing BL id + 1: `grep -oE 'BL-[0-9]{4}' docs/MASTER_BACKLOG.md | sort -u | tail -1`
2. Append a row to the correct priority section's most appropriate table
   (house format: `| BL-XXXX | **Title** — description with evidence | OPEN | C1-C5 | source |`).
   Descriptions carry evidence (file:line, dates); complexity per the doc's scale.
3. Run recount → update the Quick Stats row(s) with the COMPUTED numbers
   (numbers from the script; prose annotations yours). Update the snapshot
   footnote line in the same edit.
4. Re-run recount — must exit 0 before you're done.

### `/bl close <BL-XXXX> [resolution note]` — flip an item
1. Find the item's row (`grep -n "^| BL-XXXX |" docs/MASTER_BACKLOG.md`) —
   verify it exists ONCE in a P-section; if it appears in multiple tables,
   flip the P-section row and note the duplicates.
2. Edit the STATUS cell: `OPEN` → `DONE (…)` with wave/date/commit ref and a
   short resolution note appended to the description if valuable.
3. Recount → update Quick Stats with computed numbers → recount again (exit 0).

### `/bl partial <BL-XXXX>` / `/bl block <BL-XXXX> <on what>`
Same flow; status cell becomes `PARTIAL` / `BLOCKED on <thing>` (both count
as open).

## Status vocabulary (what the counter recognizes)

`OPEN`, `PARTIAL`, `BLOCKED [on …]` count as **open**.
`DONE`, `DONE (Wave N)`, `DONE (verified Wave N)`, `DONE (…) — trailing prose`,
`DONE-BY-BL-XXXX`, `SPLIT` count as **done**. Bold-wrapped variants OK.
If you introduce a NEW status word, add it to `scripts/recount.py`'s
`STATUS_RX` in the same change — an unrecognized status shows up in the
`unclassified` list, which must stay empty.

## Boundaries

- This skill edits ONLY `docs/MASTER_BACKLOG.md` (and its own scripts when the
  vocabulary grows). Wave history, plans, and audits are other docs' jobs.
- Preservation rule: never delete items; status changes only.
- Do not renumber or reuse BL ids — ids are stable forever.
