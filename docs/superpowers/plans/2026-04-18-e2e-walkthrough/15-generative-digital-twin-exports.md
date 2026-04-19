# Generative, Digital Twin, Exports, Calculators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1/2 findings for 4 utility tabs: Generative (GA optimizer UX — slider labels, defaults profiles, disabled-looking Generate button), Digital Twin (sparse audit — verify surface), Exports (polish Export Center + Quick Profiles + format size previews), Calculators (spinbutton bug via 02, formula → Learn cross-links, unit conversions, REPL mode for experts).

**Parent:** Tier F. Depends on 02 (NumberInput), 03, 16, 17. Innovations (E2E-438 REPL, E2E-510-511 AI moonshots, STL/STEP export E2E-368, deeper simulation) → 18.

## Coverage

| Source | IDs |
|--------|-----|
| Pass 1 Calculators | E2E-055-058 (approx, grep to confirm) |
| Pass 2 Generative | E2E-468-472 |
| Pass 2 Exports | E2E-473-477 |
| Pass 2 Calculators | E2E-435-440 |
| Digital Twin | scattered across passes (grep) |

## Existing Infrastructure

- `client/src/components/views/GenerativeDesignView.tsx`
- `client/src/components/views/DigitalTwinView.tsx`
- `client/src/components/panels/ExportPanel.tsx`
- `client/src/components/views/CalculatorsView.tsx`

## Waves

### Wave 1 — Generative
- [ ] Task 1.1 — Slider current-value labels (E2E-468, E2E-470): inline `${value}` next to slider.
- [ ] Task 1.2 — Preset defaults profiles (E2E-469): `Hobby / Industrial / Automotive` dropdown sets sensible values.
- [ ] Task 1.3 — Generate button visual fix (E2E-471): primary cyan solid, not dark teal. Use 16 Phase 3 Button primary variant.
- [ ] Task 1.4 — Population / Generations tooltips (E2E-472): "Population = number of candidates per round. Generations = how many rounds to evolve." Link to Learn article on GA.
- [ ] Task 1.5 — Tests + commit.

### Wave 2 — Digital Twin
- [ ] Task 2.1 — Grep all Pass 1 Digital Twin findings.
- [ ] Task 2.2 — Trust receipt + empty-state per 16.
- [ ] Task 2.3 — MQTT/HTTP/WiFi simulation (E2E-527) → route to 18.
- [ ] Task 2.4 — Tests + commit.

### Wave 3 — Exports
- [ ] Task 3.1 — Preserve excellent existing structure (E2E-473, E2E-474).
- [ ] Task 3.2 — Promote Quick Export Profiles above format list (E2E-477).
- [ ] Task 3.3 — Preview file sizes (E2E-476): estimate via server → client ("BOM CSV ~3KB, Gerber ZIP ~120KB").
- [ ] Task 3.4 — Remote preflight option link (E2E-475).
- [ ] Task 3.5 — Ship KiCad 9 Jobsets parity (E2E-529): orchestrated bundle pipelines — "On release: Gerbers + BOM + Pick&Place + 3D STEP + Schematic PDF" templates.
- [ ] Task 3.6 — STL/STEP 3D export (E2E-368 from 08 routing): wire the Export button in 3D View through Export Center.
- [ ] Task 3.7 — Tests + commit.

### Wave 4 — Calculators
- [ ] Task 4.1 — Card layout preserved (E2E-435 — excellent).
- [ ] Task 4.2 — Tab labels inside cards (E2E-436): promote small text.
- [ ] Task 4.3 — Link to Learn article per formula (E2E-437): "V = I × R" → "Learn about Ohm's Law →" (cross-tab action to 13 Learn Hub).
- [ ] Task 4.4 — Unit conversion calculators (E2E-439): mil↔mm, AWG↔mm², dBm↔mW.
- [ ] Task 4.5 — Rounded corners (E2E-440): match app-wide `rounded-md`.
- [ ] Task 4.6 — REPL mode for experts (E2E-438) → route to 18.
- [ ] Task 4.7 — NumberInput aria-valuemax fix (E2E-284) — consumed from 02 Phase 7.
- [ ] Task 4.8 — Tests + commit.

