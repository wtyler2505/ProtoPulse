---
description: Topic map for ProtoPulse testing patterns...
type: moc
topics:
- index
- architecture-decisions
---
# testing-patterns

Testing patterns codify which test harness answers which question. The common failure mode is running every test in JSDOM because it is fast — and missing the entire class of effective failures (focus order, ARIA announcement, real-layout hit-testing) that JSDOM simply does not simulate. This MOC catalogs the ProtoPulse rules for picking the right harness.

## Synthesis

The load-bearing meta-claim is that **the test harness must reproduce the failure mode, not just the shape of the code**. A focus-trap bug is a real-Tab-key bug, not a `document.activeElement = x` bug. A transaction-rollback bug is a real-Postgres bug, not an in-memory mock. When the harness and the failure mode diverge, passing tests lie.

## Core Ideas

- [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]] — the canonical example: JSDOM does not compute focusability or tab order, so focus-trap regressions only surface under Playwright (or a comparable real-browser runner)

## Adjacent patterns still to be captured

The following testing concerns recur in ProtoPulse but lack dedicated notes yet — candidates for future extraction:

- **Drizzle integration testing** — transactions and FK cascades ([[drizzle-transactions-wrap-read-modify-write-sequences-with-tx-scoped-queries]], [[drizzle-uses-foreign-keys-with-on-delete-cascade-instead-of-the-relations-helper]]) require a real Postgres; mocked pools silently pass on constraint violations
- **Axe-core as structural gate, not effective gate** — axe catches missing `aria-live`, not wrong `aria-live`; partially covered by [[screen-reader-testing-must-cover-nvda-and-voiceover-minimum-because-jaws-and-nvda-disagree-on-aria-live-timing]]
- **Visual regression testing** — percy/chromatic patterns for canvas-heavy surfaces like the schematic and breadboard views
- **Performance budgets** — render-cost tests for large BOMs and dense wire graphs

## Cross-cutting relationships

- **UX** — [[ux-patterns]] keyboard and focus rules are validated here
- **Implementation** — backend patterns in [[implementation-patterns]] imply specific integration-test shapes
- **A11y** — see [[a11y]] and specifically [[screen-reader-testing-must-cover-nvda-and-voiceover-minimum-because-jaws-and-nvda-disagree-on-aria-live-timing]] for the manual-AT layer that complements automated structural gates

## Tensions

- **Speed vs fidelity.** JSDOM is fast; Playwright is slow. The resolution is not "pick one" but "match harness to failure mode" — structural tests in JSDOM, effective tests in Playwright, and resist the temptation to downgrade effective tests when CI gets slow.
- **Manual AT vs CI.** NVDA and VoiceOver cannot be fully automated on every PR. Accept a twice-yearly manual sweep as the complement to always-on axe-core + Playwright.

## Open Questions

- What is the right CI-time budget split between unit/JSDOM and Playwright for a codebase this size?
- Can NVDA AT-Driver reach enough stability to enter the automated tier?

## Agent Notes

When a test passes in JSDOM but the behavior breaks in the browser, do not add more JSDOM assertions — move the test up a tier. The failure is a harness mismatch, not a test-logic gap.

---

Topics:
- [[index]]
- [[architecture-decisions]]
