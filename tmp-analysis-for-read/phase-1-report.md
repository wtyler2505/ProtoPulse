# Phase 1: Current State Inventory -- ProtoPulse

> Generated: 2026-02-28 | Refined: 2026-02-28 (cross-phase integration)

## Executive Summary

ProtoPulse is a browser-based AI-assisted EDA (Electronic Design Automation) platform with 250 TypeScript source files totaling 57,265 LOC across client (39,163 LOC) and server (18,750 LOC). It features 10 workspace views, 115 REST API endpoints, 78 AI-callable tools, 17 database tables, 12 export generators, a dual AI provider system (Anthropic + Gemini), and a SPICE simulation engine. The platform is substantially built but has notable gaps in real-time collaboration, multi-project support, and actual hardware integration (e.g., live stock checking, ECAD import).

### Key Cross-Phase Findings (integrated from Phases 2-5)

- **12 god files >1000 lines** resist safe modification — features in these files carry compounding risk (see God File Map below)
- **ai-tools.ts** (1,677 LOC) is the second-largest file in the codebase — adding more AI tools here is impractical. See TD-09.
- **parseLocalIntent.ts** has CCN=102 — the local AI mode feature has extreme complexity for its size (294 lines)
- **ShapeCanvas.tsx** has aggregate CCN=381 across 6 functions >CCN 20 — the highest complexity component in the codebase
- **Dual export system** has active overlap — monolith serves AI tools, modular system serves circuit routes
- **ProjectProvider** has been split into 8 domain contexts, but the architecture-context alone exposes 27+ state values with 6 useState hooks — re-render storms persist within domains. See TD-07.
- **ALL procurement data is AI-simulated** — zero real supplier APIs integrated, making the procurement tab a demonstration feature only. See EN-13 recalibration.

---

## Feature Inventory

### Architecture / Block Diagram Editor

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Node-based block diagram editor | **Mature** | `client/src/components/views/ArchitectureView.tsx`, `@xyflow/react` with ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, useReactFlow, useViewport | Full xyflow integration with custom node types, minimap, controls |
| Custom node rendering | **Functional** | `client/src/components/views/CustomNode.tsx` | Custom block diagram nodes with Handle/Position |
| Edge connections with metadata | **Functional** | `shared/schema.ts:51-68` - signalType, voltage, busWidth, netName fields | Rich edge metadata for signal characterization |
| Auto-layout algorithms | **Functional** | AI tool `auto_layout` supports hierarchical, grid, circular, force layouts | AI-driven, not a native graph layout engine |
| Architecture-to-circuit expansion | **Functional** | AI tool `expand_architecture_to_circuit` | Bridges block diagram to schematic |
| Subcircuit templates | **Functional** | AI tool `add_subcircuit`, `SUBCIRCUIT_TEMPLATES` in `useActionExecutor.ts:1299 LOC` | Template-based circuit insertion. **Note: useActionExecutor is a god file (1,299 LOC)** |
| Clipboard (copy JSON/summary) | **Functional** | AI tools `copy_architecture_json`, `copy_architecture_summary` | AI-mediated clipboard, not native Ctrl+C |

### Schematic Capture (Phase 10)

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Schematic canvas with React Flow | **Functional** | `client/src/components/circuit-editor/SchematicCanvas.tsx`, `SchematicView.tsx` | Full schematic editor with custom nodes |
| Component instance placement | **Functional** | `ComponentPlacer.tsx`, `SchematicInstanceNode.tsx` | Drag-and-place components |
| Net drawing tool | **Functional** | `NetDrawingTool.tsx`, `SchematicNetEdge.tsx` | Wire/net drawing with custom edge rendering |
| Power symbol palette | **Functional** | `PowerSymbolPalette.tsx`, `SchematicPowerNode.tsx` | VCC, GND, etc. |
| Net labels | **Functional** | `SchematicNetLabelNode.tsx`, AI tool `add_net_label` | Named net labels |
| No-connect markers | **Functional** | `SchematicNoConnectNode.tsx`, AI tool `place_no_connect` | X markers for unconnected pins |
| Multi-sheet schematic | **Functional** | AI tools `create_sheet`, `rename_sheet`, `move_to_sheet`, `switch_schematic_sheet` | Sheet management via AI |
| Hierarchical sheets | **Partial** | `HierarchicalSheetPanel.tsx` | UI exists but limited to panel view |
| ERC (Electrical Rules Check) | **Functional** | `ERCPanel.tsx`, `ERCOverlay.tsx`, `erc-engine.ts` (client), AI tool `run_erc` | Client-side ERC engine with overlay visualization |
| Wire routing engine | **Functional** | `client/src/lib/circuit-editor/wire-router.ts` | Automated wire routing |
| Schematic toolbar | **Functional** | `SchematicToolbar.tsx`, `ToolButton.tsx` | Tool selection UI |

