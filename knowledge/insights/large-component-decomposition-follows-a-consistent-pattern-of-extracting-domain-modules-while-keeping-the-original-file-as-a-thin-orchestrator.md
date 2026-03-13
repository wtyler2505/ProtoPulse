---
summary: Large file decomposition in ProtoPulse consistently extracts domain modules into subdirectories while keeping the original file as a thin orchestrator
areas: ["[[index]]"]
created: 2026-03-13
---

Three major decompositions in ProtoPulse followed the same pattern: extract cohesive domain logic into new files in a subdirectory, then reduce the original file to an orchestrator that imports and composes them. `ShapeCanvas.tsx` went from 1275 to 755 lines (6 extracted modules). `server/storage.ts` went from 1915 to 162 lines (13 domain modules in `server/storage/`). `ProcurementView.tsx` went from 1713 to 335 lines (15 sub-components in `components/views/procurement/`). The original file always survives as the entry point, preserving backward compatibility while dramatically improving navigability and testability.

## Topics

- [[index]]
