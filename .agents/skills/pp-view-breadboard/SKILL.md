---
name: pp-view-breadboard
description: ProtoPulse page intelligence for the Breadboard view. Use when working on BreadboardView, breadboard toolbar, breadboard canvas, workbench sidebar, exact parts, starter shelf, bench coach, board health, or breadboard hardware inspection entrypoints.
---

# ProtoPulse Breadboard View

Use this for page-level Breadboard work: layout, entrypoints, toolbar access, view state, tests, and fast orientation.

For deeper bench behavior, also load `breadboard-lab`. This skill owns the page/view map and self-improvement surface; `breadboard-lab` owns the full bench workflow.

## When To Use

- Breadboard page UI, layout, scroll behavior, toolbar density, dialogs, or panels.
- Starter/project/stash/exact-part placement flows.
- Breadboard canvas, wire editing, board health, coach overlays, or hardware inspection access.
- Bugs where the Breadboard page does not match schematic, inventory, validation, or AI behavior.
- Any task where a future agent would otherwise need to rediscover Breadboard file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`.
2. Read the smallest matching reference:
   - `references/page-map.md` for files and data flow.
   - `references/ux-contract.md` for layout and user-facing behavior.
   - `references/testing.md` for exact checks.
   - `references/gotchas.md` before changing wiring, tests, or view sync.
3. Make the smallest useful change in the page area.
4. Run the nearest Breadboard tests, then browser-check the changed flow when UI changed.
5. Add new durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/HardwareInspectionPanel.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/Breadboard*.test.tsx`
- `npm run test -- client/src/components/circuit-editor/breadboard-view/__tests__/BreadboardToolbar.test.tsx`

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, but keep human guidance in the reference files.

Thin `SKILL.md` files are not enough for active ProtoPulse pages. A real page skill needs a map, test guide, UX contract, gotchas, and an inspection script.

## Related Skills

- `breadboard-lab`
- `pp-view-schematic`
- `pp-view-validation`
- `pp-view-uiux-design`

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 1

Source globs:
- client/src/components/circuit-editor/BreadboardView.tsx
- client/src/components/circuit-editor/breadboard-*
- client/src/components/circuit-editor/useBreadboardCoachPlan.ts

Test globs:
- client/src/components/circuit-editor/__tests__/Breadboard*.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
