# FZPZ Studio → ProtoPulse Integration Plan

**Created:** 2026-02-17
**Status:** In Progress — Phase 1 complete, Phases 2-3 partially implemented
**Last updated:** 2026-02-18 (v4 — implementation progress tracking, actual file locations, checklist updates)

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
15. [Implementation Progress & Notes](#15-implementation-progress--notes)

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
FZPZ Studio becomes ProtoPulse's **Component Editor** — a dedicated workspace where users design individual electronic components at the part level, complementing ProtoPulse's system-level architecture editor. Beyond porting the existing tool, we'll enhance it into a **best-in-class component design environment** with smart alignment, real-time design rule checking, parametric constraints, and a searchable component library. Then, Phases 10-13 extend ProtoPulse into a **full circuit design platform** — schematic capture, breadboard/PCB layout, manufacturing output, and simulation — delivering the complete Fritzing feature set and beyond.

### The top-down design flow (key differentiator):
ProtoPulse's architecture is uniquely positioned for a **top-down design workflow** that no other open-source EDA tool offers:

```
Architecture (system blocks)
  ↓  expand blocks into component instances
Schematic (circuit nets between component pins)
  ↓  place components on breadboard / PCB
Breadboard & PCB Layout (physical placement + wiring)
  ↓  generate manufacturing files
Manufacturing Output (Gerber, BOM, pick-and-place)
  ↓  verify with simulation
Simulation & Analysis (DC/AC/transient, SPICE export)
```

Each level feeds the next: architecture blocks map to schematic components, schematic nets drive breadboard wiring and PCB traces, and the complete design exports to industry-standard manufacturing formats. The existing architecture edges already carry `signalType`, `voltage`, `busWidth`, and `netName` fields — these bridge directly into schematic-level net data.

### User journey after integration (full flow):
1. User designs system architecture in the existing block diagram editor (React Flow)
2. User clicks on a component node (e.g., "ESP32 Module") → opens Component Editor
3. In the Component Editor (Phases 1-9), they can:
   - Design the part's physical layout (breadboard/schematic/PCB views) with smart snap guides and dimension tools
   - Manage pins and connectors via visual canvas or spreadsheet-style pin table
   - Edit part metadata (manufacturer, MPN, datasheet URL)
   - Use AI to generate or modify the part from description/datasheet/photo
   - Generate standard package footprints (DIP, SOIC, etc.) or start from templates
   - Validate the part with real-time DRC and completeness checks
   - Import SVG artwork or existing .fzpz files
   - Export as .fzpz for use in Fritzing
   - Browse and fork parts from the component library
4. User switches to the **Circuit Schematic** view (Phase 10) to:
   - Place component instances from the project's component_parts onto a schematic canvas
   - Draw nets between pins across components (electrical connections)
   - Add power symbols (VCC, GND), bus connections, net labels, hierarchical sheets
   - Use AI to generate entire sub-circuits ("design a 3.3V regulator from 12V")
   - Run Electrical Rule Check (ERC) to catch unconnected pins, shorted power nets
5. User switches to the **Breadboard** view (Phase 11) to:
   - Place component breadboard graphics onto a virtual 830-point breadboard
   - Wire connections with color-coded wires and auto-routing
   - See schematic nets synchronized as breadboard wires
   - Or switch to basic **PCB Layout** view for footprint placement and trace routing
6. User exports the design (Phase 12):
   - Gerber files for PCB manufacturing
   - KiCad/Eagle project files for other EDA tools
   - BOM CSVs for JLCPCB/Mouser/Digi-Key ordering
   - PDF/SVG of any view for documentation
   - Full Fritzing .fzz project export/import
7. User runs **Simulation** (Phase 13) to verify the design:
   - DC operating point, transient, AC frequency response
   - Voltage/current probes on schematic nets with waveform viewer
   - SPICE netlist export for external simulators (LTspice, ngspice)
   - AI-assisted analysis ("what happens if I change R1 to 10k?")
8. Part data feeds back into BOM (metadata, MPN, manufacturer) and validation (part completeness + DRC + ERC)
9. Parametric constraints keep footprints dimensionally accurate as users make changes

### What this replaces:
The current `SchematicView.tsx` (711 lines) is a **hardcoded stub** with fake components and no real editing. It will be replaced by the FZPZ Studio's multi-view component editor, which is a real, functional tool. The full circuit design platform (Phases 10-13) then builds on this foundation to deliver capabilities comparable to Fritzing, KiCad, and Eagle — all within the browser.

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
  ├── Architecture (existing — system block diagram via React Flow)
  ├── Component Editor (NEW — replaces Schematic, Phases 1-9)
  │   ├── Breadboard view tab
  │   ├── Schematic view tab
  │   ├── PCB view tab
  │   ├── Metadata tab
  │   └── Pin Table tab (NEW)
  ├── Circuit Schematic (NEW — Phase 10: multi-component schematic capture)
  ├── Breadboard / PCB Layout (NEW — Phase 11: physical layout views)
  ├── Procurement / BOM (existing)
  ├── Validation (existing — augmented with part validation + DRC + ERC)
  ├── Simulation (NEW — Phase 13: circuit analysis + waveforms)
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

### 4.3 Circuit design tables (Phase 10)

```sql
CREATE TABLE circuit_designs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Circuit',
  description TEXT,
  settings JSONB NOT NULL DEFAULT '{}',     -- grid size, snap settings, default net colors
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_circuit_designs_project ON circuit_designs(project_id);
```

```sql
CREATE TABLE circuit_instances (
  id SERIAL PRIMARY KEY,
  circuit_id INTEGER NOT NULL REFERENCES circuit_designs(id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL REFERENCES component_parts(id),
  reference_designator TEXT NOT NULL,        -- e.g., "U1", "R3", "C12"
  schematic_x REAL NOT NULL DEFAULT 0,       -- position in schematic view
  schematic_y REAL NOT NULL DEFAULT 0,
  schematic_rotation REAL NOT NULL DEFAULT 0,
  breadboard_x REAL,                         -- position in breadboard view (nullable until placed)
  breadboard_y REAL,
  breadboard_rotation REAL DEFAULT 0,
  pcb_x REAL,                                -- position in PCB view (nullable until placed)
  pcb_y REAL,
  pcb_rotation REAL DEFAULT 0,
  pcb_side TEXT DEFAULT 'front',             -- 'front' or 'back'
  properties JSONB NOT NULL DEFAULT '{}',    -- instance-specific property overrides (e.g., resistance value)
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_circuit_instances_circuit ON circuit_instances(circuit_id);
CREATE INDEX idx_circuit_instances_part ON circuit_instances(part_id);
```

**Why `circuit_instances` references `component_parts`:** Each instance on the schematic is a placement of a component part designed in Phases 1-9. The part defines the symbol/footprint/pinout; the instance defines where it's placed, what reference designator it has, and any instance-specific property overrides (e.g., a resistor part used as both R1=10k and R2=4.7k).

```sql
CREATE TABLE circuit_nets (
  id SERIAL PRIMARY KEY,
  circuit_id INTEGER NOT NULL REFERENCES circuit_designs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                        -- net name, e.g., "VCC", "GND", "SDA", "NET_42"
  net_type TEXT NOT NULL DEFAULT 'signal',   -- 'signal' | 'power' | 'ground' | 'bus'
  voltage TEXT,                              -- rated voltage, e.g., "3.3V", "5V"
  bus_width INTEGER,                         -- for bus nets: number of bits
  segments JSONB NOT NULL DEFAULT '[]',      -- NetSegment[]: array of {fromInstanceId, fromPin, toInstanceId, toPin, waypoints[]}
  labels JSONB NOT NULL DEFAULT '[]',        -- NetLabel[]: {x, y, text, view} for placed net labels
  style JSONB NOT NULL DEFAULT '{}',         -- color, line style overrides
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_circuit_nets_circuit ON circuit_nets(circuit_id);
CREATE INDEX idx_circuit_nets_name ON circuit_nets(name);
```

**Architecture edge bridging:** The existing `architecture_edges` table has `signalType`, `voltage`, `busWidth`, and `netName` fields. When expanding an architecture block diagram into a circuit schematic (Phase 10), these fields seed the initial `circuit_nets` — the architecture edge's `netName` becomes the net name, `signalType` maps to `net_type`, and `voltage`/`busWidth` carry through directly.

### 4.4 Physical wiring table (Phase 11)

```sql
CREATE TABLE circuit_wires (
  id SERIAL PRIMARY KEY,
  circuit_id INTEGER NOT NULL REFERENCES circuit_designs(id) ON DELETE CASCADE,
  net_id INTEGER NOT NULL REFERENCES circuit_nets(id) ON DELETE CASCADE,
  view TEXT NOT NULL,                        -- 'breadboard' | 'pcb'
  points JSONB NOT NULL DEFAULT '[]',        -- array of {x, y} waypoints defining the wire/trace path
  layer TEXT DEFAULT 'front',                -- PCB: 'front' | 'back'; breadboard: always 'top'
  width REAL NOT NULL DEFAULT 1.0,           -- trace width in mils (PCB) or visual width (breadboard)
  color TEXT,                                -- wire color (breadboard) or null (PCB uses layer color)
  wire_type TEXT DEFAULT 'wire',             -- 'wire' | 'jump' (breadboard jump wires)
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_circuit_wires_circuit ON circuit_wires(circuit_id);
CREATE INDEX idx_circuit_wires_net ON circuit_wires(net_id);
```

### 4.5 Simulation tables (Phase 13)

```sql
CREATE TABLE simulation_configs (
  id SERIAL PRIMARY KEY,
  circuit_id INTEGER NOT NULL REFERENCES circuit_designs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Simulation',
  analysis_type TEXT NOT NULL,               -- 'dc_operating_point' | 'transient' | 'ac' | 'dc_sweep'
  parameters JSONB NOT NULL DEFAULT '{}',    -- analysis-specific params: {startTime, endTime, stepSize} for transient, {startFreq, endFreq, points} for AC, etc.
  probes JSONB NOT NULL DEFAULT '[]',        -- Probe[]: {netId, type: 'voltage'|'current', instanceId?, pin?}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_simulation_configs_circuit ON simulation_configs(circuit_id);

CREATE TABLE simulation_results (
  id SERIAL PRIMARY KEY,
  config_id INTEGER NOT NULL REFERENCES simulation_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'running' | 'completed' | 'failed'
  data JSONB NOT NULL DEFAULT '{}',          -- simulation output: {nodeVoltages: {netName: value[]}, branchCurrents: {instanceRef: value[]}, timePoints: number[], frequencyPoints: number[]}
  error_message TEXT,
  duration_ms INTEGER,                       -- how long the simulation took
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_simulation_results_config ON simulation_results(config_id);
```

### 4.6 Drizzle schema additions for Phases 10-13 in `shared/schema.ts`

```typescript
export const circuitDesigns = pgTable("circuit_designs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Main Circuit"),
  description: text("description"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_circuit_designs_project").on(table.projectId),
]);

export const circuitInstances = pgTable("circuit_instances", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  partId: integer("part_id").notNull().references(() => componentParts.id),
  referenceDesignator: text("reference_designator").notNull(),
  schematicX: real("schematic_x").notNull().default(0),
  schematicY: real("schematic_y").notNull().default(0),
  schematicRotation: real("schematic_rotation").notNull().default(0),
  breadboardX: real("breadboard_x"),
  breadboardY: real("breadboard_y"),
  breadboardRotation: real("breadboard_rotation").default(0),
  pcbX: real("pcb_x"),
  pcbY: real("pcb_y"),
  pcbRotation: real("pcb_rotation").default(0),
  pcbSide: text("pcb_side").default("front"),
  properties: jsonb("properties").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_circuit_instances_circuit").on(table.circuitId),
  index("idx_circuit_instances_part").on(table.partId),
]);

export const circuitNets = pgTable("circuit_nets", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  netType: text("net_type").notNull().default("signal"),
  voltage: text("voltage"),
  busWidth: integer("bus_width"),
  segments: jsonb("segments").notNull().default([]),
  labels: jsonb("labels").notNull().default([]),
  style: jsonb("style").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_circuit_nets_circuit").on(table.circuitId),
  index("idx_circuit_nets_name").on(table.name),
]);

export const circuitWires = pgTable("circuit_wires", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  netId: integer("net_id").notNull().references(() => circuitNets.id, { onDelete: "cascade" }),
  view: text("view").notNull(),
  points: jsonb("points").notNull().default([]),
  layer: text("layer").default("front"),
  width: real("width").notNull().default(1.0),
  color: text("color"),
  wireType: text("wire_type").default("wire"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_circuit_wires_circuit").on(table.circuitId),
  index("idx_circuit_wires_net").on(table.netId),
]);

export const simulationConfigs = pgTable("simulation_configs", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Simulation"),
  analysisType: text("analysis_type").notNull(),
  parameters: jsonb("parameters").notNull().default({}),
  probes: jsonb("probes").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_simulation_configs_circuit").on(table.circuitId),
]);

export const simulationResults = pgTable("simulation_results", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").notNull().references(() => simulationConfigs.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  data: jsonb("data").notNull().default({}),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_simulation_results_config").on(table.configId),
]);
```

### 4.7 Schema changes in `shared/schema.ts` (original Phase 1)

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

### 4.8 Type definitions — forward-compatible for all enhancements

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

**Circuit-level types** (`shared/circuit-types.ts`) — used by Phases 10-13:

```typescript
// --- Circuit Design Types (Phase 10) ---
interface CircuitDesign {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  settings: CircuitSettings;
}

interface CircuitSettings {
  gridSize: number;                           // default snap grid in mils
  netColors: Record<string, string>;          // named net → color overrides
  defaultBusWidth: number;
  showPowerNets: boolean;
  showNetLabels: boolean;
}

interface ComponentInstance {
  id: number;
  circuitId: number;
  partId: number;                             // references component_parts.id
  referenceDesignator: string;                // "U1", "R3", "C12"
  schematicPosition: { x: number; y: number; rotation: number };
  breadboardPosition?: { x: number; y: number; rotation: number };
  pcbPosition?: { x: number; y: number; rotation: number; side: 'front' | 'back' };
  properties: Record<string, string>;         // instance overrides: { resistance: "10k", capacitance: "100nF" }
}

// --- Net Types (Phase 10) ---
type NetType = 'signal' | 'power' | 'ground' | 'bus';

interface Net {
  id: number;
  circuitId: number;
  name: string;                               // "VCC", "GND", "SDA", "NET_42"
  netType: NetType;
  voltage?: string;
  busWidth?: number;
  segments: NetSegment[];
  labels: NetLabel[];
  style: { color?: string; lineStyle?: 'solid' | 'dashed' };
}

interface NetSegment {
  fromInstanceId: number;
  fromPin: string;                            // connector name on the source instance
  toInstanceId: number;
  toPin: string;                              // connector name on the target instance
  waypoints: { x: number; y: number }[];      // intermediate routing points
}

interface NetLabel {
  x: number;
  y: number;
  text: string;
  view: 'schematic' | 'breadboard' | 'pcb';
}

// --- Power & Special Symbols (Phase 10) ---
type PowerSymbolType = 'VCC' | 'VDD' | 'V3V3' | 'V5V' | 'V12V' | 'GND' | 'AGND' | 'DGND' | 'custom';

interface PowerSymbol {
  id: string;
  type: PowerSymbolType;
  netName: string;
  x: number;
  y: number;
  rotation: number;
  customLabel?: string;                       // for 'custom' type
}

interface NoConnectMarker {
  id: string;
  instanceId: number;
  pin: string;
  x: number;
  y: number;
}

// --- Wire/Trace Types (Phase 11) ---
interface Wire {
  id: number;
  circuitId: number;
  netId: number;
  view: 'breadboard' | 'pcb';
  points: { x: number; y: number }[];
  layer: string;
  width: number;
  color?: string;
  wireType: 'wire' | 'jump';
}

// --- Breadboard Grid (Phase 11) ---
interface BreadboardTiePoint {
  column: string;                             // 'a'-'j' or 'power+' or 'power-'
  row: number;                                // 1-63
  x: number;                                  // pixel position
  y: number;
  connected: string[];                        // list of other tie-point IDs electrically connected
}

// --- ERC Types (Phase 10) ---
type ERCRuleType = 'unconnected-pin' | 'shorted-power' | 'floating-input' | 'missing-bypass-cap'
  | 'driver-conflict' | 'no-connect-connected' | 'power-net-unnamed';

interface ERCViolation {
  ruleType: ERCRuleType;
  severity: 'error' | 'warning';
  message: string;
  instanceId?: number;
  pin?: string;
  netId?: number;
  location: { x: number; y: number };
}

// --- Simulation Types (Phase 13) ---
type AnalysisType = 'dc_operating_point' | 'transient' | 'ac' | 'dc_sweep';

interface SimulationConfig {
  id: number;
  circuitId: number;
  name: string;
  analysisType: AnalysisType;
  parameters: TransientParams | ACParams | DCSweepParams | {};
  probes: Probe[];
}

interface TransientParams {
  startTime: number;                          // seconds
  endTime: number;
  stepSize: number;
}

interface ACParams {
  startFreq: number;                          // Hz
  endFreq: number;
  pointsPerDecade: number;
}

interface DCSweepParams {
  sourceRef: string;                          // reference designator of source to sweep
  startValue: number;
  endValue: number;
  stepSize: number;
}

interface Probe {
  netId?: number;                             // voltage probe on a net
  instanceId?: number;                        // current probe through an instance
  pin?: string;                               // specific pin for current measurement
  type: 'voltage' | 'current';
  label: string;
}

interface SimulationResult {
  id: number;
  configId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data: {
    nodeVoltages?: Record<string, number[]>;  // netName → voltage samples
    branchCurrents?: Record<string, number[]>;// instanceRef → current samples
    timePoints?: number[];                    // for transient analysis
    frequencyPoints?: number[];               // for AC analysis
  };
  errorMessage?: string;
  durationMs?: number;
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

### 4.9 API endpoints (complete list including enhancements)

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

-- Circuit Design CRUD (Phase 10) --
GET    /api/projects/:id/circuits            — list circuit designs for a project
POST   /api/projects/:id/circuits            — create a new circuit design
GET    /api/circuits/:id                     — get a circuit design with instances and nets
PATCH  /api/circuits/:id                     — update circuit design metadata/settings
DELETE /api/circuits/:id                     — delete a circuit design

-- Circuit Instances (Phase 10) --
GET    /api/circuits/:id/instances           — list component instances in a circuit
POST   /api/circuits/:id/instances           — place a new component instance
PATCH  /api/instances/:id                    — update instance position/rotation/properties
DELETE /api/instances/:id                    — remove an instance from the circuit

-- Circuit Nets (Phase 10) --
GET    /api/circuits/:id/nets                — list nets in a circuit
POST   /api/circuits/:id/nets                — create a new net
PATCH  /api/nets/:id                         — update net segments/labels/style
DELETE /api/nets/:id                         — delete a net

-- Circuit AI (Phase 10) --
POST   /api/circuits/:id/ai/generate         — AI generate schematic from description
POST   /api/circuits/:id/ai/review           — AI review schematic for issues

-- ERC & Netlist (Phase 10) --
POST   /api/circuits/:id/erc                 — run electrical rule check
POST   /api/circuits/:id/netlist             — generate netlist from schematic

-- Circuit Wires (Phase 11) --
GET    /api/circuits/:id/wires               — list wires/traces in a circuit
POST   /api/circuits/:id/wires               — create a new wire
PATCH  /api/wires/:id                        — update wire path/color/width
DELETE /api/wires/:id                        — delete a wire
POST   /api/circuits/:id/autoroute           — auto-route breadboard wires for a net

-- Manufacturing Export (Phase 12) --
POST   /api/projects/:id/export/gerber       — generate Gerber zip (RS-274X + drill)
POST   /api/projects/:id/export/kicad        — generate KiCad project zip (.kicad_sch + .kicad_pcb)
POST   /api/projects/:id/export/eagle        — generate Eagle project (.sch + .brd)
POST   /api/projects/:id/export/netlist      — export netlist (?format=spice|kicad|generic)
POST   /api/projects/:id/export/bom          — export BOM (?format=jlcpcb|mouser|digikey|generic)
POST   /api/projects/:id/export/pdf          — export PDF (?view=schematic|breadboard|pcb)
POST   /api/projects/:id/export/fzz          — Fritzing full project export (.fzz)
POST   /api/projects/:id/import/fzz          — Fritzing full project import
POST   /api/projects/:id/import/kicad        — KiCad project import
POST   /api/projects/:id/export/pick-place   — pick-and-place CSV generation

-- Simulation (Phase 13) --
POST   /api/projects/:id/simulate            — run simulation (DC, transient, AC)
GET    /api/projects/:id/simulations         — list simulation configs and results
GET    /api/simulations/:id                  — get a single simulation config + results
DELETE /api/simulations/:id                  — delete a simulation config
POST   /api/projects/:id/export/spice        — export SPICE netlist file
POST   /api/projects/:id/ai/analyze          — AI circuit analysis
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

> **Implementation Note (2026-02-18):** The actual implementation simplified this decomposition. See [Section 15](#15-implementation-progress--notes) for actual file locations. Key changes: ShapeCanvas.tsx replaces ComponentCanvas.tsx + ComponentToolbar.tsx; MetadataForm is inline in ComponentEditorView.tsx; PinTable.tsx replaces PinTableEditor.tsx. ComponentEditorProvider.tsx moved to `client/src/lib/component-editor/` (not `components/`).

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
├── component-library.ts           — component library CRUD + search (Phase 9 ~150 lines)
├── circuit-routes.ts              — CRUD routes for circuit designs, instances, nets, wires (Phase 10 ~250 lines)
├── circuit-ai.ts                  — AI schematic generation, review, analysis (Phase 10/13 ~300 lines)
├── simulation.ts                  — server-side simulation execution, ngspice integration (Phase 13 ~200 lines)
└── export/                        — manufacturing output & interop (Phase 12)
    ├── gerber-generator.ts        — Gerber RS-274X output (~400 lines)
    ├── drill-generator.ts         — Excellon drill file output (~150 lines)
    ├── kicad-exporter.ts          — KiCad .kicad_sch + .kicad_pcb generation (~500 lines)
    ├── eagle-exporter.ts          — Eagle XML format generation (~400 lines)
    ├── netlist-generator.ts       — SPICE, KiCad, generic netlist formats (~250 lines)
    ├── bom-exporter.ts            — Standard BOM CSV formats (JLCPCB, Mouser, Digi-Key) (~150 lines)
    ├── pdf-generator.ts           — PDF rendering of views with title blocks (~200 lines)
    ├── fzz-handler.ts             — Fritzing full project .fzz import/export (~300 lines)
    ├── pick-place-generator.ts    — Pick-and-place CSV generation (~100 lines)
    └── spice-exporter.ts          — SPICE netlist file export (~150 lines)
```

### New circuit editor components (Phases 10-11):

```
client/src/components/circuit-editor/
├── SchematicView.tsx              — multi-component schematic canvas (Phase 10 ~400 lines)
├── SchematicCanvas.tsx            — schematic rendering with React Flow or SVG (Phase 10 ~350 lines)
├── NetDrawingTool.tsx             — net drawing interaction: click pin → route → click pin (Phase 10 ~200 lines)
├── ComponentPlacer.tsx            — drag-drop component instances from library onto schematic (Phase 10 ~150 lines)
├── PowerSymbolPalette.tsx         — VCC/GND/power rail symbol picker (Phase 10 ~80 lines)
├── ERCPanel.tsx                   — Electrical Rule Check violations list (Phase 10 ~120 lines)
├── ERCOverlay.tsx                 — ERC violation markers on schematic canvas (Phase 10 ~80 lines)
├── HierarchicalSheetPanel.tsx     — sub-sheet navigation for hierarchical designs (Phase 10 ~100 lines)
├── BreadboardView.tsx             — virtual breadboard rendering with SVG (Phase 11 ~400 lines)
├── BreadboardGrid.tsx             — 830-point grid with power rails, row/column labels (Phase 11 ~200 lines)
├── WireRouter.ts                  — auto-routing for breadboard wires (A* pathfinding) (Phase 11 ~300 lines)
├── PCBLayoutView.tsx              — basic PCB component placement + trace routing (Phase 11 ~350 lines)
├── RatsnestOverlay.tsx            — unrouted net visualization as straight lines (Phase 11 ~80 lines)
└── ExportPanel.tsx                — UI for all export options (Phase 12 ~200 lines)
```

### New circuit editor utilities (Phases 10-11):

```
client/src/lib/circuit-editor/
├── types.ts                       — circuit editor UI state types
├── hooks.ts                       — useCircuitQuery, useCircuitMutation, useNetDrawing, etc.
├── breadboard-model.ts            — grid coordinate system, tie-point connection model (Phase 11 ~200 lines)
├── erc-engine.ts                  — Electrical Rule Check engine (Phase 10 ~250 lines)
└── view-sync.ts                   — schematic ↔ breadboard ↔ PCB view synchronization (Phase 11 ~200 lines)
```

### New simulation components (Phase 13):

```
client/src/components/simulation/
├── SimulationPanel.tsx            — simulation setup, analysis type selection, run button (~200 lines)
├── WaveformViewer.tsx             — plot/graph viewer for voltage/current waveforms (~300 lines)
└── ProbeOverlay.tsx               — clickable voltage/current probes on schematic (~100 lines)

client/src/lib/simulation/
├── circuit-solver.ts              — basic nodal analysis solver or WASM ngspice wrapper (~400 lines)
└── spice-generator.ts            — generate SPICE netlist from circuit data (~200 lines)
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

2. **New AI capabilities (component-level enhancements):**
   - **AI diff/merge for modifications:** When AI modifies a part, the server returns both the new state AND a computed diff. The client renders `DiffPreview.tsx` showing added (green), removed (red), and modified (yellow) elements. User can accept/reject individual changes.
   - **AI pin extraction from photos:** `POST /api/components/:id/ai/extract-pins` — upload a photo of a physical chip, AI identifies pin locations and markings, returns Connector[] with names and positions. Uses Gemini's vision model with a specialized prompt.

3. **New AI capabilities (circuit-level — Phases 10-13):**
   - **AI schematic generation:** `POST /api/circuits/:id/ai/generate` — user describes a circuit ("design a voltage regulator circuit for 3.3V from 12V using an LM1117") → AI generates a list of component instances, their connections (nets), and placement positions. The server selects appropriate component_parts from the library or creates new ones as needed. Implementation: `server/circuit-ai.ts` with a Gemini prompt that returns structured JSON describing instances + nets.
   - **AI schematic review:** `POST /api/circuits/:id/ai/review` — AI analyzes the current schematic and returns a list of issues and suggestions. Checks for: missing decoupling capacitors, incorrect power connections, unprotected I/O, missing pull-up/pull-down resistors, component ratings vs. operating conditions. Returns structured issues with severity and specific fix suggestions.
   - **AI circuit analysis:** `POST /api/projects/:id/ai/analyze` — user asks natural language questions about circuit behavior ("what happens if I change R1 to 10k?", "what is the cutoff frequency of this filter?"). AI reads the netlist and component values, performs reasoning, and returns explanations with predicted values. This extends the existing ChatPanel AI with circuit-aware context.
   - **AI breadboard layout suggestions:** When placing components on a breadboard (Phase 11), AI can suggest optimal placement to minimize wire crossings and keep related components close together. Implementation: a "Suggest Layout" button in BreadboardView that sends the netlist and component sizes to the AI, which returns suggested positions.

4. **Use ProtoPulse's existing AI key infrastructure:**
   - FZPZ Studio currently passes API key per-request from client — this maps directly to ProtoPulse's existing pattern (ChatPanel sends keys via request body)
   - Eventually both should move to server-side key storage (audit item #61/#backend-61)

5. **Reuse vs. separate AI module:**
   - FZPZ AI prompts are highly specialized (SVG generation, FZP XML format, Fritzing conventions) — very different from ProtoPulse's general-purpose chat AI
   - **Decision: Create a separate `server/component-ai.ts`** with its own prompts and handlers
   - Share the Gemini client instantiation pattern from `server/ai.ts` (or better, create a shared `getGeminiClient(apiKey)` helper)
   - The Anthropic integration stays for chat; Gemini handles component AI (since the prompts are already tuned for Gemini)

6. **Gemini SDK migration:**
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

### New dependencies for Phases 10-13:
| Package | Purpose | Size | Phase | Notes |
|---------|---------|------|-------|-------|
| `pdfkit` | PDF generation for view export | ~500KB | 12 | Server-side only. Generates PDFs with proper scaling and title blocks. |
| `@nicholasgasior/gbrparser` or custom | Gerber RS-274X file generation | ~50KB or N/A | 12 | Consider building a custom generator — Gerber RS-274X is a well-documented text format. Custom is safer for manufacturing-critical output. |
| `archiver` | ZIP file generation (Gerber zip, KiCad project zip) | ~200KB | 12 | Already considering jszip for FZPZ; archiver is more robust for multi-file zips. Could use jszip for both. |
| `plotly.js-basic-dist` or `recharts` | Waveform/plot visualization for simulation results | ~300KB / ~50KB | 13 | `recharts` (already a shadcn-compatible library) preferred for consistency. `plotly.js` for more advanced waveform features. |
| `ngspice-wasm` (hypothetical) | Embedded SPICE simulation engine compiled to WASM | ~2-5MB | 13 | Heavy dependency. Alternative: build a simplified JS nodal analysis solver for basic circuits. See Open Questions. |
| `mathjs` | Matrix operations for nodal analysis circuit solver | ~150KB | 13 | Needed if building a custom JS-based circuit solver instead of WASM ngspice. Provides sparse matrix support. |

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

### 9.4 Circuit Design Platform — Phases 10-13

| # | Enhancement | Phase | Why it matters | Where in code | Risk | Complexity |
|---|-------------|-------|---------------|---------------|------|------------|
| CD-1 | **Multi-component schematic capture** | 10 | Core circuit design: place components, draw nets, create real circuits | `SchematicView.tsx` + `SchematicCanvas.tsx` + `NetDrawingTool.tsx` | Medium — complex interaction model | ~1,200 lines |
| CD-2 | **Electrical Rule Check (ERC)** | 10 | Catches unconnected pins, shorted power, floating inputs before manufacturing | `erc-engine.ts` + `ERCPanel.tsx` | Medium — requires complete pin type classification | ~400 lines |
| CD-3 | **AI schematic generation** | 10 | "Design a 3.3V regulator from 12V" → complete sub-circuit with components and nets | `server/circuit-ai.ts` | Medium — prompt engineering for correct netlists | ~300 lines |
| CD-4 | **Architecture → Schematic expansion** | 10 | Top-down flow: expand architecture blocks into detailed schematic components automatically | `SchematicView.tsx` + architecture edge bridging | Medium — mapping abstraction levels | ~200 lines |
| CD-5 | **Hierarchical sheets** | 10 | Break large designs into manageable sub-sheets; architecture blocks map to sheets | `HierarchicalSheetPanel.tsx` | Medium — requires sheet-level net management | ~200 lines |
| CD-6 | **Virtual breadboard** | 11 | 830-point breadboard with power rails; place components and wire them visually | `BreadboardView.tsx` + `BreadboardGrid.tsx` | Medium — grid coordinate mapping | ~600 lines |
| CD-7 | **Breadboard wire auto-routing** | 11 | A* pathfinding routes wires around components on the breadboard grid | `WireRouter.ts` | Medium — pathfinding with constraints | ~300 lines |
| CD-8 | **Schematic ↔ Breadboard synchronization** | 11 | Changes in schematic nets automatically reflect in breadboard wiring and vice versa | `view-sync.ts` | High — bidirectional sync is complex | ~200 lines |
| CD-9 | **Basic PCB layout** | 11 | Place component footprints, manual trace routing, ratsnest display | `PCBLayoutView.tsx` + `RatsnestOverlay.tsx` | Medium — different paradigm from schematic | ~450 lines |
| CD-10 | **Gerber export** | 12 | Industry-standard PCB manufacturing output (RS-274X format) | `server/export/gerber-generator.ts` | High — manufacturing correctness is critical | ~400 lines |
| CD-11 | **KiCad project export** | 12 | Most valuable interop format; enables round-tripping with KiCad | `server/export/kicad-exporter.ts` | Medium — format documentation is extensive | ~500 lines |
| CD-12 | **Multi-format BOM export** | 12 | CSV formats matching JLCPCB/Mouser/Digi-Key upload requirements | `server/export/bom-exporter.ts` | Low — well-defined CSV formats | ~150 lines |
| CD-13 | **PDF/SVG view export** | 12 | Documentation-quality exports with title blocks and scaling | `server/export/pdf-generator.ts` | Low — straightforward rendering | ~200 lines |
| CD-14 | **Fritzing full project (.fzz) import/export** | 12 | Complete Fritzing interoperability — not just parts, but full circuits | `server/export/fzz-handler.ts` | Medium — multi-view project format | ~300 lines |
| CD-15 | **DC/AC/transient simulation** | 13 | Verify circuit behavior before building — operating points, frequency response, time-domain | `circuit-solver.ts` or WASM ngspice | High — numerical accuracy requirements | ~600 lines |
| CD-16 | **Waveform viewer** | 13 | Interactive plot viewer for simulation results with cursors and measurements | `WaveformViewer.tsx` | Low — charting library handles rendering | ~300 lines |
| CD-17 | **SPICE netlist export** | 13 | Export for LTspice/ngspice/other external simulators | `spice-generator.ts` + `spice-exporter.ts` | Low — well-documented text format | ~200 lines |
| CD-18 | **AI circuit analysis** | 13 | Natural language questions about circuit behavior with AI-powered answers | `server/circuit-ai.ts` extension | Low — extends existing AI chat pattern | ~200 lines |

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
**Status: COMPLETE** (2026-02-18) — All 11 items implemented. See [Section 15](#15-implementation-progress--notes) for actual file locations vs plan.

- [x] **1.1** Add `shared/component-types.ts` with all shared types — include forward-compatible fields: `layer` on Shape, `constraints` on PartState, `layerConfig` on ViewData, `DRCRule`, `DRCViolation`, `ComponentValidationIssue`, `Constraint`
- [x] **1.2** Add `client/src/lib/component-editor/types.ts` with UI-only types — include `HistoryEntry`, `CalibratedReferenceImage`, `PartDiff`, `ShapeDiff`, `ConnectorDiff`
- [x] **1.3** Add `component_parts` table to `shared/schema.ts` with Drizzle definition (including `constraints` JSONB and `version` integer)
- [x] **1.4** Run `drizzle-kit push` to create the table
- [x] **1.5** Add CRUD methods to `server/storage.ts` for component_parts (create, get, getByProject, update, delete)
- [x] **1.6** Add API routes in `server/routes.ts` for component parts (full CRUD)
- [x] **1.7** Create `client/src/components/component-editor/ComponentEditorProvider.tsx` — reducer + named history context (adapted from FZPZ App.tsx reducer; use `HistoryEntry` with labels from the start)
- [x] **1.8** Create `client/src/components/component-editor/ComponentEditorView.tsx` — skeleton layout with internal tabs (breadboard/schematic/pcb/metadata/pin-table)
- [x] **1.9** Replace "Schematic" sidebar tab with "Component Editor" tab in Sidebar.tsx
- [x] **1.10** Replace SchematicView rendering in ProjectWorkspace.tsx with ComponentEditorView
- [x] **1.11** Wire up TanStack Query hooks in `client/src/lib/component-editor/hooks.ts` to load/save component parts from backend

---

### Phase 2: Canvas + Drawing + Quick Wins (the core editor)
**Goal:** User can draw shapes, place pins, edit properties on the SVG canvas — with smart snap guides, zoom-to-fit, multi-select editing, and ruler tool.
**Status: IN PROGRESS** — 3/14 items complete, 2 partial. Canvas with basic drawing tools works. Missing: inspector, copy/paste, auto-save, snap guides, zoom-to-fit, multi-select, ruler.

- [x] **2.1** Port `ComponentCanvas.tsx` — SVG canvas with pan/zoom, grid, shape rendering, selection, drag
- [ ] **2.2** Port `ComponentToolbar.tsx` — drawing tools (select, rect, circle, text, pin, measure), alignment buttons, undo/redo, zoom-to-fit button
- [ ] **2.3** Port `ComponentInspector.tsx` — shape properties panel, connector properties, pad specs
- [x] **2.4** Port shape rendering logic (rect, circle, path, text, group SVG rendering)
- [ ] **2.5** Port selection/multi-select/group/ungroup logic
- [ ] **2.6** Port copy/paste logic
- [x] **2.7** Adapt styling to match ProtoPulse theme (shadcn/ui components, design tokens)
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
**Status: IN PROGRESS** — 2/6 items complete. Metadata form and pin table work. Missing: package generator, validation engine, shape templates.

- [x] **3.1** Port `ComponentMetadataPanel.tsx` — metadata form with all fields
- [ ] **3.2** Port `GeneratorModal.tsx` — parametric package generator (DIP, SOIC, QFP, QFN, Header, R, C)
- [ ] **3.3** Port `generators.ts` (client-side parametric generation — pure functions)
- [ ] **3.4** Port validation engine (`validatePart()`) and `ValidationModal.tsx`
- [ ] **3.5** [QW-4] Add shape templates/presets to GeneratorModal — quick-add IC body, header, passive body, mounting hole, test point
- [x] **3.6** [ME-3] Create `PinTableEditor.tsx` — spreadsheet-style connector editing with sortable columns, inline edit, bulk operations, CSV import

---

### Phase 4: AI Features + Diff/Merge + Photo Extraction (server-side)
**Goal:** AI can generate, modify, and extract component data — all through the server — with visual diff/merge for modifications and photo-based pin extraction.
**Status: NOT STARTED**

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
**Status: NOT STARTED**

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
**Status: NOT STARTED**

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
**Status: NOT STARTED**

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
**Status: NOT STARTED**

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
**Status: NOT STARTED**

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

### Phase 10: Circuit Schematic Capture
**Goal:** Multi-component schematic editor where users place component symbols and draw electrical nets between pins, with ERC validation and AI-assisted design.
**Status: NOT STARTED**

**Dependency note:** Phase 10 depends on Phases 1-9 being complete — component_parts must exist as the "stamps" that get placed on the schematic. The schematic canvas can reuse React Flow (already used by ArchitectureView) since schematics are fundamentally node+edge graphs. The existing architecture edges' `signalType`, `voltage`, `busWidth`, and `netName` fields bridge into circuit_nets when expanding architecture blocks into schematic components.

- [ ] **10.1** Add `shared/circuit-types.ts` — CircuitDesign, ComponentInstance, Net, NetSegment, PowerSymbol, NoConnectMarker, ERCViolation, and all circuit-level type definitions
- [ ] **10.2** Add `circuit_designs`, `circuit_instances`, `circuit_nets` tables to `shared/schema.ts` with Drizzle definitions
- [ ] **10.3** Run `drizzle-kit push` to create the circuit tables
- [ ] **10.4** Add CRUD methods to `server/storage.ts` for circuit_designs, circuit_instances, circuit_nets
- [ ] **10.5** Create `server/circuit-routes.ts` — API routes for circuit CRUD, instance placement, net management
- [ ] **10.6** Create `client/src/components/circuit-editor/SchematicView.tsx` — main schematic editor view with component instance rendering and net visualization
- [ ] **10.7** Create `client/src/components/circuit-editor/SchematicCanvas.tsx` — schematic rendering engine (React Flow-based or custom SVG; React Flow preferred for consistency with ArchitectureView)
- [ ] **10.8** Create `client/src/components/circuit-editor/ComponentPlacer.tsx` — drag-drop component instances from project's component_parts or library onto schematic
- [ ] **10.9** Create `client/src/components/circuit-editor/NetDrawingTool.tsx` — net drawing interaction: click source pin → route through waypoints → click target pin; orthogonal routing with manhattan-style paths
- [ ] **10.10** Create `client/src/components/circuit-editor/PowerSymbolPalette.tsx` — VCC, GND, and custom power rail symbol picker; power symbols auto-create/attach to named power nets
- [ ] **10.11** Add net labels, bus connections, and no-connect markers to SchematicCanvas
- [ ] **10.12** Create `client/src/lib/circuit-editor/erc-engine.ts` — Electrical Rule Check engine:
  - **Rules:** unconnected-pin, shorted-power, floating-input, missing-bypass-cap, driver-conflict, no-connect-connected, power-net-unnamed
  - **Pin type classification:** input, output, bidirectional, power-in, power-out, passive, no-connect
  - **Performance:** net-based analysis (not shape-based like DRC)
- [ ] **10.13** Create `client/src/components/circuit-editor/ERCPanel.tsx` — ERC violations list with click-to-highlight and auto-navigate
- [ ] **10.14** Create `client/src/components/circuit-editor/ERCOverlay.tsx` — ERC violation markers (warning triangles, error circles) on schematic canvas at violation locations
- [ ] **10.15** Implement architecture → schematic expansion: when user clicks "Expand to Schematic" on an architecture block, create circuit_instances for each component node and seed circuit_nets from architecture edges (using `netName`, `signalType`, `voltage`, `busWidth` fields)
- [ ] **10.16** Create `client/src/components/circuit-editor/HierarchicalSheetPanel.tsx` — sub-sheet navigation; architecture blocks map to schematic sub-sheets; sheet port connectors for inter-sheet nets
- [ ] **10.17** Create `server/circuit-ai.ts` — AI schematic generation and review:
  - `POST /api/circuits/:id/ai/generate` — generate schematic from natural language description
  - `POST /api/circuits/:id/ai/review` — analyze schematic and suggest fixes (missing decoupling caps, incorrect power connections, etc.)
- [ ] **10.18** Add ERC results to the main Validation view alongside component DRC violations
- [ ] **10.19** Add netlist generation endpoint: `POST /api/circuits/:id/netlist` — generate netlist from schematic in generic format
- [ ] **10.20** Add "Circuit Schematic" tab to sidebar navigation in Sidebar.tsx
- [ ] **10.21** Wire up TanStack Query hooks in `client/src/lib/circuit-editor/hooks.ts` for circuit CRUD operations

---

### Phase 11: Breadboard & Physical Layout
**Goal:** Virtual breadboard view where users place component breadboard graphics and wire them together, plus basic PCB component placement with ratsnest display.
**Status: NOT STARTED**

**Dependency note:** Phase 11 depends on Phase 10 for circuit_nets (breadboard wiring is driven by schematic nets). Component breadboard views come from component_parts (Phases 1-9). The breadboard grid model is independent and can be developed in parallel with schematic capture, but wiring synchronization requires Phase 10's net model.

- [ ] **11.1** Add `circuit_wires` table to `shared/schema.ts` and run `drizzle-kit push`
- [ ] **11.2** Add CRUD methods to `server/storage.ts` for circuit_wires
- [ ] **11.3** Add wire API routes to `server/circuit-routes.ts`
- [ ] **11.4** Create `client/src/lib/circuit-editor/breadboard-model.ts` — breadboard grid coordinate system:
  - 830-point standard breadboard: columns a-j (split into two groups: a-e and f-j), rows 1-63, two power rail pairs
  - Each tie-point has a grid coordinate and a list of electrically connected tie-points (same row within a-e or f-j group)
  - Power rails: continuous strips along top and bottom edges
  - Coordinate ↔ pixel position mapping
- [ ] **11.5** Create `client/src/components/circuit-editor/BreadboardGrid.tsx` — SVG rendering of the 830-point grid with labeled rows/columns, power rail markings (red +, blue −), center channel
- [ ] **11.6** Create `client/src/components/circuit-editor/BreadboardView.tsx` — breadboard view with:
  - Component placement: snap component breadboard graphics to grid positions
  - Wire drawing: click-to-draw wires between tie-points with color picker
  - Jump wire support: connections that visually hop over components
  - Power rail connection visualization
- [ ] **11.7** Create `client/src/components/circuit-editor/WireRouter.ts` — auto-routing for breadboard wires:
  - A* pathfinding on the breadboard grid
  - Obstacle avoidance (route around placed components)
  - Preference for straight paths and right-angle turns
  - Color coding by net (user-configurable or auto-assigned)
- [ ] **11.8** Create `client/src/lib/circuit-editor/view-sync.ts` — schematic ↔ breadboard view synchronization:
  - When a net is added/modified in schematic → update breadboard wires
  - When a wire is drawn on breadboard → update schematic net segments
  - Bidirectional sync with conflict detection (warn if views disagree)
- [ ] **11.9** Create `client/src/components/circuit-editor/PCBLayoutView.tsx` — basic PCB component placement:
  - Place component PCB footprints on a board outline
  - Manual trace routing with width control
  - Layer switching (front/back copper)
  - Board outline editor (rectangle or custom polygon)
- [ ] **11.10** Create `client/src/components/circuit-editor/RatsnestOverlay.tsx` — unrouted net visualization:
  - Straight lines from pin to pin for unrouted connections
  - Color-coded by net
  - Updates in real-time as traces are routed
- [ ] **11.11** Add auto-route endpoint: `POST /api/circuits/:id/autoroute` — server-side auto-routing for all unrouted nets on breadboard
- [ ] **11.12** Add AI breadboard layout suggestion: "Suggest Layout" button that sends netlist + component sizes to AI → returns suggested positions for optimal placement
- [ ] **11.13** Add "Breadboard / PCB" tab to sidebar navigation with sub-view switching (breadboard vs. PCB)

---

### Phase 12: Manufacturing Output & Interoperability
**Goal:** Export designs to industry-standard manufacturing formats and enable round-tripping with other EDA tools.
**Status: NOT STARTED**

**Dependency note:** Phase 12 depends on Phase 10 (schematic netlist) and Phase 11 (PCB layout with traces). Some exports (schematic PDF, BOM, netlist) can work with Phase 10 alone. Gerber and pick-and-place exports require Phase 11's PCB layout. KiCad/Eagle export requires both schematic and layout data.

- [ ] **12.1** Create `server/export/` directory structure
- [ ] **12.2** Create `server/export/netlist-generator.ts` — netlist export in multiple formats:
  - SPICE format (for simulation)
  - KiCad netlist format
  - Generic CSV netlist
- [ ] **12.3** Create `server/export/bom-exporter.ts` — BOM export in multiple CSV formats:
  - JLCPCB format (Designator, Package, Quantity, Comment, LCSC Part #)
  - Mouser format (MPN, Manufacturer, Quantity, Description)
  - Digi-Key format (Digi-Key Part Number, Manufacturer Part Number, Quantity)
  - Generic CSV (all fields)
- [ ] **12.4** Create `server/export/gerber-generator.ts` — Gerber RS-274X output:
  - Copper layers (front + back)
  - Silkscreen layers (front + back)
  - Solder mask layers (front + back)
  - Paste layers (front + back)
  - Board outline (Edge.Cuts)
  - Aperture definitions, polarity, interpolation modes
  - **Critical: include unit tests with known-good reference Gerbers — manufacturing correctness is paramount**
- [ ] **12.5** Create `server/export/drill-generator.ts` — Excellon drill file:
  - Through-hole drill hits
  - Via drill hits
  - Tool definitions with diameters
  - Coordinate format matching Gerber output
- [ ] **12.6** Create `server/export/pick-place-generator.ts` — pick-and-place CSV:
  - Reference designator, X/Y centroid, rotation, side (top/bottom), value, footprint
  - Coordinate origin: board center or bottom-left corner (configurable)
- [ ] **12.7** Create `server/export/kicad-exporter.ts` — KiCad project export:
  - `.kicad_sch` schematic file (S-expression format, KiCad 7+ compatible)
  - `.kicad_pcb` PCB layout file (S-expression format)
  - `.kicad_pro` project file
  - Component symbols and footprints embedded or referenced
- [ ] **12.8** Create `server/export/eagle-exporter.ts` — Eagle project export:
  - `.sch` schematic in Eagle XML format
  - `.brd` board layout in Eagle XML format
  - Library symbols and packages
- [ ] **12.9** Create `server/export/pdf-generator.ts` — PDF view export:
  - Schematic view → PDF with title block, border, revision info
  - Breadboard view → PDF with component outlines and wire colors
  - PCB view → PDF per-layer or composite
  - Proper scaling (fit-to-page or 1:1 for PCB verification)
- [ ] **12.10** Create `server/export/fzz-handler.ts` — Fritzing full project (.fzz) import/export:
  - Export: package all views (schematic + breadboard + PCB), all parts, all nets into .fzz zip
  - Import: parse .fzz, create circuit_design + instances + nets + component_parts
  - Handle Fritzing's XML schema for sketches
- [ ] **12.10a** [Safety gate] Before any Gerber/drill/pick-and-place export, require a DRC pass on the PCB layout (clearance, unrouted nets, board outline checks). Show a "DRC must pass before export" dialog if violations remain. This reduces fabrication risk before files reach a fab house.
- [ ] **12.11** Create `client/src/components/circuit-editor/ExportPanel.tsx` — unified export UI:
  - Category sections: Manufacturing (Gerber, BOM, Pick-and-place), Interop (KiCad, Eagle, Fritzing), Documentation (PDF, SVG, PNG)
  - Format-specific options (e.g., BOM vendor format, PDF scaling, netlist format)
  - Progress indicator for generation
  - Download buttons
- [ ] **12.12** Add export API routes to `server/circuit-routes.ts` (all POST endpoints under `/api/projects/:id/export/`)
- [ ] **12.13** Add import endpoints for `.fzz` and `.kicad` project import
- [ ] **12.14** SVG/PNG export of any view for documentation (client-side SVG serialization + server-side rasterization)

---

### Phase 13: Simulation & Advanced Analysis
**Goal:** Basic circuit simulation and analysis capabilities — from embedded solver for simple circuits to SPICE export for complex designs, with interactive waveform visualization and AI-assisted analysis.
**Status: NOT STARTED**

**Dependency note:** Phase 13 depends on Phase 10 (circuit netlist is the input to simulation). The simulation engine choice (JS solver vs. WASM ngspice vs. server-side ngspice) is a key architectural decision — see Open Questions. A simplified JS solver can handle resistive networks and basic RC/RL circuits; SPICE-level simulation requires ngspice or similar.

- [ ] **13.1** Create `client/src/lib/simulation/spice-generator.ts` — generate SPICE netlist from circuit data:
  - Component models: R, C, L, V (voltage source), I (current source), diode, BJT, MOSFET (basic models)
  - Net names → SPICE node numbers
  - Ground net → node 0
  - Include `.tran`, `.ac`, `.dc`, `.op` analysis cards based on simulation config
- [ ] **13.2** Create `server/export/spice-exporter.ts` — SPICE netlist file export endpoint
- [ ] **13.3** Create `client/src/lib/simulation/circuit-solver.ts` — basic embedded circuit solver:
  - **Option A (recommended for MVP):** JavaScript nodal analysis solver using Modified Nodal Analysis (MNA)
    - Build conductance matrix G and source vector I from component values
    - Solve GV = I using LU decomposition (via mathjs or custom)
    - Supports: DC operating point (resistive + sources), basic transient (Euler integration for RC/RL)
    - Limitations: no semiconductor models, no convergence for nonlinear circuits
  - **Option B (full power, Phase 13+):** WASM-compiled ngspice
    - Full SPICE3 simulation engine running in the browser
    - Supports all analyses: DC, AC, transient, noise, Monte Carlo
    - ~2-5MB WASM bundle (lazy-loaded)
    - Requires WASM build infrastructure
- [ ] **13.4** Create `server/simulation.ts` — server-side simulation execution:
  - For complex circuits that exceed client-side solver capabilities
  - Run ngspice as a child process if installed on server
  - Parse ngspice output (rawfile format) into structured JSON
  - Timeout and resource limits for safety
- [ ] **13.5** Create `client/src/components/simulation/SimulationPanel.tsx` — simulation setup UI:
  - Analysis type selector (DC Operating Point, Transient, AC, DC Sweep)
  - Parameters per analysis type (time range, frequency range, sweep source)
  - Probe placement (select nets for voltage probes, components for current probes)
  - Run button with progress indicator
  - Results summary table (node voltages, branch currents)
- [ ] **13.6** Create `client/src/components/simulation/WaveformViewer.tsx` — plot/graph viewer:
  - Time-domain plots for transient analysis
  - Bode plots (magnitude + phase) for AC analysis
  - X-Y plots for DC sweep
  - Cursor for precise value readout
  - Multiple traces with legend
  - Zoom/pan on axes
  - Export plot as PNG/SVG
- [ ] **13.7** Create `client/src/components/simulation/ProbeOverlay.tsx` — schematic probe overlay:
  - Voltage probes: click a net → place a probe marker → see value in results
  - Current probes: click a component → place a probe → see branch current
  - Probe values display on schematic when DC operating point results are available
  - Color-coded to match waveform traces
- [ ] **13.8** Add simulation API routes:
  - `POST /api/projects/:id/simulate` — run simulation (accepts config, returns results)
  - `GET /api/projects/:id/simulations` — list simulation configs and results
  - `POST /api/projects/:id/export/spice` — export SPICE netlist file
- [ ] **13.9** Add AI circuit analysis: `POST /api/projects/:id/ai/analyze` — extend `server/circuit-ai.ts`:
  - User asks: "what happens if I change R1 to 10k?" → AI reads netlist, performs reasoning, explains predicted behavior change
  - User asks: "what is the cutoff frequency of this filter?" → AI identifies filter topology, calculates cutoff
  - User asks: "estimate power consumption" → AI sums per-component power dissipation
- [ ] **13.10** Add power consumption estimation: calculate total power and per-component breakdown from DC operating point results
- [ ] **13.11** Add "Simulation" tab to sidebar navigation in Sidebar.tsx
- [ ] **13.12** Basic signal integrity warnings: flag nets with fast rise times near high-impedance traces, suggest impedance matching where needed
- [ ] **13.13** Simulation result size management: waveform data can grow large (10k+ data points × multiple probes × multiple analyses). Mitigations: cap time-step count to 10,000 points per analysis; store results as compressed JSONB; auto-delete old results when a project exceeds 5 stored simulations; show result size in the SimulationPanel UI so users can manage storage

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

### High risk (Phases 10-13):
| Risk | Impact | Mitigation |
|------|--------|------------|
| Gerber generation correctness — incorrect Gerber output could result in manufacturing defects on real PCBs | **Physical manufacturing errors, wasted money, safety hazard** | Build custom Gerber generator with exhaustive unit tests against known-good reference files. Include visual diff testing (render Gerber → compare to expected image). Add prominent "BETA — verify in dedicated Gerber viewer before manufacturing" warning. Never auto-submit to fab house. |
| Circuit simulation accuracy — incorrect solver results could mislead design decisions | Wrong component selection, circuit failures | Start with a simplified JS solver for basic circuits only (resistive + RC). Clearly label accuracy limitations. Always offer SPICE export for verification in established simulators (LTspice, ngspice). Cross-validate solver results against ngspice for test circuits. |
| WASM ngspice bundle size — ngspice compiled to WASM is 2-5MB | Slow initial load, poor mobile experience | Lazy-load simulation WASM only when user opens Simulation tab. Show download progress. Consider server-side ngspice execution as alternative (avoids client bundle). For MVP, use JS solver + SPICE export and defer WASM to later. |
| Schematic complexity at scale — 100+ component schematics could overwhelm React Flow or custom SVG rendering | Laggy schematic editor on large designs | Use virtualization (only render visible components). Hierarchical sheets break large designs into manageable sub-sheets. Canvas-level optimizations: culling off-screen elements, level-of-detail rendering (simplify symbols at low zoom). Profile early with synthetic large schematics. |

### Medium risk (Phases 10-13):
| Risk | Impact | Mitigation |
|------|--------|------------|
| KiCad format compatibility — KiCad's S-expression format evolves across versions (KiCad 7 vs 8) | Exported files fail to open in KiCad | Target KiCad 7+ format (most widely used). Test exports against multiple KiCad versions. Monitor KiCad format changelog. Include format version in exported files. |
| Breadboard auto-routing performance — A* pathfinding on large breadboard with many components could be slow | Noticeable delay when auto-routing | Limit auto-route to one net at a time (not all nets simultaneously). Use grid-based A* with early termination. Show progress indicator. Allow cancellation. |
| Schematic ↔ Breadboard view synchronization — bidirectional sync between views could create infinite update loops or conflicting states | Data corruption, confusing UX | Use a unidirectional data flow with explicit sync actions (not automatic). When views conflict, show a diff and let user choose which to keep. Designate schematic as the "source of truth" — breadboard adapts to schematic changes. |
| Eagle export format stability — Autodesk has been deprioritizing Eagle; format may not be maintained | Wasted development effort | Prioritize KiCad export (open-source, actively maintained, growing market share). Eagle export is lower priority and can be deferred if resources are tight. |
| Fritzing .fzz format complexity — full Fritzing project format includes views, metadata, undo history, and custom XML schema | Import/export bugs, data loss | Focus on core data (parts, connections, positions). Ignore Fritzing undo history and view-specific decorations. Test with a corpus of real .fzz files from the Fritzing community. |

### Low risk:
| Risk | Impact | Mitigation |
|------|--------|------------|
| jszip dependency adds bundle size | ~100KB gzipped | Only used for export; can be dynamically imported. |
| Validation naming collision (both apps have "ValidationIssue") | Type confusion | Renamed to `ComponentValidationIssue` in shared types. |
| Layer system (Phase 7) could add complexity to shape rendering | Rendering bugs | Layer filtering is a simple array filter on shapes. Default all shapes to primary layer for backward compat. |
| Named history increases memory usage (storing labels) | Minor memory increase | Labels are short strings. History already stores full state snapshots — labels are negligible overhead. |
| BOM export CSV format drift — vendor CSV formats (JLCPCB, Mouser) could change | Export rejected by vendor upload | Use well-documented current formats. Add format version dates. Easy to update individual exporter when format changes. |
| PDF generation quality — server-side PDF rendering of SVG schematics might have font/rendering differences | PDFs look slightly different from screen | Use consistent font embedding in PDFs. Test PDF output across different viewers. Offer SVG export as alternative. |

---

## 12. Testing Strategy

### Manual smoke tests after each phase:

**Phase 1:** Navigate to Component Editor tab → see empty state → create part via API → see it loaded
> **Phase 1 smoke test status (2026-02-18):** PASS — Component Editor tab navigable via sidebar, empty state renders, backend CRUD operational via API routes, TanStack Query hooks load/save parts.

**Phase 2:** Draw shapes → select → move → verify snap guides appear during alignment → multi-select and bulk-edit properties → use ruler tool to measure distance → zoom-to-fit → undo/redo → switch views → verify persistence
> **Phase 2 smoke test status (2026-02-18):** PARTIAL — Drawing shapes (rect, circle, text) works, selection and drag works, pan/zoom works, grid overlay works. Not yet tested: snap guides, zoom-to-fit, multi-select, ruler, auto-save.

**Phase 3:** Open generator → select DIP-8 → generate → see shapes on canvas. Open shape templates → add standard body. Edit metadata → save → reload → verify. Open pin table → sort by name → inline edit → verify canvas updates.
> **Phase 3 smoke test status (2026-02-18):** PARTIAL — Metadata form saves fields, pin table add/edit/delete works. Not yet tested: generator modal, shape templates, validation engine.
**Phase 4:** Enter part description → AI generates → shapes appear. Upload datasheet → metadata extracted. Ask AI to "move pin 1 to the left" → see diff preview → accept some changes, reject others → verify final state. Upload chip photo → pins auto-detected.
**Phase 5:** Export .fzpz → import it into Fritzing (external). Import .fzpz → see part. Import SVG → shapes appear. Upload reference photo → calibrate overlay → toggle lock. Link to architecture node → BOM updates. Click validation issue → auto-navigate to element.
**Phase 6:** Verify all keyboard shortcuts. Test error recovery. Check loading states. Verify performance with complex part (100+ shapes).
**Phase 7:** Toggle layer visibility → shapes appear/disappear. Lock layer → shapes can't be selected. Draw Bezier path → edit control handles → smooth curves appear. Open history panel → click old entry → state jumps back → click newer entry → state jumps forward.
**Phase 8:** Draw two pads too close → DRC violation appears in real-time with red overlay. Fix clearance → violation disappears. Add pitch constraint between pins → move one pin → others auto-adjust. Create contradictory constraints → see conflict warning. Run full DRC → see all violations grouped by severity.
**Phase 9:** Browse library → search "ATmega328" → see results. Click result → preview. Fork into project → part appears in Component Editor. Publish a part → see it in library. Multi-part project: see list of parts in sidebar → switch between them.

**Phase 10:** Place 3 components on schematic → draw nets between pins → verify net connections persist after reload. Add power symbols (VCC, GND) → verify they create/attach to power nets. Run ERC → verify it catches an unconnected pin. Ask AI to "design a voltage divider" → verify component instances and nets are created. Expand an architecture block to schematic → verify instances and nets are seeded from architecture nodes/edges. Navigate hierarchical sheets → verify sub-sheet content is isolated.
**Phase 11:** Place a DIP-8 IC on breadboard → verify it snaps to grid. Draw a wire from pin 1 to the power rail → verify color coding. Auto-route a net → verify path avoids other components. Place a resistor on PCB layout → verify ratsnest lines appear for unrouted nets. Modify a schematic net → verify breadboard wiring updates. Place a jump wire → verify it visually hops over components.
**Phase 12:** Export Gerber files → open in a Gerber viewer (KiCad GerbView or online viewer) → verify copper/silk/mask layers are correct. Export KiCad project → open in KiCad → verify schematic and PCB load without errors. Export BOM in JLCPCB format → verify CSV has correct columns. Export schematic as PDF → verify scaling and title block. Import a Fritzing .fzz project → verify components and connections load. Export netlist in SPICE format → verify it's valid syntax.
**Phase 13:** Create a simple voltage divider (2 resistors + voltage source) → run DC operating point → verify output voltage is correct (V * R2 / (R1 + R2)). Add voltage probes → verify probe values display on schematic. Run transient analysis on an RC circuit → verify waveform shows correct time constant. Export SPICE netlist → import into ngspice → verify simulation runs and results match. Ask AI "what is the output voltage?" → verify AI gives correct answer.

### Automated tests (post-integration):

**Phases 1-9:**
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

**Phase 10:**
- Unit tests for ERC engine (all 7 rule types with known-violation test cases)
- Unit tests for netlist generation (known circuit → expected netlist output)
- Unit tests for architecture → schematic expansion (edge bridging: signalType/voltage/busWidth/netName mapping)
- Integration tests for circuit CRUD API (create circuit, add instances, create nets, verify persistence)
- Integration tests for circuit AI endpoints (mock Gemini responses)

**Phase 11:**
- Unit tests for breadboard grid model (coordinate ↔ pixel mapping, tie-point connectivity)
- Unit tests for wire auto-router (known layouts → expected paths, obstacle avoidance)
- Unit tests for view synchronization (schematic change → expected breadboard update)
- Integration tests for wire CRUD API
- Visual regression tests for breadboard rendering (SVG snapshot comparison)

**Phase 12:**
- **Critical: Gerber output tests** — known PCB layout → generate Gerber → compare against reference Gerber files byte-by-byte. Use a Gerber rendering library to visually diff output.
- Unit tests for Excellon drill file generation (known holes → expected drill file)
- Unit tests for KiCad S-expression output (known schematic → valid .kicad_sch)
- Unit tests for BOM CSV generation (known components → expected CSV per vendor format)
- Unit tests for SPICE netlist generation (known circuit → valid SPICE syntax)
- Integration tests for all export endpoints (verify file downloads, correct MIME types, valid zip structure)
- Round-trip tests for Fritzing .fzz (export → import → compare data model)
- Round-trip tests for KiCad (export → import in KiCad → re-export → compare)

**Phase 13:**
- Unit tests for MNA circuit solver (known circuits with analytical solutions):
  - Simple resistive divider: V_out = V_in × R2/(R1+R2)
  - RC time constant: V(t) = V_0 × (1 - e^(-t/RC))
  - RL time constant: I(t) = (V/R) × (1 - e^(-tR/L))
  - Wheatstone bridge (balanced and unbalanced)
- Unit tests for SPICE netlist syntax (valid ngspice input)
- Integration tests for simulation API (submit config → poll for results → verify data structure)
- Cross-validation tests: run same circuit in embedded solver AND ngspice → compare results within tolerance

---

## 13. Open Questions

These should be resolved before each relevant phase starts:

### Before Phase 1:
1. **Should the Component Editor support editing multiple parts simultaneously?**
   Current plan: one part at a time, selected from a sidebar list. Multi-part support deferred to Phase 9.

> **RESOLVED (2026-02-18):** Implemented as planned — one part at a time. Component Editor loads a single part via `useComponentPartByNodeId` hook. Multi-part sidebar list deferred to Phase 9.

2. **Should parts be shareable across projects?**
   Current plan: parts belong to a project. Cross-project sharing via the component library (Phase 9).

> **RESOLVED (2026-02-18):** Implemented as planned — `component_parts` table has `projectId` foreign key. Parts are project-scoped. Library sharing deferred to Phase 9.

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

> **RESOLVED (2026-02-18):** Implemented as planned — ComponentEditorView has breadboard/schematic/pcb tabs, each rendering a ShapeCanvas with the corresponding view's shapes.

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

### Before Phase 10:
12. **What is the relationship between the Architecture view and the Circuit Schematic view?**
    The architecture view is a high-level system block diagram (MCU, Power Supply, Sensor). The schematic view is the detailed circuit-level design where those blocks are expanded into individual components with electrical connections. Proposal: architecture blocks map to schematic hierarchical sheets. An "Expand to Schematic" action on an architecture node creates component instances and seeds nets from architecture edges. The two views are linked but independently editable — schematic can diverge from architecture as the design evolves.

13. **Should the schematic canvas use React Flow or a custom SVG canvas?**
    Proposal: Use React Flow. It already powers the Architecture view, supports custom nodes/edges, handles pan/zoom/selection, and has a proven rendering pipeline. Schematic components become custom React Flow nodes with pin connection handles. Nets become custom React Flow edges with orthogonal routing. This avoids maintaining two separate canvas implementations.

14. **How should component instances reference component_parts?**
    Each circuit_instance references a component_part by `partId`. The component_part defines the symbol, footprint, and pinout. The instance defines position, rotation, and property overrides (e.g., specific resistance value). If a component_part is modified after instances are placed, instances should update to reflect the new symbol/pinout. Question: should modification be automatic or require user confirmation?

### Before Phase 11:
15. **How should schematic ↔ breadboard synchronization work?**
    Proposal: schematic is the source of truth. When a net is added/modified in the schematic, the breadboard view shows the new connection as an unrouted ratsnest line. The user (or auto-router) then draws the physical wire. Breadboard-first workflows are also supported — drawing a wire on the breadboard creates the corresponding net in the schematic. Conflicts (e.g., wire exists on breadboard but net was deleted from schematic) show a warning dialog.

### Before Phase 12:
16. **What KiCad format version should we target?**
    KiCad 7+ uses S-expression format (.kicad_sch, .kicad_pcb). KiCad 8 is the latest (as of 2026). Proposal: target KiCad 7 S-expression format — it's the most widely used and has the best documentation. KiCad 8 is backward-compatible with KiCad 7 files. Don't target the older KiCad 5 legacy format.

17. **What is the manufacturing liability for Gerber output?**
    If a user fabricates a board using ProtoPulse's Gerber output and the Gerber is incorrect, there's a liability concern. Proposal: (a) Add prominent "BETA" warnings on all manufacturing exports. (b) Add a "Verify in external Gerber viewer" recommendation with links to free tools (KiCad GerbView, gerbv, Tracespace). (c) Include a disclaimer in export dialog. (d) Invest heavily in Gerber unit tests and visual diff testing. (e) Never implement direct-to-fab-house submission — always export files for user review.

18. **Should Eagle export be prioritized or deferred?**
    Eagle is being deprecated by Autodesk in favor of Fusion 360 Electronics. Proposal: defer Eagle export to a later phase or make it community-contributed. KiCad export is more valuable and should be the priority interop format.

### Before Phase 13:
19. **Which simulation engine should we use?**
    Three options:
    - **Option A: JavaScript MNA solver (recommended for MVP):** Custom Modified Nodal Analysis solver for basic circuits (resistive networks, RC/RL). ~400 lines of code, no external dependencies beyond mathjs for matrix operations. Limitations: no semiconductor models, no convergence for nonlinear circuits. Good enough for educational use and simple designs.
    - **Option B: WASM ngspice:** Full SPICE3 simulation compiled to WebAssembly. Supports all analyses and all component models. ~2-5MB bundle (lazy-loaded). Requires building ngspice with Emscripten and maintaining a WASM wrapper. Most capable but highest implementation effort.
    - **Option C: Server-side ngspice:** Run ngspice as a subprocess on the server. Avoids client bundle size. Requires ngspice installed on the server (available via Nix). Adds server load and latency. Scales poorly with concurrent users.
    Proposal: Start with Option A (JS solver) for MVP. Add SPICE netlist export so users can run complex simulations in external tools. Evaluate WASM ngspice for a future phase based on user demand.

20. **How accurate does the built-in simulation need to be?**
    Proposal: clearly label as "educational/estimation" quality. For production designs, always recommend SPICE export and external simulation. The built-in solver should be correct for linear circuits (Ohm's law, Kirchhoff's laws, RC/RL transients) but is explicitly not a replacement for professional SPICE simulation.

---

## 14. Execution Checklist

This is the master checklist. Update status as work progresses.

### Phase 0: Prerequisites
- [ ] Backend audit P0/P1 items resolved
- [ ] Frontend audit #11 (context splitting) resolved
- [ ] Frontend audit #19 (PROJECT_ID hardcoding) resolved
- [ ] Frontend audit #72 (ErrorBoundary) resolved

### Phase 1: Foundation
- [x] 1.1 shared/component-types.ts (with forward-compatible fields)
- [x] 1.2 client/src/lib/component-editor/types.ts (UI-only types)
- [x] 1.3 component_parts table in schema.ts (with constraints + version)
- [x] 1.4 drizzle-kit push
- [x] 1.5 Storage CRUD methods
- [x] 1.6 API routes
- [x] 1.7 ComponentEditorProvider.tsx (named history from day one)
- [x] 1.8 ComponentEditorView.tsx skeleton (5 internal tabs)
- [x] 1.9 Sidebar tab replacement
- [x] 1.10 ProjectWorkspace routing
- [x] 1.11 TanStack Query hooks

### Phase 2: Canvas + Drawing + Quick Wins
- [x] 2.1 ComponentCanvas.tsx
- [ ] 2.2 ComponentToolbar.tsx (with zoom-to-fit button) — partial: inline toolbar in ShapeCanvas, missing zoom-to-fit
- [ ] 2.3 ComponentInspector.tsx
- [x] 2.4 Shape rendering
- [ ] 2.5 Selection logic — partial: single-select + drag works, multi-select not yet implemented
- [ ] 2.6 Copy/paste
- [x] 2.7 Theme alignment
- [ ] 2.8 Auto-save to backend
- [ ] 2.9 snap-engine.ts
- [ ] 2.10 SnapGuides.tsx
- [ ] 2.11 Connector numbering preview
- [ ] 2.12 Zoom-to-fit implementation
- [ ] 2.13 Multi-select property editing
- [ ] 2.14 RulerOverlay.tsx

### Phase 3: Metadata + Generator + Pin Table
- [x] 3.1 ComponentMetadataPanel.tsx
- [ ] 3.2 GeneratorModal.tsx
- [ ] 3.3 generators.ts (parametric)
- [ ] 3.4 Validation engine + modal
- [ ] 3.5 Shape templates/presets
- [x] 3.6 PinTableEditor.tsx

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

### Phase 10: Circuit Schematic Capture
- [ ] 10.1 shared/circuit-types.ts (all circuit-level type definitions)
- [ ] 10.2 circuit_designs, circuit_instances, circuit_nets tables in schema.ts
- [ ] 10.3 drizzle-kit push for circuit tables
- [ ] 10.4 Storage CRUD methods for circuit_designs, circuit_instances, circuit_nets
- [ ] 10.5 server/circuit-routes.ts (circuit CRUD API routes)
- [ ] 10.6 SchematicView.tsx (main schematic editor view)
- [ ] 10.7 SchematicCanvas.tsx (schematic rendering engine — React Flow or SVG)
- [ ] 10.8 ComponentPlacer.tsx (drag-drop component instances)
- [ ] 10.9 NetDrawingTool.tsx (net drawing interaction)
- [ ] 10.10 PowerSymbolPalette.tsx (VCC/GND symbol picker)
- [ ] 10.11 Net labels, bus connections, no-connect markers
- [ ] 10.12 erc-engine.ts (Electrical Rule Check — 7 rule types)
- [ ] 10.13 ERCPanel.tsx (violations list)
- [ ] 10.14 ERCOverlay.tsx (violation markers on canvas)
- [ ] 10.15 Architecture → Schematic expansion (edge bridging)
- [ ] 10.16 HierarchicalSheetPanel.tsx (sub-sheet navigation)
- [ ] 10.17 server/circuit-ai.ts (AI schematic generation + review)
- [ ] 10.18 ERC results in main Validation view
- [ ] 10.19 Netlist generation endpoint
- [ ] 10.20 "Circuit Schematic" sidebar tab
- [ ] 10.21 TanStack Query hooks for circuit CRUD

### Phase 11: Breadboard & Physical Layout
- [ ] 11.1 circuit_wires table in schema.ts + drizzle-kit push
- [ ] 11.2 Storage CRUD methods for circuit_wires
- [ ] 11.3 Wire API routes in circuit-routes.ts
- [ ] 11.4 breadboard-model.ts (grid coordinate system, tie-point connectivity)
- [ ] 11.5 BreadboardGrid.tsx (830-point grid SVG rendering)
- [ ] 11.6 BreadboardView.tsx (component placement + wire drawing)
- [ ] 11.7 WireRouter.ts (A* auto-routing for breadboard wires)
- [ ] 11.8 view-sync.ts (schematic ↔ breadboard synchronization)
- [ ] 11.9 PCBLayoutView.tsx (basic PCB component placement + trace routing)
- [ ] 11.10 RatsnestOverlay.tsx (unrouted net visualization)
- [ ] 11.11 Auto-route endpoint
- [ ] 11.12 AI breadboard layout suggestion
- [ ] 11.13 "Breadboard / PCB" sidebar tab

### Phase 12: Manufacturing Output & Interoperability
- [ ] 12.1 server/export/ directory structure
- [ ] 12.2 netlist-generator.ts (SPICE, KiCad, generic formats)
- [ ] 12.3 bom-exporter.ts (JLCPCB, Mouser, Digi-Key, generic CSV)
- [ ] 12.4 gerber-generator.ts (RS-274X output + unit tests with reference Gerbers)
- [ ] 12.5 drill-generator.ts (Excellon drill file)
- [ ] 12.6 pick-place-generator.ts (pick-and-place CSV)
- [ ] 12.7 kicad-exporter.ts (.kicad_sch + .kicad_pcb + .kicad_pro)
- [ ] 12.8 eagle-exporter.ts (Eagle XML .sch + .brd)
- [ ] 12.9 pdf-generator.ts (PDF view export with title blocks)
- [ ] 12.10 fzz-handler.ts (Fritzing full project .fzz import/export)
- [ ] 12.10a DRC safety gate before manufacturing exports
- [ ] 12.11 ExportPanel.tsx (unified export UI)
- [ ] 12.12 Export API routes
- [ ] 12.13 Import endpoints (.fzz, .kicad)
- [ ] 12.14 SVG/PNG export of any view

### Phase 13: Simulation & Advanced Analysis
- [ ] 13.1 spice-generator.ts (generate SPICE netlist from circuit data)
- [ ] 13.2 spice-exporter.ts (SPICE netlist file export endpoint)
- [ ] 13.3 circuit-solver.ts (JS MNA solver for basic circuits)
- [ ] 13.4 server/simulation.ts (server-side simulation execution)
- [ ] 13.5 SimulationPanel.tsx (simulation setup + run UI)
- [ ] 13.6 WaveformViewer.tsx (plot/graph viewer with cursors)
- [ ] 13.7 ProbeOverlay.tsx (voltage/current probes on schematic)
- [ ] 13.8 Simulation API routes (simulate, list, export SPICE)
- [ ] 13.9 AI circuit analysis (server/circuit-ai.ts extension)
- [ ] 13.10 Power consumption estimation
- [ ] 13.11 "Simulation" sidebar tab
- [ ] 13.12 Basic signal integrity warnings
- [ ] 13.13 Simulation result size management (compressed JSONB, auto-cleanup, size UI)

---

## 15. Implementation Progress & Notes

**Last verified:** 2026-02-18

### Status Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Foundation | Complete | 11/11 items |
| Phase 2: Canvas + Drawing | Partial | 3/14 items (2 more partial) |
| Phase 3: Metadata + Generator + Pin Table | Partial | 2/6 items |
| Phase 4: AI Generation | Not started | 0/8 items |
| Phase 5: Import/Export | Not started | 0/10 items |
| Phase 6: Polish | Not started | 0/9 items |
| Phases 7-13 | Not started | 0/x items |

### Actual File Locations vs Plan

The implementation deviated from the planned file naming in a few places for simplicity:

| Planned File | Actual Implementation | Notes |
|-------------|----------------------|-------|
| `ComponentCanvas.tsx` | `client/src/components/views/component-editor/ShapeCanvas.tsx` | Renamed for clarity — renders Shape objects on SVG canvas |
| `ComponentToolbar.tsx` (separate file) | Inline toolbar in `ShapeCanvas.tsx` | Embedded toolbar with tool buttons + zoom indicator for simplicity |
| `ComponentMetadataPanel.tsx` (separate file) | `MetadataForm` function in `ComponentEditorView.tsx` | Inline component within the main view file |
| `PinTableEditor.tsx` | `client/src/components/views/component-editor/PinTable.tsx` | Simplified name |
| `ComponentEditorProvider.tsx` planned in `components/component-editor/` | `client/src/lib/component-editor/ComponentEditorProvider.tsx` | Located in lib/ since it provides context, not UI |
| `ComponentEditorView.tsx` planned in `components/component-editor/` | `client/src/components/views/ComponentEditorView.tsx` | Located in views/ to match ProtoPulse's existing view pattern |

### Key Implementation Decisions

1. **JSONB storage with version field**: Component part data uses PostgreSQL JSONB columns (views, metadata, connectors, constraints) with an integer `version` column for optimistic concurrency.
2. **nanoid for shape/connector IDs**: All client-generated IDs use `nanoid()` for uniqueness.
3. **ProtoPulse neon theme**: Selection color uses `#00F0FF` (ProtoPulse's cyan accent) instead of standard blue.
4. **Manual save via Ctrl+S**: Auto-save not yet implemented; save is manual via toolbar button or keyboard shortcut.
5. **14 action types in reducer**: The ComponentEditorProvider reducer handles: SET_STATE, SET_METADATA, ADD_SHAPE, UPDATE_SHAPE, DELETE_SHAPES, MOVE_SHAPES, ADD_CONNECTOR, UPDATE_CONNECTOR, DELETE_CONNECTOR, SET_ACTIVE_VIEW, SET_TOOL, SET_SELECTION, UNDO, REDO.
6. **5-tab internal layout**: ComponentEditorView uses Breadboard/Schematic/PCB/Metadata/Connectors tabs (Tabs component from shadcn/ui).
7. **Sidebar integration**: Component Editor appears as a Cpu icon tab in the existing sidebar, routing to `component_editor` view in ProjectWorkspace.

### Remaining Phase 2 Work
- ComponentInspector.tsx (shape properties panel for selected shapes)
- Copy/paste logic
- Auto-save with debouncing
- Snap guides and alignment engine
- Connector numbering preview on canvas
- Zoom-to-fit action
- Multi-select property editing
- Ruler overlay

### Remaining Phase 3 Work
- GeneratorModal.tsx for parametric package generation (DIP, SOIC, QFP, etc.)
- generators.ts with pure parametric generation functions
- Validation engine
- Shape templates/presets
