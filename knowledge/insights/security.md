---
summary: Authorization patterns, IDOR prevention, access control design, and security audit methodology
type: moc
---

# Security

ProtoPulse's security landscape — where vulnerabilities cluster, why they recur, and how to prevent them. The dominant theme: IDOR gaps recur across audit cycles because the wave model ships routes faster than audits can catch them. A CI gate enforcing ownership middleware would break this cycle, though bypass channels (in-memory state, WebSocket collaboration, body-param routes) would still need separate treatment.

## Insights

- [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — global IDs without project scoping are systematically vulnerable
- [[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — IDOR recurs because no CI gate checks new routes
- [[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — proposed automated enforcement: CI gate flags routes missing ownership middleware
- [[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — body-param projectId structurally bypasses middleware
- [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — shared in-memory Maps enable cross-tenant access
- [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — default editor role without invite table is an access control gap
- [[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits]] — code-vs-backlog comparison is the best audit methodology
- [[session-token-rotation-on-refresh-prevents-session-fixation-by-invalidating-the-old-hash-atomically-with-new-hash-creation]] — session rotation with SHA-256 hashing and refresh window

## Connection Clusters

### Authentication vs Authorization Gap
The security surface has a well-hardened authentication layer ([[session-token-rotation-on-refresh-prevents-session-fixation-by-invalidating-the-old-hash-atomically-with-new-hash-creation|session rotation]], scrypt passwords, AES-256-GCM API key encryption) but weaker authorization enforcement. [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls|WebSocket collaboration grants editor role without membership checks]], and [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects|in-memory Maps share a global namespace]]. Notably, some Maps ARE correctly scoped — the [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix|AI dedup Map]] includes projectId in its key.
