---
name: "WCAG 2.1 SC 1.4.11 focus ring 3:1 contrast — vault-gap stub"
description: "Gap flagged by 03-a11y-systemic.md Wave 10 Task 10.1. Seed for /extract."
captured_date: 2026-04-19
extraction_status: extracted
extracted_to: knowledge/wcag-2-1-sc-1-4-11-requires-focus-indicators-to-hit-3-to-1-contrast-against-adjacent-colors.md
extracted_date: 2026-04-19
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  task: Wave 10 Task 10.1
coverage_at_gap: missing
strong_hits_at_gap: 1
research_questions:
  - What exactly does WCAG 2.1 SC 1.4.11 Non-text Contrast require for focus indicators?
  - What is the minimum contrast ratio (3:1) and against what adjacent colors?
  - How does it interact with SC 2.4.7 Focus Visible and SC 2.4.11 Focus Not Obscured (2.2)?
  - What's a "focus cage" dual-outline pattern that robustly meets the bar?
  - What's the minimum indicator thickness + offset that passes AAA (SC 2.4.13)?
  - How does this apply to ProtoPulse's current `outline: 2px solid #00F0FF; outline-offset: 2px` + how does it fail against cyan-adjacent backgrounds?
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/16-design-system.md
topics:
  - vault-gap-seed
  - wcag
  - a11y
  - focus-indicator
---

## Gap context

The ProtoPulse a11y-systemic plan (E2E-1013, E2E-1014) needs an authoritative reference on WCAG 2.1 SC 1.4.11 Non-text Contrast's application to focus indicators. The closest existing note is `knowledge/focus-outline-none-strips-keyboard-indicators-wcag-violation.md` (SC 2.4.7 violation, tangential). We need a new note specifically on the 3:1 contrast requirement + recommended cage pattern.

## Primary sources to consult

- W3C WCAG 2.1 SC 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
- W3C WCAG 2.1 SC 2.4.7 Focus Visible — https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html
- W3C WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- W3C WCAG 2.2 SC 2.4.13 Focus Appearance (AAA) — https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- Adrian Roselli — "Focus Ring Basics" / focus cage pattern
- Sara Soueidan — "A Guide to Designing Accessible, WCAG-Compliant Focus Indicators" (smashingmagazine.com)

## Suggested extraction output

Atomic note with:
- Frontmatter: `audience: [intermediate, expert]`, `confidence: verified`, provenance entries for each WCAG SC + design article
- Body structure: Claim → Mechanism (WCAG contrast math) → Application (recommended implementations: dual-outline cage, `:focus-visible` with `box-shadow` backup, `outline-offset` to survive rounded corners) → Caveats (Safari outline-offset bugs pre-16.4; `outline: auto` browser differences) → Cross-links to existing `focus-outline-none-...` note

## Instructions for /extract

1. Read this stub + the primary sources above.
2. Synthesize into `knowledge/wcag-2-1-sc-1-4-11-focus-indicator-3to1-contrast.md` (or similar slug).
3. Cross-link to `focus-outline-none-...` and `maker-ux.md`.
4. Run `/vault-quality-gate` before committing.
5. Mark this stub row `extracted` in `ops/queue/gap-stubs.md`.
