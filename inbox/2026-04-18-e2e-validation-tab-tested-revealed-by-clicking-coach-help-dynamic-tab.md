---
name: E2E walkthrough — Validation tab — TESTED (revealed by clicking Coach & Help, dynamic tab)
description: Frontend E2E findings for 'Validation tab — TESTED (revealed by clicking Coach & Help, dynamic tab)' chunk from 2026-04-18 walkthrough. 10 E2E IDs; 2 🔴, 4 🟡, 4 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 2
  ux: 4
  idea: 4
  works: 0
  e2e_ids: 10
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Validation tab — TESTED (revealed by clicking Coach & Help, dynamic tab)

URL `/projects/30/validation`. **Found 128 potential issues in your design.** (1 BME280 component placed.) Filter: Errors (32) / Warnings (96) / Info (0).

Sections:
- DRC preset: General (Balanced) — Best for: Breakout boards, LED drivers, Prototyping. Custom Rules + Run DRC Checks buttons.
- Design Gateway — 12 issue types listed (Missing decoupling cap, Floating input pin, Unconnected power pin, Missing pull-up, High-power without heatsink, Crystal missing load caps, Voltage domain mismatch, Redundant component, No reverse polarity protection, No test points, IC without ground, BOM not placed). Each has Toggle button.
- DFM Check — Fab dropdown ("Select fab house...")
- Manufacturer Rule Compare — manufacturer dropdown
- BOM Completeness — "No BOM data available"
- Design Troubleshooter — symptoms textarea + 17 categorized common issues (Floating Inputs, Missing Decoupling Caps, Wrong Polarity, Shorted Power Rails, Missing Ground, Bad Voltage Divider, LED w/o Resistor, I2C Missing Pull-up, SPI Bus Contention, etc.)

### Validation findings

- **E2E-091 🔴 BUG** — **128 issues on a 1-component project** (32 errors + 96 warnings). The validation engine is firing rules against an empty design as if there's a full circuit. Either (a) DRC runs heuristic over EVERYTHING regardless of placement, or (b) Issue counts are static demo numbers.
- **E2E-092 🟡 UX** — Empty design but Validation says "Found 128 potential issues" — gives illusion that user must fix something they haven't built yet.
- **E2E-093 🔴 BUG** — Dashboard validation card said "All Checks Passing — No issues detected" yet Validation tab shows 128 issues. **Direct contradiction between two views of the same data.**
- **E2E-094 🟡 UX** — Issue table columns: SEV / DESCRIPTION / COMPONENT / ACTION. Severity column should use icons + color (currently text-only "power" / "signal" / "best-practice" — those aren't severities, they're categories).
- **E2E-095 🟢 IDEA** — "Toggle Missing decoupling capacitor" buttons — toggle what? Mute the rule? Acknowledge? Mark as fixed? Label is ambiguous.
- **E2E-096 🟡 UX** — "Floating input pin" appears as both an issue (in Design Gateway) AND a Troubleshooter card. Duplicated knowledge in two places.
- **E2E-097 🟢 IDEA** — Apply button next to preset combobox is disabled even though preset is "General (Balanced)" already. Should be hidden if no change.
- **E2E-098 🟢 IDEA** — Design Troubleshooter symptoms input is gold UX. Consider promoting to global searchable command palette.
- **E2E-099 🟢 IDEA** — Manufacturer Rule Compare is a powerful pro feature buried at the bottom — surface it.
- **E2E-100 🟡 UX** — `1 Design Suggestions` (singular noun + plural number) — copy bug.

### Validation edge cases

- Run DRC with no fab selected
- Manufacturer rule compare with custom (untracked) manufacturer
- Toggle a rule then re-run — does state persist?
- Custom rules JSON with malformed input
- Symptom search "" empty string
- Combine "Errors only" filter with custom rules

---

# MODE CHANGE — Meticulous baby-step pass

Per Tyler: stop marching/half-assing. Each interaction = one real click via DevTools, fresh snapshot, look at the result, document, then next. Beginning at Dashboard.

