---
summary: Authorization patterns, IDOR prevention, access control design, and security audit methodology
type: moc
---

# Security

ProtoPulse's security landscape — where vulnerabilities cluster, why they recur, and how to prevent them.

## Insights

- [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — global IDs without project scoping are systematically vulnerable
- [[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — IDOR recurs because no CI gate checks new routes
- [[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — body-param projectId structurally bypasses middleware
- [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — shared in-memory Maps enable cross-tenant access
- [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — default editor role without invite table is an access control gap
- [[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits]] — code-vs-backlog comparison is the best audit methodology
