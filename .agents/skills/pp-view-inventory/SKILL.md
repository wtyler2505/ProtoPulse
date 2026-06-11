---
name: pp-view-inventory
description: ProtoPulse page intelligence for Inventory. Use when working on Inventory view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Inventory

Use this for page-level Inventory work: inventory, local storage, saved parts, data recovery.

## When To Use

- Inventory work in the Inventory area.
- Local Storage work in the Inventory area.
- Saved Parts work in the Inventory area.
- Data Recovery work in the Inventory area.
- Bugs where Inventory routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Inventory file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-inventory/scripts/inspect-inventory.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-inventory/scripts/inspect-inventory.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Inventory work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 2

Source globs:
- client/src/components/views/StorageManagerPanel.tsx

Test globs:
- client/src/components/views/__tests__/storage-manager.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
