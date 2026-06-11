---
name: pp-view-pcb
description: ProtoPulse page intelligence for PCB. Use when working on PCB view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse PCB

Use this for page-level PCB work: page behavior, layout, tests, workflow clarity.

## When To Use

- Page Behavior work in the PCB area.
- Layout work in the PCB area.
- Tests work in the PCB area.
- Workflow Clarity work in the PCB area.
- Bugs where PCB routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover PCB file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-pcb/scripts/inspect-pcb.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-pcb/scripts/inspect-pcb.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call PCB work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 1

Source globs:
- client/src/components/circuit-editor/PCBLayoutView.tsx
- client/src/components/views/pcb-layout/**
- client/src/lib/tscircuit-*.ts

Test globs:
- client/src/lib/__tests__/tscircuit-*.test.ts
- client/src/components/circuit-editor/__tests__/TSCircuit*.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
