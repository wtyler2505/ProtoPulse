---
summary: The singleton+subscribe pattern emerged organically across 30+ managers and became ProtoPulse's standard for client-side state outside React Query
category: convention
areas: ["[[index]]"]
related insights:
  - "[[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — the counter-example: monolithic Context that proves why singleton+subscribe is better"
  - "[[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] — decomposition enables singleton+subscribe by giving each domain module its own state"
  - "[[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — many singleton managers back state with localStorage, creating the persistence gap"
  - "[[context-decomposition-uses-a-bridge-component-to-solve-cross-provider-dependency-ordering]] — singleton+subscribe avoids provider ordering problems entirely; the bridge pattern only exists because React Context forces a nesting tree"
  - "[[deprecated-useproject-facade-enables-incremental-migration-from-monolithic-to-decomposed-contexts]] — once all consumers migrate off the facade to singletons, the facade and its provider tree become deletable"
  - "[[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — singleton getSnapshot() always returns current state, avoiding the stale-closure bug that afflicts Context-based hook patterns"
created: 2026-03-13
---

ProtoPulse's client-side architecture converged on a single pattern for all non-server state: class-based singletons that expose a `subscribe(listener)` method and a `getSnapshot()` method. React's `useSyncExternalStore` turns any class following this contract into a first-class hook with zero boilerplate.

This pattern now powers 30+ managers — from early adopters like `WebSerialManager` and `FavoritesManager` through Waves 32-51 additions like `KanbanManager`, `DesignGateway`, `AIReviewQueue`, `GenerativeEngine`, `DeviceShadow`, `DiffPairManager`, `FlexZoneManager`, and `NetClassManager`. The consistency means any new feature manager is immediately hookable without introducing new context providers or state libraries.

The alternative was React Context (which ProtoPulse uses for `ProjectProvider`) — but Context forces re-renders on all consumers when any value changes, while singleton+subscribe gives surgical updates only to subscribers of the specific snapshot that changed. The 30+ singleton count versus the single problematic ProjectProvider is empirical proof of which pattern scales.

## Topics

- [[index]]
