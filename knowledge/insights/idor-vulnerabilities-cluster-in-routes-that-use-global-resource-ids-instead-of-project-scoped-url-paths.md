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

Wave 80 (March 2026) found 5 more P0 IDOR gaps through a Codex gap audit: BL-0636 (AI chat endpoints accept projectId in body without ownership verification), BL-0637 (ai-actions by-message queries without project scoping), BL-0638 (circuit API instances/nets/wires/autoroute operate on global IDs — rated C5 complexity), BL-0639 (circuit routes fetch by ID without project↔resource verification), and BL-0642 (batch analysis accepts body projectId without guards). This is the THIRD time the same vulnerability class was discovered, suggesting a CI-time gate for new route registrations is needed.

## Topics

- [[index]]