### Breadboard View

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Virtual breadboard | **Functional** | `client/src/components/circuit-editor/BreadboardView.tsx` | Breadboard wiring visualization |
| Breadboard model | **Functional** | `client/src/lib/circuit-editor/breadboard-model.ts` | Bus strip logic, row/column mapping |
| Breadboard wire placement | **Functional** | AI tool `place_breadboard_wire` | AI-assisted wiring |

### PCB Layout View

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| PCB layout editor | **Partial** | `client/src/components/circuit-editor/PCBLayoutView.tsx` | Component placement with front/back sides. **Phase 4: CCN=135 — 9x danger threshold. Blocks all PCB feature development.** |
| PCB trace drawing | **Partial** | AI tool `draw_pcb_trace` | AI-driven, no manual interactive routing |
| Auto-route | **Stub** | AI tool `auto_route` | Tool registered but actual autorouter TBD |

### Component Editor (Custom Part Design)

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Shape canvas with SVG rendering | **Functional but fragile** | `ShapeCanvas.tsx` (1,275 LOC), snap guides, ruler overlay, shape templates | Full visual editor with DRC overlays. **Phase 4: aggregate CCN=381, 6 functions >CCN 20 — highest complexity component in codebase. God file.** |
| Pin table editor | **Functional** | `PinTable.tsx` | Pin number, name, type, side editing |
| Component inspector | **Functional** | `ComponentInspector.tsx` | Metadata and property editing |
| DRC panel (component-level) | **Functional** | `DRCPanel.tsx`, `client/src/lib/component-editor/drc.ts` | Component-level design rule checks |
| Snap engine | **Functional** | `snap-engine.ts` with test coverage | Grid/object snapping |
| Constraint solver | **Functional** | `constraint-solver.ts`, `constraint-inference.ts` with tests | Geometric constraint system |
| Diff engine (version comparison) | **Functional** | `diff-engine.ts`, `DiffPreview.tsx` with tests | Visual diff between part versions |
| Shape templates | **Functional** | `shape-templates.ts` — `SHAPE_TEMPLATES` array | Pre-built shapes for rapid design |
| AI-powered part generation | **Functional** | `GeneratorModal.tsx`, `server/component-ai.ts:generatePartFromDescription` | Generate parts from text description |
| AI-powered part modification | **Functional** | `ModifyModal.tsx`, `server/component-ai.ts:modifyPartWithAI` | AI modifies existing parts |
| Datasheet extraction | **Functional** | `DatasheetExtractModal.tsx`, `server/component-ai.ts:extractMetadataFromDatasheet` | Extract specs from datasheet text |
| Pin extraction from photo | **Functional** | `PinExtractModal.tsx`, `server/component-ai.ts:extractPinsFromPhoto` | Vision-based pin extraction |
| Component validation | **Functional** | `ValidationModal.tsx`, `validation.ts`, AI tool `validate_component` | Part-level validation |
| Layer panel | **Functional** | `LayerPanel.tsx` | View layer management |
| History panel (undo/redo) | **Functional** | `HistoryPanel.tsx` | Component edit history |
| Ruler overlay / measurement | **Functional** | `RulerOverlay.tsx` | Distance measurement tool |

### Component Library

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Library browser | **Functional** | `ComponentLibraryBrowser.tsx` | Search, filter, browse library |
| Library CRUD | **Functional** | Routes: `GET/POST /api/component-library`, `DELETE /api/component-library/:id` | Full server-side library management |
| Fork from library | **Functional** | `POST /api/component-library/:id/fork`, AI tool `fork_library_component` | Fork components into project |
| Component export (FZPZ) | **Functional** | `server/component-export.ts:exportToFzpz` | Fritzing-compatible export |
| Component import (FZPZ) | **Functional** | `server/component-export.ts:importFromFzpz` via JSZip | Import Fritzing parts |
| SVG to shapes parser | **Functional** | `server/svg-parser.ts:parseSvgToShapes` (572 LOC) | Import SVG artwork as component shapes |

