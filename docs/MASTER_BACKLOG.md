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
| P0 | 0 | Security holes, crashes, data loss — all resolved (11 in Wave 52, 2 in Wave 53, 1 PARTIAL BL-0005) |
| P1 | 28 | Broken workflows, major UX trust issues, test gaps (7 Wave 54, 9 verified-done + 4 fixed Wave 55, 6 verified-done + 3 fixed Wave 56) |
| P2 | 140 | Feature gaps, polish, partial implementations |
| P3 | 142 | Nice-to-have, long-term vision, moonshots |
| **Total** | **342** | |

---

## P0 — Critical (Security / Crashes / Data Loss)

### Security

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0001 | **Auth bypass in dev mode** — `NODE_ENV !== 'production'` skips all session validation. Every endpoint is unauthenticated in dev. | DONE (Wave E) | app-audit §14 |
| BL-0002 | **`/api/seed` is public** — listed in `PUBLIC_PATHS`. Any non-prod deployment allows unauthenticated DB seeding. | DONE (Wave 52) | app-audit §14 |
| BL-0003 | **API keys sent in plaintext** in every `/api/chat/ai/stream` POST body. Visible in DevTools, potentially logged by proxies. | DONE (Wave 52) | app-audit §14 |
| BL-0004 | **Response body logging captures API keys** — server logs first 500 chars of every JSON response. | DONE (Wave E) | app-audit §14 |
| BL-0005 | **API keys in localStorage** — `gemini_api_key` accessible to any XSS on same origin. localStorage still used for unauthenticated BYOK; full fix requires auth UI (BL-0021). | PARTIAL | app-audit §14 |
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
| BL-0014 | **Schematic net edges silently fail** — 10x React Flow errors: `Couldn't create edge for source handle id: "pin-PB0"`. Nets don't render. | OPEN | app-audit §4 |
| BL-0015 | **BOM spinbutton constraints broken** — Fixed: string min/max attrs + Math.max clamping in onChange (Wave 54). | DONE | app-audit §7 |
| BL-0016 | **BOM float precision** — Fixed: Math.round(n * 100) / 100 before toFixed(2) in BomCards + BomTable (Wave 54). | DONE | app-audit §7 |
| BL-0017 | **Chat temperature slider float** — Fixed: Math.round rounding in display + aria-valuetext (Wave 54). | DONE | app-audit §11 |
| BL-0018 | **Component Editor float noise** — Fixed: round2() applied to pitch input onChange handler (Wave 54). | DONE | app-audit §3 |
| BL-0019 | **CSP `frame-ancestors` via `<meta>`** — Fixed: removed from meta tag, added frameAncestors to Helmet CSP header (Wave 54). | DONE | app-audit §1 |
| BL-0020 | **Duplicate API requests on load** — Mitigated: global `staleTime: 5min` + `refetchOnWindowFocus: false` in queryClient.ts deduplicates within React Query. Seed request has 5s AbortSignal timeout. Remaining duplicates are React Query's expected mount-time checks. | DONE | app-audit §16 |

### Auth & Session

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0021 | **No login/register UI** — Backend auth exists but zero frontend auth pages. `/login`, `/register` all 404. | OPEN | app-audit §12 |
| BL-0022 | **No session management** — No X-Session-Id stored/sent by client. Auth layer is dead code. | OPEN | app-audit §12 |
| BL-0023 | **App fully accessible without auth** — No protected routes client-side. Anyone can view/edit/delete. | OPEN | app-audit §12 |

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
| BL-0026 | **ChatPanel has 22 useState hooks** — any state change re-renders entire 829-line component. | OPEN | app-audit §15 |
| BL-0027 | **Mutations invalidate full query lists** — every message triggers full refetch instead of optimistic update. | OPEN | app-audit §15 |

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
| BL-0034 | **Route-level ownership integration tests** — verify all route families enforce ownership. | OPEN | Wave F (F1) |
| BL-0035 | **Collaboration handshake/auth tests** — WebSocket auth, room join, role enforcement. | OPEN | Wave F (F2) |
| BL-0036 | **Export/import contract integration tests** — verify format contracts between client/server. | OPEN | Wave F (F3) |
| BL-0037 | **AI tool executor boundary tests** — ownership, confirmation, cross-project mutation. | OPEN | Wave F (F4) |
| BL-0038 | **Simulation input validation tests** — tStep guard, resource limits. | OPEN | Wave F (F5) |

