---
name: E2E walkthrough — Calculators — meticulous baby-step
description: Frontend E2E findings for 'Calculators — meticulous baby-step' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 1 🔴, 0 🟡, 1 🟢, 2 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0781-0781
severity_counts:
  p1_bug: 1
  ux: 0
  idea: 1
  works: 2
  e2e_ids: 5
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Calculators — meticulous baby-step

URL `/projects/30/calculators`. 6 calculators: Ohm's Law, LED Resistor (defaults 5V/2V/0.02A), Voltage Divider (Forward/Reverse tabs), RC Time Constant (10kΩ/1µF), Filter Cutoff (RC/Bandpass tabs + Low/High pass), Power Dissipation. Each calculator has Calculate button.

### Baby-step: click Calculate on LED Resistor

→ Result rendered: **Exact R 150Ω, Nearest E24 150Ω, Nearest E96 150Ω, Current (E24) 20 mA, Resistor Power 60 mW.** + `Add to BOM` + `Apply to Component` action buttons.

- **E2E-282 ✅ EXCELLENT** — LED Resistor calculator computes correctly (5-2)/0.02 = 150Ω. Shows nearest standard values from E24 + E96 series. Accurate power calc.
- **E2E-283 ✅ EXCELLENT** — Add to BOM + Apply to Component create calculator→procurement→architecture link. Killer integration feature.
- **E2E-284 🔴 BUG (PATTERN)** — All spinbuttons valuemax=0 (E2E-236/271 pattern recurring across many tabs).
- **E2E-285 🟢 IDEA** — Default 0.02A (20mA) is good for standard LED. Add presets dropdown ("LED" / "High-power LED" / "IR LED" with auto-fill values).

---

