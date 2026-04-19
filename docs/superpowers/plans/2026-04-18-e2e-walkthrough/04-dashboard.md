# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1/2 Dashboard findings. Several P0/P1 bugs are resolved by 01 (validation contradictions via `useValidationSummary`) and 02 (dead card buttons via `InteractiveCard`). This plan polishes the remaining dashboard UX — breadcrumb redundancy (E2E-317), header label incomprehension (E2E-316), stats bar redundancy (E2E-318), empty-state CTA enrichment (E2E-324), recent activity feed (E2E-325, E2E-070), AI panel discovery nudge (E2E-321), sample data correctness (E2E-557 — Blink LED has BME280 not LED).

**Tier:** G (Polish). Depends on every prior tier so Dashboard absorbs the trust-receipt, design-token, and shell refactors.

## Coverage

Pass 1: E2E-015-017 (handled by 01), E2E-068-070 (handled by 03), E2E-201-205 (grep for Pass 1 extension findings). Pass 2 Dashboard: E2E-314-325. Cross: E2E-557 sample data, E2E-548 dashboard-validation parity (01 Phase 3).

## Existing Infrastructure

- `client/src/components/views/DashboardView.tsx` (lazy)

## Waves

### Wave 1 — Cross-plan consumption verification
- [ ] Task 1.1 — Confirm `useValidationSummary()` adopted (01 Phase 3).
- [ ] Task 1.2 — Confirm `InteractiveCard` adopted for all 4 cards including Activity card (03 Phase 3; E2E-018 inconsistency).
- [ ] Task 1.3 — Confirm TrustReceipt pattern replicated (16 Phase 4) — replace contradictory "Warnings Present — 1 issue" badges with structured trust receipt (E2E-315).
- [ ] Task 1.4 — Tests + commit.

### Wave 2 — Header/breadcrumb/labels
- [ ] Task 2.1 — Remove breadcrumb+tab-strip duplication (E2E-317): per 17 Phase 2 decision, keep tab strip; drop breadcrumb here.
- [ ] Task 2.2 — "Saved + restore" rename (E2E-316): `Autosaved` + separate `Restore` action button.
- [ ] Task 2.3 — Project metadata duplication (E2E-320): pick one location (header bar OR card).
- [ ] Task 2.4 — Tests + commit.

### Wave 3 — Stats + cards + activity
- [ ] Task 3.1 — Stats bar collapse into card headers (E2E-016, E2E-318): Components / Connections / BOM Items / Cost / Issues each becomes a small inline metric on the relevant card.
- [ ] Task 3.2 — Network preview SVG on Architecture card (E2E-319).
- [ ] Task 3.3 — Real activity feed (E2E-017, E2E-325, E2E-070): events from Audit Trail (project-scoped via 01).
- [ ] Task 3.4 — Empty-state cards get prominent CTA buttons (E2E-324): "Open Procurement →" primary button.
- [ ] Task 3.5 — Tests + commit.

### Wave 4 — AI panel + bottom-right suggestions
- [ ] Task 4.1 — AI Assistant discovery nudge (E2E-321) — replaced by 17 Phase 4 chat bubble; verify on Dashboard.
- [ ] Task 4.2 — Design Suggestions toast-preview on hover (E2E-322).
- [ ] Task 4.3 — Tests + commit.

### Wave 5 — Sample data correctness
- [ ] Task 5.1 — Blink LED sample has BME280 not LED (E2E-557): audit seed data in `server/seeds/sample-projects.ts`. Replace BME280 with actual LED + resistor for Blink LED.
- [ ] Task 5.2 — Verify every sample project matches its name.
- [ ] Task 5.3 — Tests + commit.

### Wave 6 — Color-only warning (E2E-323)
- [ ] Task 6.1 — Yellow warning triangle on Validation card + text label "Needs review" alongside icon. WCAG SC 1.4.1 Use of Color.

## Vault integration (added 2026-04-19)

Per master-index §7 + §13. Tooling: `/vault-gap`, `/vault-suggest-for-plan`, `/vault-quality-gate`.

### Run order

1. Kickoff: `/vault-suggest-for-plan docs/superpowers/plans/2026-04-18-e2e-walkthrough/04-dashboard.md`.
2. Dashboard is Tier G (polish) — most consumption happens through primitives already shipped via `16-design-system.md` (trust receipt, InteractiveCard, EmptyState).

### Planned insertions

| Task | Insertion site | Target vault slug | Status |
|------|----------------|-------------------|--------|
| Wave 3 Task 3.2 (network preview SVG, E2E-319) | Hover tooltips on each edge in the mini-graph | `<VaultHoverCard topic={edge.protocol}>` — i2c-protocol / spi-protocol / uart-protocol / power-distribution / gpio-conventions | 🟡 planned — check vault: most exist under `communication` MOC |
| Wave 5 Task 5.1 (Blink LED sample data fix, E2E-557) | `server/seeds/sample-projects.ts` — before editing, authoritative seed via vault | `arduino-blink-led-minimal-starter-led-plus-220r-resistor` | 🟡 planned — vault gap likely; seed via `/vault-gap` |
| Wave 6 Task 6.1 (Color-only severity, E2E-323) | ValidationCard badge | `wcag-2-1-sc-1-4-1-color-cannot-be-sole-channel` | ✅ seeded-inbox (Plan 03 Wave 10.2) |
| Wave 1 Task 1.3 (TrustReceipt consumption, E2E-315) | Dashboard contradictions fixed via TrustReceipt from 16 | confidence-evaluator-structured-signals-schema | 🟡 planned |

### Pre-edit vault query (Task 5.1)

Before editing `server/seeds/sample-projects.ts` to fix the Blink LED sample:

```
qmd_deep_search "blink LED arduino minimal circuit led 220 ohm resistor gpio13"
```

If zero results, `/vault-gap "Arduino Blink LED minimal starter: LED on GPIO13 + 220Ω current-limiter" --origin-plan 04-dashboard.md --origin-task 5.1`. Use the resulting note's circuit description as the seed-data source.

### Gap stubs to seed

- `arduino-blink-led-minimal-starter-led-plus-220r-resistor` — authoritative reference for the canonical blink circuit. Rejects the audit's "Blink LED (Sample) has BME280" finding at the source by pointing to the correct minimal starter.
- `dashboard-kpi-card-counts-must-derive-from-single-hook-no-parallel-selectors` — pattern note documenting the E2E-093 lesson (Dashboard + Validation used different selectors; now both use `useValidationSummary`).

### Gate

- Sample-data changes touch `server/seeds/`. Validate the pre-edit vault query matches the seed content before commit. `/vault-quality-gate` applies only to `knowledge/` notes, not seed data.

## Checklist

```
□ Prereqs: 01-17 merged (this is Polish tier)
□ check/test/lint/prettier clean
□ Playwright dashboard-* pass (including Blink LED sample data assertion)
```
