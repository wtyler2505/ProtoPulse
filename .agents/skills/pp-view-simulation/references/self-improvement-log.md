# Simulation Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Simulation work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Simulation behavior.

## Pending Proposals

- Add screenshots for the main Simulation states.
- Add more specific gotchas after the next real Simulation implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-simulation Full Audit Pass)

**User Command:** `/pp-view-simulation`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: **0** (none recorded in auto-sync; one untracked test file `SimPlayButton.test.tsx` exists in __tests__)
- Primary surface: entire `client/src/components/simulation/**` (16 files / 5,114 code / **855 CCN**)
  - WaveformViewer.tsx: 1,217 code / **244 CCN** (heaviest)
  - SimulationPanel.tsx: 781 code / 190 CCN (main coordinator)
  - ProbeOverlay.tsx: 585 code / 99 CCN
  - FrequencyAnalysisPanel.tsx, BodePlot.tsx, simulation-types.ts, SensorSliderPanel, SpiceImport*, AnalysisParamsForms, etc.
- References all present. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-simulation/scripts/inspect-simulation.mjs` → ok
2. Read `references/page-map.md` (25 lines) — entire simulation/ subdir
3. Read `references/ux-contract.md` (24 lines) — before any setup/run/results analysis
4. Read `references/testing.md` (27 lines)
5. Read `references/gotchas.md` (17 lines) — before any sync/persistence/trust analysis
6. Read `SKILL.md` (Tier 2, simulation/** globs)
7. Deep source inspection (full directory: SimulationPanel, WaveformViewer, BodePlot, FrequencyAnalysisPanel, ProbeManager/Overlay, SimPlayButton, SensorSliderPanel, AnalysisParamsForms, SpiceImport*, ResultHistorySection, ComplexityWarningDialog, ShareSimulationButton, simulation-types) + mandatory ast-grep + scc
8. Cross-campaign synthesis vs. Schematic (SimulationScenarioPanel), PCB/breadboard simulation needs, provenance campaign (trust receipts + release confidence), UI Container Rule for waveform viewers + result panels, error recovery via complexity checks
9. Durable appends to this log + master report (section 35)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc on simulation/):**
- 16 files, 5,114 code LOC, **855 CCN** (heavy Tier 2)
- Hotspots:
  - WaveformViewer: 1,217c / 244 CCN (core interactive waveform rendering)
  - SimulationPanel: 781c / 190 CCN (orchestrator with scenario selection, param forms, play controls, result history, trust cards, SPICE import, complexity dialog)
  - ProbeOverlay: 585c / 99 CCN
  - FrequencyAnalysisPanel, BodePlot, types, sensor sliders, SPICE import sections: substantial
- This is a full-featured simulation workbench (transient, AC, DC sweep, frequency domain, probing, SPICE import, result history/sharing, complexity warnings).

**Source Ownership & Architecture:**
- `SimulationPanel.tsx` is the main coordinator (uses `useSimulation` context, `useCircuitDesigns`/`useCircuitInstances`, architecture/bom/validation, ties to `SimulationScenarioPanel` from circuit-editor).
- Heavy child components: WaveformViewer (interactive plots), BodePlot, FrequencyAnalysisPanel, ProbeManager/Overlay (interactive probing on schematic/canvas), AnalysisParamsForms (Transient/AC/DC forms), SensorSliderPanel (what-if), SimPlayButton (run controls), SpiceImportSection/Button, ResultHistorySection, ComplexityWarningDialog, ShareSimulationButton.
- Strong provenance hooks: `buildSimulationTrustReceipt`, `buildWorkspaceReleaseConfidence`, renders both `TrustReceiptCard` and `ReleaseConfidenceCard`.
- Complexity checking (`checkCircuitComplexity`) + dialog for error recovery.
- Auto-detect analysis type, SPICE import, result normalization.

**Deep Analysis vs. UX Contract Pillars + Campaign Cross-Refs:**

- **Simulation Setup (rich but provenance on inputs not surfaced in results):**
  - Scenario selection (via SimulationScenarioPanel), analysis type (transient/AC/DC/freq), param forms, sensor sliders for what-if, SPICE import.
  - Ties directly to Schematic scenarios (cross-ref to pp-view-schematic audit).
  - **Provenance gap**: While the panel builds `buildSimulationTrustReceipt` and `buildWorkspaceReleaseConfidence` and renders the cards (positive — better than Schematic/PCB placer/Procurement/Right Sidebar which had zero), there is no per-result or per-waveform marking of generative origin, verificationLevel, or exact-part status of the *inputs* (parts/nets in the simulated design). Results from unverified generative designs look identical to verified ones.

- **Run Controls (clear, with complexity guard):**
  - SimPlayButton (play/stop), probe management/overlay, sensor sliders during run.
  - ComplexityWarningDialog provides error recovery before heavy sim runs.
  - Good integration with live circuit state.

- **Results Display (dense, high CCN viewers):**
  - WaveformViewer (244 CCN), BodePlot, FrequencyAnalysisPanel, DCOP result tables, result history section, share button.
  - Interactive probing (ProbeOverlay on canvas?).
  - UI Container risks high: multiple waveform/frequency viewers + tables + history + trust cards + param panels can easily create scroll traps or unreachable controls on laptop viewports (classic gotcha).

- **Error Recovery (explicit complexity handling):**
  - `checkCircuitComplexity` + ComplexityWarningDialog is a clear error recovery path (prevent OOM or long runs on overly complex circuits).
  - Good, but may need deeper integration with provenance (e.g., "this complex generative design has no verified 3D models — simulation mechanical results may be unreliable").

- **Trust / Provenance (partial positive outlier):**
  - Unlike many surfaces (Schematic zero, PCB placer zero, Procurement zero, Right Sidebar zero), this one actively uses the trust system (`buildSimulationTrustReceipt`, `buildWorkspaceReleaseConfidence`, both cards rendered).
  - Still missing *result-level* provenance (marking which waveforms or data points came from untrusted/generative/ unverified parts).

- **Tests (gap):**
  - 0 tracked by the skill (one untracked test for SimPlayButton).
  - Browser checks essential for waveform interaction, probing, scroll behavior on dense result views.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface provenance on simulation *results* (not just top-level cards)**
- Waveforms, Bode plots, frequency data, and result tables should carry or link to the verification/generative status of the underlying parts and design (e.g., badge on traces, warning in result metadata, filter "only show verified simulations").
- This closes the loop for "what-if" and validation workflows on generative or unverified designs.

**P1 — Enforce UI Container Rule on the dense result viewers + side panels on laptop viewports**
- WaveformViewer (244 CCN) + FrequencyAnalysis + history + trust cards + param forms + probe overlay can trap content. Ensure all viewers are scrollable/resizable/collapsible without losing critical run controls or error messages.

**P2 — Expand test coverage for core flows** (run transient/AC/DC with probes, complexity warning path, SPICE import round-trip, result history/share, sensor slider what-if, error recovery states).
- A 5k+ LOC / 855 CCN simulation workbench with essentially no tracked tests is a gap for a Tier 2 surface used in validation and "what-if" on real hardware designs.

**P2 — Consider extraction/splitting of the heaviest components** (WaveformViewer 244 CCN, SimulationPanel 190 CCN, ProbeOverlay) for maintainability, similar to the extraction discipline applied elsewhere in circuit-editor.

**Strengths (relative to peers):**
- One of the **better provenance integrations** in the audit — actively builds simulation-specific trust receipts and workspace release confidence, renders both standard cards.
- Full-featured simulation workbench: multiple analysis types, interactive probing, frequency domain (Bode), SPICE import, sensor what-if sliders, complexity guards, result history + sharing.
- Strong ties to Schematic scenarios and the canonical circuit model.
- Explicit error recovery path via complexity checking is mature.

**Durable Lessons for Future Agents:**
- Simulation results are a high-leverage place to surface "this what-if came from an unverified generative design" warnings — currently the top-level cards exist, but per-result marking does not.
- A simulation workbench with 855 CCN across waveform viewers, analysis panels, and probing needs the same UI Container rigor as the densest editors (Schematic, PCB) and the same extraction discipline.
- Zero tracked tests on a Tier 2 but substantial simulation engine is a real gap for correctness of results that makers rely on for validation.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tracked tests).
- Mandatory ast-grep on the entire simulation/ dir returned zero per-result provenance signals (despite top-level trust cards — a partial win vs. zero-match surfaces).
- Full scc report (5,114 code / 855 CCN, WaveformViewer 244 CCN hotspot) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to Schematic (SimulationScenarioPanel), PCB/breadboard simulation needs, the provenance campaign (this surface is a relative bright spot for trust receipts but still has the per-result gap), UI Container Rule on dense viewers, and prior audits (Schematic, Serial Monitor as another positive trust example, Right Sidebar, etc.).
- Detailed Fast Workflow Execution Report appended here; master report section 35 written.

---

*Simulation analysis complete. This is a heavy Tier 2 simulation workbench (5k+ LOC / 855 CCN) with excellent functional coverage (setup via scenarios/params/SPICE, run via play/probes/sensors, results via waveform/Bode/frequency/history, error recovery via complexity dialog) and a positive provenance integration (builds simulation trust receipts + workspace release confidence, renders both cards). The recurring campaign gap remains: per-result provenance marking for generative/unverified inputs is missing. UI Container risks on the dense viewers + laptop viewports are real. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Simulation section (2026-05-23).*