### Bill of Materials (BOM) / Procurement

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| BOM table with CRUD | **Mature** | `ProcurementView.tsx` — add, edit, delete, search, inline editing | Full inline-edit workflow |
| Drag-and-drop BOM reorder | **Functional** | `@dnd-kit/sortable` integration in ProcurementView | Persistent sort order via localStorage |
| BOM CSV export | **Functional** | Client-side `handleExportCSV` + server `generateGenericBomCsv` | Direct download |
| Supplier-specific BOM export | **Functional** | `generateJlcpcbBom`, `generateMouserBom`, `generateDigikeyBom` | JLCPCB, Mouser, Digi-Key formats |
| BOM cost optimization | **Functional** | Settings panel: batch size, max cost target, in-stock filter, preferred suppliers | UI-side settings, AI `optimize_bom` tool |
| BOM settings persistence | **Functional** | localStorage with `STORAGE_KEYS` constants | Persists across sessions |
| Pricing lookup | **AI-simulated only** | AI tool `pricing_lookup` — AI-generated, not live API | **No real supplier API integration — ALL data is fabricated by AI. See EN-13 P0 recalibration.** |
| Alternative suggestion | **AI-simulated only** | AI tool `suggest_alternatives` — AI-generated | **No real cross-reference DB — alternatives are hallucinated** |
| Lead time checking | **AI-simulated only** | AI tool `check_lead_times` — AI-generated | **No real supplier API — lead times are fictional** |

### Validation / Design Rule Checking

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Validation issue management | **Functional** | `ValidationView.tsx` — severity filters, search, issue list | Error/warning/info categories |
| DRC engine (shared) | **Functional** | `shared/drc-engine.ts` (424 LOC) — `runDRC`, `getDefaultDRCRules` | Shared client/server DRC engine |
| DRC gate for exports | **Functional** | `server/export/drc-gate.ts` with tests | Block exports on DRC failures |
| Power budget analysis | **Partial** | AI tool `power_budget_analysis` | AI-computed, no circuit simulation |
| Voltage domain check | **Partial** | AI tool `voltage_domain_check` | AI-computed |
| DFM check | **Partial** | AI tool `dfm_check` | AI-computed |
| Thermal analysis | **Partial** | AI tool `thermal_analysis` | AI-computed |
| Auto-fix validation | **Partial** | AI tool `auto_fix_validation` | AI suggests fixes |

### Simulation (Phase 13)

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| SPICE netlist generation | **Functional** | `client/src/lib/simulation/spice-generator.ts` (607 LOC) + `server/export/spice-exporter.ts` | Client and server-side SPICE generation |
| Circuit solver (DC/AC/transient) | **Functional** | `client/src/lib/simulation/circuit-solver.ts` (666 LOC) | Browser-side MNA solver |
| Waveform viewer | **Functional** | `client/src/components/simulation/WaveformViewer.tsx` (1,453 LOC) | Visualization of simulation results. **God file — highest LOC in client.** |
| Probe overlay | **Functional** | `client/src/components/simulation/ProbeOverlay.tsx` | Click-to-probe on schematic |
| Simulation panel | **Functional** | `SimulationPanel.tsx` (938 LOC) | Full simulation control UI. Near god-file territory. |
| Server-side simulation engine | **Functional** | `server/simulation.ts` (705 LOC) | Server-side SPICE simulation |
| Simulation results persistence | **Functional** | DB table `simulation_results`, storage methods | Results stored with circuit ID |

### Export System (Phase 6)

The export system exists as **two parallel implementations** with active overlap:

**Monolith (`server/export-generators.ts`, 1,209 LOC)** — consumed by `ai-tools.ts` for AI tool execution:
- `generateGenericBomCsv`, `generateJlcpcbBom`, `generateMouserBom`, `generateDigikeyBom`
- `generateKicadSch`, `generateKicadNetlist`
- `generateSpiceNetlist`, `generateCsvNetlist`
- `generateGerber`, `generatePickAndPlace`, `generateEagleSch`
- `generateDesignReportMd`

**Modular system (`server/export/`, 11 files, ~3,200 LOC total)** — consumed by `circuit-routes.ts` for REST endpoints:
- `gerber-generator.ts` (1,085 LOC) — `generateGerber` + per-layer functions
- `kicad-exporter.ts` (1,247 LOC) — schematic + PCB + project bundle
- `eagle-exporter.ts` (1,150 LOC) — schematic + board + project bundle
- `spice-exporter.ts` — `exportSpiceNetlist`
- `netlist-generator.ts` — SPICE, KiCad, CSV netlists
- `bom-exporter.ts` — JLCPCB, Mouser, Digi-Key, generic BOM
- `pick-place-generator.ts`, `drill-generator.ts`, `pdf-generator.ts`, `drc-gate.ts`, `fzz-handler.ts`

