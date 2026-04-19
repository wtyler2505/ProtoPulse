# Community, Tasks, History, Audit Trail, Comments, Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1/2 findings for 6 related tabs: Community marketplace (card click dead — fixed in 02), Tasks kanban polish, History snapshots, Audit Trail (project-scope leak fixed in 01), Comments, Lifecycle. Preserve the excellent audit-trail timeline visual (E2E-459) and lifecycle status card pattern (E2E-463). Fix UX weaknesses: kanban column X button risk (E2E-417), add filters (E2E-418), lifecycle "Last checked" (E2E-466), date range picker styling (E2E-462), comments anchored to design objects (E2E-467).

**Architecture:** 3 waves — (1) Community card click + polish, (2) Tasks + History + Lifecycle polish, (3) Comments anchoring + Audit Trail UX polish.

**Parent:** Tier F. Depends on 01 (audit trail projectId), 02 (community card click), 03 (InteractiveCard), 16, 17.

## Coverage

| Source | IDs |
|--------|-----|
| Pass 2 Community | E2E-403-409 |
| Pass 2 Tasks | E2E-416-420 |
| Pass 2 History | E2E-456-458 |
| Pass 2 Audit Trail | E2E-459-462 |
| Pass 2 Lifecycle | E2E-463-466 |
| Pass 2 Comments | E2E-467 |

## Existing Infrastructure

- `client/src/components/views/CommunityView.tsx`
- `client/src/components/views/KanbanView.tsx` (Tasks)
- `client/src/components/views/DesignHistoryView.tsx`
- `client/src/components/views/AuditTrailView.tsx`
- `client/src/components/views/LifecycleDashboard.tsx`
- `client/src/components/panels/CommentsPanel.tsx`

## Waves

### Wave 1 — Community
- [ ] Task 1.1 — Card click detail dialog (E2E-266/409 — delivered by 02 Phase 5 — this plan consumes).
- [ ] Task 1.2 — Type badge color legend (E2E-404): small legend hover or tooltip.
- [ ] Task 1.3 — License badge plain-English tooltip (E2E-406).
- [ ] Task 1.4 — Version pinning + dependency management + security advisories (E2E-407) → route to 18 (strategic).
- [ ] Task 1.5 — Half-star ratings (E2E-408).
- [ ] Task 1.6 — Tests + commit.

### Wave 2 — Tasks + History + Lifecycle
- [ ] Task 2.1 — Kanban column X button moved to overflow menu (E2E-417).
- [ ] Task 2.2 — Labels/due-date/assignee filters (E2E-418).
- [ ] Task 2.3 — "What is a kanban board?" tooltip (E2E-419).
- [ ] Task 2.4 — Column width auto-fit-content (E2E-420).
- [ ] Task 2.5 — History empty-state uses canonical `<EmptyState>` (E2E-456).
- [ ] Task 2.6 — Snapshot diff stats "+3 components / 2 nets / −1 BOM" (E2E-457).
- [ ] Task 2.7 — Git-like branching from snapshots (E2E-458) → route to 18.
- [ ] Task 2.8 — Lifecycle auto-pull from BOM default (E2E-464).
- [ ] Task 2.9 — NRND + other abbreviation tooltips (E2E-465): Active / NRND / EOL / Obsolete / Unknown each get a HoverCard definition.
- [ ] Task 2.10 — "Last checked" timestamp + "Refresh from supplier" action (E2E-466).
- [ ] Task 2.11 — Tests + commit.

### Wave 3 — Audit Trail + Comments
- [ ] Task 3.1 — Audit Trail project-scope (E2E-298/460/546) — delivered by 01 Phase 1; verify Playwright.
- [ ] Task 3.2 — Undo from audit entry (E2E-461): "Deleted SPI Bus" → button "Undo this delete" that restores.
- [ ] Task 3.3 — Date range picker styling (E2E-462): replace native HTML date with shadcn DatePicker.
- [ ] Task 3.4 — Comments anchored to design objects (E2E-467): component/wire/DRC issue anchor. Schema change: add `anchorType` + `anchorId` columns to `comments` table. Display on the anchor object as a tiny badge.
- [ ] Task 3.5 — Tests + commit.

## Vault integration (added 2026-04-19)

Per master-index §7 + §13.

### Planned insertions

| Task | Insertion site | Target vault slug | Status |
|------|----------------|-------------------|--------|
| Wave 1 Task 1.3 (license plain-English, E2E-406) | License badge HoverCard | Per-license: `license-mit-plain-english`, `license-cc0-plain-english`, `license-cc-by-plain-english`, `license-cc-by-sa-plain-english` | 🟡 seed gaps |
| Wave 2 Task 2.3 ("What is a kanban board?", E2E-419) | Kanban column header "?" icon | `kanban-board-workflow-methodology` | 🟡 seed gap |
| Wave 2 Task 2.9 (NRND tooltips, E2E-465) | Lifecycle badge | `lifecycle-active-definition`, `lifecycle-nrnd-not-recommended-for-new-designs`, `lifecycle-eol-end-of-life`, `lifecycle-obsolete`, `lifecycle-unknown` | 🟡 seed gaps |
| Wave 3 Task 3.4 (comments anchored, E2E-467) | Anchor badge hover | `design-review-commenting-discipline` | 🟡 seed gap |
| Wave 1 Task 1.1 (community detail dialog — consumed from 02) | Tag chips on detail dialog | Per-tag MOCs (existing) | ✅ existing content |

### Gap stubs to seed

```
/vault-gap "open source license MIT plain English summary" --origin-plan 14-community-tasks-history.md --origin-task 1.3
/vault-gap "open source license CC0 public domain plain English" --origin-plan 14-community-tasks-history.md --origin-task 1.3
/vault-gap "open source license CC-BY attribution plain English" --origin-plan 14-community-tasks-history.md --origin-task 1.3
/vault-gap "open source license CC-BY-SA share-alike plain English" --origin-plan 14-community-tasks-history.md --origin-task 1.3
/vault-gap "kanban board workflow methodology for hardware projects" --origin-plan 14-community-tasks-history.md --origin-task 2.3
/vault-gap "component lifecycle NRND not recommended new designs meaning" --origin-plan 14-community-tasks-history.md --origin-task 2.9
/vault-gap "component lifecycle EOL end of life supply implications" --origin-plan 14-community-tasks-history.md --origin-task 2.9
/vault-gap "component lifecycle active NRND EOL obsolete taxonomy" --origin-plan 14-community-tasks-history.md --origin-task 2.9
/vault-gap "design review commenting discipline anchor to object" --origin-plan 14-community-tasks-history.md --origin-task 3.4
```

### Consumption pattern

```tsx
<Badge variant="lifecycle">
  <VaultHoverCard topic={`lifecycle-${status}`}>
    {status}
  </VaultHoverCard>
</Badge>
```

## Checklist

```
□ Prereqs: 01 (audit scope), 02 (community click), 03 (InteractiveCard), 16, 17 merged
□ check/test/lint/prettier clean
□ Playwright community-*, tasks-*, history-*, audit-trail-*, lifecycle-*, comments-* pass
```
