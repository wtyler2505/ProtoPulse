---
summary: The singleton+subscribe pattern emerged organically across 30+ managers and became ProtoPulse's standard for client-side state outside React Query
areas: ["[[index]]"]
related insights:
  - "[[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]]": "ProjectProvider is the counter-example — the monolithic Context that proves why singleton+subscribe is better"
  - "[[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]]": "Both patterns needed retroactive standardization across the codebase"
created: 2026-03-13
---

ProtoPulse's client-side architecture converged on a single pattern for all non-server state: class-based singletons that expose a `subscribe(listener)` method and a `getSnapshot()` method. React's `useSyncExternalStore` turns any class following this contract into a first-class hook with zero boilerplate.

This pattern now powers 30+ managers — from `WebSerialManager` to `FavoritesManager` to `KanbanManager` to `GenerativeEngine`. The consistency means any new feature manager is immediately hookable without introducing new context providers or state libraries.

The alternative was React Context (which ProtoPulse uses for `ProjectProvider`) — but Context forces re-renders on all consumers when any value changes, while singleton+subscribe gives surgical updates only to subscribers of the specific snapshot that changed.

## Topics

- [[index]]
