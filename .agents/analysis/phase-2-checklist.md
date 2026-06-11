# Phase 2 Checklist -- Feature Gaps (FG-) -- ProtoPulse

> Generated / refreshed: 2026-05-18 (replaces stale prior version)
> Priority: P0 (critical to avoid churn) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)
> Evidence basis: Phase-2-report.md gap matrix + 3D deep-dive findings + FEATURE_MATURITY.md + competitor research (KiCad 10, Altium, EasyEDA, Flux, etc.)

## P0 — Critical (High Churn Risk if Missing)

- [ ] FG-01: Production-grade 3D PCB visualization + MCAD (real WebGL/Three.js or equivalent GPU renderer, STEP/WRL model binding per footprint, realistic materials/lighting/shadows, orbit/pan/zoom/trackball interaction, clearance visualization, STEP export, basic enclosure collision) | Effort: XL | Priority: P0
  - Evidence: Current implementation is CSS 3D only (BoardViewer3DView + board-viewer-3d.ts); dead 1298 LOC webgl-viewer.ts; no STEP support; competitors (KiCad raytrace, Altium MCAD CoDesigner, EasyEDA WebGPU+STEP, Fusion native) all superior. Directly impacts pro + startup personas.
- [ ] FG-02: Deep, reliable, visual Electrical + Design Rule Checking (ERC/DRC) with violation highlighting, suggested fixes, high-speed constraint support (length tuning, diff pairs, impedance), rule editor | Effort: XL | Priority: P0
  - Evidence: Validation view + custom DRC sandbox exists and is Production per audit, but lacks the depth, automation, and in-editor feedback of KiCad v10 / Altium / OrCAD. Pros will not trust the tool without this.
- [ ] FG-03: Live / embedded supply-chain data (pricing, stock levels, lead times, sourcing alternatives) surfaced inside schematic/PCB/procurement flows with one-click updates to BOM | Effort: L | Priority: P0
  - Evidence: Strong procurement and BOM surfaces exist, but not as seamless/live/sourcing-aware as EasyEDA (JLC direct) or Flux (AI + live data). High friction for all personas.

## P1 — High (Major Competitive Weakness)

- [ ] FG-04: High-speed / advanced PCB design tools (interactive length tuning with time-domain, differential pair routing assistance, controlled impedance profiles, basic SI/PI checks) | Effort: XL | Priority: P1
- [ ] FG-05: Real-time multi-user collaboration (live cursors, simultaneous editing, presence, project-level locking / comments in context) | Effort: L–XL | Priority: P1
  - Note: Excellent async history/snapshots/comments already present; add live layer on top.
- [ ] FG-06: Significantly improve breadboard view fidelity, placement intelligence, and robust bidirectional synchronization with schematic/PCB (address Partial maturity) | Effort: M–L | Priority: P1
- [ ] FG-07: Rich, searchable, community-contributable component library with high-quality 3D models (STEP preferred) and contribution workflow | Effort: L–XL (ongoing) | Priority: P1
- [ ] FG-08: Mature agentic AI design assistance (reliable multi-step schematic + layout generation, self-correction, context-aware part selection beyond current generative stub) | Effort: L | Priority: P1
  - Leverage existing architecture/generative/troubleshooter surfaces; close the Stub/Partial gaps identified in FEATURE_MATURITY.

## P2 — Medium (Important for Parity & Growth)

- [ ] FG-09: First-class multi-board / system / harness / rigid-flex design support (building on architecture view) | Effort: XL | Priority: P2
- [ ] FG-10: Advanced simulation depth and in-design analysis (full SPICE with better probing, thermal, basic signal integrity) | Effort: L–XL | Priority: P2
- [ ] FG-11: One-click or tightly integrated PCB ordering / DFM feedback loop (improve current Partial ordering wizard to server-backed + real fab quotes) | Effort: M–L | Priority: P2
- [ ] FG-12: Stronger export fidelity and variety (flawless Gerber/ODB++/STEP/3D PDF, IPC-2581, panelization support, documentation drawings) | Effort: M | Priority: P2
- [ ] FG-13: Component creation / footprint / symbol extraction tools (PDF datasheet parsing, auto 3D model attachment, wizards) | Effort: L | Priority: P2

## P3 — Low / Long-Term / Nice-to-Have

- [ ] FG-14: Advanced multi-board assembly / variant / configuration management (building on existing design variants ideas in competitors) | Effort: XL | Priority: P3
- [ ] FG-15: Plugin / extension marketplace using web standards (JS/TS/React) for community tools (leveraging modern stack advantage) | Effort: L | Priority: P3
- [ ] FG-16: Deeper educational content + certification / grading analytics on top of existing labs and starter circuits | Effort: M | Priority: P3

## Relationship to Prior Work
- FG-01 directly continues the Phase 2 3D scoped findings and Phase 3 UX 3D friction items.
- Many items overlap with existing UI/audit backlogs (MASTER_BACKLOG.md, audits_and_evaluations_by_codex, product-analysis docs).
- When implementing, reference the specific ViewRenderer lazy imports and the pp-view-* skill manifests for the affected surfaces.

## Verification Guidance
For each FG item closed:
- Update FEATURE_MATURITY.md maturity level.
- Add live-verified screenshots or test flows to docs/audit-screenshots/.
- Re-run targeted competitor comparison (especially 3D and DRC) before marking DONE.
- Add to the main MASTER_BACKLOG.md with BL- ID and cross-ref to FG- ID.

All checklist items use the `FG-` (Feature Gap) prefix. Append new items with next sequential number when discovered in future passes.
