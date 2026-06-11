---
name: pp-view-starter-circuits
description: ProtoPulse page intelligence for Starter Circuits. Use when working on Starter Circuits view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Starter Circuits

Use this for page-level Starter Circuits work: starter templates, learning flow, quick start, safe defaults.

## When To Use

- Starter Templates work in the Starter Circuits area.
- Learning Flow work in the Starter Circuits area.
- Quick Start work in the Starter Circuits area.
- Safe Defaults work in the Starter Circuits area.
- Bugs where Starter Circuits routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Starter Circuits file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-starter-circuits/scripts/inspect-starter-circuits.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-starter-circuits/scripts/inspect-starter-circuits.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Starter Circuits work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 3

Source globs:
- client/src/components/views/StarterCircuitsPanel.tsx

Test globs:
- none recorded
<!-- PAGE-SKILL:AUTO-SYNC:END -->
