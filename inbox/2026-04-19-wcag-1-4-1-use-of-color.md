---
name: "WCAG 2.1 SC 1.4.1 Use of Color — vault-gap stub"
description: "Gap flagged by 03-a11y-systemic.md Wave 10 Task 10.2. Seed for /extract."
captured_date: 2026-04-19
extraction_status: pending
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  task: Wave 10 Task 10.2
coverage_at_gap: missing
strong_hits_at_gap: 0
research_questions:
  - What are the exact WCAG 2.1 SC 1.4.1 criteria?
  - Common violations in EDA / technical UIs (yellow warning triangles, red-error dots, green-pass indicators with no text)?
  - Recommended multi-channel encoding patterns (color + icon + label + pattern)?
  - How does this apply to ProtoPulse's current layer stack colors (red F.Cu / green Inner GND) and validation severity badges?
  - Relationship to color-blindness categories (deuteranopia 6%, protanopia 2%, tritanopia rare) + practical test tools (Sim Daltonism, Coblis)
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/08-pcb-3d-order.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/11-validation-simulation.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/16-design-system.md
topics:
  - vault-gap-seed
  - wcag
  - a11y
  - color-accessibility
---

## Gap context

E2E-323 flagged that ProtoPulse's yellow warning triangle on the Validation card has no text label — color-only severity violates WCAG 2.1 SC 1.4.1 Use of Color. The design-system plan (16) needs an authoritative note on the criterion + multi-channel encoding patterns to cite.

## Primary sources to consult

- W3C WCAG 2.1 SC 1.4.1 Use of Color — https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html
- W3C WCAG 2.1 SC 1.4.3 Contrast (Minimum) — https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- Color Universal Design (CUD) palette by Okabe & Ito — widely adopted colorblind-safe palette
- Nielsen Norman — "Using Color for Information in Accessibility"
- KiCad accessibility conventions for layer colors (authoritative for the EDA domain)

## Suggested extraction output

Atomic note + probably a sibling companion note:
- Primary: `knowledge/wcag-2-1-sc-1-4-1-color-cannot-be-sole-channel.md`
- Companion: `knowledge/multi-channel-severity-encoding-pattern.md` (color + icon + label minimum)

## Instructions for /extract

1. Research the WCAG SC text + the CUD palette.
2. Produce 1-2 atomic notes under `knowledge/`.
3. Cross-link to `maker-ux` MOC + `architecture-decisions` MOC.
4. Include practical code snippets for ProtoPulse surfaces (validation badge, DRC severity, layer stack).
