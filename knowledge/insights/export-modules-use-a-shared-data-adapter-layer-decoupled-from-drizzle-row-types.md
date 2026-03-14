---
name: Export modules use a shared data adapter layer decoupled from Drizzle row types
description: server/export/types.ts defines simplified data interfaces (BomItemData, CircuitInstanceData, etc.) that all 17 export modules consume — callers must map Drizzle row types to these shapes before calling exporters, creating a data adapter boundary that isolates exporters from schema changes
type: insight
category: architecture
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/export/types.ts:12-95 — 8 simplified interfaces (BomItemData, ComponentPartData, ArchNodeData, ArchEdgeData, CircuitInstanceData, CircuitNetData, CircuitWireData, ValidationIssueData)
  - server/export/types.ts:101-106 — ExportResult with content/encoding/mimeType/filename — uniform output envelope
  - server/export/types.ts:113-146 — shared helpers (sanitizeFilename, metaStr, escapeCSV, csvRow, escapeXml) used across all modules
  - server/export/gerber-generator.ts:16-19 — imports from types.ts, never from @shared/schema
---

# Export Modules Use a Shared Data Adapter Layer Decoupled from Drizzle Row Types

All 17 export modules in `server/export/` consume data through a shared set of simplified interfaces defined in `server/export/types.ts`. These interfaces are deliberately NOT the Drizzle row types from `@shared/schema` — they're flattened, field-narrowed versions that expose only what exporters need.

**Key differences from Drizzle types:**

| Drizzle Type | Export Type | What's different |
|-------------|------------|-----------------|
| `BomItem` (24 fields) | `BomItemData` (10 fields) | Drops `id`, `projectId`, `createdAt`, `deletedAt`, `version`, audit fields |
| `CircuitInstanceRow` | `CircuitInstanceData` | Flattens `properties` to `Record<string, unknown>`, keeps both schematic + PCB coords |
| `ComponentPart` | `ComponentPartData` | Types `connectors`/`buses`/`constraints` as `unknown[]` instead of Drizzle JSONB inference |
| `CircuitWireRow` | `CircuitWireData` | `points` as `unknown[]` instead of specific JSON structure |

**Why this boundary exists:**

1. **Schema independence:** When Drizzle columns are added/renamed/retyped (e.g., the `partId` nullable change noted in `CircuitInstanceData`), export modules don't need to change. The mapping code (in AI tools and route handlers) absorbs the difference.

2. **Testability:** Export modules can be tested with plain object literals matching the simplified interfaces, without constructing full Drizzle row objects with all their audit/metadata columns.

3. **Multi-source compatibility:** The same export interfaces could be fed from imported designs (KiCad, EAGLE, Altium parsers) that don't have Drizzle rows at all.

**Uniform output envelope:** All export modules return `ExportResult { content, encoding, mimeType, filename }`. This allows the route handler to serve any export format with the same response logic (set Content-Type, set Content-Disposition, write content). The `encoding` field distinguishes binary formats (Gerber → base64) from text formats (KiCad → utf8).

**Shared escape functions:** `escapeCSV()`, `escapeXml()`, `csvRow()`, `sanitizeFilename()`, and `metaStr()` are defined once in types.ts and imported by all modules. This eliminates the most common source of export bugs: inconsistent escaping across formats.

---

Related:
- [[drc-gate-is-a-pure-function-pipeline-stage-that-blocks-manufacturing-export-without-touching-the-database]] — DRC gate uses DrcGateInput (its own adapter types), not the export types
- [[barrel-files-enable-incremental-decomposition]] — server/export-generators.ts is the barrel for all 17 export modules