### Wiring Fixes (Partial Implementations)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0039 | **Collaboration runtime activation** — WebSocket rooms, CRDT ops exist (Wave 41) but not fully activated in production flow. | PARTIAL | MF-023 |
| BL-0040 | **Standard categories not unified** — UI filter categories don't match storage categories end-to-end. | PARTIAL | MF-026 |
| BL-0041 | **Metrics lifecycle not fully wired** in runtime (metrics collection exists but dashboard/export missing). | PARTIAL | MF-030 |
| BL-0042 | **Route-level test coverage** weaker than actual route surface area. | PARTIAL | MF-032 |
| BL-0043 | **Migration chain out of sync** with runtime schema (Drizzle push works but formal migrations drift). | PARTIAL | MF-014 |
| BL-0044 | **Import transactions** — multi-step import writes lack real transaction safety. | PARTIAL | MF-015 |
| BL-0045 | **API error/status consistency** — response envelopes still vary across route families. | PARTIAL | MF-020 |

### UX Trust Fixes

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0046 | **Show real status labels** — remove fake "success" states, add working/success/failed chips. | OPEN | UX-001, UX-006 |
| BL-0047 | **Confirm modal for destructive actions** — Already implemented: ConfirmDialog on snapshot delete (DesignHistoryView), BOM delete (BomCards+BomTable), BOM snapshot delete (BomDiffPanel), output clear (OutputView). | DONE | UX-004 |
| BL-0048 | **Replace misleading labels** — Fixed: "Fix all issues" → "Help me fix these issues" in ChatPanel suggestion (Wave 56). | DONE | UX-005 |
| BL-0049 | **Consistent toast style** — success, warning, error, info variants. | OPEN | UX-007 |
| BL-0050 | **Retry button** on all network/API failure states. | OPEN | UX-008 |
| BL-0051 | **"Last saved at"** and "unsaved changes" indicator in editor header. | OPEN | UX-010 |
| BL-0052 | **Chat help links not clickable** — Already fixed: SettingsPanel.tsx has proper `<a>` elements with href/target/rel for Anthropic and Google console links. | DONE | app-audit §11 |
| BL-0053 | **Chat model names inconsistent** — Already fixed: constants.ts uses consistent "Claude X.Y ModelName" pattern for all models (4.5 Sonnet, 4.6 Sonnet, 4 Opus, etc.). | DONE | app-audit §11 |
| BL-0054 | **No validation feedback on settings save** — Fixed: added toast notification on "Save & Close" (Wave 55). | DONE | app-audit §11 |
| BL-0055 | **Output view shows fake data** — Already fixed: OutputView uses real context data from useOutput() hook. No hardcoded mock entries remain. | DONE | app-audit §9 |
| BL-0056 | **"BASH / LINUX" label misleading** — Fixed: changed to "SYSTEM LOG" in OutputView.tsx (Wave 56). | DONE | app-audit §9 |
| BL-0057 | **Validation severity numbers** — Already fixed: ValidationView uses semantic text ("error"/"warning"/"info") with color-coded badges and icons, not numeric values. | DONE | app-audit §8 |
| BL-0058 | **No severity filtering** — Fixed: added severity filter bar (error/warning/info toggles with counts) to ValidationView (Wave 56). | DONE | app-audit §8, UX-041 |
| BL-0059 | **DRC violations not grouped** — identical violations listed individually, should group by rule type. | OPEN | app-audit §8, UX-042 |
| BL-0060 | **BOM delete has no confirmation** — Already fixed: ConfirmDialog wraps delete in both BomCards.tsx (line 77-88) and BomTable.tsx (line 220-227) with "Remove BOM Item" title + variant=destructive. | DONE | app-audit §7 |
| BL-0061 | **BOM no column sorting** — can't sort by status, part number, price, stock. | OPEN | app-audit §7 |
| BL-0062 | **No context menu** on Architecture/Schematic/PCB canvases. Common EDA actions undiscoverable. | OPEN | app-audit §2 |
| BL-0063 | **No visible undo/redo buttons** — Already fixed: SchematicToolbar.tsx has visible Undo2/Redo2 buttons (lines 91-118) with tooltips "Undo (Ctrl+Z)"/"Redo (Ctrl+Shift+Z)", disabled states, data-testids. | DONE | app-audit §2 |

---

## P2 — Medium (Feature Gaps & Polish)

