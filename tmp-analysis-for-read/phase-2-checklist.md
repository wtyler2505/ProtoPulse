# Phase 2 Checklist -- Feature Gaps (FG-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)
> Generated: 2026-02-28
> Refined: 2026-02-28 (cross-phase calibration)

## P0 -- Critical Parity (without these, users will not adopt)

- [ ] FG-01: Implement production-quality PCB layout with copper routing, layer stack management, and trace editing (PCBLayoutView.tsx exists as shell -- needs full routing engine) | Effort: XL | Priority: P0 | **Prerequisite: TD-01 (refactor PCBLayoutView, CCN=135) -- MUST complete before feature work**
- [ ] FG-02: Add multi-project support -- remove hardcoded PROJECT_ID = 1 from project-context.tsx; add project picker, project CRUD in UI | Effort: M | Priority: P0 | Prerequisites: None -- clean schema + context changes
- [ ] FG-03: Implement 3D board viewer for PCB mechanical fit verification and visual inspection (WebGL or Three.js based) | Effort: L | Priority: P0 | Prerequisites: None -- additive work
- [ ] FG-04: Build or integrate autorouter for PCB layout (evaluate FreeRouting WASM port, Topological router, or custom A* with DRC) | Effort: XL | Priority: P0 | Prerequisites: FG-01 (needs real PCB layout first)
- [ ] FG-05: Expand built-in component library to 10K+ parts with symbols, footprints, and 3D models (currently relies on user-created parts and AI suggestions; Flux.ai has 750K+, EasyEDA has millions) | Effort: L | Priority: P0 | **Prerequisite: TD-09 (split ai-tools.ts, 1,677 lines) -- adding library AI tools to current monolith is impractical**

## P1 -- High-Impact Gaps (significant competitive disadvantage)

