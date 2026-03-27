# AI Audit Report — Server AI Tools (`server/ai-tools/`)

> **Analyst:** ai-tools-analyst
> **Date:** 2026-03-27
> **Scope:** All 20 files in `server/ai-tools/`, ~8700 lines
> **Total tools registered:** 125

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Infrastructure Files](#infrastructure-files)
3. [Per-Module Tool Inventory](#per-module-tool-inventory)
4. [Cross-Cutting Analysis](#cross-cutting-analysis)
5. [Findings & Recommendations](#findings--recommendations)

---

## Executive Summary

The `server/ai-tools/` directory contains 20 files (3 infrastructure + 16 tool modules + 1 utility) totaling ~8700 lines. Together they register **125 AI tools** into a singleton `ToolRegistry`. The AGENTS.md documentation claims "118 AI tools" — **this is stale and should be updated to 125**.

Tool execution follows two patterns:
- **Server-side** (real implementation): Tool calls `ctx.storage.*` methods or performs computation directly. ~48 tools.
- **Client-dispatched** (via `clientAction()`): Tool returns a `ToolResult` payload for the React frontend to handle. ~77 tools.

Destructive tools (6 total) enforce `requiresConfirmation: true` with server-side rejection if `ctx.confirmed !== true`.

### Key Findings

| Severity | Count | Summary |
|----------|-------|---------|
| P0 (Critical) | 1 | `suggest_trace_path` returns hardcoded stub data |
| P1 (High) | 4 | Weak typing in `update_bom_item`; `err: any` in export error handlers; `ToolCategory` type incomplete; tool count documentation stale |
| P2 (Medium) | 5 | Vision tools are prompt-only (no actual vision); IPC standard cross-reference is fragile; project.ts header says "9 tools" but has 10; category mismatch for 6+ modules; `set_pin_map` hardcodes specific pin names |
| P3 (Low) | 3 | Some `clientAction` tools accept empty `z.object({})` but still pass params; `suggest_dfm_fix` auto-fix actions are validation issues not actual mutations; inconsistent JSDoc tool counts |

---

## Infrastructure Files

### `types.ts` (136 lines)

Core type definitions for the entire tool system.

| Export | Type | Purpose |
|--------|------|---------|
| `ToolCategory` | Union type | `'architecture' \| 'circuit' \| 'component' \| 'bom' \| 'validation' \| 'export' \| 'project' \| 'navigation' \| 'arduino' \| 'simulation'` |
| `ToolSource` | Interface | `{ type, label, id }` — reference to design elements for AI answer source panel |
| `ToolResult` | Interface | `{ success, message, data?, sources? }` — standard return envelope |
| `ToolContext` | Interface | `{ projectId, storage, confirmed?, googleWorkspaceToken? }` — execution context |
| `ModelTier` | Union type | `'fast' \| 'standard' \| 'premium'` — routing hints for multi-model cost optimization |
| `ConfidenceScore` | Interface | `{ score (0-100), explanation, factors[] }` — for analytical tools |
| `ToolDefinition<TSchema>` | Generic interface | `{ name, description, category, parameters, execute, requiresConfirmation, modelPreference? }` |

**Finding [P1-TYPE-01]:** `ToolCategory` has 10 values but 16 tool modules exist. Modules like `vision`, `manufacturing`, `testbench`, `generative`, `bom-optimization`, and `risk-analysis` register tools under existing categories (`component`, `circuit`, `validation`, `bom`) rather than their own. This means `getByCategory()` returns mixed results — e.g., querying `'bom'` returns BOM CRUD tools AND risk analysis tools. This is not necessarily wrong, but it means the category system does not map 1:1 to modules.

### `registry.ts` (183 lines)

`ToolRegistry` class + `clientAction()` helper.

| Method | Purpose |
|--------|---------|
| `register(tool)` | Adds tool to internal Map (keyed by name). Throws on duplicate names. |
| `get(name)` | Returns single tool definition or undefined. |
| `getAll()` | Returns all registered tools as array. |
| `getByCategory(cat)` | Filters tools by category. |
| `getDestructiveTools()` | Returns names of tools with `requiresConfirmation: true`. |
| `validate(name, params)` | Validates parameters against tool's Zod schema. Returns `{ success, data?, error? }`. |
| `execute(name, params, ctx)` | Validates params, checks confirmation for destructive tools, then calls `tool.execute()`. |
| `toGenkitFormat()` | Converts all tool definitions to Genkit tool format for AI model consumption. |
| `toAnthropicFormat()` | Converts all tool definitions to Anthropic API tool format. |

**`clientAction(type, params)`**: Returns `{ success: true, message: 'Action dispatched', data: { type, ...params } }`. The frontend AI action parser picks up `data.type` and routes to the appropriate client-side handler.

**Security note:** `execute()` enforces server-side confirmation for destructive tools — if `requiresConfirmation` is `true` and `ctx.confirmed` is not `true`, execution is rejected with an error `ToolResult`. This is the correct defense-in-depth approach.

### `index.ts` (63 lines)

Barrel module. Creates singleton `toolRegistry` by calling 18 registration functions in deterministic order. Exports `DESTRUCTIVE_TOOLS` list.

Registration order:
1. navigation → 2. architecture → 3. bom → 4. validation → 5. project → 6. circuit → 7. component → 8. pcb → 9. circuitCode → 10. export → 11. vision → 12. generative → 13. arduino → 14. simulation → 15. manufacturing → 16. testbench → 17. bomOptimization → 18. riskAnalysis

Note: `circuit.ts` exports 3 separate registration functions (`registerCircuitTools`, `registerPcbTools`, `registerCircuitCodeTools`), which is why 16 modules produce 18 registration calls.

### `teardrops-util.ts` (42 lines)

Pure utility — no tools registered. Exports `generateTeardropPoints(traceP1, traceP2, traceWidth, padDiameter)` which computes 3 polygon vertices for a teardrop pad connection. Used by `generate_teardrops` tool in `circuit.ts`.

---

## Per-Module Tool Inventory

### `navigation.ts` — 2 tools

| Tool | Category | Execution | Confirmation | Parameters |
|------|----------|-----------|--------------|------------|
| `switch_view` | navigation | client | no | `view: enum(architecture\|schematic\|procurement\|validation\|output\|project_explorer)` |
| `switch_schematic_sheet` | navigation | client | no | `sheetId: string` |

**Notes:** Pure client dispatch. The `switch_view` enum has only 6 values but the app has 15+ ViewModes (kanban, knowledge, viewer_3d, community, ordering, calculators, design_patterns, storage, circuit_code, etc.). This tool cannot navigate to most views.

### `architecture.ts` — 22 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `query_nodes` | architecture | **server** | no | `{}` (fetches all) |
| `query_edges` | architecture | **server** | no | `{}` (fetches all) |
| `add_node` | architecture | **server** | no | `label, nodeType, x?, y?` |
| `remove_node` | architecture | client | **yes** | `nodeId` |
| `update_node` | architecture | client | no | `nodeId, updates{}` |
| `connect_nodes` | architecture | client | no | `sourceId, targetId, label?` |
| `remove_edge` | architecture | client | **yes** | `edgeId` |
| `generate_architecture` | architecture | client | no | `prompt` |
| `auto_layout` | architecture | client | no | `layoutType: enum` |
| `clear_canvas` | architecture | client | **yes** | `{}` |
| `add_subcircuit` | architecture | client | no | `parentNodeId, subcircuitType` |
| `assign_net_name` | architecture | client | no | `edgeId, netName` |
| `create_sheet` | architecture | client | no | `name` |
| `rename_sheet` | architecture | client | no | `sheetId, name` |
| `move_to_sheet` | architecture | client | no | `nodeIds[], sheetId` |
| `select_node` | architecture | client | no | `nodeId` |
| `focus_node_in_view` | architecture | client | no | `nodeId` |
| `copy_architecture_summary` | architecture | client | no | `{}` |
| `copy_architecture_json` | architecture | client | no | `{}` |
| `search_datasheet` | architecture | client | no | `query` |
| `set_pin_map` | architecture | client | no | `nodeId, pinMap{MOSI?,MISO?,SCK?,SDA?,SCL?,TX?,RX?,VCC?,GND?}.passthrough()` |
| `auto_assign_pins` | architecture | client | no | `nodeId` |

**Notes:**
- Server-side tools: `query_nodes`, `query_edges`, `add_node` — these directly call `ctx.storage.*` with sources for the AI source panel.
- `query_nodes` and `query_edges` both include `sources` arrays in their results for BL-0160 answer attribution.
- `add_node` writes to DB via `storage.createNode()` with a full field mapping including `pinConfiguration`.
- Destructive: `remove_node`, `remove_edge`, `clear_canvas`.
- **[P2-ARCH-01]** `set_pin_map` hardcodes 9 well-known pin names (MOSI, MISO, SCK, SDA, SCL, TX, RX, VCC, GND) in its Zod schema but uses `.passthrough()` for custom pins. This works but is an unusual pattern — the hardcoded names serve no validation purpose since all values are `z.string().optional()`.

### `bom.ts` — 12 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `query_bom_items` | bom | **server** | no | `{}` |
| `add_bom_item` | bom | **server** | no | `partNumber, manufacturer, description, quantity?, unitPrice?, supplier?, status?` |
| `remove_bom_item` | bom | client | **yes** | `partNumber` |
| `update_bom_item` | bom | client | no | `partNumber, updates{manufacturer?,description?,quantity?,unitPrice?,supplier?,status?,notes?}` |
| `pricing_lookup` | bom | client | no | `partNumber` |
| `suggest_alternatives` | bom | client | no | `partNumber, reason?: enum(cost\|availability\|performance)` |
| `optimize_bom` | bom | client | no | `{}` |
| `check_lead_times` | bom | client | no | `{}` |
| `parametric_search` | bom | client | no | `category, specs{voltage?,package?,frequency?,...}.passthrough()` |
| `add_datasheet_link` | bom | client | no | `partNumber, url` |
| `lookup_datasheet` | bom | **server** | no | `bomItemId: number` |
| `compare_components` | bom | **server** | no | `category?, partNumbers?[]` |

**Notes:**
- **[P1-BOM-01]** `update_bom_item` uses `z.unknown().optional()` for all update fields. This means the AI can pass any value type for any field — there is no runtime validation on field values. Should use specific types (`z.string()`, `z.number()`, etc.) matching the actual BOM schema.
- `add_bom_item` converts `unitPrice` to string via `String(params.unitPrice)` before storage — the schema uses `z.number()` input but stores as string.
- `compare_components` fetches BOM items and architecture nodes in parallel, then cross-references using case-insensitive label matching. This is a heuristic match (description text matching against node labels).
- `lookup_datasheet` and `query_bom_items` both provide `sources` arrays for answer attribution.

### `bom-optimization.ts` — 3 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `analyze_bom_optimization` | bom | **server** | no | `{}` |
| `suggest_alternate_part` | bom | **server** | no | `partNumber, reason?: enum(cost\|availability\|pin_compatible\|performance)` |
| `consolidate_packages` | bom | **server** | no | `targetPackage?: string` |

**Notes:** All 3 tools have full server-side implementations with real logic:
- `analyze_bom_optimization`: Detects component type via regex, identifies consolidation opportunities (same manufacturer + type), generates cost suggestions, flags over-spec components, analyzes supplier diversity.
- `suggest_alternate_part`: Uses built-in knowledge bases: `RESISTOR_PACKAGES` (4 entries), `CAPACITOR_PACKAGES` (4 entries), `IC_ALTERNATES` (7 IC families with pin-compatible alternatives: ATmega, STM32, ESP32, LM7805, AMS1117, MCP3008, TLC5940).
- `consolidate_packages`: Groups BOM items by component type, recommends target package, rates migration difficulty (easy/moderate/hard).
- All tools return `ConfidenceScore` with factors in their results.

### `validation.ts` — 11 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `add_validation_issue` | validation | **server** | no | `type: enum(error\|warning\|info), message, category?: enum, nodeId?` |
| `run_validation` | validation | client | no | `{}` |
| `clear_validation` | validation | client | **yes** | `{}` |
| `generate_test_plan` | validation | **server** | no | `focusArea?: string` |
| `design_review` | validation | **server** | no | `{}` |
| `power_budget_analysis` | validation | client | no | `{}` |
| `voltage_domain_check` | validation | client | no | `{}` |
| `auto_fix_validation` | validation | client | no | `issueId: string` |
| `dfm_check` | validation | client | no | `fabProfile?: enum` |
| `thermal_analysis` | validation | client | no | `{}` |
| `hardware_debug_analysis` | validation | **server** | no | `symptoms: string, category?: enum(power\|signal\|thermal\|mechanical\|software)` |

**Notes:**
- `design_review` is the most complex server-side tool — fetches ALL project data (nodes, edges, BOM, validation issues, circuit designs, instances, nets, wires) and pre-computes 10+ metrics: isolated nodes, dangling edges, BOM completion, duplicates, voltage domain analysis, bus width consistency.
- `hardware_debug_analysis` fetches project context (nodes, BOM, validation issues, circuit data) and returns structured debugging guidance based on symptom category.
- `generate_test_plan` fetches full project state and generates prioritized test recommendations.
- `add_validation_issue` writes directly to DB via `storage.createValidationIssue()`.

### `project.ts` — 10 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `rename_project` | project | **server** | no | `name: string(1-200)` |
| `update_description` | project | **server** | no | `description: string` |
| `set_project_type` | project | client | no | `projectType: enum(iot\|wearable\|industrial\|automotive\|consumer\|medical\|rf\|power)` |
| `save_design_decision` | project | client | no | `decision, rationale` |
| `add_annotation` | project | client | no | `nodeLabel, note, color?: enum(yellow\|blue\|red\|green)` |
| `start_tutorial` | project | client | no | `topic: enum(getting_started\|power_design\|pcb_layout\|bom_management\|validation)` |
| `undo` | project | client | no | `{}` |
| `redo` | project | client | no | `{}` |
| `analyze_image` | project | client | no | `description: string` |
| `set_explain_mode` | project | client | no | `enabled: boolean` |

**Notes:**
- **[P2-PROJ-01]** Module JSDoc header says "9 total" but the file registers 10 tools (`set_explain_mode` is the unlisted one).
- `rename_project` and `update_description` are the only server-side tools, both calling `storage.updateProject()`.

### `circuit.ts` — 21 tools (3 registration functions)

#### `registerCircuitTools` — 10 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `create_circuit` | circuit | **server** | no | `name, description?` |
| `expand_architecture_to_circuit` | circuit | client | no | `circuitDesignId?` |
| `place_component` | circuit | client | no | `circuitDesignId, componentRef, x, y, properties?{}.passthrough()` |
| `remove_component_instance` | circuit | client | no | `instanceId` |
| `draw_net` | circuit | client | no | `circuitDesignId, name, pins[]{instanceId,pinName}` |
| `remove_net` | circuit | client | no | `netId` |
| `place_power_symbol` | circuit | client | no | `circuitDesignId, symbolType: enum(VCC\|GND\|3V3\|5V\|12V), x, y` |
| `place_no_connect` | circuit | client | no | `circuitDesignId, instanceId, pinName` |
| `add_net_label` | circuit | client | no | `netId, label` |
| `run_erc` | circuit | client | no | `circuitDesignId` |

#### `registerPcbTools` — 4 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `place_breadboard_wire` | circuit | client | no | `circuitDesignId, startX, startY, endX, endY, color?` |
| `remove_wire` | circuit | client | no | `wireId` |
| `draw_pcb_trace` | circuit | client | no | `circuitDesignId, netId, points[]{x,y}, width?, layer?` |
| `auto_route` | circuit | client | no | `circuitDesignId` |

#### `registerCircuitCodeTools` — 7 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `generate_circuit_code` | circuit | client | no | `prompt, circuitType?: enum` |
| `explain_circuit_code` | circuit | client | no | `code: string` |
| `auto_stitch_vias` | circuit | **server** | no | `circuitDesignId, layer?: string, gridSpacing?, viaDiameter?` |
| `generate_teardrops` | circuit | **server** | no | `circuitDesignId, padDiameter?` |
| `suggest_net_names` | circuit | **server** | no | `circuitDesignId` |
| `suggest_trace_path` | circuit | **server** | no | `circuitDesignId, netId` |
| `explain_net` | circuit | **server** | no | `circuitDesignId, netId` |

**Notes:**
- **[P0-CIRC-01]** `suggest_trace_path` is a **STUB** — returns hardcoded `[{x:50,y:50},{x:70,y:70}]` regardless of input. The execute function fetches real data but ignores it and returns placeholder coordinates.
- `auto_stitch_vias` has a real implementation: generates a grid of vias across the board area, uses point-in-polygon testing to avoid placing vias inside component outlines, creates PCB zones via `ctx.storage.createPcbZone()`.
- `generate_teardrops` has a real implementation: reads wires/vias/instances, calls `generateTeardropPoints()` from `teardrops-util.ts`, creates polygon PCB zones.
- `explain_net` has extensive classification logic with 20+ regex patterns (`POWER_NET_PATTERNS`, `GROUND_NET_PATTERNS`, `CLOCK_NET_PATTERNS`, etc.) and exports `classifyNet()`, `classifyInstanceRole()`, `buildNetExplanation()`.
- `COMPONENT_KEYWORDS` maps 18 component keywords (resistor, capacitor, led, etc.) to DSL builder function names.
- `create_circuit` is the only server-side tool in `registerCircuitTools` — calls `storage.createCircuitDesign()`.

### `component.ts` — 6 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `create_component_part` | component | **server** | no | `name, category, description, schematicShape?, connectors?[]` |
| `modify_component` | component | **server** | no | `partId, updates{}` |
| `delete_component_part` | component | **server** | no | `partId` |
| `fork_library_component` | component | client | no | `componentId, newName` |
| `validate_component` | component | client | no | `partId` |
| `suggest_components` | component | **server** | no | `{}` |

**Notes:**
- `suggest_components` is the most complex — fetches 6 data sources in parallel (project, nodes, edges, BOM, parts, circuits) and organizes components by category for gap analysis. Returns `ConfidenceScore`.
- `create_component_part` has detailed Zod schemas for connectors (name, x, y, side enum) and uses a union for schematic shape.
- `delete_component_part` does NOT have `requiresConfirmation: true` — this is a data deletion without confirmation guard (though component parts are typically less critical than BOM items or nodes).

### `export.ts` — 17 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `export_kicad` | export | **server** | no | `circuitDesignId?` |
| `export_eagle` | export | **server** | no | `circuitDesignId?` |
| `export_spice` | export | **server** | no | `circuitDesignId?` |
| `export_bom` | export | **server** | no | `format?: enum(csv\|json\|xlsx)` |
| `export_gerber` | export | **server** | no | `circuitDesignId?` |
| `export_drill` | export | **server** | no | `circuitDesignId?, format?: enum(excellon\|gerber)` |
| `export_pick_and_place` | export | **server** | no | `circuitDesignId?` |
| `export_netlist` | export | **server** | no | `circuitDesignId?` |
| `export_odb_plus_plus` | export | **server** | no | `circuitDesignId?` |
| `export_ipc2581` | export | **server** | no | `circuitDesignId?` |
| `export_design_report` | export | **server** | no | `{}` |
| `export_fmea` | export | **server** | no | `{}` |
| `export_firmware_scaffold` | export | **server** | no | `boardType?: enum` |
| `trigger_export` | export | **server** | no | `format: string` |
| `export_bom_to_google_sheet` | export | **server** | no | `spreadsheetTitle?` |
| `export_design_report_to_google_doc` | export | **server** | no | `documentTitle?` |
| `export_project_to_google_drive` | export | **server** | no | `folderName?` |

**Notes:**
- All 17 tools are server-side with real implementations calling actual export generators.
- 8 data mapper functions transform DB records to export-friendly shapes: `toBomItemData`, `toComponentPartData`, `toArchNodeData`, `toArchEdgeData`, `toCircuitInstanceData`, `toCircuitNetData`, `toCircuitWireData`, `toValidationIssueData`.
- `resolveCircuitId()` helper provides fallback circuit design resolution (parameter → first design → error).
- `fileExportResult()` wraps export content into a `download_file` typed `ToolResult`.
- `trigger_export` has a **manufacturing approval gate**: checks `project.approvedAt` before allowing manufacturing formats (gerber, drill, pick_and_place, odb_plus_plus, ipc2581).
- **[P1-EXP-01]** 3 Google Workspace tools use `err: any` in catch blocks — violates the project's `no-explicit-any` ESLint rule. Should use `err: unknown` with proper type narrowing.
- 3 Google Workspace tools require `ctx.googleWorkspaceToken` and return clear error messages if missing.
- `EXPORT_FORMATS` maps 15 format keys to `{ label, route, requiresCircuit?, requiresApproval? }`.

### `vision.ts` — 2 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `identify_component_from_image` | component | **server** | no | `imageDescription: string` |
| `extract_circuit_from_image` | circuit | **server** | no | `imageDescription: string, circuitType?: enum(schematic\|breadboard\|pcb\|block_diagram)` |

**Notes:**
- **[P2-VIS-01]** Both tools are "prompt generators" — they do NOT perform actual vision/image analysis. They return structured text prompts that the AI model should use to analyze an image. The actual vision capability depends on the AI model being multimodal.
- Both use `modelPreference: 'premium'` to route to the most capable (multimodal) model.
- Category mismatch: `identify_component_from_image` registers as `'component'`, `extract_circuit_from_image` as `'circuit'` — neither uses a `'vision'` category (which doesn't exist in `ToolCategory`).

### `generative.ts` — 2 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `generate_circuit_candidates` | circuit | **server** | no | `circuitType: enum(led\|driver\|voltage\|power\|sensor), count?: number(1-10), constraints?{}` |
| `explain_design_tradeoffs` | circuit | **server** | no | `candidates: string[]` |

**Notes:**
- Both have full server-side implementations.
- `generate_circuit_candidates` uses a seeded PRNG (`mulberry32`) for deterministic generation. Has component templates for 5 circuit types with randomized values (resistance, capacitance, etc.).
- `quickScore()` function evaluates candidates on component count (fewer=better), cost, and power heuristics.
- `explain_design_tradeoffs` generates plain-text comparison tables from candidate summary strings.
- Both register under category `'circuit'` (no `'generative'` category exists).

### `simulation.ts` — 5 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `run_dc_analysis` | simulation | client | no | `circuitDesignId` |
| `run_ac_analysis` | simulation | client | no | `circuitDesignId, startFreq, stopFreq, pointsPerDecade?` |
| `run_transient` | simulation | client | no | `circuitDesignId, duration, timestep?` |
| `get_sim_results` | simulation | **server** | no | `circuitDesignId` |
| `set_sim_parameters` | simulation | **server** | no | `circuitDesignId, parameters{temperature?,tolerance?,iterations?}` |

**Notes:**
- All 3 `run_*` tools perform server-side **validation** (circuit exists, has components, ownership check, parameter validation) before dispatching to the client.
- `run_ac_analysis` validates `startFreq < stopFreq`; `run_transient` validates `timestep < duration`.
- All simulation tools include ownership validation: `design.projectId !== ctx.projectId` check.
- `get_sim_results` fetches from `ctx.storage.getSimulationResults()`.
- `set_sim_parameters` writes via `ctx.storage.updateSimulationScenario()`.

### `manufacturing.ts` — 3 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `run_dfm_check` | validation | **server** | no | `fabProfile?: enum(JLCPCB\|PCBWay\|OSHPark\|Generic), circuitDesignId?` |
| `explain_dfm_violation` | validation | **server** | no | `violationType: string, description?: string` |
| `suggest_dfm_fix` | validation | **server** | no | `violationType: string, currentValue?: string, fabProfile?: enum` |

**Notes:**
- All 3 tools have full server-side implementations with extensive knowledge bases.
- `IPC_STANDARDS`: 15 entries mapping DFM rule IDs to IPC standard references.
- `VIOLATION_EXPLANATIONS`: 20 entries with explanation text, severity, and common causes.
- `VIOLATION_FIXES`: 20 entries with suggestion arrays and `autoFixable` flags.
- `SERVER_FAB_PRESETS`: 4 fab profiles (JLCPCB, PCBWay, OSHPark, Generic) with ~20 capability fields each (trace width, spacing, drill sizes, via specs, layer count, surface finishes, copper weights, board dimensions).
- `runServerDfmCheck()` performs real checks: BOM availability, trace width minimums, board dimensions, drill/via diameter minimums. Converts between mm and mil units.
- `explain_dfm_violation` supports both rule IDs (`DFM-001`) and rule names, with fuzzy matching fallback.
- `suggest_dfm_fix` provides fab-specific context (e.g., "For JLCPCB: minimum trace width is 3.5 mil") and generates auto-fix actions for 3 violation types (silkscreen width, surface finish, copper weight).
- **[P2-MFG-01]** IPC standard cross-reference in `explain_dfm_violation` is fragile — uses string splitting on " — " and partial substring matching. Could fail on edge cases.
- All 3 register under category `'validation'` (no `'manufacturing'` category exists).

### `testbench.ts` — 3 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `suggest_testbench` | simulation | **server** | no | `circuitDesignId` |
| `explain_test_point` | simulation | **server** | no | `circuitDesignId, netId` |
| `generate_test_sequence` | simulation | **server** | no | `circuitDesignId` |

**Notes:**
- All 3 have full server-side implementations with real analysis logic.
- Classification helpers: `POWER_PATTERNS`, `GROUND_PATTERNS`, `CLOCK_PATTERNS`, `BUS_PATTERNS` regex arrays for net/instance role classification.
- `suggest_testbench`: Classifies every net and instance by role, generates prioritized simulation recommendations (power integrity, signal integrity, thermal, timing).
- `explain_test_point`: Looks up specific net, classifies its role, provides human-readable explanation with measurement suggestions (probe type, expected values, common issues).
- `generate_test_sequence`: Creates ordered 5-phase test procedure (visual inspection → DC power-up → AC signal → transient → integration) with per-step instructions.
- All register under category `'simulation'` (no `'testbench'` category exists).

### `risk-analysis.ts` — 1 tool

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `analyze_build_risk` | bom | **server** | no | `{}` |

**Notes:**
- Full server-side implementation. Fetches BOM items and calculates risk scores across 3 categories:
  - **Cost risk**: Based on unit price thresholds ($50+ = high, $20+ = medium)
  - **Supply risk**: Based on stock status (Out of Stock = critical, Low Stock = high)
  - **Assembly risk**: Based on package detection (BGA = high, QFP = medium, THT = low)
- Exports `calculateBuildRiskScore()` as a reusable helper function.
- Returns overall risk level (low/medium/high/critical) with item-level breakdown.
- Registers under category `'bom'` (no `'risk-analysis'` category exists).

### `arduino.ts` — 5 tools

| Tool | Category | Execution | Confirmation | Key Parameters |
|------|----------|-----------|--------------|----------------|
| `generate_arduino_sketch` | arduino | client | no | `prompt, boardType?, libraries?[]` |
| `compile_sketch` | arduino | client | no | `workspaceId, boardFqbn` |
| `upload_firmware` | arduino | client | **yes** | `workspaceId, boardFqbn, port` |
| `search_arduino_libraries` | arduino | client | no | `query` |
| `list_arduino_boards` | arduino | client | no | `{}` |

**Notes:**
- All 5 are client-dispatched. No server-side logic.
- `upload_firmware` is correctly marked as destructive (`requiresConfirmation: true`) since flashing firmware is irreversible.
- These are the only tools in the `'arduino'` category.

---

## Cross-Cutting Analysis

### Tool Count Verification

| Module | File | Tools | Category Used |
|--------|------|-------|---------------|
| navigation | navigation.ts | 2 | navigation |
| architecture | architecture.ts | 22 | architecture |
| bom | bom.ts | 12 | bom |
| bom-optimization | bom-optimization.ts | 3 | bom |
| validation | validation.ts | 11 | validation |
| project | project.ts | 10 | project |
| circuit (core) | circuit.ts | 10 | circuit |
| circuit (pcb) | circuit.ts | 4 | circuit |
| circuit (code) | circuit.ts | 7 | circuit |
| component | component.ts | 6 | component |
| export | export.ts | 17 | export |
| vision | vision.ts | 2 | component, circuit |
| generative | generative.ts | 2 | circuit |
| simulation | simulation.ts | 5 | simulation |
| manufacturing | manufacturing.ts | 3 | validation |
| testbench | testbench.ts | 3 | simulation |
| risk-analysis | risk-analysis.ts | 1 | bom |
| arduino | arduino.ts | 5 | arduino |
| **TOTAL** | **16 modules** | **125** | **10 categories** |

**Documentation says 118. Actual count is 125. Delta: +7 tools.**

### Execution Pattern Distribution

| Pattern | Count | Percentage |
|---------|-------|------------|
| Server-side (real logic) | ~48 | 38.4% |
| Client-dispatched (via `clientAction`) | ~77 | 61.6% |
| **Destructive (requiresConfirmation)** | **6** | **4.8%** |

Destructive tools: `remove_node`, `remove_edge`, `clear_canvas`, `remove_bom_item`, `clear_validation`, `upload_firmware`.

### Category Distribution

| Category | Tool Count | Modules Contributing |
|----------|------------|---------------------|
| architecture | 22 | architecture |
| circuit | 23 | circuit, vision (1), generative (2) |
| bom | 16 | bom, bom-optimization, risk-analysis |
| validation | 14 | validation, manufacturing |
| export | 17 | export |
| project | 10 | project |
| component | 7 | component, vision (1) |
| simulation | 8 | simulation, testbench |
| navigation | 2 | navigation |
| arduino | 5 | arduino |

### Stubs and Incomplete Implementations

| Tool | Module | Issue | Severity |
|------|--------|-------|----------|
| `suggest_trace_path` | circuit.ts | Returns hardcoded `[{x:50,y:50},{x:70,y:70}]` — completely non-functional | **P0** |

### Error Handling Patterns

- **Consistent**: All server-side tools that fetch data check for existence (e.g., "No circuit designs found", "BOM item not found") and return `{ success: false, message: "..." }`.
- **Project ownership**: Simulation tools validate `design.projectId !== ctx.projectId`. Export tools use `resolveCircuitId()` which performs the same check. Architecture/BOM tools rely on `ctx.projectId` scoping.
- **Zod validation**: Handled by `ToolRegistry.validate()` before `execute()` is called. All tools have Zod schemas.
- **[P1-EXP-01]** Export tools use `err: any` in catch blocks (3 Google Workspace tools). Should use `err: unknown`.

### Type Safety Assessment

| Concern | Details | Severity |
|---------|---------|----------|
| `update_bom_item` fields | All fields typed as `z.unknown().optional()` — no value validation | P1 |
| `err: any` in exports | 3 catch blocks use untyped error variable | P1 |
| `ToolCategory` incompleteness | 10 categories for 16 modules — not a bug but a design gap | P1 |
| `.passthrough()` on Zod objects | Used in `set_pin_map`, `parametric_search`, `update_bom_item`, `place_component` — allows arbitrary extra fields | P3 |

### Naming Consistency

Tool names follow a consistent `verb_noun` pattern throughout. Observations:

- **Consistent prefixes**: `export_*` (17), `run_*` (4), `query_*` (3), `add_*` (4), `remove_*` (4), `suggest_*` (4), `generate_*` (4), `explain_*` (3)
- **Inconsistent**: `trigger_export` vs `export_*` pattern — `trigger_export` is a meta-tool that dispatches to other export formats.
- **Category word in name**: Some tools repeat category context (e.g., `add_bom_item` in category `bom`), while others don't (e.g., `pricing_lookup` in category `bom`). This is minor but inconsistent.
- All tool names use snake_case — consistent.

### Security Concerns

| Concern | Location | Assessment |
|---------|----------|------------|
| Destructive tool confirmation | `registry.ts:execute()` | **Good** — server-side enforcement, not just client UI |
| Project scoping | All server-side tools | **Good** — `ctx.projectId` used consistently |
| Ownership validation | simulation.ts, export.ts | **Good** — explicit `design.projectId !== ctx.projectId` checks |
| Manufacturing approval gate | export.ts `trigger_export` | **Good** — checks `project.approvedAt` before manufacturing exports |
| Google Workspace token | export.ts | **Good** — checks for token before API calls |
| `.passthrough()` on schemas | 4 tools | **Low risk** — allows extra fields but they're ignored by tool logic |
| `delete_component_part` | component.ts | **Observation** — deletes data without `requiresConfirmation` |

### Test Coverage

Only 3 test files exist in `server/ai-tools/__tests__/`:

| Test File | Module Covered |
|-----------|----------------|
| `bom-optimization.test.ts` | bom-optimization.ts |
| `manufacturing.test.ts` | manufacturing.ts |
| `testbench.test.ts` | testbench.ts |

**13 of 16 tool modules have NO dedicated unit tests.** The 3 tested modules are all server-side heavy with real logic. Client-dispatched tools are implicitly tested through integration/E2E tests, but the server-side tools in `architecture.ts`, `bom.ts`, `circuit.ts`, `component.ts`, `export.ts`, `validation.ts`, `generative.ts`, `simulation.ts`, `risk-analysis.ts`, `vision.ts`, `project.ts`, `navigation.ts`, and `registry.ts` lack unit test coverage.

---

## Findings & Recommendations

### P0 — Critical

| ID | Finding | Recommendation |
|----|---------|----------------|
| P0-CIRC-01 | `suggest_trace_path` returns hardcoded stub `[{x:50,y:50},{x:70,y:70}]` | Implement real pathfinding (A* or maze router integration from `maze-router.ts`) or remove tool from registry and mark as unimplemented |

### P1 — High

| ID | Finding | Recommendation |
|----|---------|----------------|
| P1-BOM-01 | `update_bom_item` uses `z.unknown().optional()` for all update fields | Replace with specific Zod types matching BOM schema: `manufacturer: z.string()`, `quantity: z.number().int().positive()`, etc. |
| P1-EXP-01 | 3 Google Workspace export tools use `err: any` in catch blocks | Change to `err: unknown` with `err instanceof Error ? err.message : String(err)` pattern |
| P1-TYPE-01 | `ToolCategory` has 10 values but 16 modules exist — categories don't map to modules | Either expand `ToolCategory` to include `vision`, `manufacturing`, `testbench`, `generative`, `bom-optimization`, `risk-analysis` OR document that categories are intentionally coarser than modules |
| P1-DOC-01 | Documentation claims "118 AI tools" but actual count is 125 | Update AGENTS.md, project-dna.md, and any other docs referencing tool count |

### P2 — Medium

| ID | Finding | Recommendation |
|----|---------|----------------|
| P2-VIS-01 | Vision tools return prompt text, not actual vision results | Document clearly that these are "prompt helpers" for multimodal models, not standalone vision tools |
| P2-MFG-01 | IPC standard cross-reference uses fragile string splitting | Refactor to use a direct `ruleId → violationKey` mapping instead of substring matching |
| P2-PROJ-01 | project.ts JSDoc says "9 total" but has 10 tools | Update JSDoc header to reflect actual count |
| P2-ARCH-01 | `set_pin_map` hardcodes 9 pin names in Zod schema with `.passthrough()` | The hardcoded names add no validation value since values are all `z.string().optional()` — simplify to `z.record(z.string())` |
| P2-NAV-01 | `switch_view` enum has 6 values but app has 15+ ViewModes | Add missing ViewModes to the enum or use `z.string()` |

### P3 — Low

| ID | Finding | Recommendation |
|----|---------|----------------|
| P3-CMP-01 | `delete_component_part` lacks `requiresConfirmation` | Consider adding confirmation since it permanently deletes data |
| P3-FIX-01 | `suggest_dfm_fix` auto-fix actions create validation issues rather than applying actual fixes | This is reasonable behavior (suggest rather than auto-apply) but the `autoFixable` flag is misleading |
| P3-TST-01 | 13/16 tool modules have no dedicated unit tests | Add tests for server-side tools, especially `export.ts` (17 tools), `architecture.ts` (3 server-side), and `circuit.ts` (5 server-side with real logic) |

### Coverage Gaps

Tools/capabilities that exist elsewhere in the app but have no AI tools:

| Gap | Context |
|-----|---------|
| **Collaboration** | WebSocket rooms, CRDT, live cursors exist (`server/collaboration.ts`) but no AI tools for inviting collaborators, checking who's online, etc. |
| **Design history / snapshots** | DB schema has `design_snapshots`, `bom_snapshots` tables but no AI tools for browsing or restoring snapshots |
| **PCB ordering** | PCB order routes exist (`server/routes/ordering.ts`) but no AI tool to check order status or initiate orders |
| **Keyboard shortcuts** | Shortcut system exists but no AI tool to list or customize shortcuts |
| **Standards compliance** | `standards-compliance.ts` library exists but no AI tool wrapper |
| **Assembly cost estimation** | `assembly-cost-estimator.ts` exists but no AI tool wrapper |
| **Thermal / PDN analysis** | Server-side engines exist but AI tools dispatch to client |
| **Differential pair routing** | Full engine exists (`diff-pair-router.ts`) but no AI tool to configure or trigger it |

---

## Appendix: File Size Summary

| File | Lines | Tools | Lines/Tool |
|------|-------|-------|------------|
| circuit.ts | 1470 | 21 | 70 |
| export.ts | 1107 | 17 | 65 |
| manufacturing.ts | 1062 | 3 | 354 |
| validation.ts | 674 | 11 | 61 |
| bom-optimization.ts | 665 | 3 | 222 |
| testbench.ts | 578 | 3 | 193 |
| architecture.ts | 472 | 22 | 21 |
| bom.ts | 450 | 12 | 38 |
| component.ts | 397 | 6 | 66 |
| generative.ts | 365 | 2 | 183 |
| simulation.ts | 317 | 5 | 63 |
| project.ts | 242 | 10 | 24 |
| registry.ts | 183 | — | — |
| vision.ts | 178 | 2 | 89 |
| types.ts | 136 | — | — |
| risk-analysis.ts | 115 | 1 | 115 |
| arduino.ts | 94 | 5 | 19 |
| index.ts | 63 | — | — |
| navigation.ts | 62 | 2 | 31 |
| teardrops-util.ts | 42 | — | — |
| **Total** | **~8672** | **125** | **avg 69** |

High lines/tool ratios (manufacturing 354, bom-optimization 222, testbench 193, generative 183) indicate modules with substantial built-in knowledge bases and analysis logic. Low ratios (arduino 19, architecture 21, project 24) indicate modules dominated by thin client-dispatch wrappers.
