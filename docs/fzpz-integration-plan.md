# FZPZ Studio → ProtoPulse Integration Plan

**Created:** 2026-02-17
**Status:** Draft — pending audit checklist completion
**Last updated:** 2026-02-17 (v2 — enhancements incorporated)

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
9. [Enhancement Roadmap](#9-enhancement-roadmap)
10. [Phased Execution Plan](#10-phased-execution-plan)
11. [Risk Assessment & Mitigations](#11-risk-assessment--mitigations)
12. [Testing Strategy](#12-testing-strategy)
13. [Open Questions](#13-open-questions)
14. [Execution Checklist](#14-execution-checklist)

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
FZPZ Studio becomes ProtoPulse's **Component Editor** — a dedicated workspace where users design individual electronic components at the part level, complementing ProtoPulse's system-level architecture editor. Beyond porting the existing tool, we'll enhance it into a **best-in-class component design environment** with smart alignment, real-time design rule checking, parametric constraints, and a searchable component library.

### User journey after integration:
1. User designs system architecture in the existing block diagram editor
2. User clicks on a component node (e.g., "ESP32 Module") → opens Component Editor
3. In the Component Editor, they can:
   - Design the part's physical layout (breadboard/schematic/PCB views) with smart snap guides and dimension tools
   - Manage pins and connectors via visual canvas or spreadsheet-style pin table
   - Edit part metadata (manufacturer, MPN, datasheet URL)
   - Use AI to generate or modify the part from description/datasheet/photo
   - Generate standard package footprints (DIP, SOIC, etc.) or start from templates
   - Validate the part with real-time DRC and completeness checks
   - Import SVG artwork or existing .fzpz files
   - Export as .fzpz for use in Fritzing
   - Browse and fork parts from the component library
4. Part data feeds back into BOM (metadata, MPN, manufacturer) and validation (part completeness + DRC)
5. Parametric constraints keep footprints dimensionally accurate as users make changes

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
  │   ├── Metadata tab
  │   └── Pin Table tab (NEW)
  ├── Procurement / BOM (existing)
  ├── Validation (existing — augmented with part validation + DRC)
  └── Output Log (existing)
```

### State management approach:
- FZPZ Studio uses `useReducer` with an undo/redo history wrapper — this is self-contained and well-architected
- Keep this pattern intact within the Component Editor view; **do NOT merge it into the monolithic ProjectProvider**
- The Component Editor gets its own context provider (`ComponentEditorProvider`) that wraps just the editor view
- Communicate with the parent project context via:
  - Reading: which component is being edited (selected node from architecture)
  - Writing: saving part data to backend, updating BOM metadata
- Enhancement: undo/redo history entries get human-readable labels for the history panel (e.g., "Added pin 14", "Moved body")

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
  constraints JSONB NOT NULL DEFAULT '[]',-- Constraint[] array (parametric constraints — Phase 8)
  version INTEGER NOT NULL DEFAULT 1,     -- incremented on each save, for conflict detection
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
- Forward-compatible: adding new fields (layer, constraints) requires no migrations — just wider JSONB

### 4.2 Future table: `component_library` (Phase 9)

```sql
-- Planned for Phase 9 — do not create during initial integration
CREATE TABLE component_library (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  connectors JSONB NOT NULL DEFAULT '[]',
  buses JSONB NOT NULL DEFAULT '[]',
  views JSONB NOT NULL DEFAULT '{}',
  constraints JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] NOT NULL DEFAULT '{}',       -- searchable tags
  category TEXT,                           -- family/category for browsing
  is_public BOOLEAN NOT NULL DEFAULT false,
  author_id TEXT,                          -- who created it
  forked_from INTEGER REFERENCES component_library(id),
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_component_library_tags ON component_library USING GIN(tags);
CREATE INDEX idx_component_library_category ON component_library(category);
CREATE INDEX idx_component_library_public ON component_library(is_public);
```

### 4.3 Schema changes in `shared/schema.ts`

```typescript
export const componentParts = pgTable("component_parts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  nodeId: text("node_id"),
  meta: jsonb("meta").notNull().default({}),
  connectors: jsonb("connectors").notNull().default([]),
  buses: jsonb("buses").notNull().default([]),
  views: jsonb("views").notNull().default({}),
  constraints: jsonb("constraints").notNull().default([]),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_component_parts_project").on(table.projectId),
  index("idx_component_parts_node").on(table.nodeId),
]);
```

### 4.4 Type definitions — forward-compatible for all enhancements

The FZPZ Studio types (`types.ts`) need to be extended and split:

**Shared types** (`shared/component-types.ts`) — used by both client and server:

```typescript
// --- Layer System (Phase 7) ---
type StandardLayerName = 'copper-front' | 'copper-back' | 'silkscreen-front' | 'silkscreen-back'
  | 'courtyard' | 'fab' | 'paste-front' | 'paste-back'
  | 'body' | 'pins' | 'labels' | 'artwork'    // breadboard layers
  | 'symbols' | 'values';                       // schematic layers
type LayerName = StandardLayerName | (string & {});  // extensible: known layers + any custom string

interface LayerConfig {
  visible: boolean;
  locked: boolean;
  color: string;
  opacity: number;
}

// --- Shape types (extended) ---
// All shapes get an optional `layer` field (defaults to primary layer for the view)
interface BaseShape {
  id: string;
  x: number;
  y: number;
  opacity?: number;
  rotation?: number;
  name?: string;
  layer?: LayerName;                             // NEW: layer assignment
}
// ... (rect, circle, path, text, group extending BaseShape — same as FZPZ types.ts)

// --- Parametric Constraints (Phase 8) ---
type ConstraintType = 'distance' | 'alignment' | 'pitch' | 'symmetric' | 'equal' | 'fixed';
interface Constraint {
  id: string;
  type: ConstraintType;
  shapeIds: string[];                           // shapes/connectors this constraint applies to
  params: Record<string, number | string>;      // e.g., { distance: 254, axis: 'x' } (mils)
  enabled: boolean;
}

// --- ViewData (extended) ---
interface ViewData {
  shapes: Shape[];
  enabled: boolean;
  layerConfig?: Record<LayerName, LayerConfig>;  // NEW: per-view layer visibility/config
}

// --- PartState (extended) ---
interface PartState {
  meta: PartMeta;
  connectors: Connector[];
  buses: Bus[];
  views: Record<ViewType, ViewData>;
  constraints?: Constraint[];                    // NEW: parametric constraints
}

// --- DRC Rules (Phase 8) ---
type DRCRuleType = 'min-clearance' | 'min-trace-width' | 'courtyard-overlap'
  | 'pin-spacing' | 'pad-size' | 'silk-overlap';
interface DRCRule {
  type: DRCRuleType;
  params: Record<string, number>;               // e.g., { minClearance: 8 } (mils)
  severity: 'error' | 'warning';
  enabled: boolean;
}
interface DRCViolation {
  ruleType: DRCRuleType;
  severity: 'error' | 'warning';
  message: string;
  shapeIds: string[];                           // affected shapes
  view: ViewType;
  location: { x: number; y: number };          // center of violation area
}

// --- Renamed to avoid collision with ProtoPulse's existing ValidationIssue ---
interface ComponentValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  view?: ViewType;
  elementId?: string;
  category: 'metadata' | 'connector' | 'shape' | 'drc' | 'completeness';
}
```

**Client-only types** (`client/src/lib/component-editor/types.ts`) — UI state:

```typescript
// --- Extended Reference Image (Phase 5 enhancement) ---
interface CalibratedReferenceImage {
  url: string;
  opacity: number;
  scaleX: number;                               // NEW: calibrated scale
  scaleY: number;
  offsetX: number;                              // NEW: fine-tune position
  offsetY: number;
  locked: boolean;                              // NEW: prevent accidental moves
  realWorldWidth?: number;                      // mm — for auto-scale calculation
  realWorldHeight?: number;
}

// --- Named History Entry (Phase 7) ---
interface HistoryEntry {
  state: AppState;
  label: string;                                // human-readable: "Added pin 14", "Moved body"
  timestamp: number;
}
type HistoryState = {
  past: HistoryEntry[];
  present: AppState;
  future: HistoryEntry[];
};

// --- AI Diff/Merge (Phase 4 enhancement) ---
interface ShapeDiff {
  type: 'added' | 'removed' | 'modified';
  shapeId: string;
  view: ViewType;
  before?: Shape;                               // null for 'added'
  after?: Shape;                                // null for 'removed'
}
interface ConnectorDiff {
  type: 'added' | 'removed' | 'modified';
  connectorId: string;
  before?: Connector;
  after?: Connector;
}
interface PartDiff {
  shapes: ShapeDiff[];
  connectors: ConnectorDiff[];
  metaChanges: Record<string, { before: any; after: any }>;
}
```

### 4.5 API endpoints (complete list including enhancements)

```
-- Core CRUD (Phase 1) --
GET    /api/projects/:id/components          — list all component parts for a project
GET    /api/components/:id                   — get a single component part
POST   /api/projects/:id/components          — create a new component part
PATCH  /api/components/:id                   — update a component part (debounced auto-save)
DELETE /api/components/:id?projectId=X       — delete a component part (with ownership check)

-- Import/Export (Phase 5) --
POST   /api/components/:id/export-fzpz       — generate and download .fzpz file
POST   /api/components/import-fzpz           — upload .fzpz and create component part
POST   /api/components/import-svg            — upload SVG, parse into shapes (NEW)

-- AI Operations (Phase 4) --
POST   /api/components/:id/ai/generate       — AI generate part from description/image
POST   /api/components/:id/ai/modify         — AI modify existing part (returns diff)
POST   /api/components/:id/ai/extract        — AI extract metadata from datasheet
POST   /api/components/:id/ai/suggest        — AI suggest description text
POST   /api/components/:id/ai/extract-pins   — AI extract pins from photo (NEW)

-- DRC (Phase 8) --
POST   /api/components/:id/drc               — run full DRC check server-side (heavy computation)

-- Component Library (Phase 9) --
GET    /api/library                           — search/browse public components
GET    /api/library/:id                       — get a library component
POST   /api/library                           — publish a component to the library
POST   /api/library/:id/fork                  — fork a library component into a project
```

---

## 5. File-by-File Integration Map

### Source files → Target locations

| FZPZ Studio File | → ProtoPulse Target | Notes |
|-------------------|---------------------|-------|
| `types.ts` (165 lines) | `shared/component-types.ts` (shared data types, extended) + `client/src/lib/component-editor/types.ts` (UI-only types, extended) | Split into shared (Shape, Connector, PartMeta, ViewData, Constraint, DRCRule) and client-only (UIState, SelectionRef, AppState, HistoryEntry, PartDiff) |
| `utils.ts` (705 lines) | `client/src/lib/component-editor/utils.ts` (client-side math/validation) + `client/src/lib/component-editor/drc.ts` (DRC engine — NEW) + `server/component-export.ts` (FZPZ/SVG import/export — server-side) + `server/component-ai.ts` (AI calls — server-side) | Split by concern: geometry/alignment/validation → client; DRC → separate client module; FZPZ/SVG file I/O → server; AI calls → server |
| `generators.ts` (642 lines) | `client/src/lib/component-editor/generators.ts` (parametric generators — pure functions, no AI) + `server/component-ai.ts` (AI generation — server-side) | Parametric generation (DIP/SOIC/etc.) is pure math, stays client-side. AI generation moves server-side. |
| `App.tsx` (1,103 lines) | Decomposed into ~12 files under `client/src/components/component-editor/`: | **Critical: Do NOT create another 1,100-line monolith** |

### App.tsx decomposition target (updated with enhancements):

```
client/src/components/component-editor/
├── ComponentEditorProvider.tsx    — useReducer + named history + context provider (~180 lines)
├── ComponentEditorView.tsx        — main layout: toolbar + canvas + inspector + pin table (~150 lines)
├── ComponentCanvas.tsx            — SVG canvas with pan/zoom/draw/select/snap guides (~300 lines)
├── ComponentToolbar.tsx           — tool buttons, view tabs, undo/redo, alignment, ruler toggle (~120 lines)
├── ComponentInspector.tsx         — right panel: shape props, connector props, pad specs, multi-select (~220 lines)
├── ComponentMetadataPanel.tsx     — metadata form (title, family, MPN, etc.) (~150 lines)
├── PinTableEditor.tsx             — spreadsheet-style pin/connector editing table (NEW ~180 lines)
├── LayerPanel.tsx                 — layer visibility/lock toggles per view (NEW ~80 lines)
├── HistoryPanel.tsx               — named undo history with jump-to (NEW ~60 lines)
├── GeneratorModal.tsx             — package generator + shape templates dialog (~140 lines)
├── ModifyModal.tsx                — AI modify dialog with diff preview (enhanced ~120 lines)
├── DiffPreview.tsx                — visual diff/merge UI for AI modifications (NEW ~150 lines)
├── DRCPanel.tsx                   — DRC violations list with click-to-highlight (NEW ~100 lines)
├── ValidationModal.tsx            — validation results dialog (~40 lines)
├── SnapGuides.tsx                 — smart alignment guide lines SVG overlay (NEW ~80 lines)
├── RulerOverlay.tsx               — dimension measurement tool SVG overlay (NEW ~100 lines)
└── shared-components.tsx          — PanelHeader, InputGroup, DebouncedInput, etc. (~80 lines)
```

### New utility modules for enhancements:

```
client/src/lib/component-editor/
├── types.ts                       — client-only types (UIState, HistoryEntry, PartDiff, etc.)
├── utils.ts                       — math, coordinates, UUID, alignment, basic validation
├── generators.ts                  — parametric package generators (pure functions)
├── drc.ts                         — Design Rule Check engine (NEW ~250 lines)
├── constraint-solver.ts           — parametric constraint solver (NEW ~200 lines)
├── snap-engine.ts                 — smart snap/alignment guide calculation (NEW ~100 lines)
├── diff-engine.ts                 — PartState diff/merge computation (NEW ~120 lines)
├── svg-parser.ts                  — SVG file → internal Shape[] parser (NEW ~150 lines)
└── hooks.ts                       — useComponentQuery, useComponentMutation, useAutoSave, etc. (~80 lines)

server/
├── component-ai.ts                — AI generation, modification, extraction, pin recognition (~300 lines)
├── component-export.ts            — FZPZ export/import, SVG import (~250 lines)
└── component-library.ts           — component library CRUD + search (Phase 9 ~150 lines)
```

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
All AI calls go through the server. No client-side API key usage. Enhanced with diff/merge and photo pin extraction.

### Migration plan:

1. **Move FZPZ AI functions to server:**
   - `generatePartWithAI()` → `POST /api/components/:id/ai/generate`
   - `modifyPartWithAI()` → `POST /api/components/:id/ai/modify` (enhanced: returns diff, not just new state)
   - `extractMetadataFromDatasheet()` → `POST /api/components/:id/ai/extract`
   - `suggestDescription()` → `POST /api/components/:id/ai/suggest`

2. **New AI capabilities (enhancements):**
   - **AI diff/merge for modifications:** When AI modifies a part, the server returns both the new state AND a computed diff. The client renders `DiffPreview.tsx` showing added (green), removed (red), and modified (yellow) elements. User can accept/reject individual changes.
   - **AI pin extraction from photos:** `POST /api/components/:id/ai/extract-pins` — upload a photo of a physical chip, AI identifies pin locations and markings, returns Connector[] with names and positions. Uses Gemini's vision model with a specialized prompt.

3. **Use ProtoPulse's existing AI key infrastructure:**
   - FZPZ Studio currently passes API key per-request from client — this maps directly to ProtoPulse's existing pattern (ChatPanel sends keys via request body)
   - Eventually both should move to server-side key storage (audit item #61/#backend-61)

4. **Reuse vs. separate AI module:**
   - FZPZ AI prompts are highly specialized (SVG generation, FZP XML format, Fritzing conventions) — very different from ProtoPulse's general-purpose chat AI
   - **Decision: Create a separate `server/component-ai.ts`** with its own prompts and handlers
   - Share the Gemini client instantiation pattern from `server/ai.ts` (or better, create a shared `getGeminiClient(apiKey)` helper)
   - The Anthropic integration stays for chat; Gemini handles component AI (since the prompts are already tuned for Gemini)

5. **Gemini SDK migration:**
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
  Architecture        → existing
  Component Editor    → NEW (replaces Schematic)
  BOM / Procurement   → existing
  Validation          → existing (augmented with DRC)
  Output              → existing
```

### 7.2 View switching within Component Editor

The Component Editor has its own internal view tabs (breadboard/schematic/pcb/metadata/pin-table), managed by its own state — **not** by the parent ProjectProvider's `activeView`.

```
ProjectWorkspace
├── Sidebar (tab = "component-editor" selected)
└── Main content area
    └── ComponentEditorView
        ├── Top bar
        │   ├── Internal tabs: [Breadboard] [Schematic] [PCB] [Metadata] [Pin Table]
        │   ├── Layer panel toggle (NEW)
        │   └── History panel toggle (NEW)
        ├── Toolbar (tools, alignment, ruler toggle, undo/redo, zoom-to-fit)
        ├── Canvas (SVG)
        │   ├── Grid overlay
        │   ├── Snap guide overlay (NEW)
        │   ├── Ruler/dimension overlay (NEW)
        │   ├── DRC violation overlay (NEW)
        │   └── Reference image overlay (enhanced with calibration)
        ├── Inspector (right panel)
        │   ├── Shape properties (supports multi-select bulk edit)
        │   ├── Connector properties
        │   ├── Pad specs
        │   └── Constraint editor (NEW — Phase 8)
        └── Bottom panels (collapsible)
            ├── DRC violations list (NEW)
            └── Validation issues list
```

### 7.3 Smart snap alignment guides (Quick Win)

When dragging shapes or connectors, the canvas renders dynamic alignment guide lines:
- **Edge alignment:** dashed cyan lines appear when a shape edge aligns with another shape's edge
- **Center alignment:** dashed lines appear when centers align horizontally or vertically
- **Spacing guides:** when three+ shapes are involved, show equal-spacing indicators
- **Pin pitch guides:** when placing connectors, show pitch-distance indicators from the nearest existing connector
- Implementation: `SnapGuides.tsx` renders SVG `<line>` elements; `snap-engine.ts` computes snap targets from all shapes in the current view

### 7.4 Connector numbering preview (Quick Win)

When the pin tool is active:
- A ghost connector with its auto-generated name appears at the cursor position
- The ghost snaps to grid and shows the pin number that will be assigned
- If near an existing shape edge, highlight the edge to suggest terminal placement
- Implementation: state tracked in ComponentCanvas; name generated by `generateNextPinName()` from utils

### 7.5 Zoom-to-fit (Quick Win)

- Button in the toolbar (and keyboard shortcut `Ctrl+0` or `Home`)
- Calculates bounding box of all shapes + connectors in the current view
- Animates pan/zoom to fit all content with padding
- Implementation: uses `calculateBoundingBox()` from utils, sets pan/zoom via `SET_PAN_ZOOM` action

### 7.6 Shape templates/presets (Quick Win)

- Dropdown menu in the toolbar or generator modal with common shapes:
  - IC body outline (configurable pin count)
  - Standard header (1xN, 2xN)
  - Common passive bodies (0402, 0603, 0805, 1206)
  - Mounting holes
  - Test points
- Each template is a `GeneratedContent` (shapes + connectors) applied via `APPLY_GENERATOR` action
- Implementation: extend `generators.ts` with template presets; add template picker to GeneratorModal

### 7.7 Better validation feedback (Quick Win)

- Clicking a validation issue in the list:
  1. Switches to the relevant view (breadboard/schematic/pcb)
  2. Pans/zooms to center the offending element
  3. Highlights the element with a pulsing red outline
  4. Selects the element so the inspector shows its properties
- DRC violations (Phase 8) show as red/amber overlays directly on the canvas in real-time
- Implementation: validation issues carry `view` and `elementId` fields; click handler dispatches `SET_VIEW` + `SET_PAN_ZOOM` + `SET_SELECTION`

### 7.8 Multi-select property editing (Medium)

When multiple shapes are selected in the inspector:
- Show a unified property panel with fields that are common to all selected shapes
- Fields with mixed values show a "mixed" placeholder
- Changing a field applies to all selected shapes at once
- Example: select 5 pads → change all pad widths from 2mm to 1.5mm in one edit
- Implementation: `ComponentInspector.tsx` detects multi-selection, renders aggregate fields, dispatches batch `UPDATE_SHAPE` actions

### 7.9 Ruler/dimension tool (Medium)

- New tool in the toolbar (shortcut: `M` for measure)
- Click two points → shows a dimension line with distance in mils/mm
- Persistent dimensions stay on-screen until dismissed
- Live measurement: while hovering, shows distance from last click point
- Pin pitch verification: automatically labels pitch distance between adjacent connectors
- Implementation: `RulerOverlay.tsx` renders SVG dimension annotations; tool state in reducer

### 7.10 Pin table editor (Medium)

- New internal tab "Pin Table" alongside breadboard/schematic/pcb/metadata
- Spreadsheet-style table with columns: Name | Type | Pad Shape | Pad Width | Pad Height | Hole Diameter | Breadboard X/Y | Schematic X/Y | PCB X/Y
- Sortable by any column
- Inline editing: click a cell to edit
- Bulk operations: select rows → delete / change type / change pad shape
- Import from CSV: paste or upload a CSV of pin names/types
- Implementation: `PinTableEditor.tsx` using standard table with sort state; dispatches `UPDATE_CONNECTOR` actions

### 7.11 Connecting architecture nodes to component parts

When a user has an architecture node selected (e.g., "ESP32-S3 Module") and switches to the Component Editor tab:
- If a `component_part` exists for that node (linked by `nodeId`) → load it
- If no part exists → show a "Create Component Part" prompt with options:
  - Start from scratch (blank canvas)
  - Generate from AI (describe the part)
  - Import from .fzpz file
  - Choose a standard package template
  - Browse the component library (Phase 9)

### 7.12 BOM enrichment

When a component part has metadata (manufacturer, MPN, datasheet URL), this data can auto-populate BOM entries:
- On save, if the part's `nodeId` matches a BOM item's source node, offer to update BOM fields
- Fields that can flow: manufacturer, part number, description, package type, mounting type
- This is a **one-way suggestion** — user confirms before BOM is updated

### 7.13 Validation integration

The Component Editor has its own validation engine (`validatePart()` in utils.ts). This should feed into ProtoPulse's existing validation view:
- Component-level validation issues get a new category in the validation list
- DRC violations (Phase 8) also appear as a category
- Clicking a component validation issue navigates to the Component Editor with the relevant view/element highlighted
- The existing validation "Auto-Fix" behavior (#57 in frontend audit) should be reconsidered here

### 7.14 Styling alignment

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
| `jszip` | FZPZ export (create .fzpz zip files) | ~100KB | No. Needed for export feature. Dynamic import. |
| `lucide-react` | Icons | — | Yes, already installed. |
| `svg-parser` | SVG import: parse SVG XML into shape model | ~15KB | No. Needed for SVG import. Consider `@xmldom/xmldom` for server-side. |

### Dependencies to remove after migration:
| Package | Reason |
|---------|--------|
| `@google/generative-ai` | Replaced by `@google/genai` |

### Dependencies NOT needed (FZPZ Studio used them but ProtoPulse doesn't need):
- None — FZPZ Studio is remarkably lean (only react, react-dom, lucide-react, @google/genai)

---

## 9. Enhancement Roadmap

All enhancements, organized by effort level and mapped to their execution phase.

### 9.1 Quick Wins — woven into core phases

| # | Enhancement | Phase | Why it matters | Where in code | Risk |
|---|-------------|-------|---------------|---------------|------|
| QW-1 | **Snap alignment guides** | 2 | Precise shape placement without thinking; visual feedback like Figma/Canva | `SnapGuides.tsx` + `snap-engine.ts` | Low — isolated SVG overlay |
| QW-2 | **Connector numbering preview** | 2 | Eliminates guesswork when placing pins; shows what will be created | `ComponentCanvas.tsx` mouse handler | Low — stateless UI feedback |
| QW-3 | **Zoom-to-fit button** | 2 | One-click framing of all content; essential for navigation | `ComponentToolbar.tsx` + `calculateBoundingBox()` | Very low — pure math |
| QW-4 | **Shape templates/presets** | 3 | Quick-add common shapes without manual drawing; saves massive time | Extend `generators.ts` + `GeneratorModal.tsx` | Low — extends existing pattern |
| QW-5 | **Better validation click-to-highlight** | 5 | Makes validation actionable; currently just a dump list | `ValidationModal.tsx` + view/pan/zoom dispatch | Low — navigation logic only |

### 9.2 Medium Enhancements — Phases 2-7

| # | Enhancement | Phase | Why it matters | Where in code | Risk | Complexity |
|---|-------------|-------|---------------|---------------|------|------------|
| ME-1 | **Multi-select property editing** | 2 | Bulk editing saves massive time on parts with many similar elements | `ComponentInspector.tsx` | Low — aggregate UI pattern | ~200 lines |
| ME-2 | **Ruler/dimension tool** | 2 | Critical for verifying real-world footprint dimensions match spec | `RulerOverlay.tsx` + reducer tool state | Low — isolated SVG overlay | ~150 lines |
| ME-3 | **Pin table editor** | 3 | Spreadsheet view for 40+ pin parts is dramatically faster than clicking each | `PinTableEditor.tsx` | Low — data already exists | ~200 lines |
| ME-4 | **SVG import** | 5 | Let users drop in manufacturer SVG artwork as starting point | `svg-parser.ts` + import endpoint | Medium — SVG spec is complex | ~200 lines |
| ME-5 | **Footprint verification overlay** | 5 | Calibrated real-world photo overlay verifies footprint correctness | Extend `CalibratedReferenceImage` | Low — extends existing feature | ~100 lines |
| ME-6 | **Layer system** | 7 | Separates silkscreen/copper/courtyard concerns; essential for PCB realism | `LayerPanel.tsx` + Shape.layer field + ViewData.layerConfig | Medium — affects rendering pipeline | ~250 lines |
| ME-7 | **Path drawing tool upgrade** | 7 | Proper Bezier curves with control handles; required for realistic artwork | `ComponentCanvas.tsx` path tool extension | Medium — complex interaction model | ~300 lines |
| ME-8 | **Named undo history panel** | 7 | Jump to any point in history by name; much more usable than blind undo | `HistoryPanel.tsx` + `HistoryEntry` type | Low — extends existing reducer pattern | ~100 lines |

### 9.3 Big Swing Innovations — Phases 8-9

| # | Enhancement | Phase | Why it matters | Where in code | Risk | Complexity |
|---|-------------|-------|---------------|---------------|------|------------|
| BS-1 | **Real-time DRC** | 8 | Catches clearance/spacing violations as you draw; prevents physical manufacturing errors | `drc.ts` engine + `DRCPanel.tsx` + canvas overlay | Medium — must be performant | ~400 lines |
| BS-2 | **Parametric constraints** | 8 | "Pin pitch = 2.54mm" auto-updates everything when you resize; prevents drift | `constraint-solver.ts` + inspector UI | High — constraint solving is algorithmically complex | ~350 lines |
| BS-3 | **Component library with search** | 9 | Browse/fork pre-made parts instead of building from scratch; community value | `component_library` table + API + browse UI | Medium — needs curation/moderation strategy | ~500 lines |
| BS-4 | **Multi-part project support** | 9 | Design related components together (IC + breakout, connector pairs) | Already supported by data model (multiple rows per project) | Low — data model supports it | ~100 lines UI |
| BS-5 | **AI diff/merge for modifications** | 4 | Accept/reject individual AI changes instead of all-or-nothing; builds trust | `diff-engine.ts` + `DiffPreview.tsx` | Low — pure computation + UI | ~300 lines |
| BS-6 | **AI pin extraction from photos** | 4 | Photo of a chip → auto-populated pinout; goes beyond datasheets | `server/component-ai.ts` new prompt | Low — Gemini vision already supports this | ~100 lines |
| BS-7 | **Footprint photo verification** | 5 | Upload PCB photo, calibrate overlay, visually verify footprint matches reality | Extend reference image system | Low — builds on existing feature | ~150 lines |

---

## 10. Phased Execution Plan

### Phase 0: Prerequisites (do before integration)
- [ ] Complete backend audit checklist to a stable state (at least all P0/P1 items)
- [ ] Complete frontend audit items that affect integration points:
  - #11 (monolithic context — so Component Editor doesn't inherit the re-render problem)
  - #19 (hardcoded PROJECT_ID — so multi-project component storage works)
  - #72 (ErrorBoundary — so Component Editor crashes don't take down the app)

---

### Phase 1: Foundation (data model + skeleton)
**Goal:** Component Editor view exists, can be navigated to, shows empty state, backend stores parts.

- [ ] **1.1** Add `shared/component-types.ts` with all shared types — include forward-compatible fields: `layer` on Shape, `constraints` on PartState, `layerConfig` on ViewData, `DRCRule`, `DRCViolation`, `ComponentValidationIssue`, `Constraint`
- [ ] **1.2** Add `client/src/lib/component-editor/types.ts` with UI-only types — include `HistoryEntry`, `CalibratedReferenceImage`, `PartDiff`, `ShapeDiff`, `ConnectorDiff`
- [ ] **1.3** Add `component_parts` table to `shared/schema.ts` with Drizzle definition (including `constraints` JSONB and `version` integer)
- [ ] **1.4** Run `drizzle-kit push` to create the table
- [ ] **1.5** Add CRUD methods to `server/storage.ts` for component_parts (create, get, getByProject, update, delete)
- [ ] **1.6** Add API routes in `server/routes.ts` for component parts (full CRUD)
- [ ] **1.7** Create `client/src/components/component-editor/ComponentEditorProvider.tsx` — reducer + named history context (adapted from FZPZ App.tsx reducer; use `HistoryEntry` with labels from the start)
- [ ] **1.8** Create `client/src/components/component-editor/ComponentEditorView.tsx` — skeleton layout with internal tabs (breadboard/schematic/pcb/metadata/pin-table)
- [ ] **1.9** Replace "Schematic" sidebar tab with "Component Editor" tab in Sidebar.tsx
- [ ] **1.10** Replace SchematicView rendering in ProjectWorkspace.tsx with ComponentEditorView
- [ ] **1.11** Wire up TanStack Query hooks in `client/src/lib/component-editor/hooks.ts` to load/save component parts from backend

---

### Phase 2: Canvas + Drawing + Quick Wins (the core editor)
**Goal:** User can draw shapes, place pins, edit properties on the SVG canvas — with smart snap guides, zoom-to-fit, multi-select editing, and ruler tool.

- [ ] **2.1** Port `ComponentCanvas.tsx` — SVG canvas with pan/zoom, grid, shape rendering, selection, drag
- [ ] **2.2** Port `ComponentToolbar.tsx` — drawing tools (select, rect, circle, text, pin, measure), alignment buttons, undo/redo, zoom-to-fit button
- [ ] **2.3** Port `ComponentInspector.tsx` — shape properties panel, connector properties, pad specs
- [ ] **2.4** Port shape rendering logic (rect, circle, path, text, group SVG rendering)
- [ ] **2.5** Port selection/multi-select/group/ungroup logic
- [ ] **2.6** Port copy/paste logic
- [ ] **2.7** Adapt styling to match ProtoPulse theme (shadcn/ui components, design tokens)
- [ ] **2.8** Add auto-save: debounced PATCH to backend on state changes
- [ ] **2.9** [QW-1] Create `snap-engine.ts` — compute snap targets from all shapes/connectors in the current view
- [ ] **2.10** [QW-1] Create `SnapGuides.tsx` — render dynamic alignment guide lines as SVG overlay (edge, center, spacing)
- [ ] **2.11** [QW-2] Add connector numbering preview — ghost pin with auto-generated name at cursor when pin tool is active
- [ ] **2.12** [QW-3] Add zoom-to-fit — toolbar button + `Ctrl+0`/`Home` shortcut; animate pan/zoom to fit all content
- [ ] **2.13** [ME-1] Enhance `ComponentInspector.tsx` with multi-select property editing — unified panel for common fields, batch updates
- [ ] **2.14** [ME-2] Create `RulerOverlay.tsx` — dimension measurement tool with click-two-points distance display and pin pitch labels

---

### Phase 3: Metadata + Package Generator + Pin Table
**Goal:** User can edit part metadata, generate standard packages, use shape templates, and manage pins in a spreadsheet view.

- [ ] **3.1** Port `ComponentMetadataPanel.tsx` — metadata form with all fields
- [ ] **3.2** Port `GeneratorModal.tsx` — parametric package generator (DIP, SOIC, QFP, QFN, Header, R, C)
- [ ] **3.3** Port `generators.ts` (client-side parametric generation — pure functions)
- [ ] **3.4** Port validation engine (`validatePart()`) and `ValidationModal.tsx`
- [ ] **3.5** [QW-4] Add shape templates/presets to GeneratorModal — quick-add IC body, header, passive body, mounting hole, test point
- [ ] **3.6** [ME-3] Create `PinTableEditor.tsx` — spreadsheet-style connector editing with sortable columns, inline edit, bulk operations, CSV import

---

### Phase 4: AI Features + Diff/Merge + Photo Extraction (server-side)
**Goal:** AI can generate, modify, and extract component data — all through the server — with visual diff/merge for modifications and photo-based pin extraction.

- [ ] **4.1** Create `server/component-ai.ts` — server-side AI functions for component operations
- [ ] **4.2** Migrate Gemini SDK: replace `@google/generative-ai` with `@google/genai` across the project
- [ ] **4.3** Add API endpoints for AI operations (generate, modify, extract, suggest-description, extract-pins)
- [ ] **4.4** Port `ModifyModal.tsx` — AI modify dialog (connected to server endpoint)
- [ ] **4.5** Wire up datasheet upload + extraction (file upload → server → Gemini → response)
- [ ] **4.6** Wire up AI part generation from ChatPanel integration (user asks chat to create a part → action → Component Editor)
- [ ] **4.7** [BS-5] Create `diff-engine.ts` — compute PartDiff between before/after states (shape-level, connector-level, meta-level diffs)
- [ ] **4.8** [BS-5] Create `DiffPreview.tsx` — visual diff/merge UI; green=added, red=removed, yellow=modified; checkboxes to accept/reject individual changes
- [ ] **4.9** [BS-5] Integrate diff/merge into ModifyModal — AI modify response shows diff first, user selects which changes to apply
- [ ] **4.10** [BS-6] Add AI pin extraction from photos — `POST /api/components/:id/ai/extract-pins`; Gemini vision prompt identifies pin locations + markings from chip photo; returns Connector[] with names and positions

---

### Phase 5: Import/Export + Architecture Integration + Verification Overlay
**Goal:** FZPZ/SVG import/export works, components link to architecture nodes and feed BOM, footprint verification overlay.

- [ ] **5.1** Move FZPZ export logic to `server/component-export.ts` (needs jszip)
- [ ] **5.2** Add import endpoint: upload .fzpz → parse → create component_part
- [ ] **5.3** Add export endpoint: component_part → generate .fzpz → download
- [ ] **5.4** [ME-4] Create `svg-parser.ts` — parse external SVG file into internal Shape[] model; handle `<rect>`, `<circle>`, `<path>`, `<text>`, `<g>` (groups)
- [ ] **5.5** [ME-4] Add SVG import endpoint + UI: upload SVG → server parses → returns shapes → merge into current view
- [ ] **5.6** [ME-5/BS-7] Enhance reference image system with calibrated overlay — `CalibratedReferenceImage` with scale/offset/lock; ruler-based calibration UI ("click two points, enter real distance")
- [ ] **5.7** [QW-5] Add click-to-highlight for validation issues — clicking issue switches view, pans to element, highlights with pulsing outline, selects element
- [ ] **5.8** Wire architecture node → component part linking (click node → open Component Editor for that part)
- [ ] **5.9** Add BOM enrichment: component metadata → BOM item auto-fill suggestions
- [ ] **5.10** Add component validation issues to the main Validation view

---

### Phase 6: Polish + Cleanup
**Goal:** Everything is polished, themed, and the old SchematicView code is fully removed.

- [ ] **6.1** Remove old `SchematicView.tsx` file and all references
- [ ] **6.2** Update sidebar icons and labels
- [ ] **6.3** Add keyboard shortcuts (Ctrl+Z/Y, Ctrl+K command palette, Delete, tool hotkeys R/C/T/P/M/S, Ctrl+0 zoom-to-fit)
- [ ] **6.4** Add loading states and empty states for all Component Editor sub-views
- [ ] **6.5** Add ErrorBoundary around Component Editor
- [ ] **6.6** Performance pass: memoize canvas rendering, virtualize connector lists and pin table if needed
- [ ] **6.7** Accessibility pass: ARIA labels on SVG elements, keyboard navigation for tools
- [ ] **6.8** Update replit.md with new architecture documentation
- [ ] **6.9** Update seed data to include a sample component part

---

### Phase 7: Advanced Canvas Features (Medium enhancements)
**Goal:** Layer system, enhanced path drawing, and named undo history make the editor feel professional.

**Dependency note:** Phases 2-6 assume a flat shape list with no layer filtering. When the layer system is added here, all shapes from earlier phases default to the primary layer for their view. Rendering code from Phase 2 must treat `shape.layer === undefined` as "belongs to default layer." DRC overlays referenced in Phase 2's canvas are **not** DRC — they are snap/ruler overlays only. Actual DRC overlays are gated until Phase 8.

- [ ] **7.1** [ME-6] Implement layer system:
  - Add `LayerPanel.tsx` — per-view layer visibility/lock toggles
  - Update shape rendering to filter by visible layers
  - Update shape creation to assign to active layer
  - Default layer configs per view type (PCB: copper-front/back, silkscreen, courtyard, fab; breadboard: body, pins, labels; schematic: symbols, pins, labels)
- [ ] **7.2** [ME-7] Upgrade path drawing tool:
  - Add Bezier curve editing with control handle dragging
  - Support smooth/corner node types
  - Allow editing existing path nodes (click path → show nodes → drag to reshape)
  - Add path simplification (reduce node count while preserving shape)
- [ ] **7.3** [ME-8] Create `HistoryPanel.tsx`:
  - List of named history entries with timestamps
  - Click any entry to jump to that state (replaces current undo/redo stepping)
  - Visual indicator of current position in history
  - History entries auto-labeled from action types: "Added shape", "Moved 3 shapes", "Changed pin 14 name", etc.

---

### Phase 8: Intelligence & Automation (Big Swing innovations)
**Goal:** Real-time DRC and parametric constraints turn the editor from a drawing tool into an engineering tool.

**Dependency note:** DRC accuracy improves with the layer system (Phase 7) since clearance checks should only apply within the same copper layer. If Phase 8 is started before Phase 7, DRC treats all shapes as on the same layer (conservative — more violations, never missed violations). Phase 8 constraint solver works on shape positions regardless of layers, so no hard dependency. DRC runs **client-side** for real-time feedback (debounced). The server `POST /api/components/:id/drc` endpoint is for heavy full-project validation only (e.g., before export or publish) — it uses the same `drc.ts` engine bundled for server via shared code.

- [ ] **8.1** [BS-1] Create `drc.ts` — Design Rule Check engine:
  - **Rules implemented:**
    - `min-clearance`: Minimum distance between copper features (pads, traces)
    - `min-trace-width`: Minimum width for copper traces/paths
    - `courtyard-overlap`: Check that courtyard doesn't intersect other parts
    - `pin-spacing`: Verify pin pitch matches standard values (2.54mm, 1.27mm, 0.5mm, etc.)
    - `pad-size`: Check pads meet minimum size for their hole diameter
    - `silk-overlap`: Silkscreen text/shapes don't overlap copper pads
  - **Rule configuration:** Configurable per-project DRC rule set with severity levels
  - **Performance:** Spatial indexing for O(n log n) clearance checks instead of O(n²)
  - **Debounced execution:** DRC runs 500ms after last change (not on every keystroke)
- [ ] **8.2** [BS-1] Create `DRCPanel.tsx` — DRC violations list:
  - Grouped by severity (errors first, then warnings)
  - Click violation → highlight affected shapes with red/amber overlay on canvas
  - "Run DRC" button for manual full check
  - Toggle to show/hide DRC overlays on canvas
- [ ] **8.3** [BS-1] Add DRC overlays to `ComponentCanvas.tsx`:
  - Red translucent circles/boxes around clearance violations
  - Amber outlines around shapes that violate size rules
  - Dimension annotations showing actual vs. required values
- [ ] **8.4** [BS-2] Create `constraint-solver.ts` — parametric constraint engine:
  - **Constraint types:**
    - `distance`: Fixed distance between two elements (e.g., pin pitch = 2.54mm)
    - `alignment`: Elements must stay aligned on an axis
    - `pitch`: Regular spacing across N elements
    - `symmetric`: Mirror symmetry around an axis
    - `equal`: Two dimensions must be equal
    - `fixed`: Element cannot be moved
  - **Solver algorithm:** Iterative constraint propagation (not a full geometric constraint solver — that's overkill). When a shape is moved, propagate changes through connected constraints.
  - **Conflict detection:** If constraints are contradictory, highlight the conflicting constraints and notify user
- [ ] **8.5** [BS-2] Add constraint editor UI to `ComponentInspector.tsx`:
  - Select two shapes → "Add constraint" → choose type → set parameters
  - Constraints shown as dashed lines with labels on canvas
  - Click constraint → edit parameters or delete
  - Toggle constraints on/off without deleting
- [ ] **8.6** Add DRC violations to the main Validation view alongside component validation issues

---

### Phase 9: Component Library & Ecosystem (Big Swing innovation)
**Goal:** Searchable component library enables reuse, community sharing, and accelerated part creation.

- [ ] **9.1** [BS-3] Create `component_library` table (see section 4.2) and run migration
- [ ] **9.2** [BS-3] Create `server/component-library.ts` — CRUD + search API:
  - Full-text search on title + description + tags
  - Browse by category (IC, Passive, Connector, Sensor, etc.)
  - Sort by popularity (download_count) or recency
  - Pagination
- [ ] **9.3** [BS-3] Add library API routes to `server/routes.ts`
- [ ] **9.4** [BS-3] Create `ComponentLibraryBrowser.tsx` — search/browse UI:
  - Search bar with auto-complete
  - Category filter sidebar
  - Card grid showing part preview (thumbnail SVG rendering), title, pin count, package type
  - Click card → preview modal with full details
  - "Fork into project" button → creates component_part copy in current project
- [ ] **9.5** [BS-3] Add "Publish to library" action in Component Editor:
  - User edits a part → clicks "Publish" → enters tags and description → part saved to library
  - Validation must pass before publishing
- [ ] **9.6** [BS-4] Multi-part project support:
  - Component Editor left sidebar shows list of all component_parts in current project
  - Click to switch between parts
  - "Create new part" button at top of list
  - Architecture node badges show which parts are linked

---

## 11. Risk Assessment & Mitigations

### High risk:
| Risk | Impact | Mitigation |
|------|--------|------------|
| App.tsx (1,103 lines) is a monolith — decomposition could introduce bugs | Broken editor | Decompose incrementally: get reducer working first, then add UI components one by one. Test after each component. |
| FZPZ Studio uses client-side Gemini directly; ProtoPulse routes through server | AI features stop working until server endpoints ready | Phase 4 is self-contained. AI features can be temporarily disabled with a "coming soon" indicator during Phases 1-3. |
| JSONB columns for shapes/connectors could make partial updates slow for very complex parts | Performance on large parts | JSONB update replaces entire document. For MVP this is fine. If needed later, can add incremental update via JSON path operations. |
| Constraint solver (Phase 8) could be algorithmically complex and have performance issues | Laggy editor when constraints are active | Use iterative propagation (not a full geometric solver). Limit constraint graph depth. Allow disabling constraints. Profile early. |
| DRC engine (Phase 8) O(n²) clearance checks could be slow on complex parts | Editor stutters during drawing | Use spatial indexing (grid-based or R-tree). Debounce DRC runs (500ms after last change). Allow manual-only DRC mode. |

### Medium risk:
| Risk | Impact | Mitigation |
|------|--------|------------|
| FZPZ auto-save uses localStorage; migration to server-save could cause data loss during transition | User loses work | Implement server-save first, keep localStorage as fallback/cache. Clear localStorage data once server persistence is confirmed. |
| Two SVG canvases (ArchitectureView's ReactFlow + ComponentEditor's custom SVG) could have conflicting global key listeners | Keyboard shortcuts fire in wrong view | Each canvas should only register listeners when its view is active. Use view-scoped event handlers. |
| Styling drift between FZPZ's zinc/indigo theme and ProtoPulse's neon cyan/purple | Visual inconsistency | Phase 2.7 specifically addresses this. Use ProtoPulse's existing Tailwind variables. |
| React 19 → 18 downgrade could break subtle APIs | Build errors, runtime bugs | FZPZ code only uses standard hooks (useState, useReducer, useRef, useEffect, useMemo). No React 19 features detected. Low risk. |
| SVG import (Phase 5) — SVG spec is enormous, edge cases everywhere | Some SVGs fail to import | Support only the common subset: `<rect>`, `<circle>`, `<path>`, `<text>`, `<g>`. Show clear error for unsupported elements. Iterate based on user reports. |
| SVG import security (Phase 5) — malformed/malicious SVG or huge payloads | Resource exhaustion, XSS via embedded scripts | Server-side parsing only (never `innerHTML`). Sanitize: strip `<script>`, `<foreignObject>`, event handlers. Max file size limit (2MB). Max shape count limit (5,000). Reject SVGs with external references (`<use xlink:href>`). |
| Component library moderation (Phase 9) — spam, low-quality parts, inappropriate content | Library quality degrades | Start with "publish" requiring validation pass. Add report/flag mechanism. Curate initial seed library manually. |

### Low risk:
| Risk | Impact | Mitigation |
|------|--------|------------|
| jszip dependency adds bundle size | ~100KB gzipped | Only used for export; can be dynamically imported. |
| Validation naming collision (both apps have "ValidationIssue") | Type confusion | Renamed to `ComponentValidationIssue` in shared types. |
| Layer system (Phase 7) could add complexity to shape rendering | Rendering bugs | Layer filtering is a simple array filter on shapes. Default all shapes to primary layer for backward compat. |
| Named history increases memory usage (storing labels) | Minor memory increase | Labels are short strings. History already stores full state snapshots — labels are negligible overhead. |

---

## 12. Testing Strategy

### Manual smoke tests after each phase:

**Phase 1:** Navigate to Component Editor tab → see empty state → create part via API → see it loaded
**Phase 2:** Draw shapes → select → move → verify snap guides appear during alignment → multi-select and bulk-edit properties → use ruler tool to measure distance → zoom-to-fit → undo/redo → switch views → verify persistence
**Phase 3:** Open generator → select DIP-8 → generate → see shapes on canvas. Open shape templates → add standard body. Edit metadata → save → reload → verify. Open pin table → sort by name → inline edit → verify canvas updates.
**Phase 4:** Enter part description → AI generates → shapes appear. Upload datasheet → metadata extracted. Ask AI to "move pin 1 to the left" → see diff preview → accept some changes, reject others → verify final state. Upload chip photo → pins auto-detected.
**Phase 5:** Export .fzpz → import it into Fritzing (external). Import .fzpz → see part. Import SVG → shapes appear. Upload reference photo → calibrate overlay → toggle lock. Link to architecture node → BOM updates. Click validation issue → auto-navigate to element.
**Phase 6:** Verify all keyboard shortcuts. Test error recovery. Check loading states. Verify performance with complex part (100+ shapes).
**Phase 7:** Toggle layer visibility → shapes appear/disappear. Lock layer → shapes can't be selected. Draw Bezier path → edit control handles → smooth curves appear. Open history panel → click old entry → state jumps back → click newer entry → state jumps forward.
**Phase 8:** Draw two pads too close → DRC violation appears in real-time with red overlay. Fix clearance → violation disappears. Add pitch constraint between pins → move one pin → others auto-adjust. Create contradictory constraints → see conflict warning. Run full DRC → see all violations grouped by severity.
**Phase 9:** Browse library → search "ATmega328" → see results. Click result → preview. Fork into project → part appears in Component Editor. Publish a part → see it in library. Multi-part project: see list of parts in sidebar → switch between them.

### Automated tests (post-integration):
- Unit tests for parametric generators (pure functions, easy to test)
- Unit tests for validation engine
- Unit tests for DRC engine (clearance calculations, spatial indexing)
- Unit tests for constraint solver (propagation, conflict detection)
- Unit tests for diff engine (shape/connector diff computation)
- Unit tests for snap engine (alignment guide calculation)
- Unit tests for SVG parser (common SVG elements → Shape[])
- Integration tests for component CRUD API
- Integration tests for FZPZ export/import
- Integration tests for component library API

---

## 13. Open Questions

These should be resolved before each relevant phase starts:

### Before Phase 1:
1. **Should the Component Editor support editing multiple parts simultaneously?**
   Current plan: one part at a time, selected from a sidebar list. Multi-part support deferred to Phase 9.

2. **Should parts be shareable across projects?**
   Current plan: parts belong to a project. Cross-project sharing via the component library (Phase 9).

### Before Phase 4:
3. **Should the AI chat in ProtoPulse be able to invoke component editor actions?**
   Current plan: Yes (Phase 4.6). The existing AI action system can be extended with component-specific actions like "create part", "add pin", "generate DIP-8".

4. **What happens to the "Generate Schematic" button in ChatPanel?**
   It currently creates a fake canned response (#47 in frontend audit). After integration, it should trigger actual component generation in the Component Editor.

5. **Should AI diff/merge be opt-in or always shown?**
   Proposal: always show diff for AI modifications (builds trust). Direct modifications (manual drawing) apply immediately.

### Before Phase 7:
6. **Should we keep the breadboard/schematic/pcb sub-views or simplify?**
   Current plan: Keep all three — they're the core value of FZPZ Studio and essential for Fritzing compatibility.

7. **How many layers per view is reasonable?**
   Proposal: PCB gets 8 layers (copper front/back, silk front/back, courtyard, fab, paste front/back). Breadboard gets 4 (body, pins, labels, artwork). Schematic gets 3 (symbols, pins, labels). Users can't add custom layers (keeps it simple).

### Before Phase 8:
8. **Should DRC run automatically or only on demand?**
   Proposal: Both. Auto-DRC runs debounced (500ms) for basic rules (clearance, overlap). Full DRC (all rules) runs on-demand via button.

9. **How sophisticated should the constraint solver be?**
   Proposal: Iterative propagation only (not a full geometric constraint solver). If a constraint can't be satisfied, highlight it as conflicting and let the user fix it manually. Don't try to auto-resolve.

### Before Phase 9:
10. **Who can publish to the component library?**
    Proposal: Any user with a validated part. No approval workflow initially. Add report/flag for quality issues.

11. **Should the library support versioning?**
    Proposal: Not initially. "Fork" creates a copy; the original is immutable once published. Versioning can be added later.

---

## 14. Execution Checklist

This is the master checklist. Update status as work progresses.

### Phase 0: Prerequisites
- [ ] Backend audit P0/P1 items resolved
- [ ] Frontend audit #11 (context splitting) resolved
- [ ] Frontend audit #19 (PROJECT_ID hardcoding) resolved
- [ ] Frontend audit #72 (ErrorBoundary) resolved

### Phase 1: Foundation
- [ ] 1.1 shared/component-types.ts (with forward-compatible fields)
- [ ] 1.2 client/src/lib/component-editor/types.ts (UI-only types)
- [ ] 1.3 component_parts table in schema.ts (with constraints + version)
- [ ] 1.4 drizzle-kit push
- [ ] 1.5 Storage CRUD methods
- [ ] 1.6 API routes
- [ ] 1.7 ComponentEditorProvider.tsx (named history from day one)
- [ ] 1.8 ComponentEditorView.tsx skeleton (5 internal tabs)
- [ ] 1.9 Sidebar tab replacement
- [ ] 1.10 ProjectWorkspace routing
- [ ] 1.11 TanStack Query hooks

### Phase 2: Canvas + Drawing + Quick Wins
- [ ] 2.1 ComponentCanvas.tsx
- [ ] 2.2 ComponentToolbar.tsx (with zoom-to-fit button)
- [ ] 2.3 ComponentInspector.tsx
- [ ] 2.4 Shape rendering
- [ ] 2.5 Selection logic
- [ ] 2.6 Copy/paste
- [ ] 2.7 Theme alignment
- [ ] 2.8 Auto-save to backend
- [ ] 2.9 snap-engine.ts
- [ ] 2.10 SnapGuides.tsx
- [ ] 2.11 Connector numbering preview
- [ ] 2.12 Zoom-to-fit implementation
- [ ] 2.13 Multi-select property editing
- [ ] 2.14 RulerOverlay.tsx

### Phase 3: Metadata + Generator + Pin Table
- [ ] 3.1 ComponentMetadataPanel.tsx
- [ ] 3.2 GeneratorModal.tsx
- [ ] 3.3 generators.ts (parametric)
- [ ] 3.4 Validation engine + modal
- [ ] 3.5 Shape templates/presets
- [ ] 3.6 PinTableEditor.tsx

### Phase 4: AI Features + Diff/Merge + Photo Extraction
- [ ] 4.1 server/component-ai.ts
- [ ] 4.2 Gemini SDK migration
- [ ] 4.3 AI API endpoints
- [ ] 4.4 ModifyModal.tsx
- [ ] 4.5 Datasheet upload + extraction
- [ ] 4.6 ChatPanel AI action integration
- [ ] 4.7 diff-engine.ts
- [ ] 4.8 DiffPreview.tsx
- [ ] 4.9 Diff/merge in ModifyModal
- [ ] 4.10 AI pin extraction from photos

### Phase 5: Import/Export + Integration + Verification
- [ ] 5.1 FZPZ export (server-side)
- [ ] 5.2 FZPZ import endpoint
- [ ] 5.3 FZPZ export endpoint
- [ ] 5.4 svg-parser.ts
- [ ] 5.5 SVG import endpoint + UI
- [ ] 5.6 Calibrated reference image overlay
- [ ] 5.7 Validation click-to-highlight
- [ ] 5.8 Architecture node → component linking
- [ ] 5.9 BOM enrichment
- [ ] 5.10 Validation view integration

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

### Phase 7: Advanced Canvas Features
- [ ] 7.1 Layer system (LayerPanel + rendering filter + default configs)
- [ ] 7.2 Path drawing tool upgrade (Bezier curves + control handles + node editing)
- [ ] 7.3 HistoryPanel.tsx (named history with jump-to)

### Phase 8: Intelligence & Automation
- [ ] 8.1 drc.ts engine (6 rule types + spatial indexing + debounced execution)
- [ ] 8.2 DRCPanel.tsx (violations list + click-to-highlight)
- [ ] 8.3 DRC canvas overlays (red/amber violation indicators)
- [ ] 8.4 constraint-solver.ts (6 constraint types + iterative propagation + conflict detection)
- [ ] 8.5 Constraint editor UI in inspector
- [ ] 8.6 DRC in main Validation view

### Phase 9: Component Library & Ecosystem
- [ ] 9.1 component_library table + migration
- [ ] 9.2 server/component-library.ts (CRUD + search)
- [ ] 9.3 Library API routes
- [ ] 9.4 ComponentLibraryBrowser.tsx (search + browse + fork)
- [ ] 9.5 Publish-to-library action
- [ ] 9.6 Multi-part project support (sidebar list + switching)
