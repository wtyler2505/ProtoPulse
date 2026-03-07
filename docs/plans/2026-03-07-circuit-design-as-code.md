# IN-25: Circuit Design as Code — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Circuit as Code" authoring mode where users write TypeScript-like DSL to define circuits programmatically, with live schematic preview, inline error feedback, and bidirectional sync with the visual editor. Inspired by tscircuit, SKiDL, and JITX — democratized for makers and learners.

**Architecture:** A fluent builder DSL (`circuit()`, `.resistor()`, `.connect()`, `.chain()`) evaluated via Sucrase in a sandboxed Web Worker, producing a JSON IR that maps 1:1 to existing `circuit_instances`/`circuit_nets`/`circuit_wires` schema. CodeMirror 6 provides the editor with custom syntax highlighting and component-aware autocomplete. A split-pane `CircuitCodeView` shows code on the left, live schematic preview on the right. Visual edits regenerate code from IR.

**Tech Stack:** React 19 + TypeScript 5.6 + CodeMirror 6 + Sucrase (browser) + Web Worker + Zod + Vitest

---

## Research Summary

Three parallel research agents produced findings that inform this plan:

### Agent 1: tscircuit & Competitive Landscape
- **tscircuit**: React/JSX component model (`<resistor>`, `<chip>`, `<trace>`, `<board>`), compiles to Circuit JSON via multi-phase render pipeline (SourceRender -> PortMatching -> PcbComponentRender -> PcbTraceRender). 100+ npm module ecosystem.
- **Circuit JSON**: Universal IR with source_, pcb_, schematic_ prefixed elements. Zod-validated. All units in mm/V/A/F/H.
- **SKiDL (Python)**: Fluent API with `&` operator for series connections. Template parts. Most mature code-to-circuit tool.
- **JITX**: Commercial code-to-circuit (Stanza language). Used by Honeywell, Lockheed Martin. Proves viability at scale.
- **Atopile**: Newer entrant, Python-based, targets hardware-as-code.

### Agent 2: ProtoPulse Infrastructure Map
- **14 existing AI tools** already do programmatic circuit creation (place_component, draw_net, etc.)
- **120 seed components** with full metadata, pins, multi-view support in `shared/standard-library.ts`
- **Complete REST API**: CRUD on designs, instances, nets, wires with Zod validation
- **15+ export formats** all consume the same circuit data model
- **Simulation pipeline**: SPICE generator + MNA solver + 4 analysis types
- **Gaps**: No DSL/parser, no batch transactions, no parametric expressions

### Agent 3: Code-to-Circuit UX Patterns
- **CodeMirror 6** over Monaco: 43% smaller bundle, mobile-capable, Lezer grammar for AST-level autocomplete, per-instance state model
- **Sucrase in Web Worker**: 4-20x faster than Babel (225K lines/sec), pure JS (no WASM), Web Workers have no DOM/localStorage/fetch access by spec
- **Fluent builder API** over JSX: No transpilation beyond TS stripping, familiar to Arduino/Python makers, enables real pin-level autocomplete
- **JSON IR as canonical bridge**: Code evaluates to same schema visual editor uses. One-way primary (code -> visual live, visual -> code regenerated)
- **Security**: Web Worker = structural DOM isolation (not runtime checks). Zod validates all IR output. 2s watchdog kills infinite loops.

---

## Existing Infrastructure

| Module | File | Lines | Relevance |
|--------|------|-------|-----------|
| Circuit schema | `shared/schema.ts` | 606 | circuit_designs, circuit_instances, circuit_nets, circuit_wires tables |
| Component types | `shared/component-types.ts` | 213 | PartMeta, Connector, Bus, Shape union, PadSpec |
| Standard library | `shared/standard-library.ts` | 487 | 120 seed components across 12 categories |
| Circuit storage | `server/storage/circuit.ts` | 389 | Full CRUD: 30+ methods for designs/instances/nets/wires |
| Circuit AI tools | `server/ai-tools/circuit.ts` | 444 | 14 tools: create_circuit, place_component, draw_net, etc. |
| Circuit REST API | `server/circuit-routes/` | ~400 | GET/POST/PATCH/DELETE for designs, instances, nets, wires |
| SPICE generator | `client/src/lib/simulation/spice-generator.ts` | ~400 | Netlist generation from circuit data |
| SPICE parser | `client/src/lib/simulation/spice-netlist-parser.ts` | 1118 | Import SPICE netlists to circuit model |
| Netlist diff | `shared/netlist-diff.ts` | ~300 | Compare circuit states (powers incremental sync) |
| Project context | `client/src/lib/project-context.tsx` | ~1500 | React Query mutations for circuit CRUD |
| Schematic view | `client/src/components/circuit-editor/` | ~2000 | Existing schematic canvas, ERC, wire routing |
| Export system | `server/export/` | ~3200 | 15+ generators (KiCad, Gerber, SPICE, etc.) |

