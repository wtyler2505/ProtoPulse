# Schematic Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Schematic work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Schematic behavior.

## Pending Proposals

- Add screenshots for the main Schematic states.
- Add more specific gotchas after the next real Schematic implementation pass.

## Implementation Note — 2026-05-25 (R29 Schematic Canvas Provenance Dock)

- Added a compact canvas-surface provenance/status dock to `SchematicView.tsx`.
- The dock shows active circuit, TSCircuit mode, part count, ERC state, and local/AI exact-part trust state with `TrustBadge`.
- It is collapsible and width-resizable, with responsive bounds verified at desktop, laptop-height, and mobile-ish viewports.
- The mobile screenshot pass caught an overflow; the wrapper now constrains left/right edges and switches stats to one column below `sm`.
- Focused tests now cover local model status, collapse behavior, and AI provisional exact-part status.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-schematic Full Audit Pass)

**User Command:** `/pp-view-schematic`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests at skill level: 4 (SchematicView.test.tsx)
- Main view: `SchematicView.tsx` (663 lines / 635 code / 158 CCN)
- Full extracted surface (per page-map + scc): 12+ files in `circuit-editor/Schematic*.tsx` + `circuit-editor/schematic/**` + adapter
  - SchematicCanvas.tsx: 936 code / **217 CCN** (core React Flow + custom node/edge host)
  - TSCircuitCanvasAdapter.tsx: 266 code / 92 CCN (tscircuit bridge)
  - use-keyboard-shortcuts.ts: 221 code / 102 CCN
  - use-clipboard, use-drag-drop, converters, context-menu, etc.: substantial supporting logic
