---
summary: A pre-submit CI check that flags new Express route registrations without requireProjectOwnership middleware would break the IDOR recurrence cycle
type: implementation-idea
created: 2026-03-13
status: promoted
promoted_to: "[[a CI gate for route ownership middleware would break the IDOR recurrence cycle]]"
---

IDOR vulnerabilities have recurred across 4 audit cycles because new routes are added without ownership middleware. A CI gate — either an ESLint rule or a grep-based check — could scan for `router.get`, `router.post`, `router.put`, `router.patch`, `router.delete` registrations and verify that `requireProjectOwnership` appears in the middleware chain. Exceptions would need a whitelist for genuinely public routes (login, register, health check). This would shift IDOR prevention from reactive audits to proactive enforcement.
