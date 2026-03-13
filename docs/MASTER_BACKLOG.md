# ProtoPulse Master Backlog

> **Single source of truth** for all open work: bugs, security fixes, features, tech debt, UX polish, and moonshots.
> Consolidated 2026-03-07 from 9 source documents (see [Source Map](#source-document-map) at bottom).
> Items completed in Waves 1-53 have been removed or marked DONE. Only **open/remaining** work is listed.

## How to Use This Document

- **Pick from the top.** Items are grouped by priority (P0 → P3) then by domain.
- **IDs are stable.** Each item has a `BL-XXXX` ID. Reference these in commits and PRs.
- **Status values:** `OPEN` = not started, `PARTIAL` = some code exists but not complete, `BLOCKED` = waiting on prerequisite.
- **Cross-refs** show the original ID from the source doc (MF-xxx, UX-xxx, IFX-xxx, ARDX-xxx, etc.) for traceability.
- **When you finish an item**, change its status to `DONE` and add the Wave/commit reference.

## Quick Stats

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 0 | Security holes, crashes, data loss — all resolved (11 in Wave 52, 2 in Wave 53, BL-0005 DONE Wave 60) |
| P1 | 0 | All 16 P1 items resolved in Wave 67: breadboard collision+drag, PCB undo/redo+dims+Gerber, Schematic→PCB annotation, NR convergence, supplier disclaimer, CRDT/locks/RBAC, Arduino serial/library/boards |
| P2 | 240 | +39 from Wave 66 competitive audit: breadboard UX (Fritzing), Arduino IDE parity, PlatformIO features, simulation UX (TinkerCAD), learning/content |
| P3 | 153 | +6 moonshots: block programming, unit testing, static analysis, ESP-IDF, hardware debug, QEMU sim |
| **Total** | **393** | |

---

## P0 — Critical (Security / Crashes / Data Loss)

### Security

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0001 | **Auth bypass in dev mode** — `NODE_ENV !== 'production'` skips all session validation. Every endpoint is unauthenticated in dev. | DONE (Wave E) | app-audit §14 |
| BL-0002 | **`/api/seed` is public** — listed in `PUBLIC_PATHS`. Any non-prod deployment allows unauthenticated DB seeding. | DONE (Wave 52) | app-audit §14 |
| BL-0003 | **API keys sent in plaintext** in every `/api/chat/ai/stream` POST body. Visible in DevTools, potentially logged by proxies. | DONE (Wave 52) | app-audit §14 |
| BL-0004 | **Response body logging captures API keys** — server logs first 500 chars of every JSON response. | DONE (Wave E) | app-audit §14 |
| BL-0005 | **API keys in localStorage** — migrated to server-side encrypted storage (AES-256-GCM via `api_keys` table) when authenticated, localStorage fallback for unauthenticated users. `useApiKeys` hook, ChatPanel/ModifyModal/PinExtractModal/DatasheetExtractModal updated. | DONE | Wave 60 |
| BL-0006 | **Admin purge has no role check** — `DELETE /api/admin/purge` callable by any user. | DONE (Wave 52) | app-audit §14 |
| BL-0007 | **XSS in `useDragGhost.ts`** — `innerHTML` interpolates user-editable `assetName` without sanitization. | DONE | app-audit §14 |
| BL-0008 | **LIKE wildcards not escaped** in library search queries — user can use `%` and `_`. | DONE (Wave 52) | app-audit §14 |
| BL-0009 | **Multiple `z.any()` fields** in Zod schemas bypass type validation. | DONE | app-audit §14 |
| BL-0070 | **ZIP bomb vulnerability on FZPZ import** — no decompressed size limit. Add 50MB cap + stream-decompress with byte counter. | DONE (Wave 52) | GA-SEC-13 |
| BL-0071 | **SVG content parsed without sanitization** — add DOMPurify or equivalent before storing/rendering SVG. | DONE (CAPX-SEC-17) | GA-SEC-17 |
| BL-0072 | **Session tokens stored in plaintext** in DB — store hashed tokens, compare hashes, rotate on auth actions. | DONE | GA-SEC-09 |

### Crashes & Data Loading

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0010 | **Breadboard/PCB JSON parse crash** — API returns HTML `<!DOCTYPE` instead of JSON. Fixed: added `/api/*` catch-all returning JSON 404 before SPA catch-all (Wave 53). | DONE | app-audit §5, §6 |
| BL-0011 | **DRC false positives (123 duplicates)** — DRC runs against raw SVG coordinates, not real-world dimensions. Fixed: skip 0.0px overlapping shapes in non-PCB views + shape-pair deduplication in runDRC() (Wave 53). | DONE | app-audit §8 |

---

## P1 — High (Broken Workflows / Major UX / Test Gaps)

### Observed Bugs (from visual audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0012 | **"Invalid Date" in timeline** — Fixed: added isNaN guard in formatRelativeTime/formatExactTime (Wave 54). | DONE | app-audit §1 |
| BL-0013 | **401 on every page load** — Already fixed: `/api/settings/chat` is in PUBLIC_PATHS bypass. | DONE | app-audit §1 |
| BL-0014 | **Schematic net edges silently fail** — 10x React Flow errors: `Couldn't create edge for source handle id: "pin-PB0"`. Nets don't render. | DONE (Wave 56) — `resolvePinId()` fallback resolves pin names→connector IDs | app-audit §4 |
| BL-0015 | **BOM spinbutton constraints broken** — Fixed: string min/max attrs + Math.max clamping in onChange (Wave 54). | DONE | app-audit §7 |
| BL-0016 | **BOM float precision** — Fixed: Math.round(n * 100) / 100 before toFixed(2) in BomCards + BomTable (Wave 54). | DONE | app-audit §7 |
| BL-0017 | **Chat temperature slider float** — Fixed: Math.round rounding in display + aria-valuetext (Wave 54). | DONE | app-audit §11 |
| BL-0018 | **Component Editor float noise** — Fixed: round2() applied to pitch input onChange handler (Wave 54). | DONE | app-audit §3 |
| BL-0019 | **CSP `frame-ancestors` via `<meta>`** — Fixed: removed from meta tag, added frameAncestors to Helmet CSP header (Wave 54). | DONE | app-audit §1 |
| BL-0020 | **Duplicate API requests on load** — Mitigated: global `staleTime: 5min` + `refetchOnWindowFocus: false` in queryClient.ts deduplicates within React Query. Seed request has 5s AbortSignal timeout. Remaining duplicates are React Query's expected mount-time checks. | DONE | app-audit §16 |

### Auth & Session

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0021 | **No login/register UI** — Backend auth exists but zero frontend auth pages. `/login`, `/register` all 404. | DONE (verified Wave 59) — AuthPage.tsx 163 lines with login/register toggle, validation, error display. POST /register + /login + /logout + GET /me all exist. | app-audit §12 |
| BL-0022 | **No session management** — No X-Session-Id stored/sent by client. Auth layer is dead code. | DONE (verified Wave 59) — auth-context.tsx 237 lines: login/register/logout, localStorage session, X-Session-Id injected via queryClient.ts getAuthHeaders(), network retry, 12 tests. | app-audit §12 |
| BL-0023 | **App fully accessible without auth** — No protected routes client-side. Anyone can view/edit/delete. | DONE (verified Wave 59) — App.tsx AuthGate wraps all routes, shows AuthPage when unauthenticated. Server-side PUBLIC_PATHS whitelist + requireProjectOwnership on 22+ routes. | app-audit §12 |

### Reliability

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0073 | **SSE stream client doesn't check `response.ok`** — Already fixed: ChatPanel.tsx checks `!response.ok` before `getReader()` (line 603). DesignAgentPanel.tsx also checks (line 84). | DONE | GA-ERR-03 |
| BL-0074 | **N+1 query in `buildAppStateFromProject()`** — Already fixed: uses `Promise.all()` for 10 parallel queries (server/routes/chat.ts:203). | DONE | GA-DB-01 |
| BL-0075 | **No circuit breaker for AI provider** — Already implemented: `server/circuit-breaker.ts` with CLOSED/OPEN/HALF_OPEN states, singleton breakers per provider. | DONE | GA-ERR-06 |
| BL-0076 | **No automatic AI provider fallback** — Already implemented: `server/ai.ts` has `FallbackProviderConfig`, `isRetryableError()`, automatic provider switch on 5xx/timeout. | DONE | GA-ERR-07 |
| BL-0077 | **Race condition in `upsertChatSettings`** — Already fixed: uses `onConflictDoUpdate` (server/storage/components.ts:198). | DONE | GA-DB-03 |

### Performance

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0024 | **CircuitCodeView chunk 724 KB** — Fixed: split CodeMirror (470KB) and Sucrase (206KB) into separate vendor chunks. CircuitCodeView 724→47KB. No 500KB warning. (Wave 55) | DONE | app-audit §15 |
| BL-0025 | **7 context providers create unmemoized values** — Already fixed: all 7 providers (Architecture, BOM, Chat, Validation, History, Output, ProjectMeta) use useMemo on context values. | DONE | app-audit §15 |
| BL-0026 | **ChatPanel has 22 useState hooks** — any state change re-renders entire 829-line component. | DONE (Wave 57) — 21 useState → 3 useReducer hooks (useChatPanelUI, useChatMessaging, useMultimodalState) + 2 standalone | app-audit §15 |
| BL-0027 | **Mutations invalidate full query lists** — every message triggers full refetch instead of optimistic update. | DONE (Wave 58) — optimistic onMutate/onError/onSettled in bom, chat, validation contexts | app-audit §15 |

### Accessibility (Critical)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0028 | **`ToolButton.tsx` missing aria-label** — Already fixed: ToolButton.tsx has `aria-label={label}` (line 21). | DONE | app-audit §13 |
| BL-0029 | **48+ icon-only buttons missing aria-labels** — Fixed: added aria-labels to 9 violations across CommentsPanel, KanbanView, ChatSearchBar (Wave 55). Remaining buttons already have labels. | DONE | app-audit §13 |
| BL-0030 | **Interactive `<div>` elements** — Fixed: added role="button", tabIndex, keyboard handlers to ChatPanel backdrop, Sidebar collapsed div, Sidebar backdrop (Wave 55). | DONE | app-audit §13 |
| BL-0031 | **No `role="tablist"`/`role="tab"`/`aria-selected`** — Already fixed: ProjectWorkspace.tsx has full ARIA tab semantics (role=tablist/tab/tabpanel, aria-selected, aria-controls). | DONE | app-audit §1, §13 |
| BL-0032 | **No H1 element** — Already fixed: ProjectWorkspace.tsx:492 has `<h1 className="sr-only">ProtoPulse</h1>`, plus H1s on ProjectPickerPage and AuthPage. | DONE | app-audit §1 |
| BL-0033 | **Form fields without label association** — Fixed: added aria-labels/htmlFor to 12 fields across ShareProjectDialog, ComponentPlacer, DesignVariablesPanel, PowerSymbolPalette, CommentsPanel, SerialMonitorPanel (Wave 55). | DONE | app-audit §13 |

### Test Hardening (Wave F)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0034 | **Route-level ownership integration tests** — Already implemented: ownership-integration.test.ts (23 tests, 600 lines) covering 23 route families. | DONE | Wave F (F1) |
| BL-0035 | **Collaboration handshake/auth tests** — Already implemented: collaboration-auth.test.ts (50 tests, 850 lines) covering handshake, role enforcement, lock enforcement, room isolation. | DONE | Wave F (F2) |
| BL-0036 | **Export/import contract integration tests** — Already implemented: 10 export test files (317 tests) covering KiCad, Eagle, SPICE, Gerber, drill, BOM, IPC-2581, ODB++, STEP, snapshots. | DONE | Wave F (F3) |
| BL-0037 | **AI tool executor boundary tests** — Already implemented: ai-tools-boundary.test.ts (100 tests, 1111 lines) covering registry completeness, schema validation, input rejection for all 12 tool domains. | DONE | Wave F (F4) |
| BL-0038 | **Simulation input validation tests** — Already implemented: 8 simulation test files (545 tests) covering AC/DC/transient analysis, device models, Monte Carlo, SPICE parser, circuit solver. | DONE | Wave F (F5) |

### Wiring Fixes (Partial Implementations)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0039 | **Collaboration runtime activation** — WebSocket rooms, CRDT ops exist (Wave 41) but not fully activated in production flow. | DONE (Wave 58) — attachCollaborationServer() wired to httpServer in index.ts with DISABLE_COLLABORATION env flag | MF-023 |
| BL-0040 | **Standard categories not unified** — UI filter categories don't match storage categories end-to-end. | DONE (Wave 57) — shared/component-categories.ts as single source of truth, compile-time ComponentCategory type | MF-026 |
| BL-0041 | **Metrics lifecycle not fully wired** — Fixed: startMetricsCollection() called on server listen, stopMetricsCollection()+flushMetrics() added to graceful shutdown (Wave 56). /api/metrics endpoint already exists. | DONE | MF-030 |
| BL-0042 | **Route-level test coverage** weaker than actual route surface area. | DONE (Wave 58) — 11 new test files, 121 tests covering architecture/bom/chat/history/validation/comments/settings/circuit routes | MF-032 |
| BL-0043 | **Migration chain out of sync** with runtime schema (Drizzle push works but formal migrations drift). | DONE (Wave 58) — migration 0002 generated (8 new tables + column additions), CHECK constraints preserved | MF-014 |
| BL-0044 | **Import transactions** — Already fixed: project-io.ts uses `db.transaction()` wrapping all 9 insert operations (nodes, edges, BOM, validation, chat, history, parts, circuits) with full atomicity. | DONE | MF-015 |
| BL-0045 | **API error/status consistency** — DELETE responses now all use 204. Remaining inconsistency is non-DELETE response shape (`{ message }` vs `{ data }` vs direct arrays) — accepted pattern for REST APIs. | DONE | MF-020 |

### Cross-Tool Integration — Schematic ↔ PCB (Wave 65 Audit — NEW, P1)

> ProtoPulse's core promise is "one tool, zero context-switching." These items are where the promise breaks because separate features don't talk to each other at all.

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0558 | **Schematic → PCB forward annotation** — Fixed: POST /api/circuits/:circuitId/push-to-pcb creates unplaced PCB instances from schematic instances, Push to PCB button with AlertDialog confirmation in SchematicView. 5 new tests. | DONE (Wave 67) | Wave 65 audit |

### Broken/Non-Functional Features (Wave 64 Audit — NEW)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0477 | **Breadboard collision detection broken** — Fixed: occupiedPoints now computes proper footprint size using pinCount and crossesChannel for DIP ICs. | DONE (Wave 67) | Wave 64 audit |
| BL-0478 | **Breadboard drag-to-place not implemented** — Fixed: HTML5 drag-and-drop from component palette to breadboard with snap-to-hole, collision check, and visual drop preview. | DONE (Wave 67) | Wave 64 audit |
| BL-0479 | **PCB undo/redo not wired** — Fixed: useUndoRedo wired into PCBLayoutView, wire create/delete registered as undoable commands, Ctrl+Z/Y works. | DONE (Wave 67) | Wave 64 audit |
| BL-0480 | **PCB board dimensions not persisted** — Fixed: boardWidth/boardHeight saved to circuit_designs.settings JSONB with 500ms debounce. | DONE (Wave 67) | Wave 64 audit |
| BL-0481 | **PCB ordering: Gerber files never attached** — Fixed: POST /api/projects/:id/orders/:orderId/generate-gerbers generates and attaches Gerber layer content + drill file to order record. | DONE (Wave 67) | Wave 64 audit |
| BL-0482 | **Arduino Serial Monitor: fake hardware port** — Fixed: SerialMonitorPanel integrated into ArduinoWorkbenchView, Connect button wired to WebSerialManager.connect(). | DONE (Wave 67) | Wave 64 audit |
| BL-0483 | **Arduino Web Serial isolated from Workbench** — Fixed: Upload and Serial Monitor share WebSerialManager singleton via same port handle. | DONE (Wave 67) | Wave 64 audit |
| BL-0484 | **Simulation NR loop runs one iteration** — Fixed: proper NR iteration loop with VNTOL/ABSTOL convergence, max 150 iterations, damped Newton steps. 17 new tests. | DONE (Wave 67) | Wave 64 audit |
| BL-0485 | **Supplier API data is 100% hardcoded mock** — Fixed: added visible disclaimer banner + DEMO badges in SupplierPricingPanel. | DONE (Wave 67) | Wave 64 audit |
| BL-0486 | **CRDT conflict resolution algorithm not implemented** — Fixed: LWW with vector clocks for property updates, intent-preserving structural merge (insert-wins-over-delete), per-room Lamport clock, 200-op sliding window. 23 new tests. | DONE (Wave 67) | Wave 64 audit |
| BL-0487 | **Collaboration WebSocket lock enforcement missing server-side** — Fixed: handleStateUpdate rejects ops targeting entities locked by another user, partial acceptance for mixed batches. 17 integration tests. | DONE (Wave 67) | Wave 64 audit |
| BL-0488 | **Collaboration RBAC not enforced** — Fixed: viewers blocked from all mutations, editors blocked from root design deletion, owner retains full access. | DONE (Wave 67) | Wave 64 audit |
| BL-0587 | **Arduino library install not implemented** — Fixed: backend routes calling arduino-cli lib install/uninstall/list, full Libraries tab in ArduinoWorkbenchView. | DONE (Wave 67) | Wave 66 competitive audit |
| BL-0588 | **Board Manager (platform/core install) missing** — Fixed: backend routes for arduino-cli core list/install/uninstall, Boards tab with search + 7 popular platform quick-install. | DONE (Wave 67) | Wave 66 competitive audit |
| BL-0589 | **Serial Monitor is receive-only** — Fixed: WebSerialManager.send() + SerialMonitorPanel send input already existed, gap was Workbench not integrating the panel (fixed by BL-0482). | DONE (Wave 67) | Wave 66 competitive audit |

### UX Trust Fixes

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0046 | **Show real status labels** — Already fixed: ExportPanel uses real loading/success/error status from mutation callbacks. SaveStatusIndicator tracks real mutations. ChatPanel uses streaming state. No fake status indicators remain. | DONE | UX-001, UX-006 |
| BL-0047 | **Confirm modal for destructive actions** — Already implemented: ConfirmDialog on snapshot delete (DesignHistoryView), BOM delete (BomCards+BomTable), BOM snapshot delete (BomDiffPanel), output clear (OutputView). | DONE | UX-004 |
| BL-0048 | **Replace misleading labels** — Fixed: "Fix all issues" → "Help me fix these issues" in ChatPanel suggestion (Wave 56). | DONE | UX-005 |
| BL-0049 | **Consistent toast style** — Fixed: added success (emerald), warning (amber), info (cyan) variants to toast CVA alongside existing default + destructive (Wave 56). | DONE | UX-007 |
| BL-0050 | **Retry button** on all network/API failure states. | DONE (Wave 57) — retry buttons on 6 views (Schematic, PCB, DesignHistory, BomDiff, Lifecycle, ComponentEditor) | UX-008 |
| BL-0051 | **"Last saved at"** — Already fixed: SaveStatusIndicator in Sidebar.tsx (lines 344-384) tracks mutations via useIsMutating, shows "Saving changes..."/"Last saved at HH:MM"/"All changes saved". | DONE | UX-010 |
| BL-0052 | **Chat help links not clickable** — Already fixed: SettingsPanel.tsx has proper `<a>` elements with href/target/rel for Anthropic and Google console links. | DONE | app-audit §11 |
| BL-0053 | **Chat model names inconsistent** — Already fixed: constants.ts uses consistent "Claude X.Y ModelName" pattern for all models (4.5 Sonnet, 4.6 Sonnet, 4 Opus, etc.). | DONE | app-audit §11 |
| BL-0054 | **No validation feedback on settings save** — Fixed: added toast notification on "Save & Close" (Wave 55). | DONE | app-audit §11 |
| BL-0055 | **Output view shows fake data** — Already fixed: OutputView uses real context data from useOutput() hook. No hardcoded mock entries remain. | DONE | app-audit §9 |
| BL-0056 | **"BASH / LINUX" label misleading** — Fixed: changed to "SYSTEM LOG" in OutputView.tsx (Wave 56). | DONE | app-audit §9 |
| BL-0057 | **Validation severity numbers** — Already fixed: ValidationView uses semantic text ("error"/"warning"/"info") with color-coded badges and icons, not numeric values. | DONE | app-audit §8 |
| BL-0058 | **No severity filtering** — Fixed: added severity filter bar (error/warning/info toggles with counts) to ValidationView (Wave 56). | DONE | app-audit §8, UX-041 |
| BL-0059 | **DRC violations not grouped** — Fixed: grouped by ruleType with sub-headers showing rule name + count (Wave 56). | DONE | app-audit §8, UX-042 |
| BL-0060 | **BOM delete has no confirmation** — Already fixed: ConfirmDialog wraps delete in both BomCards.tsx (line 77-88) and BomTable.tsx (line 220-227) with "Remove BOM Item" title + variant=destructive. | DONE | app-audit §7 |
| BL-0061 | **BOM column sorting** — Fixed: sortable headers (status, part number, manufacturer, stock, qty, unit price, total) with asc/desc/none toggle, ArrowUp/ArrowDown icons (Wave 56). | DONE | app-audit §7 |
| BL-0062 | **No context menu** on Architecture/Schematic/PCB canvases. Common EDA actions undiscoverable. | DONE (Wave 57) — Radix ContextMenu on all 3 canvases with icons, data-testids, keyboard hints | app-audit §2 |
| BL-0063 | **No visible undo/redo buttons** — Already fixed: SchematicToolbar.tsx has visible Undo2/Redo2 buttons (lines 91-118) with tooltips "Undo (Ctrl+Z)"/"Redo (Ctrl+Shift+Z)", disabled states, data-testids. | DONE | app-audit §2 |

---

## P2 — Medium (Feature Gaps & Polish)

### Core EDA — Schematic & PCB

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0100 | Keep-out/keep-in region editor — Full polygon drawing support on PCB canvas, CRUD API, storage, hooks, and SVG rendering for pours, keepouts, and keepins. | DONE | Wave 63 |
| BL-0101 | Board cutouts/slots/internal milling editor — Reused zone editor logic for cutout regions; implemented Edge.Cuts layer mapping and SVG rendering with dashed white borders. | DONE | Wave 63 |
| BL-0102 | Via stitching automation — Added circuitVias schema, CRUD API, and an AI tool (auto_stitch_vias) that calculates point-in-polygon grid spacing to fill zones with stitching vias. | DONE | Wave 63 |
| BL-0103 | Teardrop generation — Added 'teardrop' to pcbZones zoneType enum. Wrote AI tool (generate_teardrops) to scan trace endpoints and attach teardrop polygons to connected vias/pads. Rendered seamlessly on PCB view. | DONE | Wave 63 |
| BL-0104 | Multi-sheet schematic hierarchy management — Added subDesignId to circuit_instances; created SchematicSheetNode for 'Sheet Symbols' with port rendering and 'Enter Sheet' navigation; implemented useInstantiateSubSheet hook and backend route. | DONE | Wave 63 |
| BL-0105 | Live pin-compatibility checks for replacements — Enhanced AlternatePartsEngine with checkPinCompatibility algorithm; built ComponentReplacementDialog with live pin match/mismatch preview; added 'Replace Component' context menu to SchematicCanvas. | DONE | Wave 63 |
| BL-0106 | Auto decoupling/power network placement suggestions — Integrated PredictionEngine into ProjectWorkspace via PredictionPanel overlay; added 'Add Decoupling Caps' context menu action to SchematicCanvas with auto pin-detection and wiring logic. | DONE | Wave 63 |
| BL-0107 | AI placement optimization assistant — Wired usePredictions hook to provide live layout and design optimization suggestions; implemented handePredictionAccept to execute suggested AI actions. | DONE | Wave 63 |
| BL-0108 | Node inline label editing on canvas — double-click to edit on Architecture (CustomNode), Schematic (InstanceNode, PowerNode) | DONE | Wave 61 |
| BL-0109 | Node properties inspector panel | DONE (Wave 62) — NodeInspectorPanel.tsx: editable label/type/description, position, edge count, delete w/ undo | app-audit §2 |
| BL-0110 | Canvas copy/paste support — Architecture, Schematic, and PCB all support Ctrl+C/V and context menu paste with ID remapping and system clipboard sync. | DONE | Wave 63 |
| BL-0111 | Multi-select rectangle on canvas — ReactFlow selectionOnDrag on Architecture + Schematic, custom SVG marquee with point-in-rect selection on PCB. | DONE | Wave 63 |
| BL-0112 | Empty state guidance on canvases — all 4 canvases now have empty states (Architecture, Schematic, PCB, Breadboard). | DONE | Wave 60 |
| BL-0113 | Sidebar collapsed nav mismatch — unified navItems and alwaysVisibleIds across sidebar and tab bar; added scrolling to collapsed sidebar. | DONE | Wave 63 |
| BL-0114 | URL deep linking per view tab — `/projects/:id/:viewName` with URL priority over localStorage, wouter route extension | DONE | Wave 61 |

### Breadboard UX — Fritzing Parity (Wave 66 Competitive Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0590 | **Photorealistic breadboard component SVGs** — Fritzing renders components as photorealistic images: resistors with real color bands, ICs with part number markings, LEDs with colored lens shapes, capacitors with correct proportions. ProtoPulse uses schematic-style abstractions on the breadboard. "Looks like my real circuit" is the primary reason beginners love Fritzing — it makes the diagram instantly recognizable against the physical hardware. | DONE | Wave 69 |
| BL-0591 | **Wire color coding in breadboard** — Right-click any breadboard wire to assign a color (red=power, black=ground, yellow=signal, etc.). Wire colors persist and are exported to diagrams. Standard electronics convention that makes breadboard diagrams readable at a glance. Every Fritzing tutorial uses this. | DONE | Wave 69 |
| BL-0592 | **Breadboard connected-row highlight on hover** — Hovering over any breadboard hole highlights every other hole electrically connected to it (the full row on the top/bottom half, or the connected power rail). Teaches beginners how breadboards work while also functioning as a visual continuity checker during layout. Very low implementation cost, very high educational value. | DONE | Wave 69 |
| BL-0593 | **Bendable/rubber-band component legs** — Through-hole components (DIP ICs, resistors, LEDs) have flexible legs that bend and stretch from the component body to their inserted breadboard holes. Legs can be dragged to different holes, stretching to fit. Makes the breadboard diagram look like the real circuit where bent component leads are visible. Fritzing implements this via `legId` in the part SVG format. | OPEN | Wave 66 / Fritzing |
| BL-0594 | **Part family swapping via Inspector** — Components with the same "family" property (e.g. all resistors) show a value dropdown in the Inspector panel. Swap a 100Ω resistor for a 1kΩ without deleting and re-placing — all wire connections are preserved. Avoids the most common tedious operation in breadboard design. | OPEN | Wave 66 / Fritzing |
| BL-0595 | **Arbitrary angle rotation** — Inspector rotation field should accept any angle (e.g. 30°, 45°, 135°), not just 90° multiples. Required for angled connector placements, off-axis through-hole components, and decorative layouts. | OPEN | Wave 66 / Fritzing |
| BL-0596 | **Mystery part (generic black-box placeholder)** — A configurable placeholder component with user-set pin count, pin labels, and a blank body. Used when a specific part isn't in the library yet. Allows circuit design to continue without blocking on part creation. Common in breadboard prototyping where custom modules need representation. | DONE (Wave 72) | Wave 66 / Fritzing |
| BL-0597 | **Wire T-junction forking** — Alt+drag on any wire bend point creates a new branching wire (T-junction). Currently wires must be routed from a component pin; mid-wire branching is not possible. T-junctions are essential for power distribution nets where multiple components share a rail. | OPEN | Wave 66 / Fritzing |

### Core EDA — Schematic Editing Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0489 | **Net label inline editing** — Double-click a net label on the schematic canvas to edit it inline (rename the net). Currently net names can only be changed via the properties panel or API. Refdes labels on components should support the same. | DONE | Wave 69 |
| BL-0490 | **Per-net color assignment UI** — Allow users to assign a custom color to a net (e.g. power red, ground black, data blue). Color should propagate to all wires on that net and to the ratsnest overlay on PCB. Currently color is automatic only. | DONE | Wave 71 |
| BL-0491 | **Bus pin mapping UI** — Provide a visual dialog for assigning individual signals to bus pins (e.g. "D0–D7 → data bus"). Currently bus routing is partially implemented in `NetDrawingTool` but there is no UI to name or assign bus members. | OPEN | Wave 64 audit |
| BL-0492 | **Text annotation tool on schematic** — Add a freetext/note placement tool for schematic comments, block labels, and callouts. Annotation text should be stored per-circuit-design (not as components) and rendered as SVG `<text>` elements. | DONE | Wave 69 |
| BL-0493 | **Power symbol auto-connect** — When a VCC or GND power symbol is placed adjacent to a compatible pin, the net connection should form automatically without requiring a manual wire segment. Standard behavior in KiCad and Eagle. | DONE | Wave 69 |
| BL-0494 | **Wire segment drag-rerouting** — Allow existing wire segments to be grabbed and repositioned (mid-segment drag). Currently wires can only be fully deleted and redrawn. Mid-segment rerouting is standard EDA UX. | OPEN | Wave 64 audit |
| BL-0495 | **Incremental ERC** — ERC currently re-runs the full circuit on every trigger. Add dirty-tracking so only changed nets/instances trigger re-validation. Prevents UI stutter on large schematics. | DONE (Wave 72) | Wave 64 audit |
| BL-0496 | **Net browser panel** — Sidebar/drawer listing all nets in the design with pin count, connected instances, and a click-to-highlight action. Equivalent to KiCad's "Net Inspector". Useful for navigating large schematics. | DONE | Wave 69 |
| BL-0497 | **Refdes auto-increment on component placement** — When placing a second R, it should be named R2 (not another R1). Currently every placed component gets R1/U1/etc. and requires manual renaming. Auto-increment on placement is table-stakes EDA UX. | DONE | Wave 71 |
| BL-0498 | **Schematic → BOM auto-populate** — Placing components on a schematic should offer to add them to the BOM automatically (with confirmation). Currently schematic instances and BOM items are entirely decoupled; linking them is manual. | OPEN | Wave 64 audit |

### Core EDA — PCB Editing Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0499 | **3D viewer shortcut in PCB toolbar** — Add a "View in 3D" button to the PCB toolbar that jumps to the `viewer_3d` ViewMode. Users don't discover this view easily from the PCB canvas. | DONE | Wave 69 |
| BL-0500 | **Diff pair routing toolbar mode** — Add a dedicated diff-pair route button to the PCB toolbar. Currently `diff-pair-router.ts` exists but there is no UI entry point to activate it; users have no way to initiate differential pair routing without AI. | DONE | Wave 69 |
| BL-0501 | **SI overlay toggle in PCB toolbar** — Add a button to show/hide signal integrity annotations (stub lengths, impedance warnings) computed by `si-advisor.ts` directly on the PCB canvas. | OPEN | Wave 64 audit |
| BL-0502 | **Thermal heatmap overlay** — Add an overlay mode to PCBLayoutView that color-codes pads/zones by thermal resistance values from `thermal-analysis.ts`. Power designers need this to spot heat accumulation before ordering. | OPEN | Wave 64 audit |
| BL-0503 | **PCB copy/paste traces and zones** — Ctrl+C on selected traces/zones followed by Ctrl+V should duplicate them (with new IDs and optional offset). Currently copy/paste only works at the architecture/schematic level. | OPEN | Wave 64 audit |
| BL-0504 | **Ratsnest filter by net** — Allow users to show/hide the unrouted ratsnest lines for specific nets. Essential for routing complex boards where power net ratsnest obscures signal net ratsnest. | DONE (Wave 72) | Wave 64 audit |
| BL-0505 | **Push-shove visual feedback** — `push-shove-engine.ts` computes pushed geometries but the result is not visualized during routing. Show the "pushed" trace outlines in a highlight color before the user commits the route. | OPEN | Wave 64 audit |
| BL-0506 | **Unrouted net completion status** — Show a count of unrouted connections (total vs routed) in the PCB toolbar, and a per-net completion indicator in the net browser. Standard autorouter UX feedback. | DONE | Wave 69 |
| BL-0507 | **DRC solder mask / paste / assembly rules** — The PCB DRC checker covers clearance/annular/trace rules but has no rules for solder mask expansion, paste aperture, or assembly courtyard clearances. Add at least 3 rule types for these. | DONE (Wave 72) | Wave 64 audit |
| BL-0508 | **Via aspect ratio DRC rule** — Validate that hole diameter / board thickness ratio meets the fab constraint (typically 1:6 max). Currently via DRC only checks annular ring; aspect ratio is a common reason Gerbers get rejected. | OPEN | Wave 64 audit |
| BL-0509 | **Impedance-aware trace width enforcement** — When a net has an impedance target set (via net class), auto-suggest or enforce the trace width required to hit that impedance given the stackup. Currently impedance is computed but not fed back into routing. | OPEN | Wave 64 audit |
| BL-0510 | **Diff pair length matching automation** — `diff-pair-meander.ts` can generate serpentine segments but there is no UI or automation to trigger length-matching to a target delta. Users must manually invoke via AI. Add a "Match lengths" button in the diff pair toolbar. | OPEN | Wave 64 audit |

### Simulation & Analysis

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0120 | Worst-case corner analysis | OPEN | MF-069 |
| BL-0121 | Mixed-signal simulation (analog + digital logic) | OPEN | MF-070 |
| BL-0122 | EMI/EMC pre-check workflows | OPEN | MF-073 |
| BL-0123 | Current density visualization on traces/pours | OPEN | MF-075 |
| BL-0124 | Simulation scenario manager with presets | OPEN | MF-076, IFX-018 |
| BL-0125 | Simulation compare mode (before/after changes) | OPEN | MF-077, IFX-014 |
| BL-0126 | Shared unit/scale contract across sim + DRC engines | PARTIAL | MF-078 |
| BL-0127 | Simulation resource guardrails (time, memory, output) | DONE (Wave 62) — sim-limits.ts: SimulationLimits interface + checkSimLimits() wired into circuit-solver, transient, monte-carlo, frequency-analysis | MF-079 |
| BL-0128 | Live current/voltage animation overlay (EveryCircuit-style) | OPEN | MF-080, IFX-011 |
| BL-0129 | Failure injection mode (open/short/noisy sensor) | OPEN | IFX-013 |
| BL-0130 | What-if slider for instant value sweeps | DONE (Wave 62) — what-if-engine.ts + WhatIfSliderPanel.tsx: parameter extraction, SI prefix formatting, per-param sliders with reset | IFX-012 |

### Simulation UX — TinkerCAD Parity (Wave 66 Competitive Audit)

> TinkerCAD's simulation is less powerful than ProtoPulse's (no AC, no Monte Carlo, no real SPICE) but it FEELS 10x more powerful because you SEE results on the circuit. These items close that perception gap.

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0619 | **Component visual state rendering during simulation** — During simulation, components should show their physical state visually on the canvas: LED brightness proportional to current (CSS glow effect), motor/servo SVG animated at simulated RPM/angle, 7-segment displays show lit segments, LCDs render text strings from simulated output, NeoPixels show per-pixel colors. This is distinct from BL-0128 (current flow animation overlay) — that's wires; this is the components themselves. TinkerCAD's killer feature. | OPEN | Wave 66 / TinkerCAD |
| BL-0620 | **Unified "Start Simulation" play button with auto-detection** — TinkerCAD has a single green "Start Simulation" button. ProtoPulse requires choosing DC/AC/transient, configuring parameters, then reading separate result panels. Add a top-level play button that auto-detects the appropriate simulation type from the circuit topology and shows results visually on the canvas. Advanced users can still access full parameter control. | OPEN | Wave 66 / TinkerCAD |
| BL-0621 | **Interactive component controls during simulation** — During a running simulation, components should be interactable: click a button/switch to toggle it, drag a potentiometer knob to change resistance, click an LED to see its current node voltage. Changes feed into the live simulation in real time. This is what makes TinkerCAD feel like a living circuit. Requires pausing the sim, applying the state change, and resuming. | DONE | Wave 69 |
| BL-0622 | **Sensor environmental sliders during simulation** — When simulating circuits with temperature sensors (NTC, LM35), light sensors (LDR, photodiode), or distance sensors (HC-SR04), show a slider in the simulation panel that lets the user set the environmental input (0–100°C, 0–100k lux, 0–400cm). The slider drives `analogRead()` / sensor output voltage in the simulation. | OPEN | Wave 66 / TinkerCAD |
| BL-0623 | **Audio output from buzzer/speaker during simulation** — When the simulated circuit drives a buzzer or speaker, produce actual audio through the browser's Web Audio API at the simulated frequency and duty cycle. `tone(pin, 440)` produces an A4 note. Makes the simulation feel alive and is directly useful for debugging audio projects. | OPEN | Wave 66 / TinkerCAD |
| BL-0624 | **Virtual oscilloscope component** — A draggable instrument component that can be placed on the schematic/breadboard canvas, connected via probe wires, and shows live waveforms during simulation. Adjustable time/div (horizontal) and auto-scaled voltage (vertical). More discoverable and tactile than the current separate graph panels. TinkerCAD and Falstad both have this. | DONE | Wave 69 |
| BL-0625 | **Virtual multimeter component** — Draggable multimeter instrument with two probe connections and a mode selector (DC voltage, AC voltage, current, resistance). Shows real-time readings during simulation. Far more intuitive than reading node voltages from a table — matches the physical bench experience. | DONE (Wave 72) | Wave 66 / TinkerCAD |
| BL-0626 | **Virtual function generator component** — Draggable signal source instrument: sine / square / triangle / sawtooth waveform selection, configurable frequency (Hz–MHz), amplitude, DC offset, and duty cycle (for square). Connects to circuit inputs. Used for AC analysis, filter characterization, and PWM testing without requiring a real function generator. | OPEN | Wave 66 / TinkerCAD |

### Simulation — SPICE Model Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0511 | **SPICE K element (mutual inductance / transformer)** — Add `K` mutual inductance coupling between `L` elements in the SPICE generator and parser. Required for simulating transformers, coupled inductors, and RF circuits. | OPEN | Wave 64 audit |
| BL-0512 | **SPICE S/W voltage-controlled switch** — Add `S` (voltage-controlled) and `W` (current-controlled) switch elements. Common in power electronics (H-bridge, buck/boost) and digital-analog interface circuits. | OPEN | Wave 64 audit |
| BL-0513 | **SPICE T element (ideal transmission line)** — Add `T` two-port transmission line element with characteristic impedance and delay. Enables SI simulation without the full crosstalk-solver overhead for simple point-to-point lines. | OPEN | Wave 64 audit |
| BL-0514 | **Simulation size / complexity warning** — Before running a large circuit (>50 nodes, >20 nonlinear devices, or transient span > 10ms at fine timestep), show an estimated runtime warning and offer to reduce parameters. Prevents silent browser hangs on large netlists. | OPEN | Wave 64 audit |

### Hardware & Firmware

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0140 | Firmware compile/upload loop from ProtoPulse | OPEN | MF-084, ARDX-006/007 |
| BL-0141 | Protocol decoders (I2C/SPI/UART monitor) | OPEN | MF-086, ARDX-041/042/043 |
| BL-0142 | Pin conflict checker (schematic vs firmware mapping) | OPEN | MF-087, ARDX-013 |
| BL-0143 | Firmware scaffold tied to actual netlist/pins | PARTIAL | MF-088 |
| BL-0144 | Hardware session recorder (logs + actions + replay) | OPEN | MF-089 |
| BL-0145 | Safe command sandbox for device interaction | OPEN | MF-092 |
| BL-0146 | Board package/library manager integration | OPEN | MF-093 |
| BL-0147 | Flashing progress/error diagnostics | OPEN | MF-094, ARDX-063 |
| BL-0148 | Web Serial integration tests | OPEN | MF-095 |
| BL-0149 | Multi-angle photo follow-up for component ID | OPEN | MF-097 |
| BL-0150 | Inventory tracking tied to BOM consumption | PARTIAL | MF-101 |
| BL-0151 | Compile error translator (plain English) | OPEN | ARDX-008 |
| BL-0152 | Auto-generate pin constants from schematic labels | OPEN | ARDX-019 |
| BL-0153 | Serial plotter for live sensor curves | OPEN | ARDX-032 |
| BL-0154 | Multi-channel telemetry dashboard | OPEN | ARDX-033 |
| BL-0155 | Crash doctor for watchdog resets/brownouts | OPEN | ARDX-036 |
| BL-0156 | Baud mismatch auto-detection | OPEN | ARDX-037 |
| BL-0157 | "No data" troubleshooting wizard | OPEN | ARDX-040 |

### Arduino & Maker Integration (Wave 63)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0200 | Arduino Workbench foundation — Implemented Arduino Workbench view with file explorer, code editor, and console; added arduinoWorkspaces, buildProfiles, and jobs schema/storage/routes; integrated Arduino CLI service for health checks and board discovery. | DONE | Wave 63 |
| BL-0201 | Fritzing (.fzz) project export — Developed Fritzing exporter that generates zipped XML archives containing schematic and breadboard instances/nets. | DONE | Wave 63 |
| BL-0202 | TinkerCad Circuits export — Built TinkerCad exporter that generates JSON project structures for importing components and wires into TinkerCad. | DONE | Wave 63 |
| BL-0203 | AI-powered Arduino sketch generation — Added generate_arduino_sketch AI tool that uses circuit context to produce hardware-accurate boilerplate code. | DONE | Wave 63 |

### Arduino — IDE Parity Gaps (Wave 66 Competitive Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0598 | **Baud rate selector UI in Serial Monitor** — The `baudRate` field exists in the Arduino session schema but the Serial Monitor panel has no dropdown to set it. Users must match their `Serial.begin(9600)` call rate manually; mismatches produce garbage output with no diagnostic. Add a baud rate selector (300 / 1200 / 2400 / 9600 / 19200 / 38400 / 57600 / 115200 / 230400 / 250000 / 500000 / 1000000 / 2000000). | OPEN | Wave 66 / Arduino IDE |
| BL-0599 | **Compile/upload memory usage display** — After every compile, Arduino IDE shows "Sketch uses X bytes (Y% of program storage). Global variables use Z bytes (W% of dynamic memory)." This is the #1 thing embedded developers check — hitting memory limits is the most common beginner blocker. Surface RAM/Flash usage prominently in the Workbench output panel after every build. | OPEN | Wave 66 / Arduino IDE + PlatformIO |
| BL-0600 | **Error line linking in compile output** — Clicking a compile error in the Workbench console should jump to the exact file and line number in the code editor. Requires parsing `avr-g++` / `xtensa-g++` error output format (`filename:line:col: error: message`). Currently users manually scan error text and scroll to find the problem. | OPEN | Wave 66 / Arduino IDE |
| BL-0601 | **Auto-format sketch code (Ctrl+T)** — One-keystroke code formatting using clang-format or a compatible formatter. Arduino IDE 1.x has had Ctrl+T since 2005. ProtoPulse CodeMirror has no formatter wired. Required muscle-memory feature for every Arduino user. | OPEN | Wave 66 / Arduino IDE |
| BL-0602 | **Live error highlighting in code editor** — Squiggly red underlines on syntax/type errors before the user hits compile. Requires either a WASM-based C/C++ parser or a background compile-check endpoint. Eliminates the edit→compile→read-error loop for basic mistakes. Arduino IDE 2.x has this via LSP. | OPEN | Wave 66 / Arduino IDE 2.x |
| BL-0603 | **Arduino-aware IntelliSense / autocomplete** — C/C++/Arduino-aware code completion: function signatures, parameter hints, `#define` expansions, `Serial.`, `digitalWrite(`, pin constants. Currently CodeMirror shows generic completions. Requires either a backend compile_commands.json approach or a WASM clangd. Arduino IDE 2.x uses LSP. | OPEN | Wave 66 / Arduino IDE 2.x + PlatformIO |
| BL-0604 | **Job cancellation** — ESP32 first compile takes 2-4 minutes. There is no way to cancel a running compile or upload job. Users are stuck waiting with no escape. Add a "Cancel" button that kills the arduino-cli process for the active job. | OPEN | Wave 66 / Arduino IDE |
| BL-0605 | **Export compiled binary (.hex/.bin/.elf)** — Allow users to download the compiled firmware binary for OTA flashing, production programming, sharing, or external debugging. `arduino-cli compile --output-dir` already supports this; just needs a UI button and download endpoint. | OPEN | Wave 66 / Arduino IDE |
| BL-0606 | **Built-in examples browser** — "File → Examples → Basics → Blink" is how every Arduino beginner starts. ProtoPulse has `generate_arduino_sketch` AI tool but no browsable library of built-in examples. Add a panel listing examples by category (Basics, Digital, Analog, Communication, Control, Sensors, Starter Kit, etc.) with one-click "Open in Editor." | OPEN | Wave 66 / Arduino IDE |
| BL-0607 | **Real-time SSE log streaming for compile/upload** — Compile and upload logs are currently polled from the DB rather than streamed. Add Server-Sent Events (SSE) streaming for job output so the console updates character-by-character as arduino-cli produces output, not in chunks after polling intervals. | OPEN | Wave 66 / Arduino IDE |
| BL-0608 | **Go to definition / find references in code editor** — Jump to the definition of a function, variable, or `#define` from any usage. Standard IDE navigation (F12 / Ctrl+Click). Essential as sketches grow beyond trivial size. Requires LSP or ctags-style indexing. | OPEN | Wave 66 / Arduino IDE 2.x |

### Arduino — PlatformIO Parity Gaps (Wave 66 Competitive Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0609 | **ESP exception decoder** — When an ESP32/ESP8266 crashes with a `Guru Meditation Error` or stack trace, the output is raw hex addresses. PlatformIO's serial monitor filter passes these through `addr2line` / `xtensa-addr2line` to translate them to `filename:line`. Every ESP32 user hits this within hours of their first project. Add an "Decode ESP exception" button in the serial monitor that auto-detects and decodes crash output. | OPEN | Wave 66 / PlatformIO |
| BL-0610 | **SPIFFS/LittleFS filesystem upload** — Upload a directory of files (HTML, CSS, JSON, images) to the ESP32/ESP8266 flash filesystem. Massive use case: ESP web servers, config files, OTA landing pages. PlatformIO has a first-class `uploadfs` target. Requires generating a filesystem image from a `/data` directory and flashing it via esptool. | OPEN | Wave 66 / PlatformIO |
| BL-0611 | **OTA (Over-The-Air) firmware update** — After the first USB flash, push firmware updates wirelessly to ESP devices via IP or mDNS. Eliminates the USB cable for iterative development. PlatformIO's `upload_protocol = espota` handles this. Add an OTA upload mode to the Workbench that discovers ESP devices on the network and pushes the compiled binary. | OPEN | Wave 66 / PlatformIO |
| BL-0612 | **Serial output log-to-file** — Auto-save serial monitor output to a timestamped file. Essential for long-running data collection (sensor logging, overnight tests). PlatformIO's `log2file` filter does this transparently. Add a "Record to file" toggle in the serial monitor with download button. | OPEN | Wave 66 / PlatformIO |
| BL-0613 | **Multi-platform board support (STM32, nRF52, RP2040, ESP-IDF)** — ProtoPulse's Workbench is Arduino-framework only. Makers increasingly use STM32 Blue Pill (cheap, powerful), nRF52840 (BLE), RP2040 Pico (dual-core, PIO), and ESP-IDF for serious ESP32 work. PlatformIO supports 35 platforms and 1300+ boards. Expand the board registry and build system to support at minimum STM32 (Arduino + STM32CubeIDE), RP2040, and nRF52. | OPEN | Wave 66 / PlatformIO |
| BL-0614 | **Custom board definitions** — Users designing custom PCBs (the core ProtoPulse use case!) need to define their own board with custom clock speed, memory layout, pin aliases, and bootloader. PlatformIO uses a simple JSON board file. Add a "New custom board" workflow that generates a board definition from the PCB's component list and lets users edit clock/memory/pin settings. | OPEN | Wave 66 / PlatformIO |
| BL-0615 | **Multi-environment build targets** — Build the same project for multiple boards/configurations from a single project (e.g. `[env:uno]`, `[env:esp32]`, `[env:release]`). Useful for libraries targeting multiple platforms and for projects with debug vs release configs. Add a build profile selector with multiple targets per project. | OPEN | Wave 66 / PlatformIO |
| BL-0616 | **Per-file memory breakdown** — After compile, show how much RAM and Flash each source file and each function consumes. PlatformIO's Project Inspector parses the `.map` file for this. Answers the common maker question "which library is eating all my Flash?" and "why did I run out of RAM?" | OPEN | Wave 66 / PlatformIO |
| BL-0617 | **Native firmware unit testing (no hardware required)** — Run firmware tests compiled for the host machine using the Unity test framework. PlatformIO has `pio test -e native` for this. Allows testing pure-logic functions (parsers, state machines, algorithms) without uploading to hardware. Teaches good testing habits and speeds iteration dramatically. | OPEN | Wave 66 / PlatformIO |
| BL-0618 | **Static analysis (Cppcheck / Clang-Tidy)** — Catch null pointer dereferences, buffer overflows, uninitialized variables, and logic errors before compile. PlatformIO integrates Cppcheck and Clang-Tidy via `pio check`. Run server-side via WASM or subprocess; surface results as annotations in the code editor. Huge safety value for beginner makers. | OPEN | Wave 66 / PlatformIO |

### Arduino — Workbench Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0515 | **Arduino board settings dialog** — Expose FQBN, programmer, upload speed, and extra flags as an editable dialog in the Workbench. Currently these values are hardcoded or derived only from board selection. Required for non-standard boards and bootloader-burning workflows. | OPEN | Wave 64 audit |
| BL-0516 | **Arduino CLI error message parsing** — Parse `arduino-cli compile` stderr output and display structured diagnostics (file, line, column, message) in the Workbench console instead of raw text. Map common errors ("library not found", "no such file") to plain-English hints. | OPEN | Wave 64 audit |
| BL-0517 | **Arduino job history console** — Show a persistent log of all past compile/upload jobs (timestamp, board, status, duration) in the Workbench. Currently only the most recent job output is visible; older runs are lost on refresh. | OPEN | Wave 64 audit |
| BL-0518 | **Sketch → Serial Monitor → Digital Twin flow** — After a successful upload, automatically offer to open the Serial Monitor connected to the same port, and route parsed telemetry to the Digital Twin's device shadow. Currently these three features are entirely disconnected. | OPEN | Wave 64 audit |

### AI Capabilities

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0160 | AI answer source panel (what data it used) — Full ڈیزائن source tracking from AI tool calls; implemented AnswerSourcePanel UI with Design Sources and AI Confidence scores. | DONE | Wave 63 |
| BL-0161 | AI safety mode for beginners (extra confirms + teaching) | OPEN | MF-145 |
| BL-0162 | Datasheet RAG for grounded suggestions | OPEN | MF-147 |
| BL-0163 | AI testbench suggestions for simulation | OPEN | MF-148, IFX-015 |
| BL-0164 | AI BOM optimization assistant | OPEN | MF-149, IFX-035 |
| BL-0165 | AI routing copilot with explainable reasoning — Added suggest_trace_path tool and client-side trace_path_suggestion handler to provide AI-driven PCB routing guidance. | DONE | Wave 63 |
| BL-0166 | AI hardware debug assistant — Added hardware_debug_analysis tool and client-side hardware_debug_guide handler to provide structured troubleshooting strategies for prototypes. | DONE | Wave 63 |
| BL-0167 | AI explain mode in simple language — Added set_explain_mode tool and client-side handler to toggle educational language and analogies for engineering concepts. | DONE | Wave 63 |
| BL-0168 | Tool allowlists per endpoint/task — Implemented tool allowlist support in ToolRegistry, streamAIMessage, and provider-specific streaming functions to restrict tool availability per request. | DONE | Wave 63 |
| BL-0170 | AI task templates ("Find BOM cost cuts", etc.) — Added quick-start task templates to ChatPanel empty state for common engineering workflows (BOM optimization, schematic review, etc.). | DONE | Wave 63 |
| BL-0171 | Preview change before applying AI actions — Implemented AI Action Preview confirmation UI with Discard and Confirm & Apply buttons; updated handleSend to require confirmation for non-navigational actions. | DONE | Wave 63 |
| BL-0172 | Napkin-to-schematic (photo/sketch → circuit draft) — Added extract_circuit_from_image vision tool and client-side circuit_extraction handler; updated system prompt to guide AI through sketch-to-schematic conversion. | DONE | Wave 63 |
| BL-0173 | AI net naming cleanup suggestions — Added suggest_net_names tool and client-side net_name_suggestions handler to humanize auto-generated net names based on pin functions. | DONE | Wave 63 |

### AI Capabilities — Tool & Context Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0519 | **Simulation control AI tools** — Add AI tools to start, stop, configure, and retrieve results from simulations (`run_dc_analysis`, `run_transient`, `get_sim_results`, `set_sim_parameters`). Currently AI can discuss simulation but cannot invoke it directly via tool call. | OPEN | Wave 64 audit |
| BL-0520 | **Circuit instances in AI system prompt** — The AI system prompt includes architecture nodes, BOM, and validation issues but does NOT include circuit schematic instances and nets. AI answers about circuit connectivity are based on inference, not actual data. Add a `buildCircuitContext()` function to include instances/nets/wires in every prompt. | OPEN | Wave 64 audit |
| BL-0521 | **Action executor error tracking** — `useActionExecutor` silently drops failed tool-call actions (no toast, no console log, no retry). Add per-action error state tracking so users see which AI-suggested actions failed and why. | OPEN | Wave 64 audit |
| BL-0522 | **"Explain this net" AI tool** — Add an `explain_net` tool that takes a net name and returns a plain-English description of what it carries (power, signal, data bus, control), what drives it, and what loads it — useful for newcomers trying to understand a schematic. | OPEN | Wave 64 audit |
| BL-0523 | **DFM/manufacturing AI assistant** — Add AI tools for `run_dfm_check`, `explain_dfm_violation`, and `suggest_dfm_fix` that wrap the existing `DfmChecker` and `StandardsCompliance` engines and surface their output conversationally. | OPEN | Wave 64 audit |

### Collaboration & Teams

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0180 | Spatial review comments pinned to coordinates — Full coordinate-based comment pinning on PCB canvas (and others), spatial field schema, CRUD routes, and interactive SVG markers with tooltips. | DONE | Wave 63 |
| BL-0181 | Review resolution workflow (open/resolved/blocked) | OPEN | MF-115 |
| BL-0182 | Approval gates before release/export | OPEN | MF-116, IFX-053 |
| BL-0183 | ECO workflow (propose/review/approve/apply) | OPEN | MF-117, IFX-058 |
| BL-0184 | Design branching model | OPEN | MF-118, IFX-057 |
| BL-0185 | Merge tooling for branch diffs | OPEN | MF-119 |
| BL-0186 | Activity feed for team actions | OPEN | MF-120, IFX-054 |
| BL-0187 | Mentions/notifications for comments | OPEN | MF-121 |
| BL-0188 | Team templates and standards packs | OPEN | MF-122, IFX-098 |
| BL-0189 | Full audit trail UI | OPEN | MF-124 |
| BL-0190 | Time-travel restore at view/object granularity | OPEN | MF-125, IFX-088 |

### Collaboration — Implementation Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0524 | **Conflict resolution UI** — When a CRDT merge produces a conflict (once BL-0486 is fixed), surface a diff dialog showing "your version" vs "their version" with accept/reject/merge controls. Without UI, silent last-write-wins is confusing. | BLOCKED on BL-0486 | Wave 64 audit |
| BL-0525 | **Presence cursors on Schematic and PCB canvases** — Live collaboration cursors (`LiveCursor` from `collaboration-client.ts`) are not rendered on the Schematic or PCB SVG canvases. Only the Architecture ReactFlow canvas has cursor rendering. Extend to all interactive editors. | OPEN | Wave 64 audit |
| BL-0526 | **Session re-validation on WebSocket reconnect** — After a WebSocket disconnect/reconnect, the server does not re-verify the session token or project membership before re-admitting the client to the room. An expired session can continue collaborating. | OPEN | Wave 64 audit |
| BL-0527 | **Offline queue retry jitter** — The offline sync retry in `offline-sync.ts` uses fixed backoff intervals (1s, 2s, 4s). For a large number of simultaneous offline clients reconnecting together, this causes a retry storm. Add randomized ±20% jitter. | OPEN | Wave 64 audit |

### Manufacturing & Supply Chain

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0468 | Panelization tool with tab/v-score/fiducial | OPEN | MF-132, IFX-037 |
| BL-0469 | Pick-and-place validation and preview | OPEN | MF-133, IFX-038 |
| BL-0470 | Manufacturing package validator before download | OPEN | MF-135 |
| BL-0471 | Build-time risk score (cost + supply + assembly) | OPEN | MF-137, IFX-031 |
| BL-0472 | Quote and order history per project | OPEN | MF-140 |
| BL-0473 | MPN normalization and dedup in BOM | PARTIAL | MF-129 |
| BL-0474 | AML/approved-vendor-list enforcement | OPEN | MF-138 |
| BL-0475 | Assembly risk heatmap | OPEN | IFX-034 |
| BL-0476 | One-click manufacturing package wizard | OPEN | UX-060, IFX-036 |

### Manufacturing — Supply Chain Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0528 | **PCB order tracking** — After placing an order via the ordering flow, provide a status tracker (Gerbers received → In production → Shipped → Delivered) linked to the PCB order record. JLCPCB and PCBWay both have order status APIs. | OPEN | Wave 64 audit |
| BL-0529 | **Fab account linking** — Allow users to save JLCPCB / PCBWay / OSHPark API keys in the settings so orders can be submitted directly without leaving the app. Currently the ordering flow generates a package but requires manual upload to fab websites. | OPEN | Wave 64 audit |
| BL-0530 | **DFM validates actual trace widths and clearances** — `DfmChecker` currently only validates component footprints and courtyard clearances. It does not read actual routed traces from `circuit_wires`. Add trace width and clearance checks against the selected fab preset. | OPEN | Wave 64 audit |
| BL-0531 | **BOM component availability check in DFM** — Integrate BOM stock data (from supplier APIs, once real) into the DFM flow. Flag unavailable or long-lead-time components as DFM risks before the user commits to a fab order. | OPEN | Wave 64 audit |
| BL-0532 | **Export file syntax validation** — Before offering a Gerber/drill/IPC-2581/ODB++ download, run a lightweight syntax check on the generated content (e.g. verify RS-274-X headers, check for truncated polygons). Surface any syntax errors with a "Cannot generate valid file" warning. | OPEN | Wave 64 audit |
| BL-0533 | **LCSC real-time part data sync** — `lcsc-jlcpcb-mapper.ts` currently uses 154 built-in static mappings. Add an optional API sync to fetch real-time prices, stock levels, and JLCPCB assembly availability from the LCSC open API. | OPEN | Wave 64 audit |

### Learning & Content — Competitive Gaps (Wave 66 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0627 | **Pre-built starter circuits with pre-loaded Arduino code** — Beginner users face a cold-start problem: blank canvas, no idea where to begin. TinkerCAD and Fritzing both ship complete working examples (LED blink, servo control, temperature sensor, LCD display) where the circuit is already wired AND the code is already written. Dragging one open gives instant gratification. Add a "Starter projects" gallery with 10–20 complete circuit+code combos. | OPEN | Wave 66 / TinkerCAD + Fritzing |
| BL-0628 | **Bundled circuit + code example library** — The Arduino IDE "File → Examples" menu is how every beginner learns: expand a category, click an example, the code opens ready to upload. ProtoPulse has `generate_arduino_sketch` AI but no browsable static library. Add an Examples panel with curated circuit+code pairs organized by category (Basics, Sensors, Displays, Motors, Communication, IoT) with descriptions and learning objectives. | OPEN | Wave 66 / Arduino IDE + Fritzing |
| BL-0629 | **Etchable PCB export (DIY toner transfer)** — Export PCB copper layers as high-contrast mirrored SVG/PDF optimized for DIY toner-transfer etching at home. Single copper layer, black fill on white background, mirrored for transfer. Fritzing has this. Very popular with the maker/hobbyist audience who can't afford fab but want real PCBs. | OPEN | Wave 66 / Fritzing |

### Import/Export

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0210 | EasyEDA import | OPEN | MF-158 |
| BL-0211 | Cross-tool mapping validator (net/layer/footprint parity) | OPEN | MF-161 |
| BL-0212 | Import repair assistant for broken files | OPEN | MF-162 |
| BL-0213 | Shareable simulation links with frozen settings | OPEN | MF-163 |
| BL-0214 | Import preview summary before apply | OPEN | UX-051 |
| BL-0215 | Import mapping warnings (what got dropped) | OPEN | UX-052 |
| BL-0216 | Export pre-check screen | OPEN | UX-053, IFX-032 |
| BL-0217 | Show exported files list and size after export | OPEN | UX-054 |
| BL-0218 | Export profiles ("Fab ready", "Sim bundle", "Docs") | OPEN | UX-056 |
| BL-0219 | Import history with one-click restore | OPEN | UX-057 |
| BL-0220 | Side-by-side diff: imported vs current design | OPEN | UX-058 |
| BL-0221 | Guided migration flow for KiCad/Eagle/EasyEDA | OPEN | UX-059, IFX-093 |

### UX Polish — Editor & Navigation

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0230 | Mini-map for large schematic/PCB canvases | DONE (Wave 62) — PCBMiniMap in PCBLayoutView.tsx + SchematicCanvas MiniMap enhanced with pan/zoom/neon cyan styling | UX-038 |
| BL-0231 | Smart contextual radial menu on right-click | OPEN | UX-040 |
| BL-0232 | Click validation issue → focus camera + flash component — ReactFlow fitView + CSS validation-focus-pulse animation | DONE | Wave 60 |
| BL-0233 | "Why this rule matters" plain-language explanation | DONE (Wave 62) — DRC_EXPLANATIONS (28 rules) in drc-engine.ts, wired into ERCPanel + ValidationView with expandable toggles | UX-043 |
| BL-0234 | Persist panel sizes/collapsed state (localStorage) — debounced writes, ViewMode validation on restore | DONE | Wave 60 |
| BL-0235 | Command palette categories by workflow stage | OPEN | UX-016 |
| BL-0236 | Context-aware shortcuts panel (`?` overlay) | OPEN | UX-017 |
| BL-0237 | Recent projects with filters and pinning | OPEN | UX-019 |
| BL-0238 | Supplier comparison drawer (price, lead time, MOQ) | OPEN | UX-065 |
| BL-0239 | Auto-grouping for SMT/THT/manual assembly | OPEN | UX-066 |
| BL-0240 | Lifecycle warning badges (NRND/EOL) | OPEN | UX-067 |
| BL-0241 | Cost optimization mode with goals/tradeoffs | OPEN | UX-068 |

### UX Polish — Integration Gaps (Wave 64 Audit)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0534 | **i18n string extraction pipeline** — `i18n-framework.ts` exists with dot-notation key lookup, interpolation, and ~100 en keys, but almost no UI strings are actually extracted. The majority of ProtoPulse UI is hardcoded English. Create a script to audit unextracted strings and a systematic extraction pass. | OPEN | Wave 64 audit |
| BL-0535 | **Community library → BOM integration** — When a user adds a component from the Community Library, offer to simultaneously add it to the current BOM (with auto-populated MPN/manufacturer/supplier fields). Currently community library and BOM are disconnected. | OPEN | Wave 64 audit |
| BL-0536 | **Tutorial step context wiring** — Tutorial steps reference UI features by name but don't open or highlight the relevant panel/view. Add a `targetView` and `targetElement` field to each tutorial step so clicking "Next" navigates to the correct canvas area and highlights the relevant control. | OPEN | Wave 64 audit |
| BL-0537 | **ViewMode section grouping in sidebar** — The sidebar currently lists all 26+ ViewModes as a flat list. Group them into sections ("Design", "Analysis", "Hardware", "Documentation") with collapsible headers. Reduces visual noise and helps new users find features. | OPEN | Wave 64 audit |
| BL-0538 | **Standard library auto-suggest during architecture design** — When a user adds an architecture node with a type that matches a standard library component (e.g. "Arduino Mega", "NE555", "LM7805"), auto-suggest the matching standard library part for the BOM. | OPEN | Wave 64 audit |
| BL-0539 | **Snippet placement as atomic undo unit** — Placing a design snippet (from `SnippetLibrary`) places multiple components and nets. Currently each insert is a separate undo step. Wrap the full snippet application in a single undo-redo entry. | OPEN | Wave 64 audit |
| BL-0540 | **Alternate parts shown in Schematic BOM sidebar** — The `AlternatePartsEngine` finds alternates for BOM items but these are only visible in the Procurement view. Surface alternates as a popover on each instance in the schematic (hovering an IC shows "3 alternates available"). | OPEN | Wave 64 audit |
| BL-0541 | **In-app "What's new" changelog panel** — Display a `CHANGELOG.md`-driven notification badge + panel to inform users of new features and fixes after updates. Important for a tool that evolves rapidly. Show once per version, dismissable. | OPEN | Wave 64 audit |
| BL-0542 | **Breadboard connectivity simulation overlay** — Visually animate which rows and columns are electrically connected on the breadboard when a circuit has a simulation result. Highlights the "live" power rail and signal paths in color (EveryCircuit-style). | OPEN | Wave 64 audit |
| BL-0543 | **Breadboard wire editing** — Allow individual wires on the breadboard to be selected and deleted or moved. Currently wires can only be added; deleting requires clearing the whole connection. | OPEN | Wave 64 audit |
| BL-0544 | **Breadboard DRC overlay** — Show DRC violation markers (short circuits, unconnected required pins) overlaid on the breadboard view. Currently DRC runs on schematics only. | OPEN | Wave 64 audit |
| BL-0545 | **Circuit Code DSL: expand component library** — `circuit-api.ts` currently supports ~13 component types (resistor, capacitor, LED, BJT, MOSFET, etc.). Expand to 50+ types including op-amps, DACs, ADCs, shift registers, H-bridges, voltage regulators, and common Arduino shields. | OPEN | Wave 64 audit |
| BL-0546 | **Circuit Code DSL: complete IC pinout definitions** — The IR-to-schematic mapper uses placeholder pinout data for ICs. Populate a `pinout-db.ts` with real pinouts for the 30 most common ICs (555, LM741, ATmega328P, ESP32, etc.) so generated schematics have correct pin placement. | OPEN | Wave 64 audit |
| BL-0547 | **Circuit Code DSL: net type safety** — Add typed net declarations (`power`, `analog`, `digital`, `differential`) to the DSL so the evaluator can flag connections between incompatible net types (e.g. `analog` connected to `digital` without level shift). | OPEN | Wave 64 audit |
| BL-0548 | **Circuit Code DSL: run seed persistence** — The generative design seed value is not saved between browser sessions. Persist the last seed to localStorage so users can reproduce a specific generative run. | OPEN | Wave 64 audit |
| BL-0549 | **Collaboration UX: enable by default** — Collaboration is implemented but must be manually activated via API. Add a "Share for collaboration" button in the project header that generates and copies a collaboration invite link in one click. Surface the collaborator presence in the UI without requiring users to know about WebSocket endpoints. | OPEN | Wave 64 audit |

### UX Polish — Validation & DRC

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0250 | Rule presets by project type (Arduino, power, sensor) | OPEN | UX-046 |
| BL-0251 | Compare current vs manufacturer rule set | OPEN | UX-047 |
| BL-0252 | Suppression workflow with reason + expiration | OPEN | UX-048 |
| BL-0253 | Guided remediation wizard (step-by-step fixes) | OPEN | UX-049 |
| BL-0254 | Risk score card for release readiness | OPEN | UX-050, IFX-031 |

### Security Hardening (P2)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0280 | **HSTS header missing** — Already set: `strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true }` in Helmet config (server/index.ts:88-91). | DONE (verified Wave 60) | GA-SEC-14 |
| BL-0281 | **Referrer-Policy header** — Already set: `referrerPolicy: { policy: 'strict-origin-when-cross-origin' }` in Helmet config (server/index.ts:92). | DONE (verified Wave 60) | GA-SEC-15 |
| BL-0282 | **CSP `unsafe-inline` for styles** — `style-src-attr: 'unsafe-inline'` required for Radix UI floating element positioning. `style-src-elem` uses CSP nonce. Accepted trade-off. | DONE (verified Wave 60) | GA-SEC-16 |
| BL-0283 | **scrypt cost factor not configured** — Already set: `N: 16384, r: 8, p: 1, maxmem: 64MB` in server/auth.ts:18. OWASP-compliant (2^14 recommended range). | DONE (verified Wave 60) | GA-SEC-19 |
| BL-0284 | **Auth endpoints lack brute-force protection** — Already implemented: `authLimiter` (10 attempts/15min) on POST /register + /login. Generic error messages prevent user enumeration. | DONE (verified Wave 60) | GA-SEC-07 |

### API & Data Contracts

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0285 | **No pagination on circuit endpoints** — add `limit/offset/sort` on instances/nets/wires | OPEN | GA-API-02 |
| BL-0286 | **No API versioning** — introduce `/api/v1/` prefix + `Deprecation`/`Sunset` headers | OPEN | GA-API-03 |
| BL-0287 | **No SSE reconnection logic** — Already implemented: `fetchWithRetry()` in ChatPanel.tsx with exponential backoff (1s/2s/4s), max 3 retries, "Reconnecting..." UI. Only retries on network TypeError. | DONE (verified Wave 60) | GA-API-05 |
| BL-0288 | **No SSE heartbeat events** — Already implemented: `:heartbeat\n\n` emitted via setInterval during SSE streaming in server/routes/chat.ts:543-547. | DONE (verified Wave 60) | GA-API-06 |
| BL-0289 | **Delete lifecycle inconsistent** — define global soft-vs-hard policy matrix by entity | OPEN | GA-DATA-01 |
| BL-0290 | **No generated API types** — use zod-to-ts or OpenAPI; enforce in CI | OPEN | GA-API-04 |

### Performance (P2)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0291 | **99 inline style objects** — reviewed: mostly dynamic (transforms, colors, positioning). Static styles already use Tailwind. No action needed. | DONE (verified Wave 60) | GA-PERF-01 |
| BL-0292 | **Composite indexes** on soft-delete queries — all 4 tables now have proper indexes including `projects(ownerId, deletedAt)`. | DONE | Wave 60 |
| BL-0293 | **`ChatPanel.handleSend` 22-item useCallback dependency** — Already optimized: `sendStateRef` pattern reduces to single `[sendStateRef]` dependency. All state read at call time via ref. | DONE (verified Wave 60) | GA-PERF-02 |
| BL-0294 | **Undo/redo stacks have no depth limit** — Already configured: `DEFAULT_MAX_SIZE = 50` in undo-redo.ts with FIFO eviction on both undo and redo stacks. | DONE (verified Wave 60) | GA-PERF-07 |

### Platform & Ops

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0260 | Persistent job durability store (not in-memory only) | OPEN | MF-170 |
| BL-0261 | Full observability (structured logs, traces, alerts) | OPEN | MF-171 |
| BL-0262 | Error taxonomy with stable error codes | OPEN | MF-173 |
| BL-0263 | Data retention policies and cleanup tooling | OPEN | MF-174 |
| BL-0264 | Deployment profiles (dev/staging/prod) with config validation | OPEN | MF-179 |
| BL-0265 | CI coverage gates and test quality thresholds | OPEN | MF-180 |
| BL-0266 | CSP policy parity across dev/prod — always-on CSP, `reportOnly: isDev`, wasm-unsafe-eval, dev connectSrc wildcards | DONE | Wave 61 |
| BL-0267 | Health/readiness checks tied to real dependencies — Already implemented: `/api/health` checks PostgreSQL connectivity, `/api/ready` checks DB + latency + cache + AI provider keys. Returns 503 if DB down. | DONE (verified Wave 60) | MF-172 |
| BL-0268 | Auth timing-safe compare + throttling for admin ops — Already implemented: `safeCompareAdminKey()` uses SHA-256 + timingSafeEqual. `adminRateLimiter` (5 req/60s) on admin endpoints. | DONE (verified Wave 60) | MF-168 |

### Tech Debt (from code review / Wave 51)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0270 | `mulberry32` PRNG extracted to `shared/prng.ts` — monte-carlo.ts, gpu-monte-carlo.ts, generative.ts all import from shared | DONE | Wave 60 |
| BL-0271 | GPU Monte Carlo evaluator runs on CPU — implement actual GPU batch-solve pipeline | OPEN | Wave 51 review |
| BL-0272 | TelemetryLogger not connected to DeviceShadow live overlay | OPEN | Wave 51 review |
| BL-0273 | Component Editor auto-save fires every 2s during active drawing (mouse-move driven) | OPEN | app-audit §15 |
| BL-0274 | React.memo on high-frequency components — HistoryList, ProjectExplorer, SortableBomRow, BomCardItem memoized | DONE | Wave 61 |
| BL-0275 | `backdrop-blur-xl` GPU jank on low-end devices | OPEN | app-audit §15 |
| BL-0276 | No cache headers on API responses — relying entirely on client-side React Query cache | OPEN | app-audit §16 |

### Cross-Tool Integration — All Domains (Wave 65 Audit)

> These are integration gaps between features that exist independently but don't talk to each other. Each one chips away at the "one tool" promise.

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0559 | **PCB → Schematic back annotation** — Renaming a reference designator in the PCB layout (e.g. R3 → R_BYPASS) is not reflected in the corresponding schematic instance. Back-annotation is the return path of the forward annotation flow (BL-0558). Without it, schematic and PCB can silently diverge. | OPEN | Wave 65 audit |
| BL-0560 | **Simulation results overlay on schematic canvas** — After running a DC operating point or transient simulation, node voltages and branch currents should optionally render as colored annotations directly on the schematic (probe labels at nodes, current arrows on wires). Currently simulation results exist only in the SimulationPanel — there is zero visual connection between simulation output and the schematic that produced it. | OPEN | Wave 65 audit |
| BL-0561 | **PDN/SI analysis reads actual routed PCB geometry** — `pdn-analysis.ts` and `si-advisor.ts` accept parametric inputs (trace width, length, layer stackup) entered manually. They do not read actual routed wire geometry from `circuit_wires`. A fully integrated flow would extract per-net trace statistics from the routed board and feed them directly into the PDN/SI solvers without user data entry. | OPEN | Wave 65 audit |
| BL-0562 | **Thermal analysis reads actual component placement** — `thermal-analysis.ts` uses a parametric component list for heat sources. It should read actual placed instances from the PCB layout (with their package thermal resistance from `FootprintLibrary`) and use their XY positions to compute spatial heat diffusion. Currently there is no connection between PCB placement and thermal simulation. | OPEN | Wave 65 audit |
| BL-0563 | **BOM back-annotation to schematic** — When a BOM item's MPN or value is changed (e.g. component substitution in the Procurement view), the corresponding schematic instance's properties (value, manufacturer, MPN) should update to match. Currently BOM and schematic instances are entirely decoupled after initial entry. | OPEN | Wave 65 audit |
| BL-0564 | **Assembly cost estimator reads actual BOM** — `AssemblyCostEstimator` uses a manually entered part list. It should read from the current project's `bom_items` table as its input, so users don't re-enter data they've already captured in the BOM. | OPEN | Wave 65 audit |
| BL-0565 | **Inline supplier stock/price in BOM view** — The BOM table shows manufacturer and MPN but not real-time stock or pricing. Supplier data (from `supplier-apis.ts`, once real — see BL-0485) should be surfaced inline in the BOM row (stock badge, best price, lead time) without requiring a trip to the Procurement view. | OPEN | Wave 65 audit |
| BL-0566 | **DRC/PCB violation click → navigate to PCB canvas** — Clicking a PCB DRC violation in the ValidationView navigates to the Schematic (because the existing `validation-focus-pulse` logic was built for architecture/schematic). PCB DRC violations should switch the active view to PCB, center the viewport on the offending trace/pad, and pulse it. | OPEN | Wave 65 audit |
| BL-0567 | **Schematic component values → SPICE model auto-population** — When a resistor with `value: "10k"` is placed in the schematic, generating SPICE for simulation should auto-use that value rather than requiring the user to re-enter it in the SPICE editor. Currently the SPICE generator and the circuit instance schema are not linked — SPICE element values must be specified separately. | DONE | Wave 70 |
| BL-0568 | **Design snapshot restore cascade** — Restoring a design snapshot currently restores architecture nodes/edges only. It does not offer to also restore the schematic, BOM, and simulation results that existed at snapshot time. A true "time travel" restore should let users choose which domains to roll back together or independently. | OPEN | Wave 65 audit |
| BL-0569 | **Global cross-domain search** — There is no single search box that queries across schematic instances + BOM items + architecture nodes + community library + standard library + design history simultaneously. Finding "where is my LM7805?" requires checking five different panels manually. A unified search (like VS Code's Ctrl+P but for design objects) would dramatically improve navigation on complex projects. | DONE | Wave 70 |

### Cross-Tool Integration — Second Pass (Wave 65 Audit, continued)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0570 | **Architecture node → spawn schematic instance** — An architecture node typed as "Arduino Mega" or "LM7805" has zero connection to the schematic. Right-clicking a node should offer "Create schematic instance" which opens the schematic view and places the corresponding component. Without this, the architecture diagram is a whiteboard that contributes nothing to the rest of the design. | DONE | Wave 70 |
| BL-0571 | **Schematic ↔ Breadboard shared netlist** — The schematic canvas and breadboard view both represent the same physical circuit but share zero data. Placing a component in the schematic should offer to add it to the breadboard, and breadboard wire connections should be reflected as schematic nets. This is Fritzing's core differentiator — ProtoPulse has both views but no bridge between them. | OPEN | Wave 65 audit |
| BL-0572 | **DFM violations → highlight on PCB canvas** — `DfmChecker` results are displayed as a text list in the procurement/validation area. Clicking a violation should navigate to the PCB view and highlight the affected component/courtyard, exactly as BL-0566 does for DRC violations. Currently DFM and the PCB canvas are completely disconnected. | OPEN | Wave 65 audit |
| BL-0573 | **Design Variables ↔ SPICE simulation parameters** — `DesignVariablesPanel` stores named parameters (e.g. `Vcc = 5`, `R_load = 1k`). These should be importable as SPICE `.param` directives so the simulation automatically uses your design's variables instead of requiring manual re-entry. Currently the two systems exist independently with zero connection. | OPEN | Wave 65 audit |
| BL-0574 | **Monte Carlo ↔ BOM component tolerances** — Monte Carlo analysis requires manually specifying tolerance distributions (±1%, ±5%) for each component. It should read the `tolerance` field from `bom_items` and pre-populate distributions from the actual specified parts, so the simulation reflects the real components you've chosen rather than generic assumptions. | OPEN | Wave 65 audit |
| BL-0575 | **AI Chat → trigger and deliver exports** — The AI can discuss exports and explain how to use them, but it cannot actually invoke an export and provide a download link. Add AI tools `trigger_export` and `get_export_status` so the AI can say "I'll export this as KiCad 7 for you" and follow through. Currently the entire export system is unreachable from AI. | DONE | Wave 70 |
| BL-0576 | **AI Chat → simulation results in system prompt context** — Simulation output (DC operating voltages, transient waveform peaks, Monte Carlo yield, thermal hotspots) is never included in the AI's context. AI answers about "why is my circuit misbehaving" have zero access to what the simulation actually showed. Add a `buildSimulationContext()` function that summarizes the most recent simulation result and includes it in the system prompt. | DONE | Wave 70 |
| BL-0577 | **Digital Twin → out-of-spec telemetry creates validation issues** — When a connected device sends telemetry that exceeds a component's operating bounds (e.g. VCC = 4.1V, temperature = 87°C), the Digital Twin should automatically create a `validation_issue` record (type: "hardware-telemetry", severity: "warning") so it shows up in the ValidationView. Currently the Digital Twin and the validation system have zero connection. | OPEN | Wave 65 audit |
| BL-0578 | **Engineering Calculators → apply result to design** — After computing a result in any calculator (Ohm's Law: R = 330Ω; RC filter: C = 100nF), there should be an "Add to BOM" and "Apply to component" button that uses the result as the value for a selected BOM item or schematic instance. Currently results must be manually transcribed — the calculators are completely isolated from the rest of the design. | OPEN | Wave 65 audit |
| BL-0579 | **Export → auto-create design snapshot** — When a user exports Gerbers for fabrication (the most critical export), the system should offer (or automatically) create a timestamped design snapshot ("Sent to fab — 2026-03-12"). This ties design history to manufacturing milestones. Currently export and design history have zero connection. | OPEN | Wave 65 audit |
| BL-0580 | **Validation ↔ BOM completeness warnings** — BOM items with missing MPN, blank manufacturer, or unverified specs should generate validation issues (severity: "info" or "warning") in the ValidationView, e.g. "R3 has no MPN — cannot verify for manufacturing." Currently BOM and validation are entirely decoupled; you can submit a BOM full of blank fields and the validator never notices. | OPEN | Wave 65 audit |
| BL-0581 | **Standards Compliance → unified ValidationView** — `StandardsCompliance` checker (IPC-2221, IPC-7711, RoHS, etc.) produces a separate panel/report. Its results should appear as first-class items in the `ValidationView` alongside DRC and ERC violations, with the same severity badges, group-by, filter, and click-to-navigate UX. Currently standards compliance is a completely separate surface. | OPEN | Wave 65 audit |
| BL-0582 | **Unified component search across Standard Library + Community Library + BOM** — Users must search Standard Library and Community Library in separate panels, and there is no way to search BOM items from either. A single "Find component" search (Ctrl+K equivalent) that queries all three simultaneously and surfaces the best match — with an "Add to BOM" or "Place on schematic" action — would eliminate most of the cross-panel navigation overhead. | OPEN | Wave 65 audit |
| BL-0583 | **Design Patterns → place schematic instances (not just arch nodes)** — `SnippetLibrary` design pattern snippets place `architecture_nodes` when applied. They should also be able to place `circuit_instances` + `circuit_nets` on the schematic canvas when invoked from SchematicView. A "5V regulator with decoupling" pattern should produce a wired schematic subcircuit, not just an architecture block. | OPEN | Wave 65 audit |
| BL-0584 | **Arduino Workbench → Knowledge Hub compile error linking** — When a compile error appears in the Workbench console, pattern-match it against known error signatures ("undefined reference to", "library not found", "no such file") and surface an inline link to the relevant Knowledge Hub article or a one-liner fix hint. Currently the 20-article knowledge hub is completely unreachable from the Workbench. | OPEN | Wave 65 audit |
| BL-0585 | **Component Editor → SPICE model / subcircuit attachment** — Custom components defined in the Component Editor have no SPICE model field. When those components are placed in a schematic and a simulation runs, they are silently ignored or cause missing-model errors. Add a SPICE subcircuit (`.subckt`) text field to component definitions so custom ICs and modules can participate in simulation. | OPEN | Wave 65 audit |
| BL-0586 | **Export panel → one-click complete fab package** — There is no single action that produces a complete manufacturing package (Gerbers + drill + BOM CSV + CPL CSV + readme.txt) as a single zip download. This bundle is only reachable by going through the full PCB ordering wizard. Add a standalone "Download fab package" button in the Export panel that generates it without requiring an order to be placed. | OPEN | Wave 65 audit |

### Tech Debt — Wave 64 Audit Additions

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0550 | **GPU Monte Carlo: implement actual GPU pipeline** — `gpu-monte-carlo.ts` has a CPU fallback but the WebGPU path never actually parallelizes the Monte Carlo batches; it falls back immediately if GPU init takes > 100ms. Implement proper async pipeline initialization and a retry path. | OPEN | Wave 64 audit |
| BL-0551 | **TelemetryLogger → DeviceShadow live overlay wiring** — `telemetry-logger.ts` persists frames to IndexedDB and `device-shadow.ts` tracks reported/desired state, but the Digital Twin overlay in `DigitalTwinView` reads only the shadow snapshot, not the live telemetry ring buffer. Wire `TelemetryLogger.subscribe()` to update the overlay in real time. | OPEN | Wave 64 audit |
| BL-0552 | **API type generation CI gate** — `shared/api-types.generated.ts` exists but is generated manually and not enforced in CI. Add a `npm run check:api-types` script that regenerates and compares against committed types, failing if they drift. | OPEN | Wave 64 audit |

---

## P3 — Low (Nice-to-Have / Long-Term Vision)

### Learning & Education

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0300 | Step-by-step beginner learning path (zero to PCB) | PARTIAL | MF-033 |
| BL-0301 | Guided "first PCB" interactive tutorial | OPEN | MF-035 |
| BL-0302 | Lesson mode that locks UI to only needed controls | OPEN | MF-036 |
| BL-0303 | Skill-level adaptive hints (beginner/intermediate/advanced) | PARTIAL | MF-038, IFX-066 |
| BL-0304 | Lab/assignment templates for educators | OPEN | MF-041 |
| BL-0305 | Classroom mode (teacher dashboard + student submissions) | OPEN | MF-042, IFX-067 |
| BL-0306 | Interactive troubleshooting wizard for common mistakes | OPEN | MF-043, IFX-063 |
| BL-0307 | First-run checklist with progress | OPEN | UX-071 |
| BL-0308 | Guided sample projects ("learn by doing") | OPEN | UX-072, IFX-062 |
| BL-0309 | Beginner mode with simplified UI labels | OPEN | UX-073, IFX-061 |
| BL-0310 | Role presets (Student/Hobbyist/Pro) tune UI density | OPEN | UX-075, IFX-076 |
| BL-0311 | Smart hints triggered by repeated user mistakes | OPEN | UX-076 |
| BL-0312 | "Explain this panel" button everywhere | OPEN | UX-077 |
| BL-0313 | Per-view onboarding hints for first 3 uses | OPEN | UX-018 |
| BL-0314 | Progress milestones from beginner to fab-ready | OPEN | IFX-064 |

### Accessibility

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0320 | Keyboard-operable resize handles | OPEN | UX-081 |
| BL-0321 | Visible focus rings on all interactive controls | OPEN | UX-082 |
| BL-0322 | Fix off-screen tooltip placement | OPEN | UX-083 |
| BL-0323 | Explicit `type` attribute on all form buttons | OPEN | UX-084 |
| BL-0324 | Improve color contrast in low-contrast surfaces | OPEN | UX-085 |
| BL-0325 | Reduced-motion mode | OPEN | UX-086 |
| BL-0326 | Screen-reader labels for canvas actions | OPEN | UX-088 |
| BL-0327 | Full keyboard-first editing mode | OPEN | UX-090 |
| BL-0328 | Accessibility audit dashboard with tracked fixes | OPEN | UX-089 |
| BL-0329 | Font scaling and spacing options | OPEN | UX-087 |

### Mobile & Responsive

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0340 | Tablet layout for side panels/inspectors | OPEN | UX-091 |
| BL-0341 | Touch-safe controls in compact mode | OPEN | UX-092 |
| BL-0342 | Mobile overflow handling for long tables | OPEN | UX-093 |
| BL-0343 | Mobile "review mode" for comments/checks | OPEN | UX-094 |
| BL-0344 | Bottom nav for core mobile actions | OPEN | UX-095 |
| BL-0345 | Gesture shortcuts (pinch zoom, two-finger pan) | OPEN | UX-096 |
| BL-0346 | Mobile capture workflows (photo→part, notes→BOM) | OPEN | UX-097 |
| BL-0347 | Responsive layout presets by device type | OPEN | UX-100 |

### Visual Design System

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0350 | Standardize icon language by domain | OPEN | UX-102 |
| BL-0351 | Consistent spacing scale and typography tokens | OPEN | UX-104 |
| BL-0352 | Light theme and OLED-black theme options | OPEN | UX-105, MF-192 |
| BL-0353 | Consistent motion language for transitions | OPEN | UX-106 |
| BL-0354 | State illustrations for empty/error/offline pages | OPEN | UX-107 |
| BL-0355 | Design system docs site in-app | OPEN | UX-108 |

### Performance Perception

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0360 | Operation duration hints for long actions | OPEN | UX-112 |
| BL-0361 | Partial loading per panel instead of blocking whole view | OPEN | UX-113 |
| BL-0362 | Background prefetch for likely next views | OPEN | UX-114 |
| BL-0363 | Progressive render for large lists/tables | OPEN | UX-115 |
| BL-0364 | "Slow path detected" UX with suggestions | OPEN | UX-117 |

### Developer Platform

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0370 | Public API + webhook platform | OPEN | MF-181, IFX-092 |
| BL-0371 | Plugin/extension SDK | OPEN | MF-182, IFX-091 |
| BL-0372 | Macro recorder/player for repeated actions | OPEN | MF-183 |
| BL-0373 | Custom keybinding editor | OPEN | MF-184 |
| BL-0374 | Scriptable command palette actions | OPEN | MF-185 |
| BL-0375 | CLI tooling for headless validation/export | OPEN | MF-188 |
| BL-0376 | Git-native design diff/merge | OPEN | MF-189 |
| BL-0377 | Public embed API for schematic/PCB views | OPEN | MF-164 |
| BL-0378 | Versioned API docs synced from live routes | OPEN | MF-165 |

### Advanced Collaboration

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0380 | SSO/OIDC for team/org deployments | OPEN | MF-176 |
| BL-0381 | RBAC + org/team tenancy model | OPEN | MF-177 |
| BL-0382 | Audit log explorer UI | OPEN | MF-178 |
| BL-0383 | Customizable workspace presets | OPEN | UX-020 |
| BL-0384 | Team command center | OPEN | IFX-119 |

### Advanced Navigation

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0390 | Interaction history timeline for step-back | OPEN | UX-039, IFX-078 |
| BL-0391 | Breadcrumbs for deep editor contexts | OPEN | UX-014 |
| BL-0392 | Quick jump/search for views and tools | OPEN | UX-013 |

### Arduino IDE Integration

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0400 | One-click "Open in Arduino IDE" from design | OPEN | ARDX-001 |
| BL-0401 | Round-trip diff viewer (ProtoPulse vs IDE) | OPEN | ARDX-003 |
| BL-0402 | Build/compile status panel | OPEN | ARDX-006 |
| BL-0403 | Upload firmware with full log output | OPEN | ARDX-007 |
| BL-0404 | Dependency resolver for Arduino libraries | OPEN | ARDX-009 |
| BL-0405 | Board package/version checker | OPEN | ARDX-010 |
| BL-0406 | Per-project board profile | OPEN | ARDX-011 |
| BL-0407 | Save last known good firmware build | OPEN | ARDX-012 |
| BL-0408 | Pre-upload safety checks | OPEN | ARDX-015 |
| BL-0409 | AI sketch starter from schematic | OPEN | ARDX-016 |
| BL-0410 | Smart code snippets per component | OPEN | ARDX-017 |
| BL-0411 | Board-aware suggestions (timers, PWM limits) | OPEN | ARDX-021 |
| BL-0412 | "Refactor to non-blocking" assistant | OPEN | ARDX-022 |
| BL-0413 | ISR safety scanner | OPEN | ARDX-023 |
| BL-0414 | RAM usage early-warning | OPEN | ARDX-024 |
| BL-0415 | Flash size budget tracker | OPEN | ARDX-025 |
| BL-0416 | Loop-time profiler overlay | OPEN | ARDX-026 |
| BL-0417 | Auto state-machine skeletons for robotics | OPEN | ARDX-027 |
| BL-0418 | Live variable watch over serial | OPEN | ARDX-028 |
| BL-0419 | Library conflict detector | OPEN | ARDX-067 |
| BL-0420 | AI "fix compile errors" action | OPEN | ARDX-076 |
| BL-0421 | AI "explain this sketch for a beginner" | OPEN | ARDX-077 |
| BL-0422 | Smart library install on compile error | OPEN | ARDX-066 |
| BL-0423 | Firmware version linked to design snapshot | OPEN | ARDX-056 |
| BL-0424 | One-click rollback to known-good sketch | OPEN | ARDX-057 |
| BL-0425 | Secrets scan before upload (API keys in sketch) | OPEN | ARDX-096 |
| BL-0426 | Hard block upload if target board mismatch | OPEN | ARDX-097 |

### Innovation Ideas

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0430 | AI co-designer (iterates design options side-by-side) | OPEN | IFX-009 |
| BL-0431 | AI root-cause map across circuit + firmware | OPEN | IFX-010 |
| BL-0432 | Monte Carlo visual risk envelope | OPEN | IFX-016 |
| BL-0433 | Expected-vs-observed sim overlay from telemetry | OPEN | IFX-017 |
| BL-0434 | Auto-tuning assistant for control loops (PID) | OPEN | IFX-020, ARDX-055 |
| BL-0435 | Bench dashboard preset (upload/log/plot/debug) | OPEN | IFX-026 |
| BL-0436 | Hardware incident bundle export | OPEN | IFX-028 |
| BL-0437 | Guided "board doctor" conversational diagnostics | OPEN | IFX-030 |
| BL-0438 | Predictive yield estimator | OPEN | IFX-040 |
| BL-0439 | Community template packs | OPEN | IFX-095 |
| BL-0440 | Marketplace for reusable circuit blocks | OPEN | IFX-096 |
| BL-0441 | "Remix this design" from public examples | OPEN | IFX-101 |
| BL-0442 | Build journals (auto notes as project evolves) | OPEN | IFX-102 |
| BL-0443 | Project scorecards (cost, risk, readiness) | OPEN | IFX-104 |
| BL-0444 | Smart reminders for unfinished critical steps | OPEN | IFX-105 |
| BL-0445 | Creator profile pages for shared projects | OPEN | IFX-107 |

### Moonshots

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0450 | End-to-end "idea to ordered PCB" in 30 minutes | OPEN | IFX-111 |
| BL-0451 | Full circuit + firmware + enclosure co-design flow | OPEN | IFX-112 |
| BL-0452 | AI textual product goals → architecture options | OPEN | IFX-113 |
| BL-0453 | Automated bench robot integration | OPEN | IFX-114 |
| BL-0454 | Multi-board system orchestrator | OPEN | IFX-115, ARDX-065 |
| BL-0455 | AR overlay for real-board pin mapping | OPEN | IFX-079 |
| BL-0456 | Voice-driven workflow for bench sessions | OPEN | IFX-080, ARDX-094 |
| BL-0457 | Self-healing assistant with approval gates | OPEN | IFX-089, ARDX-084 |
| BL-0458 | Predictive failure alerts from trend anomalies | OPEN | IFX-090 |
| BL-0459 | Circuit sandbox game with score/feedback | OPEN | IFX-069 |
| BL-0460 | AI tutor persona (Socratic questioning) | OPEN | IFX-070 |
| BL-0461 | Firmware-aware simulation mode | OPEN | ARDX-046 |
| BL-0462 | HIL-lite mode (mock missing sensors) | OPEN | ARDX-054 |
| BL-0463 | Real-time drift detection | OPEN | ARDX-112 |
| BL-0464 | Time machine playback (firmware + logs + schematic) | OPEN | ARDX-113 |
| BL-0465 | "Design-to-drive" mode (auto-create test firmware from schematic) | OPEN | ARDX-106 |
| BL-0466 | AI copilot co-debugs wiring + firmware together | OPEN | ARDX-107 |
| BL-0467 | ProtoPulse "mission mode" — concept to shipping kit | OPEN | IFX-120 |
| BL-0553 | **3D viewer WebGL migration** — Replace the current scene-graph renderer with a Three.js / WebGL renderer that loads real STEP/VRML component models, supports realistic lighting, shadow casting, and per-layer material shading for professional PCB visualization. | OPEN | Wave 64 audit |
| BL-0554 | **AC analysis harmonic distortion (THD/IMD)** — Extend the AC small-signal analysis engine to compute total harmonic distortion and intermodulation distortion for audio/RF circuits. Requires nonlinear Volterra series expansion or direct time-to-frequency transform post-transient. | OPEN | Wave 64 audit |
| BL-0555 | **SI Advisor + PDN circuit-solver deep integration** — Currently `si-advisor.ts` and `pdn-analysis.ts` produce separate reports. Build a unified power/signal integrity dashboard where PDN impedance results (via Z(f) solver) feed directly into SI stack-up recommendations, and topology changes update both simultaneously. | OPEN | Wave 64 audit |
| BL-0556 | **BGA fanout and escape routing rule set** — Add specialized DRC rules and a fanout-routing assistant for BGA packages: dog-bone via patterns, escape channel width enforcement, ball-pitch vs via-size constraints, and anti-pad clearances. Required for any design with fine-pitch BGAs. | OPEN | Wave 64 audit |
| BL-0557 | **Circuit Code DSL: pin alias and local net naming** — Allow named local nets within a DSL block scope (e.g. `const vref = net('VREF')`) so that complex sub-circuits can be composed without polluting the global net namespace. Enables reusable DSL modules. | OPEN | Wave 64 audit |
| BL-0630 | **Scratch-like visual block programming for Arduino** — Drag-and-drop block coding (Scratch/MIT App Inventor style) that generates valid Arduino C/C++. Categories: Output (digitalWrite, analogWrite, tone), Input (digitalRead, analogRead), Control (if/else, loops, delay), Math, Variables, Functions. Side-by-side blocks+text view where editing one updates the other. The primary reason TinkerCAD dominates K-12 education. Enables truly zero-experience users to make circuits work. | OPEN | Wave 66 / TinkerCAD |
| BL-0631 | **Simulator-based firmware execution (QEMU / simavr)** — Run compiled Arduino firmware in a software simulator (simavr for AVR, QEMU for ARM/RISC-V) without physical hardware. Debug with breakpoints, inspect registers and memory, fast-forward time. PlatformIO supports this via `test_speed = host`. Enables full development and testing workflow for users without hardware at hand. | OPEN | Wave 66 / PlatformIO |
| BL-0632 | **Hardware debugger integration (ST-LINK, J-Link, CMSIS-DAP)** — Full GDB-based debugging over SWD/JTAG: breakpoints, watchpoints, variable inspection, peripheral register view (SVD), FreeRTOS thread awareness. PlatformIO supports 30+ debug probes out of the box. Browser-based approach requires a local proxy agent or WebUSB + OpenOCD integration. The most powerful feature gap vs PlatformIO for serious embedded developers. | OPEN | Wave 66 / PlatformIO |
| BL-0633 | **ESP-IDF framework support** — ESP-IDF (the official Espressif SDK) unlocks WiFi stacks, BLE, FreeRTOS tasks, partitions, NVS, and deep-sleep properly on ESP32 — things the Arduino framework abstracts poorly. PlatformIO supports ESP-IDF alongside Arduino in the same project. Relevant for any serious ESP32 maker project going beyond basic connectivity. | OPEN | Wave 66 / PlatformIO |
| BL-0634 | **Static analysis (Cppcheck / Clang-Tidy) for firmware** — Run Cppcheck or Clang-Tidy server-side on uploaded Arduino/C++ code and surface annotations in the editor: null pointer dereferences, buffer overflows, uninitialized variables, integer overflow risks, dead code. PlatformIO integrates 3 analyzers. Particularly valuable for beginner makers who don't know what they don't know. | OPEN | Wave 66 / PlatformIO |
| BL-0635 | **Arduino code simulation (compile + run in browser)** — Compile and execute actual Arduino C/C++ code in the browser against a software-simulated microcontroller (simavr WASM build or equivalent). Serial.print() output appears in Serial Monitor, pin states drive component visual states (BL-0619), sensor sliders feed analogRead(). TinkerCAD does this for ~9 built-in libraries. The holy grail for a browser-based EDA+firmware tool. (See also BL-0461 firmware-aware simulation.) | OPEN | Wave 66 / TinkerCAD + PlatformIO |

---

## Completed Work Summary

51 waves of implementation have been completed. The following is a summary, not an exhaustive list:

| Domain | Key Completions |
|--------|----------------|
| **Security** | Wave A: ownership guards (22 files/100+ routes), DRC sandbox, URL validation, cache clear. Wave E: CORS allowlist, SPICE sanitization, tool confirmation, session resilience, graceful shutdown. |
| **Core EDA** | Push-and-shove routing, differential pair routing + meander, maze autorouter, trace router, footprint library (27 packages), copper pour, board stackup, PCB DRC (10 rules), net-class rules. |
| **Simulation** | DC operating point, AC analysis, transient simulation, Monte Carlo tolerance, thermal analysis, PDN analysis, signal integrity (transmission line + crosstalk + eye diagram), design variables. |
| **Hardware** | WebSerialManager (15 board profiles), SerialMonitorPanel, digital twin (telemetry protocol + device shadow + firmware templates), camera component ID, pinout hover (13 pinouts). |
| **AI** | 88 tools across 12 modules, agentic AI loop, generative design (fitness scoring + circuit mutation), confidence badges, AI review queue, architecture analyzer. |
| **Collaboration** | WebSocket rooms, CRDT ops, live cursors, role enforcement, offline sync, IndexedDB, service worker. |
| **Manufacturing** | PCB ordering (5 fab profiles), assembly cost estimator, LCSC/JLCPCB mapping, DFM checker (15 rules), ODB++ export, IPC-2581 export, Gerber, drill, pick-and-place generators. |
| **Import/Export** | 8 format parsers (KiCad, Eagle, Altium, gEDA, LTspice, Proteus, OrCAD, Generic), STEP 3D export, SPICE netlist parser, FZPZ handler, supplier APIs (7 distributors). |
| **Learning** | Tutorial system (5 tutorials), electronics knowledge hub (20 articles), design patterns library, standard component library (100 components), community library. |
| **UI/UX** | 26 ViewModes, command palette, keyboard shortcuts (19 defaults), i18n framework, Kanban board, barcode scanning, QR labels, DRC constraint overlay, circuit design as code (CodeMirror + DSL). |
| **Audit Fixes** | Frontend audit: 113/113 complete. Backend audit: 110/116 (4 open, 2 partial). |

**Test suite:** ~8784 tests across 198 files, 0 failures.

---

## Source Document Map

| Source | Location | Items | Status |
|--------|----------|-------|--------|
| Codex master findings rollup | `docs/audits_and_evaluations_by_codex/zz_master_findings_rollup.md` | 293 findings (P0-P3) | Most P0s fixed in Waves A/E |
| Codex missing features backlog | `docs/audits_and_evaluations_by_codex/zz_missing_features_capabilities_integrations_master_backlog.md` | 200 items (MF-001 to MF-200) | ~57 DONE, ~70 PARTIAL, ~73 remaining |
| Codex UX backlog | `docs/audits_and_evaluations_by_codex/zz_ui_ux_improvements_and_enhancements_backlog.md` | 120 items (UX-001 to UX-120) | 8 confirmed done, rest open |
| Codex innovative features | `docs/audits_and_evaluations_by_codex/zz_innovative_feature_ideas_backlog.md` | 120 items (IFX-001 to IFX-120) | Aspirational — most open |
| Codex Arduino/embedded | `docs/audits_and_evaluations_by_codex/zz_innovative_arduino_ide_and_embedded_features_backlog.md` | 115 items (ARDX-001 to ARDX-115) | Aspirational — most open |
| App visual/functional audit | `docs/app-audit-checklist.md` | 91 observed findings | All open (observed DOM bugs) |
| Frontend audit checklist | `docs/frontend-audit-checklist.md` | 113 findings | **113/113 DONE** |
| Backend audit checklist | `docs/backend-audit-checklist.md` | 116 findings | 110 done, 4 open, 2 partial |
| Audit v2 checklist | `docs/audit-v2-checklist.md` | 288 checks (213 pass, 7 partial) | 3 remaining fails |
| Product analysis checklist | `docs/product-analysis-checklist.md` | 166 items | **166/166 DONE** |
| Product analysis report | `docs/product-analysis-report.md` | 74 GA-* findings | Many fixed Waves A-E, ~30 remaining |
| Codex master fix plan | `docs/plans/2026-03-06-codex-audit-master-fix-plan.md` | Waves A-G | A-E DONE, F-G open |

---

*Last updated: 2026-03-13 — Wave 69: BL-0489, BL-0492, BL-0493, BL-0496, BL-0499, BL-0500, BL-0506, BL-0590, BL-0591, BL-0592, BL-0621, BL-0624 done. Wave 70: BL-0567, BL-0569, BL-0570, BL-0575, BL-0576 done. Wave 71: BL-0490, BL-0497 done.*
