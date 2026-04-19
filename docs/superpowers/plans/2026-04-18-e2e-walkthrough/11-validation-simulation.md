# Validation + Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1/2 Validation + Simulation findings. Most P0 DRC empty-state bugs land in `01-p0-bugs.md` Phase 3; this plan polishes the Validation UX (color-coding, severity filter semantics, Design Troubleshooter), fixes Simulation "disabled green button" lie (E2E-392), adds waveform preview stub (E2E-393), and promotes the Design Troubleshooter symptoms input to a top-level entry point (E2E-387).

**Tech Stack:** shadcn/ui Toggle Group (severity filter), existing DRC engine (01 Phase 3), SPICE simulator (future / beyond scope per audit).

**Parent:** Tier E. Depends on 01 (DRC engine), 16 (Button variants, TrustReceipt, ConfidenceEvaluator).

## Coverage

Pass 1: validation items referenced across passes. Pass 2 Validation: E2E-383-389. Pass 2 Simulation: E2E-390-395. Confidence contradictions: E2E-485 / E2E-547 (handled by 16 Phase 5 — consume).

## Existing Infrastructure

- `client/src/components/views/ValidationView.tsx`
- `client/src/components/panels/DesignTroubleshooterPanel.tsx`
- `client/src/components/simulation/SimulationPanel.tsx`

## Waves

### Wave 1 — Validation polish
- [ ] Task 1.1 — Color-coding clarity (E2E-384): severity dot vs category tag — separate visual language (severity = dot color; category = outlined pill).
- [ ] Task 1.2 — Single master Run DRC button (E2E-385): three Run buttons → promote one primary, demote others to secondary.
- [ ] Task 1.3 — Issue chevron affordance (E2E-386): larger hit area; visible on hover.
- [ ] Task 1.4 — Design Troubleshooter symptoms input promoted to top (E2E-387): hero position.
- [ ] Task 1.5 — Severity filter semantics (E2E-389): multi-select explicit — ToggleGroup primitive.
- [ ] Task 1.6 — DRC ruleset diff (E2E-388) → route to 18 (expert feature).
- [ ] Task 1.7 — Dashboard-Validation parity via `useValidationSummary` (01 Phase 3 Task 3.3): verify consumption.
- [ ] Task 1.8 — Tests + commit.

### Wave 2 — Simulation polish
- [ ] Task 2.1 — Trust receipt (E2E-391): consume 16 Phase 4 `<TrustReceipt>` primitive.
- [ ] Task 2.2 — Start Simulation button honest disabled (E2E-392): use `disabledReason` tooltip from 16 Phase 3 Button variant.
- [ ] Task 2.3 — Waveform preview placeholder (E2E-393): last-result thumbnail / placeholder + "Run to see waveforms".
- [ ] Task 2.4 — Plain-English mode for DC Operating Point (E2E-394): `useWorkspaceMode() === 'student'` substitutes plain labels.
- [ ] Task 2.5 — Inline SPICE netlist editor (E2E-395) → route to 18.
- [ ] Task 2.6 — Tests + commit.

### Wave 3 — Consume ConfidenceEvaluator
- [ ] Task 3.1 — Validation + Simulation trust receipts fully consume `useConfidence()` from 16 Phase 5. No more contradicting strings.
- [ ] Task 3.2 — Tests + commit.

## Vault integration (added 2026-04-19)

Per master-index §7 + §13. Validation + Simulation is the RICHEST plan for vault consumption because every DRC rule + SPICE concept is a pedagogical moment.

### Planned insertions

| Task | Insertion site | Target vault slug | Status |
|------|----------------|-------------------|--------|
| Wave 1 Task 1.4 (Design Troubleshooter prompt) | Symptoms input — `buildVaultContext` auto-inject already lives in `server/ai.ts` (post 2026-04-14) | N/A — already consumes vault | ✅ existing infrastructure |
| Wave 2 Task 2.4 (DC Operating Point plain-English, E2E-394) | Simulation result table — Student-mode label substitution | `dc-operating-point-analysis-definition-and-interpretation` | 🟡 planned — seed gap |
| Wave 2 Task 2.2 (Start Simulation disabled tooltip, E2E-392) | `disabledReason` on Button | `simulation-readiness-preconditions-spice-model-plus-placed-components` | 🟡 planned — seed gap |
| Wave 1 Task 1.1 (DRC severity colors, E2E-384) | Validation row icon + color | `drc-severity-taxonomy-error-warning-info-and-how-to-triage` | 🟡 planned — seed gap |
| Every DRC rule (systemic per T10 quality gate) | Each rule has a `vaultSlug` field; "Why is this wrong?" button → `<VaultExplainer slug={rule.vaultSlug}>` | Many — e.g. `drc-should-flag-direct-gpio-to-inductive-load-...` already exists | ✅ partially covered; inventory via `/vault-suggest-for-plan` |

### Gap stubs to seed

```
/vault-gap "DC operating point analysis definition and interpretation" --origin-plan 11-validation-simulation.md --origin-task 2.4
/vault-gap "simulation readiness preconditions SPICE model placed components" --origin-plan 11-validation-simulation.md --origin-task 2.2
/vault-gap "DRC severity taxonomy error warning info triage priority" --origin-plan 11-validation-simulation.md --origin-task 1.1
```

### DRC rule → vault slug registry

Create (in this plan's work): a JSON at `server/services/drc/rule-registry.json` mapping each rule ID to a vault slug. When a new rule is added, the registry requires a vault slug too. CI asserts every rule has a resolvable slug (via T3 backlink index).

```json
{
  "gpio-inductive-load-missing-flyback": {
    "severity": "error",
    "vaultSlug": "drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit",
    "shortMessage": "GPIO → inductive load without driver",
    "category": "power"
  },
  "decoupling-cap-missing": {
    "vaultSlug": "drc-should-flag-missing-decoupling-cap-on-ic-vcc-pin",
    "...": "..."
  }
}
```

### Gate

- Every new DRC rule commit MUST include its vault slug (in the registry) AND pass `/vault-validate <slug>` AND pass `/vault-quality-gate` on the associated vault note if new.

## Checklist

```
□ Prereqs: 01 Phase 3 (DRC guards), 16 (TrustReceipt + ConfidenceEvaluator)
□ check/test/lint/prettier clean
□ Playwright validation-* + simulation-* pass
```
