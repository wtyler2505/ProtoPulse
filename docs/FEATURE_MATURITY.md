# ProtoPulse Feature Maturity Classification

**Date:** 2026-03-27
**Source evidence:** `reports/ai-audit/00-MASTER-REPORT.md`, `reports/ai-audit/05-client-ai-features.md`, `docs/checklist/MASTER_AUDIT_CHECKLIST.md` (Section 4 — Fresh Verification Results), `docs/checklist/WORKFLOW_VERIFICATION_MATRIX.md`

**Purpose:** This document classifies every major ProtoPulse feature's real implementation status based on live browser verification, code inspection, and audit findings. It exists to close the gap between what the UI promises and what actually works, so that development effort can be directed at the right maturity tier.

---

## Maturity Levels

| Level | Definition |
|-------|-----------|
| **Production** | Fully functional end-to-end, tested, live-verified in a browser session. Data persists, API calls succeed, no known broken paths. |
| **Functional** | Works end-to-end but may have edge cases, incomplete sub-features, or partial verification. Core happy path confirmed. |
| **Partial** | Core capability works but significant sub-features are missing, simulated, or unwired. |
| **Stub** | UI renders and looks real but functionality is simulated, hardcoded, or local-only when it should be server-backed. |
| **Aspirational** | Named or branded beyond actual capability. The label implies something the implementation does not deliver. |

---

## Table 1: Views (30 ViewModes)

Every ViewMode was live-verified in the audit checklist session against project 18 on the dev server. Maturity reflects what was observed, not what the code appears to contain.

| ViewMode | Maturity | Evidence Summary |
|----------|----------|-----------------|
| `dashboard` | Functional | Renders. Not deeply exercised in audit pass. |
| `project_explorer` | Functional | Renders. Not deeply exercised in audit pass. |
| `output` | Production | Live-verified stable. Export Center renders populated categories/formats. Download Firmware Scaffold opens real precheck. Export SPICE completes successfully after server-side fix. |
| `architecture` | Production | Live-verified: canvas, asset library, node inspector, design suggestions panel, add/accept component flow, graph mutation persists. Minor: React Flow sizing warning in console. |
| `component_editor` | Functional | Live-verified: deep link renders correctly and remains stable. Sub-tab workflows not fully replayed. |
| `schematic` | Production | Live-verified: editor with toolbar/parts/canvas, drag-to-place, Add Component overlay, keyboard placement, Push to PCB, delete restores empty state. API calls confirmed (POST instances -> 201). |
| `breadboard` | Partial | Code-inspected. Auto-placement assigns coordinates on mount (Wave 155 fix). Wire sync calls `syncSchematicToBreadboard()`. Low confidence for practical usability — no obvious placement source beyond sidebar in audit pass. |
| `pcb` | Functional | Live-verified: renders real layout UI, shows pushed components from schematic, empty state restores correctly. Advanced editing (trace routing, zone fill) not replayed. |
| `procurement` | Production | Live-verified: Add Item dialog, Compare Suppliers dialog, AVL Compliance tab, BOM Comparison tab. Route-loop defect fixed and no longer reproducing. |
| `validation` | Production | Live-verified: issue counts, Run DRC triggers POST and increments count, troubleshooter detail view, Custom DRC Rules dialog with sandboxed script controls. |
| `simulation` | Functional | Live-verified: DC OP 404 fixed, Start Simulation and Run DC OP correctly disabled on empty circuit, Results shows clear empty message, Add Probe expands real controls, Share copies link. Actual simulation execution not replayed (requires populated circuit). |
| `design_history` | Production | Live-verified: Save Snapshot with name validation, snapshot row appears, Compare to Current shows diff, delete confirmation dismisses cleanly. |
| `lifecycle` | Production | Live-verified: Add Component dialog, create/edit/delete lifecycle entries persist server-side, EOL attention banner, Export CSV produces real download, state persists after reload. |
| `comments` | Functional | Live-verified: existing comments hydrate, Reply opens textbox, cancel works. Comment creation not replayed. |
| `calculators` | Production | Live-verified: Ohm's Law returns correct values, Apply to Component copies to clipboard, Add to BOM succeeds after schema fix, LED Resistor and Voltage Divider return correct results. |
| `design_patterns` | Partial | Live-verified: filter works, My Snippets renders, Create/Delete/Duplicate work. But no action to place/import a pattern or snippet into Schematic or Architecture — stops at library management. |
| `storage` | Production | Live-verified: Storage Manager renders, Scan opens Barcode Scanner dialog, non-empty path renders grouped bins with quantity/status, Labels opens print workflow with preview, Print reaches `window.open()` and invokes `print()`. |
| `kanban` | Production | Live-verified: persisted task present on reload (localStorage-backed), edit updates all fields, tag/assignee filtering works, Clear restores, delete restores empty baseline, state persists after reload. |
| `knowledge` | Production | Live-verified: after hydration renders article count, search, filters, and article cards. |
| `viewer_3d` | Production | Live-verified: camera controls work, board dimensions editable and apply, layer toggles work, Export generates JSON blob download. No actual 3D WebGL rendering (scene graph is data-only). |
| `community` | Functional | Live-verified: Browse tab with catalog/search/filter, Featured tab with sections, component detail view. But: Download Component increments count without producing a real download. Collections create/persist but no add/remove/delete controls exposed. |
| `ordering` | Partial | Live-verified: full order wizard flow (spec -> fab -> DFM -> quotes -> summary -> place). But: order placement is localStorage-only, no server-side API call observed. Fab API key storage works but order placement does not depend on it. |
| `serial_monitor` | Functional | Live-verified: renders board/baud/line-ending selectors, DTR/RTS toggles, monitor controls. Onboarding hint dismiss fixed. Actual serial connection requires physical hardware (Web Serial API). |
| `circuit_code` | Production | Live-verified: starter DSL evaluates on first load, preview resolves components and nets, Apply to Project succeeds with POST -> 200. |
| `generative_design` | Stub | Live-verified: Generate produces candidates even with empty description, no network request observed during generation. Runs from in-browser engine with `defaultBaseCircuit()`. Compare shows diffs. Export works. But generation is entirely client-side heuristic, not AI-powered. |
| `digital_twin` | Functional | Live-verified: empty-state renders, Connect reaches `navigator.serial.requestPort()`, Generate Firmware dialog with real controls, Generate Sketch produces output. Actual device connection requires physical hardware. |
| `arduino` | Production | Live-verified: real Arduino Workbench, New file dialog, starter circuits with expandable templates, Open Circuit creates files and opens in editor, no duplicate file rows on reopen. |
| `starter_circuits` | Production | Live-verified: populated starter templates, expandable detail sections with full sketch, Open Circuit routes into Arduino workspace. |
| `audit_trail` | Production | Live-verified: deep link stays on route, expand reveals field diffs, search filters correctly, date filter works, Clear restores, Export CSV generates real blob download. |
| `labs` | Production | Live-verified: populated lab cards, expandable objectives/steps/hints/grading, Start Lab tracks progress, step completion advances count, progress persists across reload, Reset clears state. |