### Core EDA — Schematic & PCB

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0100 | Keep-out/keep-in region editor | OPEN | MF-052 |
| BL-0101 | Board cutouts/slots/internal milling editor | OPEN | MF-053 |
| BL-0102 | Via stitching automation | OPEN | MF-054 |
| BL-0103 | Teardrop generation | OPEN | MF-055 |
| BL-0104 | Multi-sheet schematic hierarchy management | OPEN | MF-060 |
| BL-0105 | Live pin-compatibility checks for replacements | OPEN | MF-063 |
| BL-0106 | Auto decoupling/power network placement suggestions | OPEN | MF-064 |
| BL-0107 | AI placement optimization assistant | OPEN | MF-065 |
| BL-0108 | Node inline label editing on canvas | OPEN | app-audit §2 |
| BL-0109 | Node properties inspector panel | OPEN | app-audit §2 |
| BL-0110 | Canvas copy/paste support | OPEN | app-audit §2 |
| BL-0111 | Multi-select rectangle on canvas | OPEN | app-audit §2 |
| BL-0112 | Empty state guidance on canvases (Architecture, Schematic, PCB, Breadboard) | OPEN | app-audit §2, §4, §5, §6 |
| BL-0113 | Sidebar collapsed nav mismatch — different views shown depending on sidebar state | OPEN | app-audit §1 |
| BL-0114 | URL deep linking per view tab (currently static `/projects/1`) | OPEN | app-audit §1 |

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
| BL-0127 | Simulation resource guardrails (time, memory, output) | OPEN | MF-079 |
| BL-0128 | Live current/voltage animation overlay (EveryCircuit-style) | OPEN | MF-080, IFX-011 |
| BL-0129 | Failure injection mode (open/short/noisy sensor) | OPEN | IFX-013 |
| BL-0130 | What-if slider for instant value sweeps | OPEN | IFX-012 |

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

### AI Capabilities

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0160 | AI plan/dry-run mode with impact preview | OPEN | MF-144, MF-155 |
| BL-0161 | AI safety mode for beginners (extra confirms + teaching) | OPEN | MF-145 |
| BL-0162 | Datasheet RAG for grounded suggestions | OPEN | MF-147 |
| BL-0163 | AI testbench suggestions for simulation | OPEN | MF-148, IFX-015 |
| BL-0164 | AI BOM optimization assistant | OPEN | MF-149, IFX-035 |
| BL-0165 | AI routing copilot with explainable reasoning | OPEN | MF-150, IFX-007 |
| BL-0166 | AI hardware debug assistant | OPEN | MF-152, IFX-010 |
| BL-0167 | AI explain mode in simple language | OPEN | MF-153, IFX-003 |
| BL-0168 | Tool allowlists per endpoint/task | PARTIAL | MF-142 |
| BL-0169 | AI answer source panel (what data it used) | OPEN | UX-028 |
| BL-0170 | AI task templates ("Find BOM cost cuts", etc.) | OPEN | UX-029, IFX-071 |
| BL-0171 | Preview change before applying AI actions | OPEN | UX-023, UX-030 |
| BL-0172 | Napkin-to-schematic (photo/sketch → circuit draft) | OPEN | IFX-001 |
| BL-0173 | AI net naming cleanup suggestions | OPEN | IFX-005 |

### Collaboration & Teams

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0180 | Spatial review comments pinned to coordinates | OPEN | MF-114, IFX-051 |
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

### Manufacturing & Supply Chain

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0200 | Panelization tool with tab/v-score/fiducial | OPEN | MF-132, IFX-037 |
| BL-0201 | Pick-and-place validation and preview | OPEN | MF-133, IFX-038 |
| BL-0202 | Manufacturing package validator before download | OPEN | MF-135 |
| BL-0203 | Build-time risk score (cost + supply + assembly) | OPEN | MF-137, IFX-031 |
| BL-0204 | Quote and order history per project | OPEN | MF-140 |
| BL-0205 | MPN normalization and dedup in BOM | PARTIAL | MF-129 |
| BL-0206 | AML/approved-vendor-list enforcement | OPEN | MF-138 |
| BL-0207 | Assembly risk heatmap | OPEN | IFX-034 |
| BL-0208 | One-click manufacturing package wizard | OPEN | UX-060, IFX-036 |

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
| BL-0230 | Mini-map for large schematic/PCB canvases | OPEN | UX-038 |
| BL-0231 | Smart contextual radial menu on right-click | OPEN | UX-040 |
| BL-0232 | Click validation issue → focus camera + flash component | OPEN | UX-042 |
| BL-0233 | "Why this rule matters" plain-language explanation | OPEN | UX-043 |
| BL-0234 | Persist panel sizes/collapsed state (localStorage) | OPEN | UX-011, D8 |
| BL-0235 | Command palette categories by workflow stage | OPEN | UX-016 |
| BL-0236 | Context-aware shortcuts panel (`?` overlay) | OPEN | UX-017 |
| BL-0237 | Recent projects with filters and pinning | OPEN | UX-019 |
| BL-0238 | Supplier comparison drawer (price, lead time, MOQ) | OPEN | UX-065 |
| BL-0239 | Auto-grouping for SMT/THT/manual assembly | OPEN | UX-066 |
| BL-0240 | Lifecycle warning badges (NRND/EOL) | OPEN | UX-067 |
| BL-0241 | Cost optimization mode with goals/tradeoffs | OPEN | UX-068 |

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
| BL-0280 | **HSTS header missing** — enable via Helmet `hsts: { maxAge: 63072000, includeSubDomains: true }` | OPEN | GA-SEC-14 |
| BL-0281 | **Referrer-Policy header** — add `strict-origin-when-cross-origin` | OPEN | GA-SEC-15 |
| BL-0282 | **CSP `unsafe-inline` for styles** — replace with nonce-based or hash-based | OPEN | GA-SEC-16 |
| BL-0283 | **scrypt cost factor not configured** — set `N=32768, r=8, p=1` explicitly | OPEN | GA-SEC-19 |
| BL-0284 | **Auth endpoints lack brute-force protection** — strict limiter + temp lockout | OPEN | GA-SEC-07 |

