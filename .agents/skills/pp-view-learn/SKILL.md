---
name: pp-view-learn
description: ProtoPulse page intelligence for Learn. Use when working on Learn view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Learn

Use this for page-level Learn work: learning content, search, source quality, view-aware help.

## When To Use

- Learning Content work in the Learn area.
- Search work in the Learn area.
- Source Quality work in the Learn area.
- View Aware Help work in the Learn area.
- Bugs where Learn routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Learn file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-learn/scripts/inspect-learn.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-learn/scripts/inspect-learn.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Learn work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 3

Source globs:
- client/src/components/views/KnowledgeView.tsx

Test globs:
- none recorded
<!-- PAGE-SKILL:AUTO-SYNC:END -->