**Summary:** 18 Production, 7 Functional, 3 Partial, 1 Stub, 0 Aspirational (at the view level). The views themselves are generally honest about what they do. The maturity concerns are more about depth within views than about views being fake.

---

## Table 2: Client "AI" Feature Libraries (30 modules)

The AI audit (`reports/ai-audit/05-client-ai-features.md`) found that **all 30 client-side modules branded as "AI" are purely client-side heuristic engines with zero AI API calls**. They use hardcoded knowledge bases (~500+ items total), pattern matching, rule engines, and evolutionary algorithms. The "AI" prefix is aspirational branding.

This does not mean they are low quality. Many are well-engineered, well-tested, and genuinely useful. The issue is the gap between the "AI" label and the deterministic reality.

| Module | Lines | AI Label Maturity | Implementation Quality | What It Actually Is |
|--------|------:|:-----------------:|:----------------------:|-------------------|
| ai-review-queue.ts | 480 | Aspirational | Production | Threshold-based action routing with dedup and expiry |
| ai-prediction-engine.ts | 1387 | Aspirational | Production | 32 hardcoded rules, keyword pattern matching, confidence adjustment via feedback |
| ai-root-cause.ts | 1005 | Aspirational | Production | 22 symptoms + 20 failure patterns, BFS causal graph traversal |
| ai-safety-mode.ts | 524 | Aspirational | Production | Risk classification with 10 destructive + 13 caution action types |
| ai-tutor.ts | 834 | Aspirational | Production | 30+ topic question banks, 4 tutoring styles, progressive hint system, vocabulary-based level classification |
| ai-co-designer.ts | 634 | Aspirational | Stub | Design session framework with placeholder scoring. Comments say "real scoring is server-side via AI" but no server endpoint exists. Comparison matrix works but scores are meaningless. |
| ai-goal-parser.ts | 899 | Aspirational | Functional | Keyword-based NLP extraction (~60 keyword groups), 3-tier architecture candidate generation. Impressive for keyword-based, but not AI. |
| action-error-tracker.ts | 311 | Not branded AI | Production | Retryable vs non-retryable error classification. Name is accurate. |
| prediction-actions.ts | 58 | Not branded AI | Production | Utility bridge from prediction engine to AI action format. Name is accurate. |
| stream-resilience.ts | 285 | Not branded AI | Production | SSE streaming with exponential backoff retry and heartbeat idle detection. No dedicated test file (coverage gap). |
| voice-workflow.ts | 383 | Not branded AI | Functional | Levenshtein fuzzy matching for 20+ voice commands. Works, but requires text input — no STT bridge exists. |
| voice-ai.ts | 556 | Aspirational | Partial | Web Audio API capture with VAD (RMS energy threshold). Captures raw audio but no speech-to-text. Uses deprecated ScriptProcessorNode. Pipeline disconnect: captures audio, but nothing converts it to text for voice-workflow. |
| smart-library-installer.ts | 418 | Not branded AI | Production | Arduino compile error parser with 50+ include->library and 30+ symbol->library mappings. |
| multimodal-input.ts | 895 | Not branded AI | Partial | Image capture and type detection work. Preprocessing is a stub (calculates dimensions but no canvas operations). Analysis prompts exist but API calls happen elsewhere. |
| sketch-explainer.ts | 1124 | Not branded AI | Production | 40+ concept database, section parser, 3-level explanations. Exceptional educational content with robust C parser. |
| proactive-healing.ts | 1295 | Not branded AI | Production | 14 danger rules with interrupt levels (block/warn/info/silent). Fires on every architecture action. Excellent for beginner safety. |
| rag-engine.ts | 464 | Not branded AI | Functional | TF-IDF with cosine similarity. Correct implementation but bag-of-words only — no semantic search. |
| rag-knowledge-base.ts | 443 | Not branded AI | Production | 20 curated electronics knowledge articles. High-quality, accurate reference content. |
| board-aware-suggestions.ts | 586 | Not branded AI | Production | 5 board profiles with pin analysis, timer conflict detection, optimal pin allocation. Timer conflict detection is particularly valuable. |
| semantic-pin-mapper.ts | 350 | Not branded AI | Functional | Weighted scoring pin mapper (role 0.5 + name 0.35 + electrical 0.15). Greedy assignment — correct but not globally optimal. |
| idea-to-pcb.ts | 754 | Not branded AI | Production | 8-stage, 18-step workflow with prerequisites, progress tracking, and session reports. |
| co-design.ts | 845 | Not branded AI | Production | Cross-domain (circuit/firmware/enclosure) constraint tracking, conflict detection, 10-material database, fit checking. Genuinely novel for maker EDA. |
| panel-explainer.ts | 507 | Not branded AI | Production | Static explanations for 28+ ViewModes. Pure data, well-written. |
| fitness-scorer.ts | 339 | Not branded AI | Functional | Multi-criteria scoring with rough cost/power lookup tables. Ballpark estimates, not real BOM pricing. |
| circuit-mutator.ts | 442 | Not branded AI | Production | 6 GA mutation types with E12 value tables. Correct implementation with seeded PRNG. |
| generative-engine.ts | 335 | Not branded AI | Production | Evolutionary loop with elitism and tournament selection. Async generator for progressive UI. |
| generative-adopt.ts | 346 | Not branded AI | Production | Candidate-to-architecture bridge with comparison diff and grid layout adoption. |
| co-design.ts | 845 | Not branded AI | Production | Already listed above. |

