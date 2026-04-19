---
name: "WCAG + ARIA patterns expansion MOC — vault-gap stub"
description: "Gap flagged by T4 Directed MOC Expansion. Vault has ~16 a11y notes; needs a consolidating MOC + expansion notes beyond Wave 10's four seeds."
captured_date: 2026-04-19
extraction_status: pending
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md
  task: T4 Directed MOC Expansion — A11y/WCAG
coverage_at_gap: thin
strong_hits_at_gap: 16
research_questions:
  - What's the canonical ARIA pattern for a combobox (editable + listbox pop-up)? How does Radix implement it?
  - Tab panels pattern — aria-controls, aria-labelledby, roving tabindex vs aria-selected
  - Disclosure widget (button that toggles visibility) — aria-expanded vs hidden, focus management
  - Toast notifications — aria-live region politeness (polite vs assertive) + auto-dismiss accessibility
  - Modal dialog — focus trap, aria-modal, initial focus, return focus on close
  - Data grid for 2D canvas (breadboard) — how does ARIA grid pattern scale beyond ~100 cells?
  - Keyboard shortcuts — registering as `aria-keyshortcuts` + discoverability
  - Screen reader testing — NVDA/JAWS/VoiceOver differences; which should a dev prioritize?
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md (consuming)
  - All per-tab plans (form fields, dialogs, toasts)
topics:
  - vault-gap-seed
  - wcag
  - aria
  - a11y
  - keyboard-nav
---

## Gap context

Vault has 16 a11y notes total (thin); Wave 10 of 03-a11y-systemic seeds 4 more. T4 is the directed push to make a11y/WCAG a first-class MOC. This stub captures the remaining expansion work after Wave 10 extracts.

## Primary sources to consult

- W3C WAI-ARIA Authoring Practices Guide — https://www.w3.org/WAI/ARIA/apg/
- WCAG 2.1 Understanding — all Level A + AA SCs
- Radix UI primitives docs — canonical React ARIA implementations
- Adrian Roselli blog — extensive ARIA pattern critiques
- Deque University ARIA reference

## Suggested extraction output

MOC + ~12 atomic notes:
- `moc-a11y-wcag-aria.md` — index organized by widget pattern
- One note per widget pattern (combobox, tab panels, disclosure, toast, modal, tooltip, menu, grid, tree, slider, spinbutton, listbox)
- One note per relevant WCAG SC cited in ProtoPulse (1.4.3, 1.4.11, 2.1.1, 2.1.2, 2.4.3, 2.4.7, 3.2.1, 3.3.2, 4.1.2, 4.1.3)

Audience tiers required on every note — beginner (what) / intermediate (how to implement with Radix) / expert (screen reader quirks + testing).

## Instructions for /extract

1. Wait until Wave 10's four stubs are extracted (prereq; don't duplicate).
2. For remaining widget patterns, synthesize atomic notes from ARIA APG + Radix source reading.
3. Build `moc-a11y-wcag-aria.md` with section per pattern group.
4. Cross-link from `moc-maker-ux.md` + `moc-architecture-decisions.md`.
5. Run `/vault-quality-gate` + `/vault-audience` on every note.
6. Update `/vault-health` — expect a11y coverage to jump from 16 to ~30 notes.
7. Mark this stub `extracted` in `ops/queue/gap-stubs.md`.
