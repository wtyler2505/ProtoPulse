---
summary: Routes using global IDs (circuitId, wireId, messageId) without project scoping are systematically vulnerable to IDOR — this pattern recurred across 3 security audit waves
areas: ["[[index]]"]
related insights:
  - "[[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — the recurrence mechanism that keeps producing new IDOR gaps"
  - "[[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — the body-vs-URL anti-pattern that explains why middleware alone cannot fix certain routes"
  - "[[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — a parallel authorization bypass through ephemeral state rather than database IDs"
  - "[[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — authorization bypass at the WebSocket layer rather than HTTP routes"
created: 2026-03-13
---

ProtoPulse's most persistent security vulnerability class is IDOR (Insecure Direct Object Reference) / BOLA (Broken Object-Level Authorization). The pattern: routes that accept a global resource ID (like `/api/wires/:id` or `/api/ai-actions/by-message/:messageId`) without verifying the authenticated user owns the project containing that resource.

This was first identified in the Codex audit (293 findings, 25 P0), partially fixed in Wave A (100+ routes), then re-discovered in Waves 52-53 and again in Wave 80 where Codex found 5 more gaps (BL-0636 through BL-0642).

A deeper root cause emerged from the gap audit: routes that accept `projectId` in the request body (AI chat, batch analysis, agent endpoints) structurally bypass URL-based ownership middleware (`requireProjectOwnership`), which only inspects `req.params`. This body-vs-URL anti-pattern means these endpoints cannot be secured by adding more middleware — they require restructuring to use URL parameters (e.g., `/api/projects/:id/chat`). Authorization must be derivable from the URL structure, not from user-supplied body data.

The fix pattern is always the same: create middleware that maps `resourceId → parentResource → projectId → verify ownership`. The recurring nature — documented in [[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — suggests the codebase needs a CI gate that flags new Express route registrations without ownership middleware. The [[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction|body-param bypass pattern]] reveals that some routes cannot be fixed with middleware at all and require structural URL changes.

## Topics

- [[index]]