**Overlap**: BOM, Gerber, KiCad, Eagle, SPICE, CSV netlist, and pick-and-place generators exist in BOTH systems with different function signatures and implementations. The modular versions are more complete (e.g., modular KiCad adds PCB + project file, modular Eagle adds board file). The monolith is NOT dead code — it is actively imported by `ai-tools.ts`. This directly feeds TD-10 (complete the decomposition).

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Gerber export | **Functional** | Both systems | Modular version more complete (per-layer functions) |
| KiCad schematic export | **Functional** | Both systems | Modular adds PCB + project bundle |
| KiCad netlist export | **Functional** | Both systems | Available in both monolith and modular |
| Eagle schematic export | **Functional** | Both systems | Modular adds board + project bundle |
| SPICE netlist export | **Functional** | Both systems | Different implementations |
| CSV netlist export | **Functional** | Both systems | Available in both |
| Pick-and-place export | **Functional** | Both systems | Available in both |
| Drill file generation | **Functional** | Modular only | `server/export/drill-generator.ts` |
| Design report (Markdown) | **Functional** | Monolith only | `generateDesignReportMd` |
| PDF generation | **Partial** | Modular only | `server/export/pdf-generator.ts` |
| Fritzing project export | **Functional** | Separate (`component-export.ts`) | AI tool `export_fritzing_project` |
| Gerber preview | **Partial** | AI tool `preview_gerber` | Generates preview, not full Gerber viewer |

### AI Chat System

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Streaming AI chat (SSE) | **Mature** | `server/routes.ts:1193` — `/api/chat/ai/stream`, `server/ai.ts` 1083 LOC | Full SSE streaming with tool use loop |
| Non-streaming AI chat | **Functional** | `server/routes.ts:1137` — `/api/chat/ai` | Fallback non-stream endpoint |
| Dual AI provider (Anthropic + Gemini) | **Mature** | `server/ai.ts` — `callAnthropic`, `getGeminiClient`, LRU client cache | Claude + Gemini with LRU caching |
| Multi-model routing | **Functional** | `routeToModel` in ai.ts — user/auto/quality/speed/cost strategies | 5 routing strategies, 3 model tiers per provider |
| 78 registered AI tools | **Mature** | `server/ai-tools.ts` (1,677 LOC) — `ToolRegistry` with Zod validation | Architecture, circuit, component, BOM, validation, export, project, navigation. **Second-largest file in codebase — adding more tools is impractical (TD-09).** |
| Native tool use (Anthropic) | **Functional** | `toAnthropicTools()` converter, multi-turn tool loop (max 10 turns) | Anthropic function calling |
| Gemini function declarations | **Functional** | `GeminiFunctionDeclaration` format converter | Gemini native function calling |
| Action executor (client-side) | **Mature** | `useActionExecutor.ts` (1,299 LOC) — 48+ case handlers | Client dispatches AI actions to contexts. **God file — monolithic switch statement.** |
| Local intent parsing | **Stub/Fragile** | `parseLocalIntent.ts` (294 LOC, CCN=102) | **Phase 4: extreme cyclomatic complexity. 102 CCN in 294 lines = nearly every line is a branch. Organic growth without architectural planning. Local AI mode is a key feature locked behind an unmaintainable parser.** |
| Multimodal (image analysis) | **Functional** | `ImageContent` in ai.ts, `analyze_image` action | Base64 image upload + vision |
| Chat settings (per-user) | **Functional** | `userChatSettings` DB table, `useChatSettings.ts` hook, server endpoints | Provider, model, temperature, custom system prompt, routing strategy |
| Quick actions bar | **Functional** | `QuickActionsBar.tsx` | Pre-built action shortcuts |
| Follow-up suggestions | **Functional** | `FollowUpSuggestions.tsx` | Contextual follow-up prompts |
| Action accept/reject UI | **Functional** | `pendingActions`, `onAcceptActions`, `onRejectActions` in MessageBubble | User confirms AI actions before execution |
| Chat search | **Functional** | `ChatSearchBar.tsx` | Search through chat history |
| Streaming indicator | **Functional** | `StreamingIndicator.tsx` with cancel | Real-time generation indicator |
| Token info display | **Functional** | `tokenInfo` prop in MessageBubble | Token usage transparency |
| AI action logging | **Functional** | `aiActions` DB table, `POST /api/ai-actions`, `GET /api/ai-actions/by-message/:id` | Persistent action audit trail |
| Error categorization | **Functional** | `categorizeError` in ai.ts — AUTH_FAILED, RATE_LIMITED, TIMEOUT, MODEL_ERROR, etc. | User-friendly error messages |
| Secret redaction | **Functional** | `redactSecrets` in ai.ts | Strips API keys from error messages |
| Prompt caching (LRU) | **Functional** | `promptCache` LRU in ai.ts | Per-session cached system prompts |
| Request deduplication | **Functional** | `activeRequests` Map in ai.ts | Prevents duplicate concurrent requests |

