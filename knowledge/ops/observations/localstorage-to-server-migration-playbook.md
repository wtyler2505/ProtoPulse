---
summary: A systematic pattern for migrating localStorage-backed features to project-scoped server storage with localStorage as offline cache
type: implementation-idea
created: 2026-03-13
status: promoted
promoted_to: "[[localStorage features follow an identical five-step migration to server-scoped storage]]"
---

6+ ProtoPulse features store state exclusively in localStorage (Kanban, design variables, DRC scripts, shortcuts, community collections, PCB ordering history). Each migration follows the same steps: (1) add Drizzle schema table with projectId foreign key, (2) add IStorage interface methods + DatabaseStorage implementation, (3) add Express routes with ownership middleware, (4) add React Query hooks replacing direct localStorage calls, (5) keep localStorage as offline cache with sync-on-reconnect. This playbook should be documented as a reusable template since each migration is structurally identical.
