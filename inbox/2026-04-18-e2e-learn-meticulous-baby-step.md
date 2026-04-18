---
name: E2E walkthrough — Learn — meticulous baby-step
description: Frontend E2E findings for 'Learn — meticulous baby-step' chunk from 2026-04-18 walkthrough. 6 E2E IDs; 1 🔴, 1 🟡, 2 🟢, 1 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 1
  ux: 1
  idea: 2
  works: 1
  e2e_ids: 6
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Learn — meticulous baby-step

URL `/projects/30/knowledge`. 20 articles in card grid. Search articles textbox + category combobox + level combobox. Cards clickable — open inline expanded view (NOT a modal/dialog). Article body shows: prose explanation, sections (Ohm's Law, Color Code, Common Values, Power Rating, Types), Tags, Related Topics (links).

### Baby-step: click "Resistors" card

→ Card expanded inline below all card grid (or replaced grid?). Shows full article body with multiple sub-sections + Tags + Related Topics.

- **E2E-261 🔴 a11y** — Article cards have `onclick` and `cursor:pointer` but **no `role="button"`** and no inner button/link. Invisible to screen readers. Same pattern as Dashboard cards (E2E-068). Systemic issue.
- **E2E-262 ✅ EXCELLENT** — Article body is rich, structured, with related topics links. Real reference docs.
- **E2E-263 🟢 IDEA** — "Related Topics" links would benefit from being navigable as `<a>` to `#article-X` anchors with back-button support.
- **E2E-264 🟢 IDEA** — Articles overlap heavily with the Vault (675 notes). Why two systems? Either consolidate or label this as "Quick Refs" vs "Deep Vault".
- **E2E-265 🟡 UX** — No "next/previous article" navigation in expanded view. User must scroll back up to grid.

---