- [ ] FG-06: Add real-time multi-user collaboration with cursors, live edits, and conflict resolution (WebSocket-based, similar to Flux.ai's 20-editor support / Altium 365) | Effort: XL | Priority: P1 | **BLOCKED by 3 prerequisites: TD-02 (remove PROJECT_ID=1), TD-03 (DB migrations), TD-07 (split ProjectProvider) -- all must complete first**
- [ ] FG-07: Connect Gerber export to actual PCB layout data (current gerber-generator.ts generates from schema but has no real copper/layer data) | Effort: L | Priority: P1 | **Partially blocked: TD-10 (complete export decomposition) recommended first; also depends on FG-01 (PCB layout)**
- [ ] FG-08: Implement ODB++ export format for modern PCB manufacturing (single-file alternative to Gerber) | Effort: M | Priority: P1 | **Partially blocked: TD-10 (dual export system) should be resolved first**
- [ ] FG-09: Implement IPC-2581 export format (XML-based, consolidates all manufacturing data) | Effort: M | Priority: P1 | **Partially blocked: TD-10 (dual export system) should be resolved first**
- [ ] FG-10: Add one-click PCB ordering integration (JLCPCB, PCBWay, OSHPark APIs; generate manufacturing files and submit order from UI) | Effort: M | Priority: P1 | Prerequisites: FG-01 (needs real PCB data to submit)
- [ ] FG-11: Implement push-and-shove interactive routing for PCB layout (essential for productive manual routing) | Effort: XL | Priority: P1 | Prerequisites: FG-01 (needs real PCB layout first)
- [ ] FG-12: Add design review and commenting system (threaded comments on nodes/nets/components; @mentions; resolve/unresolve workflow) | Effort: L | Priority: P1 | Prerequisites: None -- additive work
- [ ] FG-13: Implement AC small-signal analysis in circuit solver (currently limited to DC and transient; code comment notes this gap explicitly) | Effort: L | Priority: P1 | Prerequisites: None -- additive work on existing simulation engine
- [ ] FG-22: Add import support for KiCad, Altium, and Eagle project files (currently only FZPZ import; Flux.ai imports KiCad + Altium + Cadence) | Effort: L | Priority: **P1** (promoted from P2) | Prerequisites: None -- existing export infrastructure provides patterns; **architecturally clean, additive work not blocked by debt** | **Rationale: Phase 3 documents this as "Critical dead-end" for professional engineers. Phase 1 confirms only FZPZ import exists. No professional engineer will adopt a tool they cannot import existing designs into.**
- [ ] FG-23: Implement real-time component pricing/stock from distributor APIs (Octopart, Digi-Key, Mouser) beyond AI-powered lookup | Effort: M | Priority: **P1** (promoted from P2) | Prerequisites: None -- additive API integration work | **Rationale: Phase 1 confirmed ALL procurement data is AI-simulated. The BOM pricing, stock levels, and lead times shown to users are completely fabricated. This undermines trust in the entire procurement feature. Flux.ai and OrCAD Live BOM both use real supplier data.**

## P2 -- Medium-Impact Gaps (nice-to-have for professional users)

- [ ] FG-14: Add differential pair routing support in PCB layout | Effort: L | Priority: P2 | Prerequisites: FG-01, FG-11 (needs PCB layout + routing engine)
- [ ] FG-15: Implement multi-layer PCB support (currently no layer stack management; competitors support 32+ layers) | Effort: L | Priority: P2 | Prerequisites: FG-01 (needs PCB layout foundation)
- [ ] FG-16: Add ECAD-MCAD integration (STEP export of board + components for mechanical CAD import) | Effort: L | Priority: P2 | Prerequisites: FG-01 (needs real board geometry)
- [ ] FG-17: Implement offline mode / progressive web app for resilience when server is unavailable | Effort: L | Priority: P2 | Prerequisites: Architectural -- significant rework of server-dependent SPA
- [ ] FG-18: Add signal integrity analysis (impedance calculation, crosstalk estimation, eye diagrams) for high-speed designs | Effort: XL | Priority: P2 | Prerequisites: FG-01, FG-15 (needs multi-layer PCB with real trace data)
- [ ] FG-19: Expand DRC rule coverage to match KiCad/Altium (currently 6 rule types: min-clearance, min-trace-width, courtyard-overlap, pin-spacing, pad-size, silk-overlap; missing: annular ring, thermal relief, trace-to-edge, via-in-pad, solder mask expansion) | Effort: M | Priority: P2 | Prerequisites: None -- additive to existing DRC engine
- [ ] FG-20: Add Monte Carlo / statistical simulation analysis for component tolerance modeling | Effort: L | Priority: P2 | Prerequisites: None -- additive to simulation engine
- [ ] FG-21: Implement nonlinear device models in circuit solver (diodes, BJTs, MOSFETs -- currently noted as limitation in circuit-solver.ts) | Effort: XL | Priority: P2 | Prerequisites: None -- additive to simulation engine
- [ ] FG-33: Add AI-learned user preferences (design principles, part selection preferences, style guidelines) -- Flux.ai's Copilot Knowledge feature | Effort: M | Priority: P2 | Prerequisites: None -- additive to AI system
- [ ] FG-34: Implement FMEA (Failure Mode and Effects Analysis) report generation -- Flux.ai Copilot Shortcut | Effort: M | Priority: P2 | Prerequisites: None -- additive AI action
- [ ] FG-35: Add AI test plan generation for board validation -- Flux.ai Copilot Shortcut | Effort: S | Priority: P2 | Prerequisites: None -- additive AI action
- [ ] FG-36: Add AI component comparison tables -- Flux.ai Copilot Shortcut | Effort: S | Priority: P2 | Prerequisites: None -- additive AI action

## P3 -- Nice-to-Have (differentiators or long-term features)

- [ ] FG-24: Add rigid-flex PCB design support | Effort: XL | Priority: P3
- [ ] FG-25: Implement power integrity / PDN analysis with physics-based modeling (currently AI-driven power_budget_analysis only) | Effort: XL | Priority: P3
- [ ] FG-26: Add design reuse blocks / snippets (save and reuse schematic + PCB fragments like Altium's design blocks) | Effort: M | Priority: P3
- [ ] FG-27: Implement thermal analysis with physics-based simulation (currently AI-driven only) | Effort: XL | Priority: P3
- [ ] FG-28: Add component lifecycle / obsolescence tracking (like OrCAD Live BOM's lifecycle risk indicators) | Effort: M | Priority: P3
- [ ] FG-29: Implement netlist comparison / ECO (Engineering Change Order) workflow for tracking design changes | Effort: L | Priority: P3
- [ ] FG-30: Add board stackup editor for multi-layer PCB impedance planning | Effort: M | Priority: P3
- [ ] FG-31: Implement copper pour / zone fill for ground planes and power planes | Effort: L | Priority: P3
- [ ] FG-32: Add manufacturing DFM check integration with fab house APIs (beyond AI dfm_check action) | Effort: M | Priority: P3

---

## Summary Statistics

| Priority | Count | Effort Breakdown |
|----------|-------|-----------------|
| P0 | 5 | 2 XL, 2 L, 1 M |
| P1 | 10 | 2 XL, 4 L, 4 M |
| P2 | 12 | 3 XL, 4 L, 3 M, 2 S |
| P3 | 9 | 4 XL, 2 L, 3 M |
| **Total** | **36** | **11 XL, 12 L, 11 M, 2 S** |

## Feasibility Assessment (Phase 4 Integration)

### Quick Wins (clean architecture, additive work, no blockers)

| Gap | Effort | Why It's Quick |
|-----|--------|---------------|
| FG-22 (design import) | L | Export infrastructure provides patterns; additive work |
| FG-23 (real supplier APIs) | M | Standard API integration; no architectural dependencies |
| FG-12 (design review/commenting) | L | Additive feature; no existing code to refactor |
| FG-13 (AC analysis) | L | Builds on existing MNA solver; additive |
| FG-33-36 (Flux.ai parity AI features) | S-M | Additive AI actions using existing tool infrastructure |

### Requires Prerequisite Refactoring (blocked or partially blocked)

| Gap | Effort | Prerequisite | Why Blocked |
|-----|--------|-------------|-------------|
| FG-01 (PCB layout) | XL | **TD-01** (PCBLayoutView CCN=135) | Any new features added to the 135-CCN component will compound the complexity crisis |
| FG-05 (component library) | L | **TD-09** (ai-tools.ts 1,677 lines) | Library AI tools would bloat already-oversized tool file |
| FG-06 (collaboration) | XL | **TD-02 + TD-03 + TD-07** | Needs multi-project + migrations + split context before CRDTs |
| FG-07/08/09 (export improvements) | M-L | **TD-10** (dual export system) | Old monolith + new modules both active; improvements touch both |

### Dependency Chains (must be implemented in order)

```
TD-01 (refactor PCBLayoutView) → FG-01 (PCB layout) → FG-04 (autorouter) → FG-11 (push-and-shove)
                                                      → FG-07 (real Gerber) → FG-10 (PCB ordering)
                                                      → FG-14 (diff pairs) + FG-15 (multi-layer)
                                                      → FG-03 (3D viewer, can proceed in parallel)

TD-02 + TD-03 + TD-07 → FG-06 (collaboration) → FG-12 (design review, can proceed independently)

TD-09 (split ai-tools) → FG-05 (component library) → FG-33-36 (AI feature parity)

TD-10 (export decomposition) → FG-07/08/09 (export improvements) → FG-10 (PCB ordering)
```

## Cross-Phase Connections

- FG-01 (PCB layout) and FG-03 (3D viewer) are foundational -- many other gaps (FG-04, FG-07-09, FG-11, FG-14-15, FG-31) depend on having a real PCB layout engine. **Phase 4 adds: PCBLayoutView CCN=135 must be refactored before any of this work begins.**
- FG-02 (multi-project) will appear as a UX friction issue in Phase 3 (UX analysis). All 5 phases independently flag PROJECT_ID=1 as critical.
- FG-06 (collaboration) will appear as an architecture gap in Phase 4 (no WebSocket infrastructure exists). **Phase 4 adds: 3 XL prerequisites (TD-02, TD-03, TD-07) must complete first.**
- FG-05 (component library) connects to Phase 4 architecture decisions about data sourcing and storage. **Phase 4 adds: ai-tools.ts (1,677 lines) must split into modules before scaling the tool count.**
- FG-17 (offline mode) connects to Phase 5 technical debt (server-dependent SPA)
- FG-22 (design import) promoted to P1 -- Phase 3 rates this as "Critical dead-end" for professional engineer persona
- FG-23 (real supplier APIs) promoted to P1 -- Phase 1 confirmed all procurement data is fabricated
- FG-33-36 are new gaps identified from Flux.ai deep-dive -- features Flux.ai has that ProtoPulse lacks in the AI domain (user preference learning, FMEA, test plans, component comparison)
