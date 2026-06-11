---
name: pp-view-component-editor
description: ProtoPulse page intelligence for Component Editor. Use when working on Component Editor view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Component Editor

Use this for page-level Component Editor work: component metadata, pin data, footprint readiness, part editing safety.

## When To Use

- Component Metadata work in the Component Editor area.
- Pin Data work in the Component Editor area.
- Footprint Readiness work in the Component Editor area.
- Part Editing Safety work in the Component Editor area.
- Bugs where Component Editor routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Component Editor file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-component-editor/scripts/inspect-component-editor.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-component-editor/scripts/inspect-component-editor.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Component Editor work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 2

Source globs:
- client/src/components/views/ComponentEditorView.tsx
- client/src/components/views/component-editor/**

Test globs:
- client/src/components/views/__tests__/ComponentEditorAutoSave.test.tsx
- client/src/components/views/component-editor/__tests__/*.test.tsx
- client/src/components/views/component-editor/__tests__/*.test.ts
- client/src/lib/component-editor/__tests__/*.test.ts
<!-- PAGE-SKILL:AUTO-SYNC:END -->
