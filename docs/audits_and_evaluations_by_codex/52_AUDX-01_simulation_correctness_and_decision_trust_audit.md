# AUDX-01: Simulation Correctness and Decision Trust Audit

Date: 2026-03-30  
Author: Codex  
Wave: Deep Systems Expansion  
Purpose: Determine how trustworthy ProtoPulse simulation outputs are for learning, iteration, and real design decisions, then define how to harden and elevate the simulation experience.

## Current Trust Posture
- `Safe for exploration`: yes, with caveats
- `Safe for comparative design iteration`: partially
- `Safe for engineering sign-off without external verification`: no

ProtoPulse simulation currently looks much closer to a strong learning and early-iteration tool than to a simulator a user should trust blindly for irreversible hardware decisions.

## What Was Reviewed
- Prior simulation audits:
  - `docs/audits_and_evaluations_by_codex/10_FE-10_simulation_analysis_logic_audit.md`
  - `docs/audits_and_evaluations_by_codex/24_BE-10_simulation_spice_backend_audit.md`
- Adjacent validation and release-confidence audits:
  - `docs/audits_and_evaluations_by_codex/30_BE-16_backend_test_reality_check_audit.md`
  - `docs/audits_and_evaluations_by_codex/32_SH-02_shared_validation_standards_audit.md`
- Product claims and readiness framing:
  - `docs/product-analysis-checklist.md`
  - `docs/audits_and_evaluations_by_codex/33_UIUX-00_master_rollup.md`

## What Was Verified
- Reconfirmed that prior FE and BE simulation audits already identified both frontend solver-quality issues and backend execution-safety gaps.
- Reconfirmed that no evidence set in the current audit corpus proves a gold-standard reference-circuit verification harness is in place.
- Reconfirmed that current product-level docs and surfaced capability framing can easily imply more simulation trust than the current evidence base supports.
- No new numerical reference-suite execution was run in this pass. This document is a second-pass synthesis grounded in existing audit evidence.

## Findings By Severity

### 1) `P0` Netlist/directive injection risk still makes untrusted simulation input unsafe
Evidence:
- `24_BE-10_simulation_spice_backend_audit.md`
- Backend audit already flagged netlist directive injection risk on the ngspice execution path.

Why this matters:
- A simulation surface that executes hostile directives is not only a correctness problem; it is a local-trust and platform-safety problem.
- This alone is enough to block any claim that ProtoPulse simulation is ready for untrusted imported models or broad autonomous AI-generated simulation flows.

Recommended direction:
- Treat SPICE input sanitization as a release gate.
- Add an allowlist parser for directives and models instead of passing through broad raw text.

### 2) `P1` Solver behavior is split across paths and feature coverage is incomplete
Evidence:
- `10_FE-10_simulation_analysis_logic_audit.md`
- `24_BE-10_simulation_spice_backend_audit.md`
- Prior audits already recorded:
  - DC solver silently skipping some element classes
  - split-brain DC behavior across UI/runtime paths
  - fallback solver behavior diverging from backend expectations

Why this matters:
- If two internal paths answer the same electrical question differently, the user cannot know which answer is the product’s truth.
- That makes simulation useful for intuition-building, but not yet trustworthy for design sign-off.

Recommended direction:
- Collapse onto one canonical analysis path per simulation mode.
- Make any fallback solver explicit and visibly labeled when used.

### 3) `P1` Invalid numeric settings can still lead to NaNs, stalls, or pathological workloads
Evidence:
- `10_FE-10_simulation_analysis_logic_audit.md`
- `24_BE-10_simulation_spice_backend_audit.md`
- Confirmed issues already include:
  - transient stall risk for invalid timestep values
  - PDN sweep NaN generation on bad settings
  - overly large DC sweep expansion behavior
  - incomplete backend resource controls

Why this matters:
- A simulator that accepts dangerous parameters without strong guardrails will feel flaky even when the core math is sound.
- Beginners are especially likely to interpret broken outputs as their own fault.

Recommended direction:
- Add strict parameter validation before execution.
- Enforce sweep/sample caps and surface “why this was rejected” in plain language.

### 4) `P1` There is still no visible user-facing confidence model for simulation results
Evidence:
- `33_UIUX-00_master_rollup.md`
- `35_UIUX-02_core_design_views_audit.md`
- Prior audits identified correctness gaps, but current UI surfaces do not appear to clearly tell users when a result is approximate, partial, fallback-derived, or unsuitable for manufacturing decisions.

Why this matters:
- Users treat charts, waveforms, and numeric outputs as authoritative unless the product teaches them otherwise.
- The absence of a trust layer converts implementation debt into user overconfidence.

