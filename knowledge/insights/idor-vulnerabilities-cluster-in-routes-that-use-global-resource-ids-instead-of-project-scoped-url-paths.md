---
summary: Routes using global IDs (circuitId, wireId, messageId) without project scoping are systematically vulnerable to IDOR — this pattern recurred across 3 security audit waves
areas: ["[[index]]"]
related insights:
  - "[[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]]": "Both are examples of patterns that emerged organically and needed retroactive standardization"
created: 2026-03-13
---

ProtoPulse's most persistent security vulnerability class is IDOR (Insecure Direct Object Reference) / BOLA (Broken Object-Level Authorization). The pattern: routes that accept a global resource ID (like `/api/wires/:id` or `/api/ai-actions/by-message/:messageId`) without verifying the authenticated user owns the project containing that resource.

This was first identified in the Codex audit (293 findings, 25 P0), partially fixed in Wave A (100+ routes), then re-discovered in Waves 52-53 and again in Wave 80 where Codex found 5 more gaps in AI chat, circuit routes, and batch analysis.

The fix pattern is always the same: create middleware that maps `resourceId → parentResource → projectId → verify ownership`. The recurring nature suggests the codebase needs a systematic audit any time new routes are added, not just periodic security sweeps.

## Topics

- [[index]]
