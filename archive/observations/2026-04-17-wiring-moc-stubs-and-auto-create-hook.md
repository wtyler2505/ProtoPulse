---
description: "Closed the Pattern A dangling-link debt (7 wiring MOCs missing) and installed preventive auto-create-parent-moc hook to close the gap between 'automation: full' dimension claim and reality"
type: observation
date: 2026-04-17
---

# Wiring MOC stubs + auto-create-parent-moc hook (2026-04-17)

Implements all three recommendations from the 2026-04-17 architect report on
the extract workflow (see `/arscontexta:architect` output preserved in
the session transcript).

## What changed

### Rec 1 — 7 wiring-guide MOC stubs created in `knowledge/`

- `wiring-36v-battery-power-distribution-4-tier-system.md` (10 incoming refs)
- `wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md` (8)
- `wiring-zs-x11h-to-esp32-with-level-shifter.md` (0 — future-proofing for queue)
- `wiring-dual-zs-x11h-for-hoverboard-robot.md` (12)
- `wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md` (11)
- `wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter.md` (0 — future-proofing)
- `wiring-i2c-multi-device-bus-compass-imu-current-sensor.md` (6)

Each stub:
- Follows `templates/topic-map.md` schema (`type: moc`, `description`, `topics:`)
- Parents are `[[wiring-integration]]`, `[[power-systems]]`, `[[index]]`
- Knowledge Notes section auto-populated from all atomic notes that already
  reference the MOC (47 refs total, programmatically enumerated via a Python
  script that globs `knowledge/*.md` and matches `[[<slug>]]`)
- Each wiki-linked note gets a short summary pulled from the atomic note's
  own `description:` field (first 140 chars), so future readers and the
  `/connect` command don't have to re-discover the relationships.

### Rec 2 — `Source: [[docs_and_data]]` → `Source: docs_and_data` in 24 notes

Source provenance is metadata, not a graph edge. A single `sed` pass across
all `knowledge/*.md` files stripped the misleading wiki-link syntax for
the 24 affected atomic notes. Schema validation still passes (provenance
fields are free-form strings under the `knowledge-note` schema).

### Rec 3 — `auto-create-parent-moc.sh` PostToolUse hook installed

- Hook script: `.claude/hooks/auto-create-parent-moc.sh` (executable)
- Registered in `.claude/settings.json` under `hooks.PostToolUse` matching
  `Write|Edit|MultiEdit`. Sits BEFORE `lint-changed` so every knowledge
  note write triggers a topic-resolution pass.
- Behavior: when a write to `knowledge/*.md` references a non-existent
  topic in its `topics:` frontmatter field, the hook creates a stub MOC
  from scratch with:
  - `auto_generated: true` frontmatter flag (so stubs are searchable)
  - `auto_generated_source:` pointing to the note that triggered creation
  - `auto_generated_at:` ISO-8601 timestamp
  - A "Next steps for a human" block explaining how to either flesh out
    Core Ideas or delete the stub if it was a typo
- Every creation is appended to `ops/observations/auto-stubs-pending.md`
  with a timestamped entry so humans can triage in batches.
- Hook is read-only on body links — it only parses the `topics:` field,
  which is the explicit navigation contract. Opportunistic body links
  are ignored (they're semantic, not structural).

Tested end-to-end with a synthetic `topics: [[a-totally-new-nonexistent-moc]]`
note — stub created, flag set, observation log populated, correct metadata.

## Impact

**Dangling link count: 248+ → 137 (-45%).** The remaining 137 are Pattern B
(part-catalog items like `riorand-zs-x11h-bldc-controller-*` and
`hoverboard-bldc-hub-motor-*`) referenced from `parts-consolidation`
branch work. That's a separate cleanup pass tracked in the Master Backlog.

**Queue unblocking: ~30 pending claims** across the 4 batches with existing
queue items can now transition past the `verify` phase because their parent
MOC resolves. `/connect` next pass should auto-close the claim batches.

## Why it matters (dimension alignment)

`config.yaml` declares `automation: full` for the vault pipeline. Before
today, that dimension claim was silently violated: extraction auto-connected
links to parent MOCs, but when the parent didn't exist, nothing created it.
Humans had to notice after the fact, re-read the health report, and manually
backfill. The new hook closes that loop: the navigation layer can no longer
lag behind atomic extraction.

The `navigation: 3-tier` dimension (atomic → topic map → index) is now
enforced at write time rather than audit time. Orphan checks will continue
to PASS, but *incoming-closure* (atomic notes linking to MOCs that link back)
is now structurally guaranteed.

## Research basis

- Architect report identified 4 active wiring batches stalled in the queue
  at 55/70 pending claims, all blocked on non-existent parent MOCs.
- Failure mode: "Pipeline stall" — new to the watchlist; documented by
  this observation so future health reports can cite it.
- Dimensions impacted: `automation: full` (now truly full),
  `navigation: 3-tier` (now structurally closed at write time),
  `auto_connect_on_extract: true` (cascade now complete — link + target).

## Followups

1. Part-catalog Pattern B (137 remaining dangling refs): separate consolidation
   pass, possibly another agent-team dispatch targeting
   `knowledge/parts-*.md` naming conventions.
2. Run `/connect` on the 7 new MOCs to verify atomic-note-to-MOC
   back-references populate Core Ideas sections (currently listed) are
   still correct, and to catch any freshly-created auto-stubs.
3. Monitor `ops/observations/auto-stubs-pending.md` for the first real-world
   triggers of the hook — if the trigger-rate is high, the hook is working;
   if zero, it means the existing flow rarely produces new topics, and the
   hook is just preventive insurance.
