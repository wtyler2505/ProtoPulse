---
summary: Large file decomposition in ProtoPulse consistently extracts domain modules into subdirectories while keeping the original file as a thin orchestrator
category: convention
areas: ["[[index]]"]
related insights:
  - "[[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — barrel files are the mechanism that makes this pattern safe for callers"
  - "[[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — decomposed domain modules naturally adopt singleton+subscribe for their state"
  - "[[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — ProjectProvider is the monolith that most needs this decomposition pattern"
created: 2026-03-13
---

Three major decompositions in ProtoPulse followed the same pattern: extract cohesive domain logic into new files in a subdirectory, then reduce the original file to an orchestrator that imports and composes them. `ShapeCanvas.tsx` went from 1275 to 755 lines (6 extracted modules). `server/storage.ts` went from 1915 to 162 lines (13 domain modules in `server/storage/`). `ProcurementView.tsx` went from 1713 to 335 lines (15 sub-components in `components/views/procurement/`). The original file always survives as the entry point, preserving backward compatibility while dramatically improving navigability and testability.

- [[three-diff-engines-share-identical-algorithm-shape-but-are-not-abstracted-creating-a-subtle-maintenance-trap]] — a future unification of the three diff engines would follow this decomposition pattern (shared core + thin wrappers)

## Topics

- [[index]]