### Circuit AI (Phase 10+)

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| AI circuit generation | **Functional** | `POST /api/circuits/:id/ai/generate` in circuit-ai.ts | Generate circuits from description |
| AI circuit review | **Functional** | `POST /api/circuits/:id/ai/review` | AI reviews existing circuits |
| AI circuit analysis | **Functional** | `POST /api/circuits/:id/ai/analyze` | Analyze circuit characteristics |
| AI datasheet search | **Functional** | AI tool `search_datasheet` | Find datasheets for components |

### Authentication & Authorization

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| User registration | **Functional** | `POST /api/auth/register`, scrypt password hashing | Username + password |
| User login | **Functional** | `POST /api/auth/login`, session creation | Session-based auth |
| Session management | **Functional** | `X-Session-Id` header, 7-day expiry, `validateSession` | Header-based sessions (not cookies) |
| API key encryption | **Functional** | AES-256-GCM encryption in `auth.ts` | Secure storage of provider API keys |
| API key management | **Functional** | `GET/POST/DELETE /api/settings/api-keys` | Per-user AI provider key management |
| Rate limiting | **Functional** | `express-rate-limit` in `server/index.ts` | API rate limiting middleware |

### Project Management

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Project CRUD | **Functional** | Full REST: `GET/POST/PATCH/DELETE /api/projects` | Create, read, update, soft-delete |
| Project settings panel | **Functional** | `ProjectSettingsPanel.tsx` in sidebar | Name, description editing |
| History tracking | **Functional** | `history_items` table, `HistoryList.tsx` | Action audit trail |
| Component tree | **Functional** | `ComponentTree.tsx` in sidebar | Hierarchical node navigation |
| Asset manager | **Functional** | `AssetManager.tsx` (238 LOC) with `AssetGrid.tsx`, `AssetSearch.tsx` | Drag-to-canvas component picker |
| Seed data | **Functional** | `POST /api/seed` endpoint | Demo project seeding |

### Output / Logging

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Output view | **Functional** | `OutputView.tsx` | Build logs and system messages |
| Output context (client-side) | **Functional** | `output-context.tsx` — `OutputLogEntry` array | In-memory log accumulation |

### UI Infrastructure

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| 40+ shadcn/ui primitives | **Mature** | `client/src/components/ui/` — 59 files, 5485 LOC | Full design system |
| Dark theme | **Mature** | `next-themes` + ThemeToggle, Tailwind v4 dark mode | System/dark/light toggle |
| Keyboard shortcuts | **Functional** | `KeyboardShortcutsModal.tsx`, shortcuts in ArchitectureView, SchematicCanvas, ComponentEditorView, ChatPanel | Ctrl+Z, Ctrl+Y, Delete, etc. |
| Resizable panels | **Functional** | Sidebar + ChatPanel with ResizeHandle, width persistence | Drag-to-resize, collapse/expand |
| Scrollable tab bar | **Functional** | `ScrollableTabBar` in ProjectWorkspace with fade gradients | Overflow handling for many tabs |
| Toast notifications | **Functional** | `use-toast.ts` hook + toast UI | User feedback system |
| Styled tooltips | **Functional** | `StyledTooltip` component | Consistent tooltip styling |
| Responsive layout | **Partial** | Flex-based 3-panel layout, `use-mobile.tsx` hook | Basic responsive but optimized for desktop |
| Markdown rendering | **Functional** | `react-markdown` + `remark-gfm` in MessageBubble | AI response rendering |

### Server Infrastructure

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Express 5 with middleware stack | **Mature** | `server/index.ts` — helmet, compression, rate limit, JSON/URL parsing, CORS, error handler | Production-ready middleware |
| PostgreSQL with Drizzle ORM | **Mature** | 17 tables in `shared/schema.ts`, full CRUD in `storage.ts` | Comprehensive data layer |
| In-memory cache layer | **Functional** | `server/cache.ts` (52 LOC), prefix-based invalidation | Simple but effective |
| LRU client cache | **Functional** | `server/lib/lru-cache.ts` | For AI provider clients |
| Request metrics | **Functional** | `server/metrics.ts` — `recordRequest`, `getMetrics` | Basic request tracking |
| Structured logging | **Functional** | `server/logger.ts` (40 LOC) | Centralized logging |
| Payload size limits | **Functional** | `payloadLimit` helper in routes.ts, per-route limits | DoS protection |
| Static file serving | **Functional** | `server/static.ts` — `serveStatic` | SPA fallback |
| API documentation | **Functional** | `server/api-docs.ts`, `GET /api/docs` | Self-documenting API |
| Health check | **Functional** | `GET /api/health` | Uptime monitoring |
| Admin purge | **Functional** | `DELETE /api/admin/purge` | Data cleanup |
| Vite dev middleware | **Functional** | `server/vite.ts` | HMR integration in development |

