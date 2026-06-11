---
name: pp-view-dashboard
description: ProtoPulse page intelligence for Dashboard. Use when working on Dashboard view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Dashboard

Use this for page-level Dashboard work: status overview, project health, recent activity, next actions.

## When To Use

- Status Overview work in the Dashboard area.
- Project Health work in the Dashboard area.
- Recent Activity work in the Dashboard area.
- Next Actions work in the Dashboard area.
- Bugs where Dashboard routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Dashboard file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-dashboard/scripts/inspect-dashboard.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-dashboard/scripts/inspect-dashboard.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Dashboard work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 2

Source globs:
- client/src/components/views/DashboardView.tsx

Test globs:
- client/src/components/views/__tests__/DashboardView.validation.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
