# Component Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1 + Pass 2 Component Editor findings: 6-tab + 13-toolbar button density (E2E-040, E2E-370), Pin Table 2-line label wrap (E2E-371), add form-section groupings (E2E-373), pedagogical tooltips for Family/Mounting/Package/MPN (E2E-374), expert bulk-edit (E2E-375), parts sidebar search + group-by (E2E-376). Preserve the excellent trust strip of color-coded pills (E2E-372).

**Tech Stack:** shadcn/ui Tabs, Form, Input, Popover; Radix HoverCard for definitions.

**Parent:** Tier E. Depends on 16 (primitives), 03 (a11y).

## Coverage

Pass 1: E2E-040. Pass 2: E2E-370-376.

## Existing Infrastructure

- `client/src/components/views/ComponentEditorView.tsx` (grep for 6 sub-tabs + 13 toolbar buttons)
- Pin table component
- SPICE editor sub-tab

## Waves

### Wave 1 — Toolbar density + sub-tab polish
- [ ] Task 1.1 — Group 13 toolbar buttons by purpose (Edit / View / Model / Export); dividers per 16 Phase 3 Button grouping.
- [ ] Task 1.2 — Pin Table sub-tab label (E2E-371): shorten to "Pins" OR widen tab.
- [ ] Task 1.3 — Tests + commit.

### Wave 2 — Form groupings + tooltips
- [ ] Task 2.1 — Section headers (E2E-373): "Identity" / "Physical" / "Categorization".
- [ ] Task 2.2 — Field definitions (E2E-374): HoverCard on Family, Mounting Type, Package Type, MPN with plain-English definitions.
- [ ] Task 2.3 — Tests + commit.

### Wave 3 — Parts sidebar improvements
- [ ] Task 3.1 — Search input for parts list (E2E-376).
- [ ] Task 3.2 — Group-by category / manufacturer toggle.
- [ ] Task 3.3 — Multi-select for expert bulk edit (E2E-375): shift-click selects range; bulk edit dialog.
- [ ] Task 3.4 — Tests + commit.

## Checklist

```
□ Prereqs: 16, 03 merged
□ check / test / lint clean
□ Playwright component-editor-* pass
```
