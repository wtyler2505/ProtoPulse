---
summary: IDOR gaps recurred 3 times (Codex audit, Waves 52-53, Wave 80) because no CI gate checks new Express routes for ownership middleware
category: bug-pattern
areas: ["[[index]]"]
related insights:
  - "[[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — the vulnerability pattern this recurrence mechanism keeps producing"
  - "[[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — a structural variant that middleware alone cannot catch"
  - "[[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits]] — the audit methodology that finally catches these gaps systematically"
  - "[[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — the wave model that creates the conditions for recurrence by shipping routes without cross-cutting audits"
  - "[[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — the proposed automated enforcement that would break this recurrence pattern"
created: 2026-03-13
---

ProtoPulse's IDOR vulnerabilities keep recurring not because fixes are wrong but because new routes are added without systematic verification. The recurrence spans four distinct audit cycles: the Codex audit (25 P0 items), Wave A (100+ routes fixed), Waves 52-53 (timing-safe admin, SQL wildcard escaping, SVG sanitization, ZIP bomb protection), and Wave 80 (more gaps in chat endpoints, circuit routes, and batch analysis).

Two new vulnerability classes emerged beyond traditional IDOR: (1) The WebSocket collaboration system assigns non-owners `editor` role by default with no persistent invite/membership table — any authenticated user who connects to a room can edit. This is an access control design gap, not an IDOR pattern. (2) Routes accepting `projectId` in the request body (AI chat, batch analysis, agent endpoints) structurally bypass URL-based ownership middleware — the fix requires route restructuring, not more middleware.

Each wave fixes the known gaps, but [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt|wave-based development's focus on vertical slices]] means the next wave adds new routes without ownership middleware. The [[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits|code-vs-backlog audit methodology]] catches these retroactively, but a pre-submit gate that flags new Express route registrations without ownership middleware would break the cycle proactively.

## Topics

- [[index]]
