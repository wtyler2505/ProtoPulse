---
name: pp-view-community
description: ProtoPulse page intelligence for Community. Use when working on Community view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Community

Use this for page-level Community work: shared projects, community examples, trust/safety, import flow.

## When To Use

- Shared Projects work in the Community area.
- Community Examples work in the Community area.
- Trust/Safety work in the Community area.
- Import Flow work in the Community area.
- Bugs where Community routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Community file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-community/scripts/inspect-community.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-community/scripts/inspect-community.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Community work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 3

Source globs:
- client/src/components/views/CommunityView.tsx

Test globs:
- client/src/components/views/__tests__/CommunityView.test.tsx
- e2e/p1-viewer-3d-bridge.spec.ts
<!-- PAGE-SKILL:AUTO-SYNC:END -->
