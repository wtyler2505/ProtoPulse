---
name: pp-view-supply-chain
description: ProtoPulse page intelligence for Supply Chain. Use when working on Supply Chain view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse Supply Chain

Use this for page-level Supply Chain work: supplier risk, availability alerts, alternates, source confidence.

## When To Use

- Supplier Risk work in the Supply Chain area.
- Availability Alerts work in the Supply Chain area.
- Alternates work in the Supply Chain area.
- Source Confidence work in the Supply Chain area.
- Bugs where Supply Chain routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover Supply Chain file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-supply-chain/scripts/inspect-supply-chain.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-supply-chain/scripts/inspect-supply-chain.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call Supply Chain work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 3

Source globs:
- client/src/components/views/SupplyChainAlertsPanel.tsx

Test globs:
- client/src/components/views/__tests__/SupplyChainAlertsPanel.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