### Missing / Not Implemented

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Real-time collaboration | **Missing** | No WebSocket/CRDT implementation found | Single-user only |
| Multi-project support | **Missing** | `PROJECT_ID = 1` hardcoded in client context | Known tech debt per CLAUDE.md |
| Real supplier API integration | **Missing** | AI tools simulate pricing/stock/lead times | No Octopart, Mouser, Digi-Key APIs |
| ECAD file import (KiCad, Eagle) | **Missing** | Only exports exist, no import parsers for KiCad/Eagle | FZPZ import only |
| Version control / branching | **Missing** | No git-like design versioning | Single linear history |
| PCB autorouter | **Stub** | AI tool `auto_route` registered but no actual routing engine | Would need Freerouter or custom implementation |
| Net-aware PCB DRC | **Missing** | DRC exists for components but not PCB-level net clearance | Component DRC only |
| Parametric component search | **Partial** | AI tool `parametric_search` but AI-generated, no real parametric DB | Would need Octopart/Nexar API |
| IBIS/SPICE model import | **Missing** | SPICE generation exists but no model file import | Browser simulation only |
| Undo/redo stack (native) | **Partial** | AI tools `undo`/`redo` exist but actual stack is view-dependent | Not a unified undo system |
| PWA / offline support | **Missing** | No service worker, no manifest | Online-only |
| i18n / localization | **Missing** | All strings hardcoded in English | English only |

---

## God File Map

Phase 4 identified 12 files exceeding 1,000 lines. This table maps which features live in these oversized files:

| File | LOC | Features Hosted | Risk Level |
|------|-----|-----------------|------------|
| `server/circuit-routes.ts` | 1,757 | 46 circuit REST endpoints, Gerber/Eagle export triggers, simulation endpoints | HIGH — most routes, highest LOC |
| `server/ai-tools.ts` | 1,677 | All 78 AI tool definitions + Zod schemas + execution logic | HIGH — adding tools is impractical (TD-09) |
| `WaveformViewer.tsx` | 1,453 | All simulation visualization, waveform rendering, probe display | MEDIUM — specialized, low churn |
| `server/routes.ts` | 1,329 | 69 core REST endpoints (projects, BOM, validation, chat, auth, settings) | HIGH — most-changed server file |
| `useActionExecutor.ts` | 1,299 | All 48+ AI action type handlers, subcircuit templates | HIGH — monolithic switch, error handling inconsistent |
| `ShapeCanvas.tsx` | 1,275 | SVG shape rendering, snap guides, DRC overlays, ruler, shape editing | CRITICAL — CCN=381 aggregate, 6 functions >20 |
| `kicad-exporter.ts` | 1,247 | KiCad schematic + PCB + project file generation | MEDIUM — specialized export |
| `export-generators.ts` | 1,209 | 12 legacy export generators (BOM, KiCad, Gerber, Eagle, SPICE, CSV, etc.) | HIGH — dead-walking monolith, still imported by ai-tools |
| `eagle-exporter.ts` | 1,150 | Eagle schematic + board + project generation | MEDIUM — specialized export |
| `gerber-generator.ts` | 1,085 | Gerber layer generation (copper, silkscreen, soldermask, paste, outline) | MEDIUM — specialized export |
| `server/ai.ts` | 1,083 | AI provider integration, streaming, prompt building, tool loop | HIGH — critical path, O(n) prompt scaling |
| `server/storage.ts` | 1,062 | All database CRUD operations, cache layer | MEDIUM — stable but large |

---

## Data Flow Map

```
User Interaction
       |
       v
+------------------+
| React Components |  (views, panels, sidebar)
| ArchitectureView |
| SchematicView    |
| ProcurementView  |
| ChatPanel        |
+------------------+
       |
       v
+------------------+     +-----------------------+
| React Contexts   | <-> | TanStack React Query  |
| architecture-ctx |     | QueryClient           |
|   (365 LOC,      |     | Mutations + Cache     |
|    6 useState,    |     +-----------------------+
|    27+ values)    |             |
| bom-context      |             v
| chat-context     |     +-----------------------+
| validation-ctx   |     | apiRequest()          |
| history-context  |     | fetch() to /api/*     |
| project-meta-ctx |     +-----------------------+
| output-context   |
+------------------+             |
                                 v
                         +-----------------------+
                         | Express 5 Server      |
                         | routes.ts (69 routes) |
                         | circuit-routes.ts     |
                         |   (46 routes)         |
                         | circuit-ai.ts (3 AI)  |
                         +-----------------------+
                           |         |         |
                           v         v         v
                  +----------+ +----------+ +---------+
                  | storage  | | ai.ts    | | export  |
                  | .ts      | | +tools   | | DUAL:   |
                  | (CRUD)   | | (78)     | | monolith|
                  +----------+ +----------+ | +modular|
                       |            |       +---------+
                       v            v
                  +----------+ +------------------+
                  |PostgreSQL| |Anthropic / Gemini|
                  |17 tables | |API (streaming)   |
                  +----------+ +------------------+
```

