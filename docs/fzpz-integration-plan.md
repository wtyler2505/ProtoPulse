# FZPZ Studio → ProtoPulse Integration Plan

**Created:** 2026-02-17
**Status:** Draft — pending audit checklist completion
**Last updated:** 2026-02-17

---

## Table of Contents

1. [What FZPZ Studio Is](#1-what-fzpz-studio-is)
2. [Integration Vision](#2-integration-vision)
3. [Architecture Decision: How It Fits](#3-architecture-decision-how-it-fits)
4. [Data Model Changes](#4-data-model-changes)
5. [File-by-File Integration Map](#5-file-by-file-integration-map)
6. [AI Consolidation Plan](#6-ai-consolidation-plan)
7. [UI/UX Integration Design](#7-uiux-integration-design)
8. [Dependency Reconciliation](#8-dependency-reconciliation)
9. [Phased Execution Plan](#9-phased-execution-plan)
10. [Risk Assessment & Mitigations](#10-risk-assessment--mitigations)
11. [Testing Strategy](#11-testing-strategy)
12. [Open Questions](#12-open-questions)
13. [Checklist](#13-execution-checklist)

---

## 1. What FZPZ Studio Is

FZPZ Studio is a standalone Fritzing part editor (~2,450 lines across 4 main files):

### Core capabilities:
- **Multi-view SVG canvas** — breadboard, schematic, and PCB views of a single electronic component
- **Shape drawing tools** — rect, circle, text, path, groups with selection, alignment, copy/paste
- **Connector/pin management** — pin placement, pad specs (THT/SMD), terminal positions per view
- **Part metadata editor** — title, family, manufacturer, MPN, tags, mounting type, package type, properties
- **FZPZ import/export** — reads and writes Fritzing `.fzpz` format (zipped FZP XML + SVG)
- **AI-powered features** (via Gemini):
  - Generate entire parts from text description or image
  - Modify existing parts via natural language
  - Extract metadata + pinout from datasheet upload (PDF/image)
  - Auto-suggest part descriptions
- **Package generator** — parametric generation of DIP, SOIC, QFP, QFN, Header, Resistor, Capacitor footprints
- **Validation engine** — checks for missing connectors, overlapping shapes, incomplete metadata, etc.
- **Undo/redo** — full history via useReducer with past/present/future stacks
- **Auto-save** — debounced localStorage persistence

### File inventory:
| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 165 | All TypeScript interfaces (Shape, Connector, PartMeta, UIState, AppState, etc.) |
| `utils.ts` | 705 | Math, coordinates, UUID, alignment, validation, FZPZ export/import, AI extraction |
| `generators.ts` | 642 | Package generation (parametric), AI part generation, AI part modification |
| `App.tsx` | 1,103 | Entire UI: reducer, toolbar, canvas, inspector, metadata editor, modals |
| `index.tsx` | 55 | Entry point / React mount |

### Key data structures:
- `PartState` — the core part model: meta + connectors[] + buses[] + views (breadboard/schematic/pcb, each with shapes[])
- `Shape` — discriminated union: rect | circle | path | text | group, each with position, style, optional rotation
- `Connector` — pin with shapeIds per view, terminal positions per view, padSpec for PCB
- `UIState` — active view, selection, pan/zoom, tool, grid settings, reference images, modals, clipboard, validation issues
- Uses `useReducer` with 25+ action types for all state mutations

---

## 2. Integration Vision

### The big picture:
FZPZ Studio becomes ProtoPulse's **Component Editor** — a dedicated workspace where users design individual electronic components at the part level, complementing ProtoPulse's system-level architecture editor.

### User journey after integration:
1. User designs system architecture in the existing block diagram editor
2. User clicks on a component node (e.g., "ESP32 Module") → opens Component Editor
3. In the Component Editor, they can:
   - Design the part's physical layout (breadboard/schematic/PCB views)
   - Manage pins and connectors
   - Edit part metadata (manufacturer, MPN, datasheet URL)
   - Use AI to generate or modify the part from description/datasheet
   - Generate standard package footprints (DIP, SOIC, etc.)
   - Validate the part for completeness
   - Export as .fzpz for use in Fritzing
4. Part data feeds back into BOM (metadata, MPN, manufacturer) and validation (part completeness)

### What this replaces:
The current `SchematicView.tsx` (711 lines) is a **hardcoded stub** with fake components and no real editing. It will be replaced by the FZPZ Studio's multi-view component editor, which is a real, functional tool.

---

## 3. Architecture Decision: How It Fits

### Option chosen: **New view ("Component Editor") + replace SchematicView**

**Why:**
- FZPZ Studio's multi-view canvas (breadboard/schematic/PCB) is a superset of the current SchematicView stub
- It naturally maps to a new sidebar tab in the existing view-switching system
- The component editor operates at a different conceptual level (individual part) vs. architecture view (system level), so it should be its own view
- The current SchematicView has no real functionality (it's hardcoded data) — replacing it loses nothing

**Integration model:**
```
ProtoPulse workspace views:
  ├── Architecture (existing — system block diagram)
  ├── Component Editor (NEW — replaces Schematic)
  │   ├── Breadboard view tab
  │   ├── Schematic view tab
  │   ├── PCB view tab
  │   └── Metadata tab
  ├── Procurement / BOM (existing)
  ├── Validation (existing — augmented with part validation)
  └── Output Log (existing)
```

### State management approach:
- FZPZ Studio uses `useReducer` with an undo/redo history wrapper — this is self-contained and well-architected
- Keep this pattern intact within the Component Editor view; **do NOT merge it into the monolithic ProjectProvider**
- The Component Editor gets its own context provider (`ComponentEditorProvider`) that wraps just the editor view
- Communicate with the parent project context via:
  - Reading: which component is being edited (selected node from architecture)
  - Writing: saving part data to backend, updating BOM metadata

---

## 4. Data Model Changes

### 4.1 New database table: `component_parts`

```sql
CREATE TABLE component_parts (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id TEXT,                           -- links to architecture_nodes.nodeId (nullable for standalone parts)
  meta JSONB NOT NULL DEFAULT '{}',       -- PartMeta object
  connectors JSONB NOT NULL DEFAULT '[]', -- Connector[] array
  buses JSONB NOT NULL DEFAULT '[]',      -- Bus[] array
  views JSONB NOT NULL DEFAULT '{}',      -- { breadboard: ViewData, schematic: ViewData, pcb: ViewData }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_component_parts_project ON component_parts(project_id);
CREATE INDEX idx_component_parts_node ON component_parts(node_id);
```

**Why JSONB for shapes/connectors instead of normalized tables:**
- Shape data is deeply nested (groups contain children, paths have complex `d` strings)
- Connector data has per-view terminal positions and pad specs
- The data is always loaded/saved as a unit (no individual shape queries needed)
- JSONB supports indexing if we ever need to query inside
- Matches how FZPZ Studio already structures its state
- Avoids creating 5+ additional tables for what's essentially a document store

### 4.2 Schema changes in `shared/schema.ts`

```typescript
export const componentParts = pgTable("component_parts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  nodeId: text("node_id"),
  meta: jsonb("meta").notNull().default({}),
  connectors: jsonb("connectors").notNull().default([]),
  buses: jsonb("buses").notNull().default([]),
  views: jsonb("views").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_component_parts_project").on(table.projectId),
  index("idx_component_parts_node").on(table.nodeId),
]);
```

### 4.3 Type definitions needed in `shared/` or client types

The FZPZ Studio types (`types.ts`) need to be made available to both client and server:
- Move `types.ts` content into a new `shared/component-types.ts` file
- This ensures type safety across the API boundary
- Remove the FZPZ-only UI state types (UIState, AppState) — those stay client-side only
- Keep shared types: Shape, Connector, Bus, PartMeta, ViewData, PadSpec, Point, BoundingBox, ValidationIssue (renamed to avoid collision with existing ValidationIssue)

### 4.4 API endpoints needed

```
GET    /api/projects/:id/components          — list all component parts for a project
GET    /api/components/:id                   — get a single component part
POST   /api/projects/:id/components          — create a new component part
PATCH  /api/components/:id                   — update a component part (auto, debounced)
DELETE /api/components/:id?projectId=X       — delete a component part (with ownership check)
POST   /api/components/:id/export-fzpz       — generate and download .fzpz file
POST   /api/components/import-fzpz           — upload .fzpz and create component part
POST   /api/components/:id/ai/generate       — AI generate part from description
POST   /api/components/:id/ai/modify         — AI modify existing part
POST   /api/components/:id/ai/extract        — AI extract metadata from datasheet
```

---

## 5. File-by-File Integration Map

### Source files → Target locations

| FZPZ Studio File | → ProtoPulse Target | Notes |
|-------------------|---------------------|-------|
| `types.ts` (165 lines) | `shared/component-types.ts` (shared data types) + `client/src/lib/component-editor/types.ts` (UI-only types) | Split into shared (Shape, Connector, PartMeta, ViewData) and client-only (UIState, SelectionRef, AppState) |
| `utils.ts` (705 lines) | `client/src/lib/component-editor/utils.ts` (client-side math/validation) + `server/component-export.ts` (FZPZ export/import — server-side) + `server/component-ai.ts` (AI calls — server-side) | Split by concern: geometry/alignment/validation → client; FZPZ file I/O → server; AI calls → server |
| `generators.ts` (642 lines) | `client/src/lib/component-editor/generators.ts` (parametric generators — pure functions, no AI) + `server/component-ai.ts` (AI generation — server-side) | Parametric generation (DIP/SOIC/etc.) is pure math, stays client-side. AI generation moves server-side. |
| `App.tsx` (1,103 lines) | Decomposed into ~6 files under `client/src/components/component-editor/`: | **Critical: Do NOT create another 1,100-line monolith** |

### App.tsx decomposition target:

```
client/src/components/component-editor/
├── ComponentEditorProvider.tsx    — useReducer + history + context provider (~150 lines)
├── ComponentEditorView.tsx        — main layout: toolbar + canvas + inspector (~150 lines)
├── ComponentCanvas.tsx            — SVG canvas with pan/zoom/draw/select (~250 lines)
├── ComponentToolbar.tsx           — tool buttons, view tabs, undo/redo, alignment (~100 lines)
├── ComponentInspector.tsx         — right panel: shape props, connector props, metadata (~200 lines)
├── ComponentMetadataPanel.tsx     — metadata form (title, family, MPN, etc.) (~150 lines)
├── GeneratorModal.tsx             — package generator dialog (~120 lines)
├── ModifyModal.tsx                — AI modify dialog (~60 lines)
├── ValidationModal.tsx            — validation results dialog (~40 lines)
└── shared-components.tsx          — PanelHeader, InputGroup, DebouncedInput, etc. (~80 lines)
```

### Utility styling components:
- `PanelHeader`, `InputGroup`, `DebouncedInput`, `DebouncedNumber`, `InspectorField` — these should use shadcn/ui equivalents where possible, or become shared components

---

## 6. AI Consolidation Plan

### Current state:
- **ProtoPulse** has AI chat via Anthropic + Gemini (`server/ai.ts`), streaming SSE
- **FZPZ Studio** uses Gemini only (`@google/genai` client-side) for:
  - Part generation from description/image
  - Part modification from natural language
  - Datasheet metadata extraction
  - Description auto-suggestion

### Target state:
All AI calls go through the server. No client-side API key usage.

### Migration plan:

1. **Move FZPZ AI functions to server:**
   - `generatePartWithAI()` → `POST /api/components/:id/ai/generate`
   - `modifyPartWithAI()` → `POST /api/components/:id/ai/modify`
   - `extractMetadataFromDatasheet()` → `POST /api/components/:id/ai/extract`
   - `suggestDescription()` → `POST /api/components/:id/ai/suggest-description`

2. **Use ProtoPulse's existing AI key infrastructure:**
   - FZPZ Studio currently passes API key per-request from client — this maps directly to ProtoPulse's existing pattern (ChatPanel sends keys via request body)
   - Eventually both should move to server-side key storage (audit item #61/#backend-61)

3. **Reuse vs. separate AI module:**
   - FZPZ AI prompts are highly specialized (SVG generation, FZP XML format, Fritzing conventions) — very different from ProtoPulse's general-purpose chat AI
   - **Decision: Create a separate `server/component-ai.ts`** with its own prompts and handlers
   - Share the Gemini client instantiation pattern from `server/ai.ts` (or better, create a shared `getGeminiClient(apiKey)` helper)
   - The Anthropic integration stays for chat; Gemini handles component AI (since the prompts are already tuned for Gemini)

4. **Gemini SDK migration:**
   - FZPZ Studio uses `@google/genai` (newer SDK)
   - ProtoPulse uses `@google/generative-ai` (older SDK)
   - **Decision: Migrate ProtoPulse to `@google/genai`** (the newer one) during this integration, since it's a drop-in improvement
   - This is a low-risk change that modernizes the dependency

---

## 7. UI/UX Integration Design

### 7.1 Navigation integration

The Component Editor becomes a new sidebar tab, replacing the current "Schematic" tab:

```
Sidebar tabs (updated):
  📐 Architecture        → existing
  🔧 Component Editor    → NEW (replaces Schematic)
  📦 BOM / Procurement   → existing
  ✅ Validation           → existing (augmented)
  📋 Output              → existing
```

### 7.2 View switching within Component Editor

The Component Editor has its own internal view tabs (breadboard/schematic/pcb/metadata), managed by its own state — **not** by the parent ProjectProvider's `activeView`.

```
ProjectWorkspace
├── Sidebar (tab = "component-editor" selected)
└── Main content area
    └── ComponentEditorView
        ├── Internal tabs: [Breadboard] [Schematic] [PCB] [Metadata]
        ├── Toolbar (tools, alignment, undo/redo)
        ├── Canvas (SVG)
        └── Inspector (right panel)
```

### 7.3 Connecting architecture nodes to component parts

When a user has an architecture node selected (e.g., "ESP32-S3 Module") and switches to the Component Editor tab:
- If a `component_part` exists for that node (linked by `nodeId`) → load it
- If no part exists → show a "Create Component Part" prompt with options:
  - Start from scratch (blank canvas)
  - Generate from AI (describe the part)
  - Import from .fzpz file
  - Choose a standard package template

### 7.4 BOM enrichment

When a component part has metadata (manufacturer, MPN, datasheet URL), this data can auto-populate BOM entries:
- On save, if the part's `nodeId` matches a BOM item's source node, offer to update BOM fields
- Fields that can flow: manufacturer, part number, description, package type, mounting type
- This is a **one-way suggestion** — user confirms before BOM is updated

### 7.5 Validation integration

The Component Editor has its own validation engine (`validatePart()` in utils.ts). This should feed into ProtoPulse's existing validation view:
- Component-level validation issues get a new category in the validation list
- Clicking a component validation issue navigates to the Component Editor with the relevant view/element highlighted
- The existing validation "Auto-Fix" behavior (#57 in frontend audit) should be reconsidered here

### 7.6 Styling alignment

FZPZ Studio uses a dark zinc/indigo theme — close but not identical to ProtoPulse's dark neon cyan/purple theme.
- Replace FZPZ's inline Tailwind classes with ProtoPulse's design tokens
- Use shadcn/ui components where possible (Button, Input, Select, Dialog, Tabs, Tooltip)
- Canvas styling stays custom (SVG doesn't use shadcn)
- Match the font stack (Rajdhani headings, JetBrains Mono for technical values, Inter for body)

---

## 8. Dependency Reconciliation

### React version conflict:
- ProtoPulse: React 18
- FZPZ Studio: React 19
- **Decision: Stay on React 18** (ProtoPulse's version). FZPZ Studio code is compatible — it doesn't use React 19-specific APIs.

### New dependencies needed:
| Package | Purpose | Size | Already in ProtoPulse? |
|---------|---------|------|----------------------|
| `@google/genai` | Gemini AI SDK (newer version) | ~50KB | No — has `@google/generative-ai` (older). Migrate. |
| `jszip` | FZPZ export (create .fzpz zip files) | ~100KB | No. Needed for export feature. |
| `lucide-react` | Icons | — | Yes, already installed. |

### Dependencies to remove after migration:
| Package | Reason |
|---------|--------|
| `@google/generative-ai` | Replaced by `@google/genai` |

### Dependencies NOT needed (FZPZ Studio used them but ProtoPulse doesn't need):
- None — FZPZ Studio is remarkably lean (only react, react-dom, lucide-react, @google/genai)

---

## 9. Phased Execution Plan

### Phase 0: Prerequisites (do before integration)
- [ ] Complete backend audit checklist to a stable state (at least all P0/P1 items)
- [ ] Complete frontend audit items that affect integration points:
  - #11 (monolithic context — so Component Editor doesn't inherit the re-render problem)
  - #19 (hardcoded PROJECT_ID — so multi-project component storage works)
  - #72 (ErrorBoundary — so Component Editor crashes don't take down the app)

### Phase 1: Foundation (data model + skeleton)
**Goal:** Component Editor view exists, can be navigated to, shows empty state, backend stores parts.

- [ ] **1.1** Add `shared/component-types.ts` with all shared types (Shape, Connector, PartMeta, ViewData, etc.)
- [ ] **1.2** Add `component_parts` table to `shared/schema.ts` with Drizzle definition
- [ ] **1.3** Run `drizzle-kit push` to create the table
- [ ] **1.4** Add CRUD methods to `server/storage.ts` for component_parts (create, get, getByProject, update, delete)
- [ ] **1.5** Add API routes in `server/routes.ts` for component parts
- [ ] **1.6** Create `client/src/components/component-editor/ComponentEditorProvider.tsx` — reducer + context (adapted from FZPZ App.tsx reducer)
- [ ] **1.7** Create `client/src/components/component-editor/ComponentEditorView.tsx` — skeleton layout with internal tabs
- [ ] **1.8** Replace "Schematic" sidebar tab with "Component Editor" tab in Sidebar.tsx
- [ ] **1.9** Replace SchematicView rendering in ProjectWorkspace.tsx with ComponentEditorView
- [ ] **1.10** Wire up TanStack Query hooks to load/save component parts from backend

### Phase 2: Canvas + Drawing (the core editor)
**Goal:** User can draw shapes, place pins, edit properties on the SVG canvas.

- [ ] **2.1** Port `ComponentCanvas.tsx` — SVG canvas with pan/zoom, grid, shape rendering, selection, drag
- [ ] **2.2** Port `ComponentToolbar.tsx` — drawing tools (select, rect, circle, text, pin, measure), alignment buttons, undo/redo
- [ ] **2.3** Port `ComponentInspector.tsx` — shape properties panel, connector properties, pad specs
- [ ] **2.4** Port shape rendering logic (rect, circle, path, text, group SVG rendering)
- [ ] **2.5** Port selection/multi-select/group/ungroup logic
- [ ] **2.6** Port copy/paste logic
- [ ] **2.7** Adapt styling to match ProtoPulse theme (shadcn/ui components, design tokens)
- [ ] **2.8** Add auto-save: debounced PATCH to backend on state changes

### Phase 3: Metadata + Package Generator
**Goal:** User can edit part metadata and generate standard packages.

- [ ] **3.1** Port `ComponentMetadataPanel.tsx` — metadata form with all fields
- [ ] **3.2** Port `GeneratorModal.tsx` — parametric package generator (DIP, SOIC, QFP, QFN, Header, R, C)
- [ ] **3.3** Port `generators.ts` (client-side parametric generation — pure functions)
- [ ] **3.4** Port validation engine (`validatePart()`) and `ValidationModal.tsx`

### Phase 4: AI Features (server-side)
**Goal:** AI can generate, modify, and extract component data — all through the server.

- [ ] **4.1** Create `server/component-ai.ts` — server-side AI functions for component operations
- [ ] **4.2** Migrate Gemini SDK: replace `@google/generative-ai` with `@google/genai` across the project
- [ ] **4.3** Add API endpoints for AI operations (generate, modify, extract, suggest-description)
- [ ] **4.4** Port `ModifyModal.tsx` — AI modify dialog (connected to server endpoint)
- [ ] **4.5** Wire up datasheet upload + extraction (file upload → server → Gemini → response)
- [ ] **4.6** Wire up AI part generation from ChatPanel integration (user asks chat to create a part → action → Component Editor)

### Phase 5: Import/Export + Architecture Integration
**Goal:** FZPZ import/export works, components link to architecture nodes and feed BOM.

- [ ] **5.1** Move FZPZ export logic to `server/component-export.ts` (needs jszip)
- [ ] **5.2** Add import endpoint: upload .fzpz → parse → create component_part
- [ ] **5.3** Add export endpoint: component_part → generate .fzpz → download
- [ ] **5.4** Wire architecture node → component part linking (click node → open Component Editor for that part)
- [ ] **5.5** Add BOM enrichment: component metadata → BOM item auto-fill suggestions
- [ ] **5.6** Add component validation issues to the main Validation view

### Phase 6: Polish + Cleanup
**Goal:** Everything is polished, themed, and the old SchematicView code is fully removed.

- [ ] **6.1** Remove old `SchematicView.tsx` file and all references
- [ ] **6.2** Update sidebar icons and labels
- [ ] **6.3** Add keyboard shortcuts (Ctrl+Z/Y, Ctrl+K command palette, Delete, tool hotkeys)
- [ ] **6.4** Add loading states and empty states for all Component Editor sub-views
- [ ] **6.5** Add ErrorBoundary around Component Editor
- [ ] **6.6** Performance pass: memoize canvas rendering, virtualize connector lists if needed
- [ ] **6.7** Accessibility pass: ARIA labels on SVG elements, keyboard navigation for tools
- [ ] **6.8** Update replit.md with new architecture documentation
- [ ] **6.9** Update seed data to include a sample component part

---

## 10. Risk Assessment & Mitigations

### High risk:
| Risk | Impact | Mitigation |
|------|--------|------------|
| App.tsx (1,103 lines) is a monolith — decomposition could introduce bugs | Broken editor | Decompose incrementally: get reducer working first, then add UI components one by one. Test after each component. |
| React 19 → 18 downgrade could break subtle APIs | Build errors, runtime bugs | FZPZ code only uses standard hooks (useState, useReducer, useRef, useEffect, useMemo). No React 19 features detected. Low risk. |
| FZPZ Studio uses client-side Gemini directly; ProtoPulse routes through server | AI features stop working until server endpoints ready | Phase 4 is self-contained. AI features can be temporarily disabled with a "coming soon" indicator during Phases 1-3. |
| JSONB columns for shapes/connectors could make partial updates slow for very complex parts | Performance on large parts | JSONB update replaces entire document. For MVP this is fine. If needed later, can add incremental update via JSON path operations. |

### Medium risk:
| Risk | Impact | Mitigation |
|------|--------|------------|
| FZPZ auto-save uses localStorage; migration to server-save could cause data loss during transition | User loses work | Implement server-save first, keep localStorage as fallback/cache. Clear localStorage data once server persistence is confirmed. |
| Two SVG canvases (ArchitectureView's ReactFlow + ComponentEditor's custom SVG) could have conflicting global key listeners | Keyboard shortcuts fire in wrong view | Each canvas should only register listeners when its view is active. Use view-scoped event handlers. |
| Styling drift between FZPZ's zinc/indigo theme and ProtoPulse's neon cyan/purple | Visual inconsistency | Phase 2.7 specifically addresses this. Use ProtoPulse's existing Tailwind variables. |

### Low risk:
| Risk | Impact | Mitigation |
|------|--------|------------|
| jszip dependency adds bundle size | ~100KB gzipped | Only used for export; can be dynamically imported. |
| Validation naming collision (both apps have "ValidationIssue") | Type confusion | Rename FZPZ's to `ComponentValidationIssue` in shared types. |

---

## 11. Testing Strategy

### Manual smoke tests after each phase:
- Phase 1: Navigate to Component Editor tab → see empty state → create part via API → see it loaded
- Phase 2: Draw shapes → select → move → edit properties → undo/redo → switch views → verify persistence
- Phase 3: Open generator → select DIP-8 → generate → see shapes on canvas. Edit metadata → save → reload → verify
- Phase 4: Enter part description → AI generates → shapes appear. Upload datasheet → metadata extracted.
- Phase 5: Export .fzpz → import it into Fritzing (external). Import .fzpz → see part. Link to architecture node → BOM updates.

### Automated tests (post-integration):
- Unit tests for parametric generators (pure functions, easy to test)
- Unit tests for validation engine
- Integration tests for component CRUD API
- Integration tests for FZPZ export/import

---

## 12. Open Questions

These should be resolved before Phase 1 starts:

1. **Should the Component Editor support editing multiple parts simultaneously?**
   Current plan: one part at a time, selected from architecture or a parts list.

2. **Should parts be shareable across projects?**
   Current plan: parts belong to a project. A "component library" (cross-project) is a future feature.

3. **Should the AI chat in ProtoPulse be able to invoke component editor actions?**
   Current plan: Yes (Phase 4.6). The existing AI action system can be extended with component-specific actions.

4. **Should we keep the breadboard/schematic/pcb sub-views or simplify?**
   Current plan: Keep all three — they're the core value of FZPZ Studio and essential for Fritzing compatibility.

5. **What happens to the "Generate Schematic" button in ChatPanel?**
   It currently creates a fake canned response (#47 in frontend audit). After integration, it should trigger actual component generation in the Component Editor.

---

## 13. Execution Checklist

This is the master checklist. Update status as work progresses.

### Phase 0: Prerequisites
- [ ] Backend audit P0/P1 items resolved
- [ ] Frontend audit #11 (context splitting) resolved
- [ ] Frontend audit #19 (PROJECT_ID hardcoding) resolved
- [ ] Frontend audit #72 (ErrorBoundary) resolved

### Phase 1: Foundation
- [ ] 1.1 shared/component-types.ts
- [ ] 1.2 component_parts table in schema.ts
- [ ] 1.3 drizzle-kit push
- [ ] 1.4 Storage CRUD methods
- [ ] 1.5 API routes
- [ ] 1.6 ComponentEditorProvider.tsx
- [ ] 1.7 ComponentEditorView.tsx skeleton
- [ ] 1.8 Sidebar tab replacement
- [ ] 1.9 ProjectWorkspace routing
- [ ] 1.10 TanStack Query hooks

### Phase 2: Canvas + Drawing
- [ ] 2.1 ComponentCanvas.tsx
- [ ] 2.2 ComponentToolbar.tsx
- [ ] 2.3 ComponentInspector.tsx
- [ ] 2.4 Shape rendering
- [ ] 2.5 Selection logic
- [ ] 2.6 Copy/paste
- [ ] 2.7 Theme alignment
- [ ] 2.8 Auto-save to backend

### Phase 3: Metadata + Generator
- [ ] 3.1 ComponentMetadataPanel.tsx
- [ ] 3.2 GeneratorModal.tsx
- [ ] 3.3 generators.ts (parametric)
- [ ] 3.4 Validation engine + modal

### Phase 4: AI Features
- [ ] 4.1 server/component-ai.ts
- [ ] 4.2 Gemini SDK migration
- [ ] 4.3 AI API endpoints
- [ ] 4.4 ModifyModal.tsx
- [ ] 4.5 Datasheet upload + extraction
- [ ] 4.6 ChatPanel AI action integration

### Phase 5: Import/Export + Integration
- [ ] 5.1 FZPZ export (server-side)
- [ ] 5.2 FZPZ import endpoint
- [ ] 5.3 FZPZ export endpoint
- [ ] 5.4 Architecture node → component linking
- [ ] 5.5 BOM enrichment
- [ ] 5.6 Validation integration

### Phase 6: Polish
- [ ] 6.1 Remove old SchematicView.tsx
- [ ] 6.2 Update sidebar icons/labels
- [ ] 6.3 Keyboard shortcuts
- [ ] 6.4 Loading + empty states
- [ ] 6.5 ErrorBoundary
- [ ] 6.6 Performance pass
- [ ] 6.7 Accessibility pass
- [ ] 6.8 Update replit.md
- [ ] 6.9 Seed data with sample component
