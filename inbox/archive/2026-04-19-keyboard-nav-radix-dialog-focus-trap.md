---
name: "Keyboard nav + Radix Dialog focus trap + Escape hierarchy — vault-gap stub"
description: "Gap flagged by 03-a11y-systemic.md Wave 10 Task 10.4 + Phase 6 (keyboard-nav test suite). Seed for /extract."
captured_date: 2026-04-19
extraction_status: extracted
extraction_date: 2026-04-19
extracted_notes:
  - knowledge/radix-dialog-focus-trap-and-escape-hierarchy.md
  - knowledge/popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision.md
  - knowledge/oncloseautofocus-must-fallback-when-trigger-is-unmounted.md
  - knowledge/nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level.md
  - knowledge/protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays.md
  - knowledge/playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom.md
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  task: Wave 10 Task 10.4
coverage_at_gap: missing
strong_hits_at_gap: 0
research_questions:
  - What's the correct Radix Dialog focus-trap behavior? (`autoFocus`, `onOpenAutoFocus`, `onCloseAutoFocus`, `FocusScope` internals)
  - How does focus return after Escape? What's the ProtoPulse convention when a dialog closes due to `onOpenChange(false)` vs `Escape`?
  - Nested-dialog focus-trap composition: modal opens another modal — what stacks the traps, what escapes in order?
  - Interaction with `<PopoverTrigger asChild>` + nested Tooltip (see E2E-074 root cause — slot forwarding is related)
  - Focus-trap testing strategy in Playwright: `Tab` sequences, `await page.keyboard.press('Escape')`, assert focus returns to opener
  - Axe-core rules that validate focus-trap correctness
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/02-p1-dead-buttons.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/17-shell-header-nav.md
topics:
  - vault-gap-seed
  - aria
  - a11y
  - keyboard-navigation
  - radix-ui
---

## Gap context

Multiple 2026-04-18 E2E findings touch dialog focus management:
- E2E-074 (Coach popover) — root cause is `PopoverTrigger asChild` wrapping `StyledTooltip` (Slot forwarding breaks)
- E2E-266 (Community card → detail Dialog) — needs focus trap + Escape return
- E2E-1017 (popovers use same dialog design) — good pattern; document and replicate
- E2E-554 (keyboard-nav test suite) — needs a spec of what "correct" looks like

No vault note currently ties the Radix primitives + WAI-ARIA Dialog pattern + ProtoPulse conventions together.

## Primary sources to consult

- Radix UI Dialog docs — https://www.radix-ui.com/docs/primitives/components/dialog
- Radix UI Popover docs — https://www.radix-ui.com/docs/primitives/components/popover
- Radix FocusScope internals — https://github.com/radix-ui/primitives/tree/main/packages/react/focus-scope
- W3C WAI-ARIA 1.2 Dialog (Modal) Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- Sara Soueidan — "Focus Trap 101"
- Deque University — axe dialog-name rule

## Suggested extraction output

- Primary: `knowledge/radix-dialog-focus-trap-and-escape-hierarchy.md`
- Companion (maybe): `knowledge/popover-trigger-aschild-slot-forwarding-gotcha.md` (documents the E2E-074 root cause)

## Instructions for /extract

1. Read Radix source (FocusScope.tsx + DialogContent.tsx) to understand exact behavior.
2. Research WAI-ARIA dialog pattern for the ideal spec.
3. Document ProtoPulse's canonical conventions:
   - All modal dialogs use `<Dialog>`; all transient anchored overlays use `<Popover>`.
   - When wrapping a Popover trigger in Tooltip, ALWAYS nest `<Tooltip>` OUTSIDE `<PopoverTrigger asChild>` (fix per E2E-074).
   - `onCloseAutoFocus` should return to the opener unless opener is unmounted; fall back to body.
4. Produce test examples (Playwright `Tab` / `Escape` sequences).
5. Cross-link to `maker-ux` MOC + `architecture-decisions`.
