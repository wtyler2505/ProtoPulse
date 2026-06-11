---
name: pp-view-digital-twin
description: ProtoPulse page intelligence for Digital Twin. Use when working on Digital Twin view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Digital Twin

Use this for page-level Digital Twin work: virtual hardware state, 3D/behavior preview, sync health, state confidence.

## When To Use

- Virtual Hardware State work in the Digital Twin area.
- 3D/Behavior Preview work in the Digital Twin area.
- Sync Health work in the Digital Twin area.
- State Confidence work in the Digital Twin area.
- Bugs where Digital Twin routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Digital Twin file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Digital Twin work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 2

Source globs:
- client/src/components/views/DigitalTwinView.tsx

Test globs:
- client/src/components/views/__tests__/DigitalTwinView.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
