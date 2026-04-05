# UI/UX Audit: Shared UI System

Date: 2026-03-30  
Auditor: Codex  
Method: Runtime observation + comparison with prior FE-05 audit

## Scope Reviewed
- Buttons, tabs, icon rail, cards, filters, toolbars, checklist card, empty-state treatments
- Repeated patterns across picker, dashboard, architecture, procurement, validation, exports, community

## Findings

### 1) `P1` The visual system is cohesive, but the density settings are too aggressive by default
Evidence:
- Nearly every audited view uses dense chrome and compact controls.

Impact:
- The app looks powerful.
- It also looks harder than it needs to be.

### 2) `P2` Cards and panels are consistent, but repeated low-contrast dark surfaces flatten hierarchy
Evidence:
- Procurement, validation, exports, community all use similar dark slabs with fine borders.

Impact:
- Important sections can visually blur together.

Recommendation:
- Increase depth contrast between page sections, toolbars, and secondary cards.

### 3) `P2` Cyan accent usage is strong but sometimes overloaded
Evidence:
- Accent bars, active tabs, action buttons, counts, and icon highlights often compete in the same viewport.

Impact:
- Accent loses specificity as a directional cue.

Recommendation:
- Reserve brightest cyan for current action and current location.

### 4) `P2` Floating checklist card is stylistically consistent but systemically overused
Impact:
- It behaves like a reusable component that ignores context.

### 5) `P2` Toolbar button groups need stronger semantics
Evidence:
- Many views show small clustered icon buttons with little textual framing.

Recommendation:
- Group by action families with separators and optional labels.

## What Is Working
- Dark theme is coherent.
- Typography is readable and brand-consistent.
- Architecture cards/nodes are especially strong.
- Project picker cards have good motion and hierarchy.

## Priority Recommendations
1. Add a “comfortable” density mode.
2. Strengthen contrast hierarchy between stacked dark surfaces.
3. Reduce accent overload.