**Note:** `co-design.ts` appears once in the inventory. The 30-module count from the audit includes all files in the generative-design subdirectory as separate entries.

**Summary:** 7 modules carry the "ai-" prefix that is aspirational. Of those 7, 5 have Production-quality heuristic implementations that deliver real value despite the naming. 1 (ai-co-designer) is a Stub with placeholder scoring. 1 (voice-ai) is Partial due to the STT pipeline disconnect. The remaining 23 modules are not branded as AI and their names accurately reflect their function.

**Key finding:** The actual AI capability in ProtoPulse lives on the server side (`server/ai.ts`, `server/ai-tools/`, `server/genkit.ts`) — not in these client libraries. These are domain-expertise engines, and good ones, but the "AI" label creates a truthfulness gap.

---

## Table 3: Server AI Features

### AI Tools (125 total across 16 modules)

| Category | Tool Count | Execution Type | Maturity | Notes |
|----------|-----------|---------------|----------|-------|
| architecture | 22 | 3 server / 19 client-dispatched | Production (server), Functional (client) | Largest tool count. Server tools do real DB mutations. |
| circuit | 21 | 5 server / 16 client-dispatched | Production (server), Functional (client) | Largest file (1470 lines). `suggest_trace_path` returns hardcoded stub `[{x:50,y:50},{x:70,y:70}]` (CRITICAL: TOOLS-01). |
| export | 17 | 17 server | Production | All server-side, real file generation. Strongest maturity. |
| bom | 12 | 3 server / 9 client-dispatched | Production (server), Functional (client) | `update_bom_item` has weak typing (`z.unknown().optional()`). |
| validation | 11 | 11 client-dispatched | Functional | All client-dispatched. |
| project | 10 | 1 server / 9 client-dispatched | Functional | Header says "9" but actually has 10 tools. |
| component | 6 | 1 server / 5 client-dispatched | Functional | `delete_component_part` lacks confirmation flag. |
| simulation | 5 | 5 client-dispatched | Functional | All client-dispatched. |
| arduino | 5 | 5 client-dispatched | Functional | Thin wrappers around client-side functionality. |
| manufacturing | 3 | 3 client-dispatched | Functional | 1062 lines (354 lines/tool), heavy analysis. |
| bom-optimization | 3 | 3 client-dispatched | Functional | 665 lines, heavy analysis. |
| testbench | 3 | 3 client-dispatched | Functional | 578 lines. |
| generative | 2 | 2 client-dispatched | Functional | Evolutionary design. |
| vision | 2 | 2 client-dispatched | Stub | Prompt-only — no real vision/image analysis. Tools prepare prompts but don't process images. |
| navigation | 2 | 2 client-dispatched | Partial | `switch_view` only knows 6 of 30+ ViewModes. |
| risk-analysis | 1 | 1 client-dispatched | Functional | Single tool. |