---

## Phase Overview

| Phase | Description | Tasks | Dependencies |
|-------|-------------|-------|--------------|
| **Phase 1** | DSL core + Web Worker evaluator | 1-3 | None (foundation) |
| **Phase 2** | CodeMirror editor + split-pane view | 4-6 | Phase 1 (needs DSL API types) |
| **Phase 3** | Autocomplete, errors, code generator | 7-9 | Phase 2 (needs editor + eval loop) |
| **Phase 4** | Integration (ViewMode, AI, server) | 10-12 | Phase 3 (needs working code view) |

---

## Phase 1: DSL Core + Evaluator

### Task 1: Circuit IR Schema

**Files:**
- Create: `client/src/lib/circuit-dsl/circuit-ir.ts`
- Test: `client/src/lib/circuit-dsl/__tests__/circuit-ir.test.ts`

**Context:** Define the JSON Intermediate Representation that the DSL produces and the visual editor consumes. Must map cleanly to existing `InsertCircuitInstance`, `InsertCircuitNet`, `InsertCircuitWire` Zod schemas in `shared/schema.ts`. This is the bridge between code and visual worlds.

**Steps (TDD):**
1. Write failing tests: IR schema validates a voltage divider circuit (2 resistors, 3 nets, VCC/GND/VOUT), rejects invalid pin references, rejects duplicate refdes
2. Run tests — confirm failures
3. Implement `CircuitIR` Zod schema: `{ meta: { name, version }, components: [], nets: [], wires: [] }`. Component has `id`, `refdes`, `partId` (lookup from standard library), `value`, `footprint`, `pins: Record<string, string>` (pin name -> net ID). Net has `id`, `name`, `type` (signal/power/ground). Wire has `id`, `netId`, `points[]`.
4. Implement `irToInsertSchemas(ir: CircuitIR, circuitId: number)` — converts IR to arrays of `InsertCircuitInstance[]`, `InsertCircuitNet[]`, `InsertCircuitWire[]` for batch database insertion
5. Implement `circuitToIR(instances, nets, wires, parts)` — reverse: reads existing circuit data and produces IR (for code generation in Phase 3)
6. Run tests — confirm passes
7. Commit

### Task 2: Circuit DSL Builder API

**Files:**
- Create: `client/src/lib/circuit-dsl/circuit-api.ts`
- Test: `client/src/lib/circuit-dsl/__tests__/circuit-api.test.ts`

**Context:** The fluent builder API that users write against. Must feel natural to Arduino/Python makers. Each method call builds up the IR incrementally. Component factories (`resistor()`, `capacitor()`, `ic()`) return typed handles with `.pin()` accessor. Inspired by SKiDL's fluent style and tscircuit's component model.

**Steps (TDD):**
1. Write failing tests:
   - `circuit("Voltage Divider")` creates builder, `.export()` returns valid `CircuitIR`
   - `c.resistor({ value: "10k" })` auto-generates refdes R1, returns handle with `.pin(1)`, `.pin(2)`
   - `c.capacitor({ value: "100nF" })` → C1
   - `c.ic({ part: "ATmega328P" })` → U1, with named pins from standard library lookup
   - `c.net("VCC", { voltage: 5 })` creates power net
   - `c.connect(R1.pin(1), vcc)` connects pin to net
   - `c.chain(vcc, R1, R2, gnd)` connects components in series (SKiDL-inspired)
   - `c.resistor({ value: "10k", footprint: "0805" })` sets footprint
   - Error: `R1.pin(3)` throws "Resistor has 2 pins" (pin count from standard library)
   - Error: duplicate refdes throws
