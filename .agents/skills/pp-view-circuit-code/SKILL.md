---
name: pp-view-circuit-code
description: ProtoPulse page intelligence for Circuit Code. Use when working on Circuit Code view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Circuit Code

Use this for page-level Circuit Code work: generated circuit code, code preview, copy/export actions, source trust.

## When To Use

- Generated Circuit Code work in the Circuit Code area.
- Code Preview work in the Circuit Code area.
- Copy/Export Actions work in the Circuit Code area.
- Source Trust work in the Circuit Code area.
- Bugs where Circuit Code routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Circuit Code file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-circuit-code/scripts/inspect-circuit-code.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-circuit-code/scripts/inspect-circuit-code.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Circuit Code work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 2

Source globs:
- client/src/components/views/CircuitCodeView.tsx
- client/src/components/views/circuit-code/CodeEditor.tsx

Test globs:
- client/src/components/views/__tests__/CircuitCodeView.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
