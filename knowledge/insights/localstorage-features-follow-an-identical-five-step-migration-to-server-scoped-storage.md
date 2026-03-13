---
summary: 6+ ProtoPulse features store state exclusively in localStorage and each migration to server-scoped storage follows the same 5-step pattern — Drizzle schema, IStorage method, Express route with ownership, React Query hook, localStorage as offline cache
category: implementation-detail
areas:
  - "[[architecture]]"
  - "[[conventions]]"
confidence: proven
affected_files:
  - shared/schema.ts
  - server/storage.ts
  - server/routes/
  - client/src/lib/project-context.tsx
---

# localStorage features follow an identical five-step migration to server-scoped storage

ProtoPulse has 6+ features that store state exclusively in localStorage: Kanban board tasks, design variables, custom DRC scripts, keyboard shortcuts, community collections, and PCB ordering history. Each of these is a data silo — project-scoped data that doesn't persist across browsers, can't be shared via collaboration, and isn't backed up with the project.

Every migration from localStorage to server-scoped storage follows the same structural pattern:

1. **Drizzle schema** — add a table in `shared/schema.ts` with a `projectId` foreign key linking to the projects table
2. **IStorage interface** — add CRUD methods to `server/storage.ts` (the `IStorage` interface + `DatabaseStorage` implementation)
3. **Express routes** — add routes in `server/routes/` with `requireProjectOwnership` middleware
4. **React Query hooks** — add TanStack Query hooks in `client/src/lib/project-context.tsx` replacing direct `localStorage.getItem/setItem` calls
5. **Offline cache** — keep localStorage as an offline cache layer with sync-on-reconnect behavior via the offline sync engine

This playbook is structurally identical across all 6+ features. The only variables are the table shape, the CRUD method signatures, and the route paths. A template or generator could reduce each migration from a multi-hour task to a configuration-driven scaffold.

---

Related:
- [[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — the storage barrel pattern these migrations extend

Areas:
- [[architecture]]
- [[conventions]]
