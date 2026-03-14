---
summary: Server-side in-memory Maps (RAG docs, batch tracking, job queues) share a single namespace across all users and projects, enabling cross-tenant data access
category: bug-pattern
areas: ["[[index]]"]
related insights:
  - "[[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — database-layer IDOR; this is the ephemeral-state parallel"
  - "[[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — another non-database authorization bypass vector"
  - "[[soft-deletes-create-a-persistent-querying-tax-where-forgetting-isNull-causes-data-ghosts]] — both are patterns where forgetting a filter clause causes silent data leakage"
created: 2026-03-13
---

ProtoPulse stores several categories of server state in plain JavaScript Maps without tenant scoping: RAG document collections, batch analysis tracking, and job queue state. Because these Maps use simple string keys without project or user prefixes, any authenticated user can access or manipulate any other user's data through the shared namespace. This is not a traditional IDOR vulnerability (those use database IDs) — it's a namespace isolation failure in ephemeral state. The fix requires either tenant-scoped key prefixes (`${projectId}:${key}`) or per-project Map instances. This pattern is easy to miss in security audits because it doesn't involve database queries.

**Note:** Not all in-memory Maps have this problem. The [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix|AI request deduplication `activeRequests` Map]] correctly includes `projectId` in its composite key, making it tenant-scoped by construction. The [[session-token-rotation-on-refresh-prevents-session-fixation-by-invalidating-the-old-hash-atomically-with-new-hash-creation|session token system]] also correctly scopes per-user via SHA-256 hash lookup. The unscoped Maps are the ones used for RAG docs, batch tracking, and similar features that grew without the same security scrutiny.

## Topics

- [[index]]