2. Run tests — confirm failures
3. Implement `CircuitBuilder` class:
   - Constructor takes circuit name
   - Component factories: `resistor(opts)`, `capacitor(opts)`, `inductor(opts)`, `diode(opts)`, `led(opts)`, `transistor(opts)`, `ic(opts)`, `connector(opts)`, `generic(opts)`
   - Each factory returns `ComponentHandle` with `.pin(nameOrNumber)` returning `PinRef`
   - `net(name, opts?)` returns `NetRef`
   - `connect(...refs: (PinRef | NetRef)[])` — connects all refs to same net (auto-creates net if needed)
   - `chain(...refs: (ComponentHandle | NetRef)[])` — series connection sugar
   - `export()` — builds and validates `CircuitIR`, throws on validation errors
   - Auto-refdes: tracks counters per prefix (R, C, U, D, L, Q, J)
   - Standard library lookup: `resolvePartPins(partNameOrId)` returns pin count + pin names from `shared/standard-library.ts`
4. Run tests — confirm passes
5. Commit

### Task 3: Web Worker Evaluator (Sandboxed)

**Files:**
- Create: `client/src/lib/circuit-dsl/circuit-dsl-worker.ts`
- Create: `client/src/lib/circuit-dsl/use-circuit-evaluator.ts`
- Test: `client/src/lib/circuit-dsl/__tests__/circuit-dsl-worker.test.ts`

**Context:** User code runs in a dedicated Web Worker for security. Sucrase strips TypeScript annotations, `new Function()` evaluates the result. The `circuit()` API is injected as a global. A 2-second watchdog kills infinite loops. All output is Zod-validated before reaching the main thread. The worker is persistent (not spawned per eval) for performance.

**Steps (TDD):**
1. Write failing tests:
   - Worker evaluates simple DSL code → returns valid CircuitIR
   - Worker returns parse errors with line numbers
   - Worker returns runtime errors (e.g., bad pin reference) with descriptive messages
   - Worker is killed and recreated after 2s timeout (simulated infinite loop)
   - Worker rejects code that tries to access `self.fetch`, `self.importScripts` (returns error, not crash)
   - IR output exceeding 1MB is rejected
2. Run tests — confirm failures
3. Install `sucrase` as dependency: `npm install sucrase`
4. Implement `circuit-dsl-worker.ts`:
   - Blob URL worker (inline code, no separate file needed)
   - `self.onmessage` receives `{ code: string, evalId: string }`
   - Sucrase `transform(code, { transforms: ['typescript'] })` strips TS
   - `new Function('circuit', 'connect', 'chain', transpiledCode)` evaluates with injected API
   - `self.postMessage({ ok: true, ir: CircuitIR, evalId })` or `{ ok: false, error: string, line?: number, evalId }`
   - Restricted scope: delete `self.fetch`, `self.XMLHttpRequest`, `self.importScripts` before eval
5. Implement `use-circuit-evaluator.ts` React hook:
   - `evaluate(code: string): Promise<{ ir?: CircuitIR, error?: EvalError }>`
   - Manages persistent worker lifecycle (create on mount, terminate on unmount)
   - 2-second watchdog: `setTimeout` that calls `worker.terminate()` + recreates
   - Deduplication: if new eval arrives while previous is pending, cancel previous
   - Returns `{ ir, error, isEvaluating, evaluate }`
6. Run tests — confirm passes
7. Commit

---

## Phase 2: Code Editor + Split-Pane View

### Task 4: CodeMirror 6 Integration

**Files:**
- Create: `client/src/lib/circuit-dsl/circuit-lang.ts`
- Create: `client/src/components/views/circuit-code/CodeEditor.tsx`
- Test: `client/src/lib/circuit-dsl/__tests__/circuit-lang.test.ts`