### API & Data Contracts

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0285 | **No pagination on circuit endpoints** — add `limit/offset/sort` on instances/nets/wires | OPEN | GA-API-02 |
| BL-0286 | **No API versioning** — introduce `/api/v1/` prefix + `Deprecation`/`Sunset` headers | OPEN | GA-API-03 |
| BL-0287 | **No SSE reconnection logic** — retry with exponential backoff + "Reconnecting..." UI | OPEN | GA-API-05 |
| BL-0288 | **No SSE heartbeat events** — emit `:heartbeat\n\n` every 15-30s during idle | OPEN | GA-API-06 |
| BL-0289 | **Delete lifecycle inconsistent** — define global soft-vs-hard policy matrix by entity | OPEN | GA-DATA-01 |
| BL-0290 | **No generated API types** — use zod-to-ts or OpenAPI; enforce in CI | OPEN | GA-API-04 |

### Performance (P2)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0291 | **53 inline style objects** create new references on every render — extract to `const` | OPEN | GA-PERF-01 |
| BL-0292 | **Missing composite indexes** on soft-delete queries — add `(projectId, deletedAt)` | OPEN | GA-DB-02 |
| BL-0293 | **`ChatPanel.handleSend` 22-item useCallback dependency** — consolidate to ref/reducer | OPEN | GA-PERF-02 |
| BL-0294 | **Undo/redo stacks have no depth limit** — add configurable max (e.g. 100) | OPEN | GA-PERF-07 |

### Platform & Ops

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0260 | Persistent job durability store (not in-memory only) | OPEN | MF-170 |
| BL-0261 | Full observability (structured logs, traces, alerts) | OPEN | MF-171 |
| BL-0262 | Error taxonomy with stable error codes | OPEN | MF-173 |
| BL-0263 | Data retention policies and cleanup tooling | OPEN | MF-174 |
| BL-0264 | Deployment profiles (dev/staging/prod) with config validation | OPEN | MF-179 |
| BL-0265 | CI coverage gates and test quality thresholds | OPEN | MF-180 |
| BL-0266 | CSP policy parity across dev/prod | PARTIAL | MF-167 |
| BL-0267 | Health/readiness checks tied to real dependencies | PARTIAL | MF-172 |
| BL-0268 | Auth timing-safe compare + throttling for admin ops | PARTIAL | MF-168 |

### Tech Debt (from code review / Wave 51)

| ID | Description | Status | Source |
|----|-------------|--------|--------|
| BL-0270 | `mulberry32` PRNG duplicated in monte-carlo.ts and gpu-monte-carlo.ts — extract to shared util | OPEN | Wave 51 review |
| BL-0271 | GPU Monte Carlo evaluator runs on CPU — implement actual GPU batch-solve pipeline | OPEN | Wave 51 review |
| BL-0272 | TelemetryLogger not connected to DeviceShadow live overlay | OPEN | Wave 51 review |
| BL-0273 | Component Editor auto-save fires every 2s during active drawing (mouse-move driven) | OPEN | app-audit §15 |
| BL-0274 | Only 2 components use `React.memo` — high-frequency children need memoization | OPEN | app-audit §15 |
| BL-0275 | `backdrop-blur-xl` GPU jank on low-end devices | OPEN | app-audit §15 |
| BL-0276 | No cache headers on API responses — relying entirely on client-side React Query cache | OPEN | app-audit §16 |

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

*Last updated: 2026-03-07 — Wave 51 complete (166/166 product analysis, 88 AI tools, 26 ViewModes, ~8784 tests)*
