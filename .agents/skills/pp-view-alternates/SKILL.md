---
name: pp-view-alternates
description: ProtoPulse page intelligence for Alternates. Use when working on Alternates view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Alternates

Use this for page-level Alternates work: alternate parts, comparison, tradeoffs, substitution safety.

## When To Use

- Alternate Parts work in the Alternates area.
- Comparison work in the Alternates area.
- Tradeoffs work in the Alternates area.
- Substitution Safety work in the Alternates area.
- Bugs where Alternates routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Alternates file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-alternates/scripts/inspect-alternates.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-alternates/scripts/inspect-alternates.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Alternates work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 3

Source globs:
- client/src/components/views/PartAlternatesBrowserView.tsx

Test globs:
- none recorded
<!-- PAGE-SKILL:AUTO-SYNC:END -->
