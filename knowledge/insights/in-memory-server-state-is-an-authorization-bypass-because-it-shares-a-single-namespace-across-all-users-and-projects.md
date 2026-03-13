---
summary: Server-side in-memory Maps (RAG docs, batch tracking, job queues) share a single namespace across all users and projects, enabling cross-tenant data access
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse stores several categories of server state in plain JavaScript Maps without tenant scoping: RAG document collections, batch analysis tracking, and job queue state. Because these Maps use simple string keys without project or user prefixes, any authenticated user can access or manipulate any other user's data through the shared namespace. This is not a traditional IDOR vulnerability (those use database IDs) — it's a namespace isolation failure in ephemeral state. The fix requires either tenant-scoped key prefixes (`${projectId}:${key}`) or per-project Map instances. This pattern is easy to miss in security audits because it doesn't involve database queries.

## Topics

- [[index]]
