# Procurement Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1 / Pass 2 findings across the 17-sub-tab Procurement suite PLUS consolidate per the 17-shell-header-nav.md Wave 2 grouping decision (BOM / Sourcing / Manufacturing / Compliance / Personal Inventory). Fix Inventory tab wasted space (E2E-426-428), fix Supply Chain / BOM Templates / My Parts empty-states (E2E-478-480), polish cost summary KPI (E2E-381), sortable columns with saved views (E2E-382), ESD abbreviation tooltip (E2E-380), sourcing-aware inline pricing (E2E-524 → scoped here).

**Architecture:** 4 waves — (1) sub-tab consolidation per 17 Wave 2 groupings, (2) BOM + cost summary polish, (3) data tabs empty-state overhaul (Supply Chain / BOM Templates / My Parts / Alternates / Part Usage — latter two's 401 fix lives in 01), (4) Inventory merge or on-ramp.

**Parent:** Tier E. Depends on 01 (Alternates/Part Usage 401), 02 (NumberInput valuemax), 03 (a11y Procurement tabpanel, Phase 1), 16, 17. **Blocks:** nothing.

---

## Coverage

| Source | IDs |
|--------|-----|
| Pass 1 | E2E-006-010 |
| Pass 2 Procurement | E2E-377-382 |
| Pass 2 Inventory | E2E-426-428 |
| Pass 2 Supply/Templates/My Parts | E2E-478-480 |
| Pass 2 Alternates/Part Usage | E2E-481-482 (P0 fix in 01; this plan verifies UX) |
| Sourcing-aware design | E2E-524 |

## Existing Infrastructure

| File | Notes |
|------|-------|
| `client/src/components/views/ProcurementView.tsx` | 17 sub-tabs |
| `client/src/components/views/StorageManagerPanel.tsx` | Inventory tab |
| `client/src/components/views/SupplyChainAlertsPanel.tsx` | Supply Chain sub-tab (lazy-imported) |
| `client/src/components/views/BomTemplatesPanel.tsx` | BOM Templates |
| `client/src/components/views/PersonalInventoryPanel.tsx` | My Parts |
| `client/src/components/views/PartAlternatesBrowserView.tsx` | Alternates |
| `client/src/components/views/PartUsageBrowserView.tsx` | Part Usage |

## Research protocol

- **Context7** `@tanstack/react-table` (if used) — "column sorting + saved views"
- **WebSearch** "Flux.ai inline BOM pricing UX" — Wave 2 inspiration

## Waves

### Wave 1 — Sub-tab consolidation (E2E-377, E2E-478-480)
- [ ] Task 1.1 — Implement nested tabs per 17 decision: top level `BOM | Sourcing | Manufacturing | Compliance | Inventory` → each with children.
- [ ] Task 1.2 — Migrate 17 sub-tabs into the 5 groups; preserve URLs with `?tab=` query param.
- [ ] Task 1.3 — Supply Chain / Templates / My Parts move under `Inventory` group (they're part-catalog utilities per 17 grouping).
- [ ] Task 1.4 — Tests + commit.

### Wave 2 — BOM polish (E2E-006-010, E2E-378-382)
- [ ] Task 2.1 — Procurement tabpanel a11y (E2E-006 → delivered by 03 Phase 1).
- [ ] Task 2.2 — Cost summary KPI enlargement (E2E-381): `$0.00` → `<Heading kpiMd>`.
- [ ] Task 2.3 — Estimated cost "No BOM = show hint" (E2E-008): "Add items to estimate cost".
- [ ] Task 2.4 — Component Parts Reference count tooltip (E2E-009).
- [ ] Task 2.5 — Sortable columns with saved views (E2E-382): persist view config in localStorage + per-project.
- [ ] Task 2.6 — Cost Optimisation/ESD/Assembly toggle active-state (E2E-379).
- [ ] Task 2.7 — ESD tooltip "Electrostatic discharge protection filter" (E2E-380).
- [ ] Task 2.8 — Empty-state with `+ Add First Item` already solid (E2E-378) — verify migrate to `<EmptyState>` primitive.
- [ ] Task 2.9 — Tests + commit.

### Wave 3 — Empty-state overhaul (E2E-478-480, E2E-427-428, E2E-381)
- [ ] Task 3.1 — Migrate every Procurement sub-tab empty state to canonical `<EmptyState>` per 16 Phase 4.
- [ ] Task 3.2 — Empty-state value hints (E2E-479): Supply Chain "Get notified when parts you depend on go EOL"; BOM Templates "Save successful BOMs as starting points"; My Parts "Track physical parts so AI knows what you have".
- [ ] Task 3.3 — Inventory tab: Scan/Labels button tooltips (E2E-427).
- [ ] Task 3.4 — Storage Manager headline (E2E-428): "Track where your physical parts live (drawer, bin, shelf, etc.)".
- [ ] Task 3.5 — Tests + commit.

### Wave 4 — Sourcing-aware inline (E2E-524 scoped)
- [ ] Task 4.1 — Show real-time pricing + stock + lifecycle on every BOM item INLINE (not just Live Pricing sub-tab). Columns: Stock · Unit Price · Lifecycle (from Lifecycle tab data).
- [ ] Task 4.2 — Cross-reference with E2E-381 cost summary.
- [ ] Task 4.3 — Verify Alternates / Part Usage render (E2E-481-482 post-01 fix): Playwright e2e confirming tabs show data, not error.
- [ ] Task 4.4 — Tests + commit.

## Vault integration (added 2026-04-19)

Per master-index §7 + §13.

### Planned insertions

| Task | Insertion site | Target vault slug | Status |
|------|----------------|-------------------|--------|
| Wave 2 Task 2.7 (ESD tooltip, E2E-380) | BOM row Cost Optimisation/ESD/Assembly toggle labels | `electrostatic-discharge-esd-protection-filter-definition` | 🟡 planned — seed gap |
| Wave 3 Task 3.2 (empty-state hints, E2E-479) | Supply Chain / Templates / My Parts empty states | Three separate slugs: `supply-chain-eol-planning-workflow`, `bom-templates-reusability-pattern`, `personal-inventory-tracking-discipline` | 🟡 planned — seed gaps |
| Wave 4 Task 4.1 (alternate row reason, E2E-524) | Alternate suggestions dropdown in BOM editor | `<VaultExplainer slug={alternate.reasonSlug}>` per-alternate reasoning (cost, lifecycle, sourcing, spec-match) | 🟡 planned — may use existing MOC `power-systems` / `passives` |

### Gap stubs to seed

```
/vault-gap "electrostatic discharge ESD protection filter in BOM" --origin-plan 10-procurement-suite.md --origin-task 2.7
/vault-gap "supply chain EOL planning for parts you depend on" --origin-plan 10-procurement-suite.md --origin-task 3.2
/vault-gap "BOM template reusability pattern save successful BOMs" --origin-plan 10-procurement-suite.md --origin-task 3.2
/vault-gap "personal parts inventory tracking discipline maker on-hand" --origin-plan 10-procurement-suite.md --origin-task 3.2
```

### Consumption pattern

```tsx
<Toggle aria-label="ESD protection filter">
  ESD
  <VaultHoverCard topic="electrostatic-discharge-esd-protection-filter-definition">
    <InfoIcon size={14} />
  </VaultHoverCard>
</Toggle>
```

## Checklist

```
□ Prereqs: 01 (401 fix), 02 (NumberInput), 03 (Procurement a11y), 16, 17 merged
□ check/test/lint/prettier clean
□ Playwright procurement-consolidated spec passes
□ advisor() ≥1× (Task 1.1 nested tabs structure)
```