Recommended direction:
- Add explicit result status labels such as:
  - `Reference-checked`
  - `Model-limited`
  - `Fallback solver`
  - `Learning-grade only`

### 5) `P2` Model parsing, unit parsing, and cache invalidation inconsistencies still threaten repeatability
Evidence:
- `10_FE-10_simulation_analysis_logic_audit.md`
- Prior audit already captured inconsistent SPICE value parsing and stale filtered-model invalidation behavior.

Why this matters:
- Repeatability is part of trust. If the same model/value combination can be interpreted differently across modules or stale caches, users lose faith in the whole analysis stack.

Recommended direction:
- Centralize value parsing and unit normalization.
- Replace ad hoc filtered-cache invalidation with structured query keys and deterministic invalidation rules.

### 6) `P2` Test coverage is not yet proving simulation truth against known-good references
Evidence:
- `30_BE-16_backend_test_reality_check_audit.md`
- Current test-reality audit shows strong subsystem coverage in places, but not a broad live verification harness against canonical reference circuits.

Why this matters:
- Unit tests can prove code stability without proving that the math matches reality or a trusted external simulator.

Recommended direction:
- Build a golden-circuit verification suite and run it in CI.
- Track output drift over time, not just pass/fail behavior.

## Why It Matters
Simulation is one of the most trust-sensitive parts of ProtoPulse. If the app teaches beginners with incorrect or unstable outputs, it creates misconceptions. If it reassures intermediate users with incomplete or mislabeled analysis, it can push them toward bad hardware decisions. The right standard is not “perfect SPICE parity for every edge case.” The right standard is honest trust framing plus a steadily expanding set of reference-verified modes.

## Improvement Directions
1. Establish a `simulation trust ladder` with explicit labels for learning-grade, comparative-grade, and sign-off-blocked outputs.
2. Create a canonical reference-circuit suite covering DC, AC, transient, Monte Carlo, and invalid-input handling.
3. Unify solver pathing so the product has one clear answer for each mode.
4. Add hard input/resource controls before the job starts rather than recovering after bad settings are accepted.
5. Surface model/source limitations directly in the result UI.
6. Build comparison tooling against a trusted external engine for regression tracking.

## Enhancement / Addition / Integration Ideas
- Add a `Why this waveform changed` explainer that narrates the role of resistance, capacitance, switching, and tolerances.
- Add a `Compare to ideal circuit` toggle for educational scenarios.
- Add a sensitivity heatmap that highlights which parts dominate a voltage, timing, or gain result.
- Add reference-circuit starter packs tied to Knowledge and Labs so users can learn by perturbing known-good examples.
- Add `simulate before upload` hooks in firmware and Arduino flows where appropriate.
- Add AI-assisted interpretation that explains what the result means without pretending the result is higher confidence than it is.
- Add hardware-in-the-loop comparison capture for supported simple measurement loops.

## Quick Wins
1. Reject invalid timestep and sweep settings earlier with user-facing explanations.
2. Add visible badges for `fallback solver`, `model-limited`, and `learning-grade`.
3. Centralize SPICE numeric parsing and unit conversion.
4. Cap sweep/sample sizes and emit deterministic validation errors instead of NaNs or huge expansions.
5. Add a short `When to trust this result` help panel to simulation surfaces.

## Medium Lifts
1. Build a golden reference-circuit suite with expected outputs committed to the repo.
2. Unify frontend and backend solver selection so the same user action does not fork into materially different behaviors.
3. Add a results receipt showing solver path, model source, parameter set, and known limitations.
4. Add simulation-specific regression tests that compare waveform/statistical summaries over time.
5. Integrate manufacturer or datasheet-backed default assumptions where models are known incomplete.

## Big Swings
1. Build a `Simulation Trust Center` that compares ProtoPulse outputs against reference engines and hardware captures.
2. Add a progressive teaching mode where the simulator explains the circuit as it runs and highlights what each component is doing.
3. Create a closed-loop `simulate -> build -> measure -> compare` workflow that teaches users how simulation and reality diverge.

## Residual Unknowns
- No new live numeric verification against external reference simulators was executed in this pass.
- The current audit corpus does not prove whether recent un-audited changes improved or worsened any individual solver path after the March 6 audits.
- Hardware-measured correlation for simple reference circuits is still unknown.

## Related Prior Audits
- `10_FE-10_simulation_analysis_logic_audit.md` — confirmed
- `24_BE-10_simulation_spice_backend_audit.md` — confirmed
- `30_BE-16_backend_test_reality_check_audit.md` — extended
- `33_UIUX-00_master_rollup.md` — extended with decision-trust framing
