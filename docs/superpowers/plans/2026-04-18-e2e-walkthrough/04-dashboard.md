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

## Checklist

```
□ Prereqs: 01-17 merged (this is Polish tier)
□ check/test/lint/prettier clean
□ Playwright dashboard-* pass (including Blink LED sample data assertion)
```
