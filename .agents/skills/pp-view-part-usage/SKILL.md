---
name: pp-view-part-usage
description: ProtoPulse page intelligence for Part Usage. Use when working on Part Usage view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Part Usage

Use this for page-level Part Usage work: where-used data, usage impact, project links, part lifecycle.

## When To Use

- Where Used Data work in the Part Usage area.
- Usage Impact work in the Part Usage area.
- Project Links work in the Part Usage area.
- Part Lifecycle work in the Part Usage area.
- Bugs where Part Usage routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Part Usage file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-part-usage/scripts/inspect-part-usage.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-part-usage/scripts/inspect-part-usage.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Part Usage work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 3

Source globs:
- client/src/components/views/PartUsageBrowserView.tsx

Test globs:
- none recorded
<!-- PAGE-SKILL:AUTO-SYNC:END -->
