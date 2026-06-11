---
name: pp-view-order-pcb
description: ProtoPulse page intelligence for Order PCB. Use when working on Order PCB view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Order PCB

Use this for page-level Order PCB work: PCB order flow, fab checks, cost/shipping, final review.

## When To Use

- PCB Order Flow work in the Order PCB area.
- Fab Checks work in the Order PCB area.
- Cost/Shipping work in the Order PCB area.
- Final Review work in the Order PCB area.
- Bugs where Order PCB routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Order PCB file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-order-pcb/scripts/inspect-order-pcb.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-order-pcb/scripts/inspect-order-pcb.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Order PCB work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 2

Source globs:
- client/src/components/views/PcbOrderingView.tsx

Test globs:
- none recorded
<!-- PAGE-SKILL:AUTO-SYNC:END -->
