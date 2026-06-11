# Calculators Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Calculators work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Calculators behavior.

## Pending Proposals

- Add screenshots for the main Calculators states.
- Add more specific gotchas after the next real Calculators implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05 Deep Analysis Pass (user: "/pp-view-calculators" in the systematic full-app views backlog campaign)

**Workflow followed exactly:**
1. Inspector run → ok (CalculatorsView 1023 LOC / 93 complexity — moderate for a multi-calculator surface).
2. page-map.md read (single file).
3. ux-contract.md read (strong emphasis on visibility of "Apply To Design Actions").
4. testing.md read (no tests recorded).
5. gotchas.md read.
6. This entry + contribution to master backlog report.

**Deep Findings:**

**What the View Actually Delivers:**
- A clean grid of practical electronics calculators (Ohm's Law, LED resistor, Voltage Divider (forward + reverse/suggest), RC time constant, RC/Bandpass filters, Power dissipation).
- Good engineering notation formatting and input handling.
- "Apply" buttons via `CalcApplyButtons` that do:
  - Add to BOM (generic/low-fidelity entry)
  - Apply to Component (copies value to clipboard for manual paste)

**Biggest Gap vs. UX Contract:**
- The contract explicitly calls out **"Apply To Design Actions is visible enough for a user to understand what is happening"** as a must-hold.
- Current implementation is weak: BOM adds are low-quality stubs; component apply is just clipboard. There is no deep, one-click application into the schematic, PCB, or component properties.
- This is the single largest missed opportunity in the view.

**Other Notable Items:**
- Excellent attention to accessibility (the MAX_CALC_VALUE + aria-valuemax story for spinbuttons is thoughtful and references a real past E2E bug).
- No automated tests for the view itself.
- Good potential for tighter AI/Chat integration ("calculate the right resistor for this LED I just placed").
- Reverse flow (results feeding validation or power analysis) is missing.
- With many cards, the layout must stay clean on laptop viewports (per contract).

**Durable Lesson:**
A collection of calculators is only as valuable as its "apply" story. When the contract calls out "Apply To Design Actions" as a first-class concern, clipboard + generic BOM stubs do not satisfy the requirement. The highest-leverage improvements are deeper, context-aware application into the actual design (schematic instances, PCB properties, power validation, etc.).

**Recommended for Codex:**
- Strengthen the apply layer (`lib/calculator-apply.ts` + `CalcApplyButtons`) to support real property setting on selected components and better BOM item creation.
- Add direct integration hooks from the component editor / PCB layout (right-click a resistor → "Calculate LED resistor").
- Add tests for the main calculators and apply paths.
- Explore AI/Chat surfaces for calculator results and suggestions.

This analysis is contributed to the living master backlog report. The Calculators view is clean and useful for manual calculations, but the "apply to design" promise (central to its UX contract) is only partially delivered.

## R23 Keyboard Lesson

The shared keyboard helper does not resolve `<label htmlFor>` names. For tab-reachable calculator numeric inputs, keep explicit `aria-label` values alongside visible labels so browser checks and assistive tooling both see stable names.