- Combined schematic surface slice: ~2,970 code / **732 CCN** (heavy Tier 1, comparable to PCB extraction)
- All references present. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-schematic/scripts/inspect-schematic.mjs` → ok
2. Read `references/page-map.md` (28 lines) — full globs for Schematic* + schematic/ subdir
3. Read `references/ux-contract.md` (24 lines) — before any layout or canvas analysis
4. Read `references/testing.md` (28 lines)
5. Read `references/gotchas.md` (17 lines) — before any sync/persistence/extraction analysis
6. Read `SKILL.md` (Tier 1, explicit circuit-editor schematic globs)
7. Deep source inspection (SchematicView coordinator, SchematicCanvas, TSCircuitCanvasAdapter, schematic/ primitives: canvas-contract, converters, drag-drop, keyboard, clipboard, context-menu) + mandatory ast-grep + scc
8. Cross-campaign synthesis vs. Architecture extraction debt, PCB "thin wrapper vs reality", provenance campaign, 3D sync, breadboard, Generative/Component Editor placement, UI Container Rule on side panels + laptop viewports
9. Durable appends to this log + master report (section 33)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc on Schematic surface):**
- 12 files in the core slice, 2,970 code LOC, **732 CCN**
- Hotspots:
  - SchematicCanvas.tsx: 936c / 217 CCN (the heavy canvas host with custom nodes: Instance, NetEdge, NetLabel, Power, NoConnect, Annotation, Sheet)
  - SchematicView.tsx: 635c / 158 CCN (coordinator with active circuit switching, panel tabs (components/power/sheets/sim), AI generate, Push to PCB, ERC violations, design decay, JIT skills, HierarchicalSheetPanel)
  - TSCircuitCanvasAdapter: 266c / 92 CCN (the tscircuit v3 integration layer)
  - use-keyboard-shortcuts: 102 CCN (dense shortcut handling)
- This is a **heavy extracted schematic editor** (analogous to the PCB extraction story audited earlier).

**Source Ownership & Architecture:**
- `SchematicView.tsx` is the page-level coordinator (circuit design selector, side panels for ComponentPlacer/PowerSymbolPalette/HierarchicalSheetPanel/SimulationScenarioPanel/ERCPanel, AI generation dialog, Push-to-PCB flow, DesignDecayCard, JIT skill card).
- Real canvas work lives in the extracted `circuit-editor/` modules: `SchematicCanvas.tsx` (React Flow host), `TSCircuitCanvasAdapter.tsx` (tscircuit bridge per `canvas-contract.ts`), custom nodes/edges (`SchematicInstanceNode`, `SchematicNetEdge`, `SchematicNetLabelNode`, `SchematicPowerNode`, `SchematicNoConnectNode`, `SchematicAnnotationNode`, `SchematicSheetNode`), and the `schematic/` primitives (drag-drop, keyboard, clipboard, context-menu, converters, types).
- Strong integration with `useCircuitDesigns` / `useCircuitInstances` (canonical Project → CircuitDesign → CircuitInstance model) and downstream (Push to PCB, ERC, simulation scenarios).

**Deep Analysis vs. UX Contract Pillars + Campaign Cross-Refs:**

- **Layout & UI Container Rule (high risk — dense side panels + canvas on laptop viewports):**
  - Multiple toggleable side panels (parts, power, sheets, sim, ERC) + top toolbar + status elements inside SchematicView.
  - The canvas itself (SchematicCanvas + adapter) must remain reachable and scrollable/zoomable when side panels are open.
  - Laptop-height viewports + "fixed heights and nested overflow" risk (per gotchas) are real here, exactly as called out in the global UI Container Rule and the prior PCB/Architecture audits.
  - Many floating/overlaid elements (DesignDecayCard, JIT skill card, AI dialog, push dialog, ERC highlights) compete for attention without clear progressive disclosure.

- **Page Behavior & Workflow Clarity (strong multi-sheet + ERC + sim + push flows, but provenance invisible):**
  - Excellent support for hierarchical sheets, ERC violations with highlighting, simulation scenarios, power symbols, component placement from the architecture graph, AI-assisted generation, and "Push to PCB" (with unplaced instance detection).
  - The view is deeply wired into the canonical model and the downstream fabrication path.
  - **"AI-generated or uncertain data is clearly marked" contract is not met on the canvas**: exhaustive ast-grep across SchematicView + all Schematic*.tsx + schematic/ primitives returned **zero** matches for Trust*, provenance, generatedFrom, verificationLevel, exactPart, VaultHover, etc.
  - Users can place symbols that came from Generative adoption or unverified Component Editor parts directly on the schematic with no visual distinction, no ERC-level warning, and no link to the verification status. The same gap exists in the PCB placer/DRC (previously audited).

- **Extraction Debt (parallel to PCB story):**
  - The surface shows the same "extracted but still heavy" pattern: SchematicCanvas 217 CCN + adapter 92 CCN + dense supporting hooks (keyboard 102 CCN, clipboard 70 CCN).
  - The Architecture view explicitly called out dual-canvas maintenance and the need for a final retirement decision. Schematic is on the same trajectory (tscircuit adapter + custom React Flow nodes/edges).
  - 3D bidirectional sync and provenance enforcement at placement time (raised as P1 for PCB) apply equally here: the schematic is where the electrical intent is first captured geometrically.

- **Tests (light relative to surface size):**
  - 4 tests at the view level + several in circuit-editor/__tests__ (SchematicCanvas.test, SchematicToolbar.test, SchematicAnnotationNode.test, TSCircuitCanvasAdapter.test, etc.).
  - Given 732 CCN of complex canvas + adapter + interaction logic, coverage is still modest for a Tier 1 core editor. Browser checks (reachability, scroll, keyboard, no overflow on laptop) remain essential.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Enforce provenance / verification visibility and guards at the schematic placement level (the electrical geometry surface must reflect the safety story)**
- Custom nodes (Instance, Net, Power, etc.) and the ERC engine must consult the underlying CircuitInstance / part verificationLevel, generatedFrom, and exact-part status.
- Add visual badges/tooltips on symbols and at minimum a soft warning in ERC for unverified/generative parts. Block or prominently warn on "Push to PCB" when the schematic contains unverified content (consistent with the P1 raised for PCB placer/DRC).

**P1 — Make the explicit retirement decision on the dual canvas (tscircuit adapter vs custom React Flow) and execute (Architecture view's highest-leverage debt, now also on Schematic)**
- The same extraction that was done for PCB must reach a conclusion here. Continuing to maintain both paths multiplies every new feature (sheets, annotations, ERC, simulation overlays, 3D sync, provenance badges) across two implementations.

**P1 — Police UI Container Rule on the SchematicView + side panels + floating cards on realistic laptop viewports**
- Multiple toggleable panels + canvas + decay/JIT cards + dialogs. Ensure every control remains reachable via scroll/collapse/resize when the viewport is constrained.

**P2 — Expand test coverage for the core canvas flows** (sheet navigation, ERC violation highlight + focus, drag-drop + keyboard + clipboard, tscircuit round-trip, multi-sheet hierarchical behavior) with visual regression on laptop sizes.

**P2 — Surface richer status in the sheet selector / hierarchical panel** (e.g., "3 unverified parts", "last ERC clean", "generative origin" summary) so the multi-sheet overview gives a true at-a-glance safety picture.

**Strengths (relative to peers):**
- One of the richest schematic editors in the app: hierarchical sheets, full ERC with violation focus, simulation scenarios, power symbol palette, AI-assisted generation, direct Push-to-PCB with unplaced detection, design decay + JIT skill cards.
- Clean separation between the view coordinator (SchematicView) and the extracted canvas primitives (SchematicCanvas + adapter + schematic/ hooks).
- Deep integration with the canonical CircuitDesign / CircuitInstance model and the rest of the fabrication pipeline.
- Good use of the tscircuit adapter for proof-of-concept while keeping a custom rendering layer for UX control.

**Durable Lessons for Future Agents:**
- Placement canvases (Schematic and PCB) are the places where abstract provenance becomes physical geometry. If the safety story is not enforced and visible here, every upstream verification gate (Component Editor, Generative review, 3D mechanical) is theater.
- The extraction pattern (heavy adapter + custom node/edge host + many interaction hooks) creates the same maintenance burden observed in PCB. The Architecture view's call for a final retirement decision applies equally (or more urgently) to Schematic.
- "AI-generated or uncertain data is clearly marked" is not a nice-to-have in the UX contract — it is a safety requirement on every surface where a user can place or route a part that came from an un-reviewed generative source.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 4+ circuit-editor tests).
- Mandatory ast-grep for all provenance/trust/generative signals returned zero matches across the entire Schematic surface.
- Full scc report (732 CCN, heavy extracted canvas) captured with exact hotspots.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to the Architecture extraction debt, PCB "thin wrapper vs 270 CCN reality" + provenance gap in placer/DRC, Generative/Component Editor verification work, 3D rescue, breadboard-lab, Exports precheck, the UI Container Rule, and the Right/Left Sidebar + Project Explorer audits from the same handoff campaign.
- Detailed Fast Workflow Execution Report appended here; master report section 33 written.

---

*Schematic analysis complete. This is a heavy Tier 1 extracted schematic editor (SchematicView coordinator + SchematicCanvas 217 CCN + TSCircuitCanvasAdapter + rich custom nodes/edges + side panels for ERC/sheets/sim/power). The functionality is excellent (hierarchical sheets, ERC, simulation, AI gen, push-to-PCB). The critical gaps are (1) complete absence of provenance/verification visibility or guards on the placement canvas (the same P1 raised for PCB), (2) ongoing dual-canvas maintenance burden parallel to the PCB story, and (3) UI Container risks from dense side panels + floating cards on laptop viewports. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Schematic section (2026-05-23).*
