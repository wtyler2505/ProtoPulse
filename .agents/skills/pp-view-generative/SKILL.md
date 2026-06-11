---
name: pp-view-generative
description: ProtoPulse page intelligence for Generative. Use when working on Generative view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Generative

Use this for page-level Generative work: AI generation, proposal review, adoption flow, trust labels.

## When To Use

- AI Generation work in the Generative area.
- Proposal Review work in the Generative area.
- Adoption Flow work in the Generative area.
- Trust Labels work in the Generative area.
- Bugs where Generative routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Generative file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-generative/scripts/inspect-generative.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-generative/scripts/inspect-generative.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Generative work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 2

Source globs:
- client/src/components/views/GenerativeDesignView.tsx
- client/src/lib/generative-design/**

Test globs:
- client/src/components/views/__tests__/GenerativeDesignView.test.tsx
- client/src/lib/generative-design/__tests__/generative-adopt.test.ts
- client/src/lib/generative-design/__tests__/*.test.ts
<!-- PAGE-SKILL:AUTO-SYNC:END -->