**Context:** CodeMirror 6 with TypeScript/JavaScript syntax highlighting (not a custom Lezer grammar yet — that's Phase 3 polish). Basic setup: dark theme matching shadcn/ui, line numbers, bracket matching, auto-indent. We use `@codemirror/lang-javascript` with TypeScript mode for initial highlighting — the DSL is valid TypeScript so this works out of the box.

**Steps (TDD):**
1. Install CodeMirror: `npm install @codemirror/view @codemirror/state @codemirror/language @codemirror/lang-javascript @codemirror/commands @codemirror/autocomplete @codemirror/lint @codemirror/search codemirror`
2. Write failing tests: CodeEditor renders, accepts initial value, fires onChange, applies dark theme
3. Implement `CodeEditor.tsx`:
   - React component wrapping CodeMirror 6 `EditorView`
   - Props: `value: string`, `onChange: (code: string) => void`, `errors?: EvalError[]`, `readOnly?: boolean`
   - Extensions: `javascript({ typescript: true })`, `oneDark` (or custom dark theme), `lineNumbers()`, `bracketMatching()`, `autocompletion()`, `lintGutter()`
   - `useEffect` to push external value changes, `EditorView.updateListener` to emit onChange
   - Error diagnostics via `@codemirror/lint` — converts `EvalError[]` to `Diagnostic[]`
4. Implement `circuit-lang.ts`:
   - Starter template string (the default code when a new circuit-code view opens):
   ```typescript
   const STARTER_TEMPLATE = `// ProtoPulse Circuit DSL
   const c = circuit("My Circuit");

   // Add components
   const R1 = c.resistor({ value: "10k" });

   // Add power rails
   const vcc = c.net("VCC", { voltage: 5 });
   const gnd = c.net("GND");

   // Connect
   c.connect(vcc, R1.pin(1));
   c.connect(R1.pin(2), gnd);

   // Export (required)
   c.export();
   `;
   ```
   - Snippet completions for common patterns: `voltage-divider`, `led-circuit`, `h-bridge`, `op-amp-inverting`
5. Run tests — confirm passes
6. Commit

### Task 5: CircuitCodeView Split-Pane Component

**Files:**
- Create: `client/src/components/views/CircuitCodeView.tsx`
- Test: `client/src/components/views/__tests__/CircuitCodeView.test.ts`

**Context:** The main view component. Left pane: CodeEditor. Right pane: read-only schematic preview (reuses existing schematic rendering). Bottom strip: error/ERC/BOM tabs. Debounced evaluation (300ms after last keystroke). Uses `useCircuitEvaluator` hook from Task 3.

**Steps (TDD):**
1. Write failing tests:
   - Renders split pane with code editor and preview area
   - Debounces evaluation on code change
   - Shows error panel when eval fails
   - Shows component count in status bar
   - Resize handle between panes works
2. Implement `CircuitCodeView.tsx`:
   - `ResizablePanelGroup` from shadcn/ui (horizontal split, default 50/50)
   - Left panel: `<CodeEditor>` with value from state, onChange triggers debounced eval
   - Right panel: Schematic preview — renders circuit from IR using SVG (simplified schematic renderer, not the full interactive @xyflow canvas). Show component boxes + net lines.
   - Bottom panel (collapsible): Tabs for Errors, ERC Warnings, BOM Preview
   - Status bar: component count, net count, eval time, last eval timestamp
   - State: `code` (string), `ir` (CircuitIR | null), `errors` (EvalError[]), `isEvaluating` (boolean)
   - `useDebouncedCallback(evaluate, 300)` triggers on code change
   - Starter template from `circuit-lang.ts` as initial code
3. Run tests — confirm passes
4. Commit

### Task 6: Live Preview Pipeline

**Files:**
- Create: `client/src/lib/circuit-dsl/ir-to-schematic.ts`
- Test: `client/src/lib/circuit-dsl/__tests__/ir-to-schematic.test.ts`

**Context:** Converts CircuitIR into a lightweight SVG schematic for the preview pane. This is NOT the full @xyflow schematic editor — it's a read-only, auto-laid-out visualization. Uses a simple force-directed or grid placement algorithm. Components are boxes with pin labels, nets are lines between connected pins.

**Steps (TDD):**
1. Write failing tests:
   - Voltage divider IR produces SVG with 2 resistor symbols and 3 nets
   - Component boxes show refdes + value labels
   - Pin connections are drawn as polylines
   - Power/ground nets use standard symbols (arrow up for VCC, bars for GND)
   - Empty IR produces "No components" placeholder
2. Implement `ir-to-schematic.ts`:
   - `irToSchematicSVG(ir: CircuitIR): SchematicLayout` — returns positioned component and wire data
   - Simple grid layout: components placed in rows, nets routed as Manhattan paths
   - Component rendering: rectangle with refdes above, value below, pin dots on edges
   - Power symbols: VCC arrow, GND bars
   - Returns SVG-ready data (positions, paths) not actual SVG string — the React component renders it
3. Implement `SchematicPreview.tsx` in `client/src/components/views/circuit-code/`:
   - Pure SVG rendering of `SchematicLayout` data
   - Pan/zoom via SVG viewBox manipulation
   - Highlight connected components when hovering a net
4. Run tests — confirm passes
5. Commit

---

## Phase 3: Autocomplete, Errors, Code Generator

### Task 7: Component Autocomplete

**Files:**
- Modify: `client/src/components/views/circuit-code/CodeEditor.tsx`
- Create: `client/src/lib/circuit-dsl/completions.ts`
- Test: `client/src/lib/circuit-dsl/__tests__/completions.test.ts`

**Context:** Context-aware autocomplete powered by the standard library. After `c.ic({part: "` suggests component names. After `U1.pin(` suggests pin names for that specific IC. After `c.connect(` suggests existing nets and unconnected pins.

**Steps (TDD):**
1. Write failing tests:
   - After `c.resistor({` → suggests `value`, `footprint`, `refdes`
   - After `c.ic({ part: "ATm` → suggests "ATmega328P", "ATmega2560", "ATtiny85"
   - After `U1.pin(` (where U1 is ATmega328P) → suggests all 28 pin names
   - After `c.connect(` → suggests existing net names and component.pin() refs
   - Completions include description text (pin function, component category)
2. Implement `completions.ts`:
   - `circuitCompletionSource(context: CompletionContext)` — CodeMirror completion source
   - Parse surrounding code to determine context (component factory, pin accessor, connect call)
   - Lookup standard library for component names, pin names, footprints
   - Return `Completion[]` with label, detail, type (variable/function/property)
3. Wire into CodeEditor via `autocompletion({ override: [circuitCompletionSource] })`
4. Run tests — confirm passes
5. Commit

### Task 8: Inline Error Markers

**Files:**
- Modify: `client/src/components/views/circuit-code/CodeEditor.tsx`
- Modify: `client/src/components/views/CircuitCodeView.tsx`
- Test: `client/src/lib/circuit-dsl/__tests__/error-markers.test.ts`

**Context:** Evaluation errors and ERC warnings appear as inline squiggles in the editor. Syntax errors from Sucrase get red underlines. Runtime errors (bad pin, duplicate refdes) get orange underlines with descriptive tooltips. ERC violations (floating pins, unconnected nets) get yellow warnings.

**Steps (TDD):**
1. Write failing tests:
   - Syntax error at line 5 → red diagnostic at line 5 in editor
   - Runtime error "Resistor has 2 pins" → orange diagnostic at correct line
   - ERC warning "floating pin on U1" → yellow diagnostic
   - Errors panel shows all diagnostics with click-to-navigate
2. Implement error mapping:
   - `evalErrorToDiagnostic(error: EvalError): Diagnostic` — maps error type + line to CodeMirror Diagnostic
   - `ercViolationToDiagnostic(violation: ERCViolation): Diagnostic` — maps ERC results
   - Wire diagnostics into `linter()` extension in CodeEditor
3. Implement error panel in CircuitCodeView:
   - List of errors/warnings with severity icon, message, line number
   - Click → scroll editor to that line and highlight
4. Run tests — confirm passes
5. Commit

### Task 9: Code Generator (IR -> DSL)

**Files:**
- Create: `client/src/lib/circuit-dsl/code-generator.ts`
- Test: `client/src/lib/circuit-dsl/__tests__/code-generator.test.ts`

**Context:** When the user edits the circuit visually (in the schematic editor), then switches to code view, the code is regenerated from the current circuit state (via `circuitToIR` from Task 1, then `irToCode`). Generated code uses the same fluent DSL syntax. Comments warn that visual edits regenerated the code.

**Steps (TDD):**
1. Write failing tests:
   - Voltage divider IR → generates valid DSL code that re-evaluates to equivalent IR
   - Generated code uses descriptive variable names (based on refdes)
   - Generated code groups components by category (passives, ICs, connectors)
   - Generated code includes `// Auto-generated from visual editor` header
   - Round-trip: IR → code → evaluate → IR' where IR' is structurally equivalent to IR
2. Implement `code-generator.ts`:
   - `irToCode(ir: CircuitIR): string`
   - Generate `const c = circuit("${ir.meta.name}");`
   - Group nets by type (power first, then signal)
   - Group components by category
   - Generate `c.connect()` calls from pin-to-net mappings
   - Detect chain patterns (linear series connections) and emit `c.chain()` sugar
   - Format with consistent indentation
3. Run tests — confirm passes
4. Commit

---

## Phase 4: Integration

### Task 10: ViewMode + Navigation

**Files:**
- Modify: `client/src/pages/ProjectWorkspace.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`
- Modify: `client/src/components/ui/command.tsx`

**Context:** Add `'circuit_code'` to the `ViewMode` union type. Wire it into the sidebar navigation, lazy-loaded view, and command palette. The circuit code view should appear near the schematic view in the nav since they're related authoring modes.

**Steps:**
1. Add `'circuit_code'` to `ViewMode` type in ProjectWorkspace
2. Add lazy import: `const CircuitCodeView = lazy(() => import('@/components/views/CircuitCodeView'))`
3. Add sidebar item with `<Code2 />` icon, label "Circuit Code"
4. Add to command palette
5. Add `requestIdleCallback` prefetch entry
6. Type-check: `npm run check`
7. Commit

### Task 11: Persist + Sync with Visual Editor

**Files:**
- Modify: `client/src/components/views/CircuitCodeView.tsx`
- Modify: `client/src/lib/project-context.tsx`

**Context:** When the user clicks "Apply to Circuit" in the code view, the IR is persisted to the database via batch API calls (creating instances, nets, wires). When switching from schematic view to code view, existing circuit data is read and code is regenerated. Circuit code source is stored in the circuit design's `settings` JSONB field.

**Steps:**
1. Add "Apply to Circuit" button in CircuitCodeView
2. On click: `irToInsertSchemas(ir, circuitId)` → batch POST to `/api/circuits/:id/instances`, `/api/circuits/:id/nets`, `/api/circuits/:id/wires`
3. Add `circuitDslCode` field to circuit design settings JSONB (persists the user's code)
4. On view mount: if `circuitDslCode` exists in settings, load it; else if circuit has data, regenerate code via `irToCode(circuitToIR(...))`
5. Add mutation in project-context: `saveCircuitCode(designId, code)` → PATCH circuit design settings
6. Type-check: `npm run check`
7. Commit

### Task 12: AI Integration

**Files:**
- Modify: `server/ai-tools/circuit.ts`
- Modify: `client/src/components/views/CircuitCodeView.tsx`

**Context:** Add an AI tool `generate_circuit_code` that produces DSL code from a natural language description. The AI chat can say "I'll generate circuit code for a voltage divider" and the code appears in the code editor. Also: "Explain this circuit code" tool that reads the current code and explains it.

**Steps:**
1. Add `generate_circuit_code` AI tool:
   - Input: `description` (string), `circuitId` (number)
   - AI generates valid DSL code using the circuit API
   - Returns `{ code: string }` as a clientAction that populates the code editor
2. Add `explain_circuit_code` AI tool:
   - Input: `circuitId` (number)
   - Reads circuit code from design settings
   - Returns explanation as chat message
3. Add "Ask AI" button in CircuitCodeView toolbar — opens chat with context
4. Wire `generate_circuit_code` clientAction handler in CircuitCodeView
5. Type-check and test
6. Commit

---

## /agent-teams Prompts

### Phase 1 — 3 Teammates (parallel)

**Teammate: ir-schema**
- Files owned: `client/src/lib/circuit-dsl/circuit-ir.ts`, `client/src/lib/circuit-dsl/__tests__/circuit-ir.test.ts`
- Task: Implement Task 1 (Circuit IR Schema)
- Context: Read `shared/schema.ts` lines for InsertCircuitInstance/InsertCircuitNet/InsertCircuitWire Zod schemas. IR must map cleanly to these. Read `shared/standard-library.ts` for component pin data.
- Dependencies: None

**Teammate: dsl-api**
- Files owned: `client/src/lib/circuit-dsl/circuit-api.ts`, `client/src/lib/circuit-dsl/__tests__/circuit-api.test.ts`
- Task: Implement Task 2 (Circuit DSL Builder API)
- Context: Read `shared/standard-library.ts` for component names/pins. Read `shared/component-types.ts` for Connector/PartMeta types. The builder produces CircuitIR — import the Zod schema from ir-schema teammate's file.
- Dependencies: Task 1 types (can stub CircuitIR interface initially, replace when Task 1 merges)

**Teammate: worker-eval**
- Files owned: `client/src/lib/circuit-dsl/circuit-dsl-worker.ts`, `client/src/lib/circuit-dsl/use-circuit-evaluator.ts`, `client/src/lib/circuit-dsl/__tests__/circuit-dsl-worker.test.ts`
- Task: Implement Task 3 (Web Worker Evaluator)
- Context: Install `sucrase` first. Worker receives code string, transpiles with Sucrase, evaluates with injected circuit API, returns CircuitIR or error. 2s watchdog. Zod validation of output.
- Dependencies: Task 1 (IR schema for validation), Task 2 (circuit API injected into worker)

### Phase 2 — 3 Teammates (parallel, after Phase 1)

**Teammate: code-editor**
- Files owned: `client/src/lib/circuit-dsl/circuit-lang.ts`, `client/src/components/views/circuit-code/CodeEditor.tsx`, `client/src/lib/circuit-dsl/__tests__/circuit-lang.test.ts`
- Task: Implement Task 4 (CodeMirror 6 Integration)
- Context: Install CodeMirror packages. Dark theme matching ProtoPulse (bg: hsl(222.2, 84%, 4.9%), text: hsl(210, 40%, 98%)). JavaScript/TypeScript language mode. Error diagnostics via lint extension.
- Dependencies: None (editor is standalone)

**Teammate: code-view**
- Files owned: `client/src/components/views/CircuitCodeView.tsx`, `client/src/components/views/__tests__/CircuitCodeView.test.ts`
- Task: Implement Task 5 (CircuitCodeView Split-Pane)
- Context: Use shadcn/ui ResizablePanelGroup. Left=CodeEditor, Right=SchematicPreview, Bottom=error tabs. Debounced eval via useCircuitEvaluator. Read `client/src/pages/ProjectWorkspace.tsx` for view pattern.
- Dependencies: Task 4 (CodeEditor component), Task 3 (useCircuitEvaluator hook)

**Teammate: preview-renderer**
- Files owned: `client/src/lib/circuit-dsl/ir-to-schematic.ts`, `client/src/components/views/circuit-code/SchematicPreview.tsx`, `client/src/lib/circuit-dsl/__tests__/ir-to-schematic.test.ts`
- Task: Implement Task 6 (Live Preview Pipeline)
- Context: Convert CircuitIR to positioned SVG elements. Simple grid layout. Component boxes with refdes/value. Manhattan-routed net lines. Power symbols (VCC arrow, GND bars). Pan/zoom via SVG viewBox.
- Dependencies: Task 1 (CircuitIR type)

### Phase 3 — 3 Teammates (parallel, after Phase 2)

**Teammate: autocomplete**
- Files owned: `client/src/lib/circuit-dsl/completions.ts`, `client/src/lib/circuit-dsl/__tests__/completions.test.ts`
- Task: Implement Task 7 (Component Autocomplete)
- Context: Read `shared/standard-library.ts` for component names, pins, footprints. CodeMirror CompletionSource interface. Context-aware: detect if cursor is inside `.ic({part: "`, `.pin(`, `.connect(` etc.
- Dependencies: Phase 1 (standard library data), Phase 2 (CodeEditor to wire into)

**Teammate: error-system**
- Files owned: Modifies `CodeEditor.tsx` error section, `CircuitCodeView.tsx` error panel
- Task: Implement Task 8 (Inline Error Markers)
- Context: Map eval errors and ERC violations to CodeMirror Diagnostic type. Red=syntax, orange=runtime, yellow=ERC. Error panel with click-to-navigate.
- Dependencies: Phase 2 (working editor + eval loop)

**Teammate: codegen**
- Files owned: `client/src/lib/circuit-dsl/code-generator.ts`, `client/src/lib/circuit-dsl/__tests__/code-generator.test.ts`
- Task: Implement Task 9 (Code Generator)
- Context: Reverse of DSL evaluation. Read existing circuit data → produce valid DSL code. Must round-trip cleanly. Group by category, detect chain patterns, add comments.
- Dependencies: Task 1 (circuitToIR function), Task 2 (DSL syntax to generate)

### Phase 4 — 2 Teammates (sequential: Task 10 first, then 11+12 parallel)

**Teammate: wiring**
- Files owned: `ProjectWorkspace.tsx` (ViewMode addition), `Sidebar.tsx` (nav item), `command.tsx` (palette entry), `project-context.tsx` (mutations)
- Task: Implement Tasks 10 + 11 (ViewMode + Persist/Sync)
- Context: Add 'circuit_code' ViewMode. Lazy import. Sidebar item with Code2 icon. "Apply to Circuit" button → batch API calls. Store DSL code in circuit design settings JSONB.
- Dependencies: Phase 3 (working CircuitCodeView)

**Teammate: ai-tools**
- Files owned: `server/ai-tools/circuit.ts` (new tools only)
- Task: Implement Task 12 (AI Integration)
- Context: Add generate_circuit_code and explain_circuit_code AI tools. Read existing tools in circuit.ts for pattern. Generated code must use the fluent DSL API syntax.
- Dependencies: Phase 3 (DSL API syntax finalized)

---

## Team Execution Checklist

- [ ] Research: Context7 lookup for CodeMirror 6 API, Sucrase API
- [ ] Research: WebSearch for Web Worker blob URL patterns, Sucrase browser usage
- [ ] Plan: Get plan approval from Tyler before implementation
- [ ] Phase 1: Deploy /agent-teams (3 teammates: ir-schema, dsl-api, worker-eval)
- [ ] Phase 1: `npm run check` — zero TS errors
- [ ] Phase 1: `npm test` — all tests pass
- [ ] Phase 1: Commit
- [ ] Phase 2: Deploy /agent-teams (3 teammates: code-editor, code-view, preview-renderer)
- [ ] Phase 2: `npm run check` — zero TS errors
- [ ] Phase 2: `npm test` — all tests pass
- [ ] Phase 2: Commit
- [ ] Phase 3: Deploy /agent-teams (3 teammates: autocomplete, error-system, codegen)
- [ ] Phase 3: `npm run check` — zero TS errors
- [ ] Phase 3: `npm test` — all tests pass
- [ ] Phase 3: Commit
- [ ] Phase 4: Deploy /agent-teams (2 teammates: wiring, ai-tools)
- [ ] Phase 4: `npm run check` — zero TS errors
- [ ] Phase 4: `npm test` — all tests pass
- [ ] Phase 4: Commit
- [ ] Update MEMORY.md with Wave 50 additions
- [ ] Update product-analysis-checklist.md: mark IN-25 done

---

## Verification

1. `npm run check` — zero TS errors after each phase
2. `npm test` — all existing + new tests pass
3. Manual: Open Circuit Code view → see starter template → live schematic preview renders
4. Manual: Type `c.resistor({ value: "10k" })` → preview updates with resistor box
5. Manual: Introduce syntax error → red squiggle appears inline
6. Manual: Type `R1.pin(3)` for a resistor → orange error "Resistor has 2 pins"
7. Manual: Click "Apply to Circuit" → switch to schematic view → components appear
8. Manual: Edit circuit visually → switch to code view → code is regenerated
9. Manual: Autocomplete suggests component names after `c.ic({ part: "`
10. Manual: Ask AI to "generate a voltage divider circuit in code" → code appears in editor

---

## New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `sucrase` | Fast TypeScript stripping in Web Worker | ~100KB |
| `@codemirror/view` | CodeMirror 6 core view | ~300KB (total CM6 bundle ~1.2MB) |
| `@codemirror/state` | Editor state management | (included above) |
| `@codemirror/language` | Language infrastructure | (included above) |
| `@codemirror/lang-javascript` | JS/TS syntax highlighting | (included above) |
| `@codemirror/commands` | Standard keybindings | (included above) |
| `@codemirror/autocomplete` | Completion UI | (included above) |
| `@codemirror/lint` | Error diagnostics | (included above) |
| `@codemirror/search` | Find/replace | (included above) |
| `codemirror` | Meta-package (bundles essentials) | (included above) |

**Total new JS:** ~1.3MB (CodeMirror + Sucrase). Lazy-loaded with CircuitCodeView — zero impact on initial bundle.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Web Worker can't import standard library data | Serialize component catalog and postMessage it to worker on init |
| Sucrase doesn't handle all TS syntax | DSL is simple (no generics, no decorators) — Sucrase handles this subset |
| CodeMirror 6 bundle size | Lazy-loaded with view — only loads when user opens Circuit Code |
| Auto-layout quality for complex circuits | Start with grid layout, upgrade to ELK (elkjs) later if needed |
| Code regeneration loses user comments | Clear UI warning: "Editing visually will regenerate code" |
| Performance with large circuits (100+ components) | Debounce eval at 300ms, cancel in-flight evals, memoize schematic diff |
