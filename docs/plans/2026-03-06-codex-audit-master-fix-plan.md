# Master Fix Plan: Codex Audit Response

> Generated 2026-03-06 from validated analysis of 32 Codex audit files + 200-item backlog + 120-item UX backlog
> Validated by 3-agent research team against actual codebase
> UX backlog merged 2026-03-06 (cherry-picked high-value items, rest filed as long-term roadmap)

## Executive Summary

Codex audited the full ProtoPulse codebase and found 293 findings across 32 sections plus a 200-item missing features backlog. After validation against the actual codebase (which includes Waves 25-49 of work Codex didn't account for):

| Metric | Codex Claimed | Validated Reality |
|--------|--------------|-------------------|
| P0 blockers | 25 | 15 confirmed real, 5 invalid, 5 fixed |
| P1 findings | 126 | ~90 real, rest fixed or partial |
| "Missing" features (200) | 200 missing | 57 DONE, 70 PARTIAL, 73 truly missing |
| Codebase coverage | "lots of gaps" | 81% of backlog built or wired |

**The #1 systemic issue is IDOR/BOLA**: `requireProjectOwnership` middleware exists but is only applied to 2 routes (project PATCH/DELETE). It needs to be applied to 30+ routes across main, circuit, AI, and job surfaces.

---

## Wave A: P0 Security Blockers (IDOR + Sandbox + Injection)

**Goal**: Eliminate all data exposure and code execution risks
**Effort**: 2-3 days with /agent-teams (3 teammates)
**Priority**: MUST-FIX before any other work

### Task A1: Apply `requireProjectOwnership` to ALL project-scoped routes

**Files**: `server/routes/{architecture,chat,agent,validation,history,comments,embed,settings,batch,bom-snapshots,chat-branches,design-preferences,spice-models,component-lifecycle,design-history,backup}.ts`, `server/circuit-routes/{designs,instances,nets,wires,exports,simulations,hierarchy,imports}.ts`

**Context**:
- `requireProjectOwnership` already exists in `server/routes/auth-middleware.ts`
- Currently only used in `server/routes/projects.ts:66,100` (PATCH/DELETE)
- Need to apply it as middleware on ALL routes that take `:id` or `:projectId` param
- Circuit routes need a variant that resolves circuit -> project ownership

**Steps**:
1. Extend `requireProjectOwnership` to also handle `:projectId` param (circuit routes use this)
2. Create `requireCircuitOwnership` that resolves circuitId -> projectId -> ownership
3. Apply to all 30+ route files as `app.use('/api/projects/:id/*', requireProjectOwnership)`
4. Apply circuit variant to circuit-routes barrel
5. Add ownership check to AI tool executor context (server/ai-tools/)
6. Add ownership check to job queue routes
7. Tests: ownership integration tests for each route family

### Task A2: Fix DRC sandbox escape + hard timeout

**Files**: `client/src/lib/drc-scripting.ts`

**Context**:
- `new Function()` constructor allows prototype chain escape
- `Promise.race()` timeout can't preempt busy loops
- Need Web Worker isolation with `worker.terminate()` hard kill

**Steps**:
1. Create `drc-script-worker.ts` Web Worker
2. Move script execution into Worker (no main thread access)
3. Use `worker.terminate()` after timeout (hard kill, not cooperative)
4. Sanitize script input (block `constructor`, `__proto__`, `globalThis`)
5. Tests: escape attempt tests, infinite loop timeout tests

### Task A3: URL protocol validation across 9 surfaces

**Files**: `client/src/components/circuit-editor/PinoutHoverCard.tsx`, `client/src/components/panels/chat/DatasheetLink.tsx`, + 7 other surfaces with unvalidated URLs

**Context**:
- `javascript:` URIs can execute code when rendered as links
- Need allowlist: `https:`, `http:`, `mailto:` only

**Steps**:
1. Create `shared/url-validation.ts` with `isSafeUrl(url: string): boolean`
2. Apply to all 9 surfaces identified in FE audit
3. Tests: protocol injection tests

### Task A4: Query cache clear on auth identity change

**Files**: `client/src/lib/auth-context.tsx`, `client/src/lib/queryClient.ts`

**Context**:
- On logout/login, React Query cache retains previous user's data
- Need `queryClient.clear()` on identity change

**Steps**:
1. Add `queryClient.clear()` to logout handler in auth-context
2. Add `queryClient.clear()` on session identity change detection
3. Tests: verify cache is empty after identity switch

### Task A5: Quick backend fixes (3 one-liners)

**Files**: `server/ai.ts`, `shared/collaboration.ts`

1. **Dedup key collision**: Change `requestKey()` to use `projectId` (number) not `projectName` (string)
2. **Prompt cache scoping**: Add `userId`/`sessionId` to `hashAppState()`
3. **Lock key scoping**: Change `lockKey()` to include `projectId` parameter

---

## Wave B: P1 Wiring Fixes + UX Trust Fixes (Make Features Real)

**Goal**: Fix the "UI visible but not functional" pattern + core UX trust issues
**Effort**: 4-5 days with /agent-teams (4 teammates)
**Priority**: HIGH — these are broken user-facing workflows
**Merged from**: Codex audit P1 findings + UX backlog Section 1 (trust fixes) + Section 6 (import/export UX)

### Task B1: Wire import button to apply parsed data to project state

**Files**: `client/src/pages/ProjectWorkspace.tsx`, `client/src/lib/design-import.ts`

**Context**: Import parses files via 8 format parsers but never calls mutations to persist nodes/nets/wires to project state. The parse result is logged and view switches to output, but no state change occurs.

**Also covers**:
- UX-002: Make import button actually import to the live design state
- UX-003: Add clear error message when import fails (what failed + what to do next)
- UX-051: Add import preview summary before apply (components/nets/views count)
- UX-052: Show import mapping warnings clearly (what got dropped/changed)

### Task B2: Fix export panel auth + format contracts

**Files**: `client/src/components/panels/ExportPanel.tsx`

**Context**:
- Missing `X-Session-Id` header on fetch calls
- FZZ export expects JSON but server returns binary ZIP
- Gerber export reads `json.files` but server sends `json.layers`

**Also covers**:
- UX-053: Add export pre-check screen (missing fields, DRC status, output type hints)
- UX-054: Show exact exported files list and size after export

### Task B3: Wire "Generate Architecture" to AI request

**Files**: `client/src/components/views/ArchitectureView.tsx`

**Context**: CTA button writes a message but doesn't trigger AI request. Need to call the chat/AI endpoint.

### Task B4: Wire validation advanced checks to real data

**Files**: `client/src/components/views/ValidationView.tsx`

**Context**: Advanced checks explicitly pass empty arrays. Need to pass actual project nodes/edges/BOM data.

**Also covers**:
- UX-041: Group issues by severity + area + component
- UX-042: Click issue should focus camera and flash offending objects
- UX-043: Show "why this rule matters" in plain language

### Task B5: Fix simulation controls

**Files**: `client/src/components/simulation/SimulationPanel.tsx`, `ProbeOverlay.tsx`

**Context**:
- "Stop" button only flips UI state, no AbortController
- DC sweep hardcodes empty source list
- Probe placement adds empty target IDs, drag resets on mouseup

**Also covers**:
- UX-033: Add visible stop/cancel behavior for simulations and long ops
- UX-035: Add explicit tool state label ("Wire tool active", "Probe tool active")

### Task B6: Fix auth headers on all fetch calls

**Files**: `client/src/components/panels/ChatPanel.tsx`, `client/src/hooks/useChatSettings.ts`, `client/src/components/panels/ExportPanel.tsx`

**Context**: Multiple fetch calls use raw `fetch()` without `X-Session-Id` header. Should use `apiRequest` utility from `queryClient.ts`.

### Task B7: UX trust label fixes (merged from UX backlog Section 1)

**Files**: Various view/panel components

**Context**: Multiple UI surfaces show misleading labels or states.

**Covers**:
- UX-001: Show real status labels only (remove fake "success" states)
- UX-004: Add confirm modal for destructive actions (delete snapshot, clear data, etc.)
- UX-005: Replace misleading labels like "Fix all issues" with truthful wording
- UX-006: Add "working / success / failed" state chips on long AI actions
- UX-007: Add consistent toast style: success, warning, error, info
- UX-008: Always show retry button on network/API failure states
- UX-010: Add "last saved at" and "unsaved changes" indicator in editor header

---

## Wave C: P1 Contract Hardening

**Goal**: Unify data contracts across client/server boundaries
**Effort**: 2-3 days with /agent-teams (2-3 teammates)
**Priority**: HIGH — prevents silent data corruption

### Task C1: Chat message contract unification

**Files**: `client/src/components/panels/ChatPanel.tsx`, `shared/schema.ts`

**Context**: UI creates rich messages with `actions`/`toolCalls` metadata but schema only stores basic fields. Rich data lost on page reload.

### Task C2: BOM price type consistency

**Files**: `client/src/lib/contexts/bom-context.tsx`, `shared/schema.ts`

**Context**: Client expects `number` for prices; schema stores as `text`. Type coercion bugs.

### Task C3: Architecture busWidth type fix

**Files**: `shared/schema.ts`, client consumers

**Context**: Client expects `number`; schema stores as `text`.

### Task C4: API response envelope unification

**Files**: Multiple route files

**Context**: DELETEs return 204 in routes.ts but `{ success: true }` in circuit-routes.ts. Need one pattern.

---

## Wave D: PARTIAL -> DONE Quick Wins + Editor/Nav UX Polish

**Goal**: Finish partially-wired features + high-value UX quick wins
**Effort**: 5-6 days with /agent-teams (4 teammates)
**Priority**: MEDIUM — high ROI, most are 80% done
**Merged from**: Codex backlog PARTIAL items + UX backlog Sections 2, 4, 7, 11, 12

### Task D1: Wire Web Serial into main workspace

**Files**: `client/src/pages/ProjectWorkspace.tsx`, new `SerialMonitorPanel.tsx`

**Context**: `web-serial.ts` library is complete (15 board profiles, auto-reconnect). Only wired into settings, not main workspace. Need a SerialMonitor panel.

### Task D2: Finish import integration (AST -> actual state)

**Files**: `client/src/lib/design-import.ts`, project-context mutations

**Context**: 8 format parsers return ASTs but Altium/gEDA/LTspice don't fully map to nodes/nets/wires. Need to complete the AST -> mutation pipeline.

### Task D3: Couple copper-pour into DRC workflow

**Files**: `client/src/lib/copper-pour.ts`, `client/src/lib/pcb/pcb-drc-checker.ts`

**Context**: Pour fills zones; DFM checker validates separately. Need to auto-run copper pour validation as part of DRC pass.

### Task D4: Wire design variables UI

**Files**: `shared/design-variables.ts`, new `DesignVariablesPanel.tsx`

**Context**: Expression parser + dependency graph exist. No UI for declaring/managing variables in schematic.

### Task D5: Collaboration share dialog

**Files**: New `ShareProjectDialog.tsx`, wired from ProjectWorkspace

**Context**: WebSocket rooms + role enforcement exist. No UI for sharing/inviting collaborators.

### Task D6: Wire serial monitor + saved presets

**Files**: `client/src/lib/web-serial.ts`, `SerialMonitorPanel.tsx`

**Context**: Serial monitor code exists in library. Needs panel UI with preset management.

### Task D7: Editor interaction UX polish (merged from UX backlog)

**Files**: Various editor/canvas components

**Covers**:
- UX-031: Make selected net very obvious (color + pill label + inspector state)
- UX-032: Make placement errors show inline near cursor, not only in toasts
- UX-037: Add "snap/grid/angle" quick toggles in one compact strip

### Task D8: Navigation + workspace UX polish (merged from UX backlog)

**Files**: `ProjectWorkspace.tsx`, `Sidebar.tsx`, various panels

**Covers**:
- UX-011: Persist panel sizes and collapsed state across sessions (localStorage)
- UX-012: Fix dead controls in collapsed sidebar
- UX-015: Add global "Back to project list" button in workspace shell

### Task D9: Visual polish quick wins (merged from UX backlog)

**Files**: Various view components

**Covers**:
- UX-101: Standardize empty states with action-first messaging
- UX-103: Add subtle loading skeletons for all major data panels
- UX-111: Show optimistic UI state where safe (with rollback cues)

### Task D10: BOM/Procurement UX quick wins (merged from UX backlog)

**Files**: `ProcurementView.tsx` and sub-components

**Covers**:
- UX-061: Show stock state colors (in stock, low stock, unknown)
- UX-062: Add total cost delta vs previous revision
- UX-063: Add clear duplicate part warnings
- UX-064: Add quick "find alternates" action per BOM row

---

## Wave E: Security + Ops Hardening + AI Safety UX

**Goal**: Production-readiness security posture + AI action safety
**Effort**: 4-5 days
**Priority**: MEDIUM-HIGH for deployment
**Merged from**: Codex audit security findings + UX backlog Section 3 (AI chat UX)

### Tasks:
- E1: CORS allowlist hardening (CAPX-SEC-02)
- E2: SPICE netlist directive injection sanitization
- E3: `requiresConfirmation` server-side enforcement in AI tool registry
  - Also covers UX-023: Preview change before applying AI actions
  - Also covers UX-024: Add per-action confirm for risky operations
  - Also covers UX-030: Side-by-side "AI suggestion diff" UI before apply
- E4: Job queue tenant scoping + watchdog timeout
- E5: Session handling for network blips (don't clear on transient failure)
- E6: Graceful shutdown (SIGTERM handler, connection drain)
- E7: Standard library seed as true upsert
- E8: AI chat UX trust improvements
  - UX-021: Show exact model and mode used per message
  - UX-027: Show when chat settings failed to load and why

---

## Wave F: Test Reality Hardening

**Goal**: Test coverage matches actual route surface
**Effort**: 3-4 days
**Priority**: MEDIUM

### Tasks:
- F1: Route-level ownership integration tests (all route families)
- F2: Collaboration handshake/authorization tests
- F3: Export/import contract integration tests
- F4: AI tool executor boundary tests
- F5: Simulation input validation tests

---

## Wave G: UX Roadmap (Long-Term Polish)

**Goal**: Remaining UX improvements not absorbed into Waves A-F
**Effort**: Ongoing — pick items per sprint as bandwidth allows
**Priority**: LOW-MEDIUM — quality-of-life, not blocking

### G1: Accessibility (UX backlog Section 9)
- UX-081: Make resize handles keyboard-operable
- UX-082: Ensure all interactive controls have visible focus rings
- UX-083: Fix off-screen tooltip placement logic
- UX-084: Ensure all buttons inside forms use explicit button types
- UX-085: Improve color contrast in low-contrast surfaces
- UX-086: Reduced-motion mode for animation-heavy areas
- UX-088: Screen-reader optimized labels for canvas actions

### G2: Onboarding + Education (UX backlog Section 8)
- UX-071: First-run checklist with progress
- UX-072: Guided sample projects with "learn by doing" steps
- UX-073: Beginner mode with simplified UI labels
- UX-075: Role presets (Student, Hobbyist, Pro) that tune UI density
- UX-076: Smart hints triggered by repeated user mistakes
- UX-077: "Explain this panel" button everywhere

### G3: Advanced Editor UX (UX backlog Section 4)
- UX-038: Mini-map for large schematic/PCB canvases
- UX-039: Interaction history timeline for local step-back on object edits
- UX-040: Smart contextual radial menu on right click

### G4: Advanced Navigation (UX backlog Section 2)
- UX-016: Command palette categories by workflow stage
- UX-017: Context-aware shortcuts panel (? help overlay)
- UX-018: Per-view onboarding hints for first 3 uses
- UX-019: Recent projects with filters and pinning
- UX-020: Customizable workspace presets (Schematic/PCB/AI-focused)

### G5: Mobile + Responsive (UX backlog Section 10)
- UX-091 through UX-100 (tablet layout, touch controls, mobile review mode, gestures, PWA polish)

### G6: Visual Design System (UX backlog Section 11)
- UX-102: Standardize icon language by domain
- UX-104: Consistent spacing scale and typography tokens
- UX-105: Light theme and OLED-black theme option
- UX-106: Consistent motion language for panel transitions
- UX-107: State illustrations for empty/error/offline pages

### G7: Performance Perception (UX backlog Section 12)
- UX-112: Operation duration hints for long actions
- UX-113: Partial loading per panel instead of blocking whole view
- UX-114: Background prefetch for likely next views
- UX-115: Progressive render for large lists/tables

### G8: Advanced Validation UX (UX backlog Section 5)
- UX-046: Rule presets by project type (Arduino, power board, sensor board)
- UX-047: Side panel to compare current vs manufacturer rule set
- UX-048: Suppression workflow with reason + expiration
- UX-049: Guided remediation wizard (step-by-step fixes)
- UX-050: Risk score card for release readiness

### G9: Advanced Export/Import UX (UX backlog Section 6)
- UX-056: Export profiles ("Fab house ready", "Simulation bundle", "Docs bundle")
- UX-057: Import history with one-click restore
- UX-058: Side-by-side diff between imported and current design
- UX-059: Guided migration flow for KiCad/Eagle/EasyEDA imports
- UX-060: One-click manufacturing package wizard

### G10: Advanced BOM UX (UX backlog Section 7)
- UX-065: Supplier comparison drawer (price, lead time, MOQ)
- UX-066: Auto-grouping for SMT/THT/manual assembly
- UX-067: Lifecycle warning badges (NRND/EOL risk)
- UX-068: Cost optimization mode with goals and tradeoffs
- UX-069: Assembly-ready BOM report generator UI
- UX-070: "What changed in BOM and why" explain panel

### G11: AI Chat Advanced UX (UX backlog Section 3)
- UX-028: AI answer source panel (what data it used)
- UX-029: AI task templates ("Find BOM cost cuts", "Review DRC risk", etc.)

---

## UX Items Already Covered by Existing Features

These UX backlog items are already implemented — no action needed:

| UX Item | Already Built In |
|---------|-----------------|
| UX-009 (fallback for invalid project IDs) | Wave 39: ProjectPickerPage + wouter routing |
| UX-022 (confidence badge) | Wave 32: ConfidenceBadge component |
| UX-025 (undo AI action) | Wave 26: unified undo/redo system |
| UX-034 (keyboard guard while typing) | Wave 30: keyboard-shortcuts.ts input field detection |
| UX-036 (hover pin info) | Wave 31: PinoutHoverCard (13 pinouts + SVG) |
| UX-074 (glossary hover cards) | Wave 33: electronics-knowledge.ts (20 articles) |
| UX-078 (quest/tutorial system) | Wave 35: tutorial-system.ts (5 tutorials) |
| UX-099 (PWA polish) | Wave 36/41: service worker + offline sync |

---

## Backlog Items Truly Missing (73 items for future waves)

### High-Value Missing (worth building)
- MF-052: Keep-out/keep-in region editor
- MF-054: Via stitching automation
- MF-055: Teardrop generation
- MF-069: Worst-case corner analysis
- MF-070: Mixed-signal simulation
- MF-073: EMI/EMC pre-check
- MF-080: Interactive live simulation (EveryCircuit-style)
- MF-084: Firmware compile/upload from ProtoPulse
- MF-116: Approval gates before manufacturing export
- MF-117: ECO workflow
- MF-118: Design branching model
- MF-132: Panelization tool
- MF-144: AI plan/dry-run mode
- MF-176: SSO/OIDC

### Deferred (nice-to-have, not blocking)
- MF-041/042: Classroom/educator mode
- MF-086: Protocol decoders (I2C/SPI/UART)
- MF-181-190: Developer platform (API, SDK, CLI, webhooks)
- MF-191-200: UX polish (mobile, light theme, docs hub)

---

## Execution Order

```
Wave A (P0 security)           [2-3 days]  -- MUST DO FIRST
  |
Wave B (wiring + UX trust)     [4-5 days]  -- parallel with Wave C
Wave C (contract fixes)        [2-3 days]  -- parallel with Wave B
  |
Wave D (partial->done + UX)    [5-6 days]
  |
Wave E (security+ops + AI UX)  [4-5 days]  -- parallel with Wave F
Wave F (test hardening)        [3-4 days]  -- parallel with Wave E
  |
Wave G (UX roadmap)            [ongoing]   -- pick items per sprint
```

**Total Waves A-F: ~21-26 days of focused work**
**Wave G: ongoing, pick per sprint**

## /agent-teams Structure Per Wave

### Wave A (3 teammates)
| Teammate | Files | Tasks |
|----------|-------|-------|
| **ownership-guard** | server/routes/*.ts, server/circuit-routes/*.ts, server/routes/auth-middleware.ts | A1 (ownership middleware on 30+ routes) |
| **sandbox-fixer** | client/src/lib/drc-scripting.ts, new drc-script-worker.ts, shared/url-validation.ts | A2 + A3 (sandbox + URL validation) |
| **cache-auth-fixer** | client/src/lib/auth-context.tsx, client/src/lib/queryClient.ts, server/ai.ts, shared/collaboration.ts | A4 + A5 (cache clear + 3 one-liners) |

### Wave B (4 teammates)
| Teammate | Files | Tasks |
|----------|-------|-------|
| **import-fixer** | ProjectWorkspace.tsx, design-import.ts, ArchitectureView.tsx | B1 + B3 (import apply + generate architecture + import UX) |
| **export-auth-fixer** | ExportPanel.tsx, ChatPanel.tsx, useChatSettings.ts | B2 + B6 (export contracts + auth headers + export UX) |
| **validation-sim-fixer** | ValidationView.tsx, SimulationPanel.tsx, ProbeOverlay.tsx | B4 + B5 (real data wiring + simulation controls + validation UX) |
| **trust-label-fixer** | Various view/panel components | B7 (UX trust labels, state chips, confirm modals, toasts, save indicator) |

### Wave D (4 teammates)
| Teammate | Files | Tasks |
|----------|-------|-------|
| **serial-wirer** | ProjectWorkspace.tsx, new SerialMonitorPanel.tsx, web-serial.ts | D1 + D6 (serial workspace + monitor presets) |
| **import-completer** | design-import.ts, project-context mutations, copper-pour.ts, pcb-drc-checker.ts | D2 + D3 (AST->state + copper pour DRC) |
| **ui-wirer** | design-variables panel, ShareProjectDialog, various | D4 + D5 (variables UI + share dialog) |
| **ux-polisher** | Editor components, Sidebar, ProcurementView, various panels | D7 + D8 + D9 + D10 (editor, nav, visual, BOM UX) |
