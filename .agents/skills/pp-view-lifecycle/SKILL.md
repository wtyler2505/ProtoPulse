---
name: pp-view-lifecycle
description: ProtoPulse page intelligence for Lifecycle. Use when working on Lifecycle view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Lifecycle

Use this for page-level Lifecycle work: project lifecycle, maturity stages, readiness, history.

## When To Use

- Project Lifecycle work in the Lifecycle area.
- Maturity Stages work in the Lifecycle area.
- Readiness work in the Lifecycle area.
- History work in the Lifecycle area.
- Bugs where Lifecycle routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Lifecycle file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-lifecycle/scripts/inspect-lifecycle.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-lifecycle/scripts/inspect-lifecycle.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Lifecycle work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-24T00:00:00.000Z
Commit: 414f0bbc
Manifest status: active
Tier: 3

Source globs:
- client/src/components/views/LifecycleDashboard.tsx

Test globs:
- client/src/components/views/__tests__/LifecycleDashboard.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