### State Flow Detail

1. **User action** (click, type, drag) in a view component
2. **Context dispatch** via React context hook (e.g., `useArchitecture().addNode()`)
3. **React Query mutation** fires `apiRequest()` to the server
4. **Server validates** request via Zod schema
5. **Storage layer** executes PostgreSQL query via Drizzle ORM
6. **Cache invalidation** clears relevant prefix-matched cache entries
7. **Response** returns to client
8. **Query invalidation** triggers React Query refetch
9. **UI re-renders** with new data

### AI Chat Flow

1. **User message** sent to ChatPanel
2. **ChatPanel** calls `POST /api/chat/ai/stream` (or non-stream variant)
3. **Server** builds system prompt with full project state (nodes, edges, BOM, validation, chat history, component parts, circuit designs, history)
4. **routeToModel** selects AI model based on strategy
5. **AI provider** called with native tool use (Anthropic) or function declarations (Gemini)
6. **Multi-turn tool loop** (up to 10 turns): AI calls tools, server executes them, results fed back
7. **SSE events** streamed to client: text chunks, tool calls, tool results, done event with actions
8. **Client action executor** processes actions: updates architecture, BOM, validation, etc. via context hooks
9. **User confirmation** for destructive actions via accept/reject UI

---

## Integration Points

| Integration | Type | Status | Location |
|-------------|------|--------|----------|
| Anthropic Claude API | AI Provider | **Active** | `server/ai.ts`, `@anthropic-ai/sdk` |
| Google Gemini API | AI Provider | **Active** | `server/ai.ts`, `@google/generative-ai` |
| PostgreSQL | Database | **Active** | `server/db.ts`, `drizzle-orm` + `pg` |
| Digi-Key (BOM supplier) | External | **AI-simulated** | Supplier in BOM items, no live API. Data is fabricated. |
| Mouser (BOM supplier) | External | **AI-simulated** | Supplier in BOM items, no live API. Data is fabricated. |
| LCSC/JLCPCB (BOM supplier) | External | **AI-simulated** | BOM export format exists, no live API. Data is fabricated. |
| Fritzing (component format) | File Format | **Active** | `server/component-export.ts` — FZPZ import/export |
| KiCad (export) | File Format | **Active** | `server/export/kicad-exporter.ts` — schematic + PCB + netlist + project |
| Eagle (export) | File Format | **Active** | `server/export/eagle-exporter.ts` — schematic + board + project |
| Gerber (export) | File Format | **Active** | `server/export/gerber-generator.ts` |
| SPICE (export + sim) | File Format | **Active** | `server/export/spice-exporter.ts` + `client sim engine` |
| Excellon drill | File Format | **Active** | `server/export/drill-generator.ts` |

---

## Navigation & Entry Points

### Client Routing

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Redirect to `/projects/1` | Default entry |
| `/projects/:projectId` | `ProjectWorkspace` | Main workspace |
| `*` (404) | `NotFound` | Error page |

### Workspace Views (10 tabs)

| View | Tab Key | Component | Purpose |
|------|---------|-----------|---------|
| Output | `output` | `OutputView` | Build logs, system messages |
| Architecture | `architecture` | `ArchitectureView` | Block diagram editor |
| Component Editor | `component_editor` | `ComponentEditorView` | Custom part design |
| Schematic | `schematic` | `SchematicView` | Circuit schematic capture |
| Breadboard | `breadboard` | `BreadboardView` | Virtual breadboard |
| PCB | `pcb` | `PCBLayoutView` | PCB layout |
| Procurement | `procurement` | `ProcurementView` | BOM management |
| Validation | `validation` | `ValidationView` | Design rule checks |
| Simulation | `simulation` | `SimulationPanel` | SPICE simulation |
| Project Explorer | `project_explorer` | (via Sidebar) | Project settings |

### Sidebar Sections

- **SidebarHeader** — Project name, collapse toggle
- **ComponentTree** — Hierarchical node browser from architecture
- **HistoryList** — Recent action history
- **ProjectSettingsPanel** — Name, description, project type

### Chat Panel

