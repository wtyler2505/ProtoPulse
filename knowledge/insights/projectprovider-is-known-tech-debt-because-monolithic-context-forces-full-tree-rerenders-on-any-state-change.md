---
summary: ProjectProvider holds 40+ state values in one React Context, causing unnecessary re-renders — the singleton+subscribe pattern is the proven alternative but migration is deferred
areas: ["[[index]]"]
related insights:
  - "[[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]]": "The singleton+subscribe pattern is the architectural answer to ProjectProvider's re-render problem — it already works for 30+ managers"
created: 2026-03-13
---

`ProjectProvider` in `client/src/lib/project-context.tsx` is ProtoPulse's original state management approach — a single React Context holding 40+ state values backed by React Query mutations. Every consumer re-renders when *any* value changes, because React Context does not support selective subscriptions.

This is acknowledged tech debt (TD-01 in the backlog). The [[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook|singleton+subscribe pattern]] that powers every newer manager is the proven alternative, but migrating ProjectProvider requires touching nearly every component in the app.

The pragmatic compromise: new features use singleton+subscribe managers, and ProjectProvider stays as-is until a dedicated refactoring wave.

## Topics

- [[index]]