**Split:** ~48 server-side tools (do real DB/export work) = Production. ~77 client-dispatched tools (instruct the client to take action) = Functional. 2 vision tools = Stub. 1 trace suggestion = Stub (hardcoded response).

### Streaming Chat

| Feature | Maturity | Notes |
|---------|----------|-------|
| SSE streaming via Genkit -> Gemini | Production | Stream abuse protection is excellent: rate limiting, concurrency guards, body size limits, origin validation, timeouts, heartbeat, backpressure. |
| Chat CRUD | Production | Consistently uses ownership middleware. Well-secured. |
| Token-aware history truncation | Production | Prevents context overflow. |
| View-aware prompt optimization | Production | Reduces prompt size for non-active views. |
| Error handling | Production | 6 error categories, secret redaction, user-friendly messages. |
| Custom system prompt | Production | Sanitized: markdown headings and code fences stripped, wrapped in `<user-instructions>` tags with safety note (P2 fix). |

### Agent Loop

| Feature | Maturity | Notes |
|---------|----------|-------|
| POST /api/projects/:id/agent SSE | Functional | Multi-turn tool-use loop works. P0 fixes added timeout, maxSteps, concurrency controls. |
| Destructive tool confirmation | Production | Agent uses `confirmed: false` — destructive tools rejected by registry (P0 fix). |
| maxSteps enforcement | Production | Enforced in stream loop with `complete` event on limit (P0 fix). |

### Circuit AI (generate / review / analyze)

| Feature | Maturity | Notes |
|---------|----------|-------|
| Circuit generation from description | Production | Auth (requireCircuitOwnership), rate limiting (5/min), compensating transaction all added (P0 fix). |
| Circuit review | Production | Auth + rate limiting added (P0 fix). |
| Circuit analysis | Production | Auth + rate limiting added (P0 fix). |

### Genkit Integration

| Feature | Maturity | Notes |
|---------|----------|-------|
| Genkit -> Gemini bridge | Production | Internal module import removed, uses public API only (P1 fix). |
| Tool double-execution guard | Production | Destructive tools skipped in streaming fallback (P1 fix). |
| Output validation | Stub | All tool output schemas are `z.any()` (CORE-04 HIGH). |
| Standalone Genkit flows | Partial | 4 POC flows dev-gated. Mock pricing tool removed, projectId from context not model input (P0+P2 fixes). |
| Model routing | Partial | Gemini fast/standard tiers use identical model (`gemini-2.5-flash` for both) (CORE-06 HIGH). |

---

## Cross-Cutting Observations

1. **The views are more honest than the libraries.** Most views accurately represent their capability. The maturity problems concentrate in the client "AI" libraries (naming gap) and server-side integration edges (auth gaps, stubs).

2. **"Functional" is the dominant tier for server AI tools.** The 77 client-dispatched tools work correctly when invoked but depend on the client executing the dispatched action — a layer of indirection that reduces confidence vs. the 48 server-side tools that directly mutate state.

3. **Three features are genuinely aspirational (labeled beyond capability):**
   - The 7 "ai-" prefixed client modules (heuristic engines, not AI)
   - Agent auto-confirmation (implies user control that doesn't exist)
   - Vision tools (prompt-only, no image processing)

4. **Three features are stubs that look real:**
   - `suggest_trace_path` (hardcoded coordinates)
   - Genkit standalone flows (POC with stale IDs)
   - `ai-co-designer` scoring (placeholder returns)

5. **The ordering workflow is the biggest truthfulness gap at the view level.** The full wizard flow works beautifully in the UI but places orders to localStorage only — no server API call. A user could reasonably believe they placed a real order.