- **ChatHeader** — Model info, settings toggle
- **MessageBubble** — AI responses with action accept/reject
- **MessageInput** — Text input with image upload
- **QuickActionsBar** — Pre-built action shortcuts
- **SettingsPanel** — Provider, model, temperature, custom prompt, routing strategy
- **ChatSearchBar** — Search through conversation

---

## Module Breakdown

| Module | Files | LOC (code) | Purpose |
|--------|-------|------------|---------|
| `client/src/components/views/` | 25 | 7,968 | View components (Architecture, Schematic, Procurement, Validation, Output, ComponentEditor) |
| `client/src/components/ui/` | 59 | 5,485 | shadcn/ui design system primitives |
| `client/src/components/panels/` | 22 | 4,542 | ChatPanel, AssetManager, chat subcomponents |
| `client/src/components/circuit-editor/` | 20 | 4,427 | Schematic canvas, net drawing, ERC, PCB, breadboard |
| `client/src/components/simulation/` | 3 | 2,552 | Simulation panel, waveform viewer, probe overlay |
| `client/src/components/layout/` | 7 | 1,052 | Sidebar, header, component tree, settings |
| `client/src/lib/` (contexts, hooks, utils) | 49 | 9,161 | State management, contexts, circuit/component editor engines |
| `client/src/hooks/` | 4 | 421 | Custom hooks (toast, mobile, chat settings, synced flow) |
| `client/src/pages/` | 2 | 513 | ProjectWorkspace, NotFound |
| `server/` (excl. tests, exports) | ~20 | 14,749 | API routes, AI, storage, auth, middleware |
| `server/export/` | 11 | ~3,200 | Modular export generators (Gerber, KiCad, Eagle, SPICE, etc.) |
| `server/export-generators.ts` | 1 | 1,209 | Legacy monolith export generators (still active via ai-tools.ts) |
| `server/__tests__/` | 15 | 4,001 | Server test suite |
| `shared/` | 4 | 1,064 | Schema, types, DRC engine |
| **Total** | **250** | **57,265** | |

---

## Developer Intent Signals

Only 2 TODO markers found in source code (excluding backup files):

| Location | TODO | Implication |
|----------|------|-------------|
| `server/circuit-routes.ts` | `boardWidth: 50, // TODO: get from circuit settings` | PCB board dimensions are hardcoded — need to be configurable |
| `ChatPanel.tsx.bak` (backup) | `// TODO: Migrate API key storage to server-side` | Already resolved — server-side API key endpoints exist |

### Implicit Signals from Code Structure

- **Monolithic `project-context.tsx`** acknowledged as tech debt in CLAUDE.md — has been partially refactored into 8 separate contexts (architecture, bom, chat, history, output, validation, project-meta, project-id). However, the architecture-context alone is 365 LOC with 6 useState hooks and exposes 27+ values — the re-render problem has been distributed, not eliminated. See TD-07.
- **PROJECT_ID = 1 hardcoding** noted in CLAUDE.md as blocking multi-project
- **Deprecated endpoints** (`/api/bom/:id`, `/api/validation/:id`) still present alongside proper project-scoped endpoints
- **Export generators dual system**: `export-generators.ts` (1,209 LOC monolith) coexists with `server/export/` directory (11 files, ~3,200 LOC). Both are actively used — monolith by ai-tools.ts, modular by circuit-routes.ts. See TD-10.
- **parseLocalIntent.ts** (294 LOC, CCN=102) — local AI mode is a key user-facing feature built on an unmaintainable decision tree that grew organically

---

## Quantitative Summary

| Metric | Value |
|--------|-------|
| Total source files (TS/TSX) | 250 |
| Total LOC (code only) | 57,265 |
| Total LOC (with blanks/comments) | 68,748 |
| Client-side LOC | ~39,163 |
| Server-side LOC | ~18,750 |
| Shared LOC | ~1,064 |
| Database tables | 17 |
| REST API endpoints | 115 |
| AI-callable tools | 78 (in a single 1,677-LOC file — TD-09) |
| Export generators | 12 (monolith) + expanded modular (7 overlap, 4 modular-only) |
| React components (default exports) | 55 |
| React contexts | 8 |
| Custom hooks | 4 |
| Test files | 37 (19 client + 15 server + 2 shared + test-setup) |
| Production dependencies | 74 |
| Dev dependencies | 16 |
| Workspace views | 10 |
| Complexity (cyclomatic) | 9,667 total |
| God files (>1000 LOC) | 12 |
| Functions with CCN >20 | 6 (in ShapeCanvas alone) + PCBLayoutView (135) + parseLocalIntent (102) |
| COCOMO cost estimate | $1,893,995 |
| Estimated schedule | 17.53 months |
