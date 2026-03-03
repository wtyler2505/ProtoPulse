# ADR-0002: TanStack React Query over Redux/Zustand

**Status:** Accepted
**Date:** 2026-01-15 (retroactive)
**Deciders:** Tyler

## Context

ProtoPulse needs to manage server state (projects, nodes, edges, BOM items, chat messages, validation issues) and keep the UI synchronized with the database.

## Decision

Use TanStack React Query for all server state management. No Redux, Zustand, MobX, or other client-side state libraries. Use React Context only for client-only ephemeral state (active view, UI preferences).

## Rationale

- **Server state is the truth**: All persistent data lives in PostgreSQL. The client should cache and sync, not duplicate.
- **Automatic cache invalidation**: React Query's `invalidateQueries` after mutations keeps the UI fresh without manual state updates.
- **Optimistic updates**: React Query provides built-in optimistic mutation support with rollback on failure.
- **Deduplication**: Identical queries from multiple components share a single network request.
- **DevTools**: TanStack Query DevTools provide cache inspection without custom tooling.
- **Less boilerplate**: No actions, reducers, selectors, or middleware. Just `useQuery` and `useMutation`.

## Consequences

- **Monolithic ProjectProvider**: All mutations currently live in a single context (`client/src/lib/project-context.tsx`) — known tech debt, see TD-07.
- **No client-only global state**: UI preferences that don't sync to server use plain React Context. Acceptable for current scope.
- **Hydration complexity**: If SSR were ever needed, React Query's hydration boundaries would require careful setup. Currently not a concern (SPA-only).
