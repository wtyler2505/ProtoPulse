---
name: pp-view-procurement
description: ProtoPulse page intelligence for Procurement. Use when working on Procurement view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Procurement

Use this for page-level Procurement work: page behavior, layout, tests, workflow clarity.

## When To Use

- Page Behavior work in the Procurement area.
- Layout work in the Procurement area.
- Tests work in the Procurement area.
- Workflow Clarity work in the Procurement area.
- Bugs where Procurement routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Procurement file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Procurement work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 1

Source globs:
- client/src/components/views/ProcurementView.tsx
- client/src/components/views/procurement/**
- client/src/lib/supplier-api/**

Test globs:
- client/src/components/views/__tests__/procurement-sub-components.test.tsx
- client/src/lib/__tests__/supplier-api.test.ts
<!-- PAGE-SKILL:AUTO-SYNC:END -->
