---
name: pp-view-ai-chat
description: ProtoPulse page intelligence for AI Chat. Use when working on AI Chat view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse AI Chat

Use this for page-level AI Chat work: page behavior, layout, tests, workflow clarity.

## When To Use

- Page Behavior work in the AI Chat area.
- Layout work in the AI Chat area.
- Tests work in the AI Chat area.
- Workflow Clarity work in the AI Chat area.
- Bugs where AI Chat routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover AI Chat file locations.

## Fast Workflow

1. Run `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`.
2. Read `references/page-map.md` for files and ownership.
3. Read `references/ux-contract.md` before changing layout or user-facing behavior.
4. Read `references/testing.md` for the closest checks.
5. Read `references/gotchas.md` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- Run the nearest tests listed in `references/testing.md`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call AI Chat work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 1

Source globs:
- client/src/components/panels/ChatPanel.tsx
- client/src/components/panels/chat/**
- client/src/hooks/useChatSettings.ts

Test globs:
- client/src/components/panels/chat/**/*.test.tsx
- client/src/components/panels/chat/**/*.test.ts
<!-- PAGE-SKILL:AUTO-SYNC:END -->