## Vault integration (added 2026-04-19)

Per master-index §7 + §13. Calculators are pure formulas — every one is a pedagogical moment. Generative is GA-based so parameter notes matter.

### Planned insertions

| Task | Insertion site | Target vault slug | Status |
|------|----------------|-------------------|--------|
| Wave 1 Task 1.4 (Population/Generations tooltips, E2E-472) | Slider labels + Learn cross-link | `genetic-algorithm-parameters-population-and-generations-explained` | 🟡 seed gap |
| Wave 1 Task 1.2 (Preset profiles, E2E-469) | Profile dropdown — each preset has `vaultSlug` justification | `ga-preset-hobby-vs-industrial-vs-automotive-constraints` | 🟡 seed gap |
| Wave 3 Task 3.5 (KiCad Jobsets, E2E-529) | Jobset template descriptions | `kicad-9-jobsets-release-bundle-orchestration` | 🟡 seed gap |
| Wave 4 Task 4.3 (Calculator formula → Learn, E2E-437) | Every calculator card has `vaultSlug` for the underlying physics | `ohms-law-v-equals-i-times-r`, `rc-lowpass-cutoff-frequency`, `voltage-divider-formula`, `resistor-parallel-series-combining` | 🟡 seed gaps |
| Wave 4 Task 4.4 (Unit conversion, E2E-439) | Conversion card — "why this matters" | `mil-vs-mm-pcb-unit-convention`, `awg-vs-mm2-wire-sizing`, `dbm-vs-mw-rf-power-units` | 🟡 seed gaps |
| Wave 2 Task 2.2 (Digital Twin trust receipt) | Trust receipt body | `digital-twin-simulation-fidelity-limits` | 🟡 seed gap |

### Gap stubs to seed

```
/vault-gap "genetic algorithm parameters population and generations explained" --origin-plan 15-generative-digital-twin-exports.md --origin-task 1.4
/vault-gap "GA preset hobby vs industrial vs automotive constraints" --origin-plan 15-generative-digital-twin-exports.md --origin-task 1.2
/vault-gap "KiCad 9 jobsets release bundle orchestration Gerbers BOM P&P" --origin-plan 15-generative-digital-twin-exports.md --origin-task 3.5
/vault-gap "Ohms law V equals I times R derivation and intuition" --origin-plan 15-generative-digital-twin-exports.md --origin-task 4.3
/vault-gap "RC lowpass filter cutoff frequency 1 over 2 pi RC" --origin-plan 15-generative-digital-twin-exports.md --origin-task 4.3
/vault-gap "voltage divider formula two resistor ratio derivation" --origin-plan 15-generative-digital-twin-exports.md --origin-task 4.3
/vault-gap "resistor parallel series combining formulas" --origin-plan 15-generative-digital-twin-exports.md --origin-task 4.3
/vault-gap "mil vs mm PCB unit convention 1000 mil equals 25.4mm" --origin-plan 15-generative-digital-twin-exports.md --origin-task 4.4
/vault-gap "AWG to mm squared wire sizing conversion" --origin-plan 15-generative-digital-twin-exports.md --origin-task 4.4
/vault-gap "dBm to mW RF power units conversion" --origin-plan 15-generative-digital-twin-exports.md --origin-task 4.4
/vault-gap "digital twin simulation fidelity limits what it cannot model" --origin-plan 15-generative-digital-twin-exports.md --origin-task 2.2
```

### Consumption pattern

```tsx
<CalculatorCard formula="V = I × R">
  <FormulaDisplay>V = I × R</FormulaDisplay>
  <VaultHoverCard slug="ohms-law-v-equals-i-times-r">
    Learn about Ohm's Law →
  </VaultHoverCard>
</CalculatorCard>
```

## Checklist

```
□ Prereqs: 02 (NumberInput), 03, 16, 17 merged
□ check/test/lint/prettier clean
□ Playwright generative-*, digital-twin-*, exports-*, calculators-* pass
```
