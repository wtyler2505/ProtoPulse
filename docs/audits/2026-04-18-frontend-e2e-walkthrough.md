# Frontend E2E Walkthrough — 2026-04-18

**Tester:** Claude (Chrome DevTools MCP, user perspective)
**Build:** main branch, dev server localhost:5000
**Account:** e2e_test_user / TestPass123!SecureE2E
**Project:** Blink LED (Sample) — id 30

Per Tyler: test every button, every workflow, every tab. Document everything — bugs, UX friction, ideas, enhancements.

Findings are tagged:
- 🔴 **BUG** — broken behavior
- 🟡 **UX** — friction or unclear
- 🟢 **IDEA** — enhancement opportunity
- ⚪ **OBS** — neutral observation

Each gets a stable ID `E2E-XXX` for backlog cross-ref.

---

## Tab Inventory (32 tabs visible)

Dashboard, Architecture, Arduino, Circuit Code, Breadboard, Component Editor, Procurement, Simulation, Tasks, Learn, Vault, Community, Order PCB, Inventory, Serial Monitor, Calculators, Patterns, Starter Circuits, Labs, History, Audit Trail, Lifecycle, Comments, Generative, Digital Twin, Exports, Supply Chain, BOM Templates, My Parts, Alternates, Part Usage.

---

## Vault tab — TESTED ✅

- ✅ Search input fills + debounces, returns 4 results for "esp32 gpio boot strapping"
- ✅ MOC tile click filters note panel to that topic (breadboard-intelligence → 17 linked notes)
- ✅ Note click renders full body in detail pane with topics, claims, linked-notes navigation
- ✅ A11y tree exposes all buttons properly (post-fix from last session)
- ✅ Zero console errors

### Vault findings

- **E2E-001 🟡 UX** — Note detail card duplicates the title (h3 + h1, uids 16_172/16_176 in snapshot). Reads twice for screen reader users.
- **E2E-002 🟢 IDEA** — Search input has no clear button (X). User must select-all + delete to clear search.
- **E2E-003 🟢 IDEA** — `[[wiki-link]]` in note body renders as plain text (e.g. `[[esp32-adc2-unavailable-when-wifi-active]]`). Should be clickable links to other notes in vault.
- **E2E-004 🟢 IDEA** — When MOC filter active, no visible "active filter" chip with the MOC name + clear-X. There IS a "Clear topic filter" button but it's not in the filter region — it's at top of MOC list.
- **E2E-005 🟡 UX** — Note dialog is in-pane (3-column layout) not a modal. Works but on narrow screens the 3 columns will not fit. No responsive behavior verified.

---

## Procurement tab — TESTING

- **E2E-006 🔴 BUG** — Procurement tab renders **empty main panel**. Only toolbar + tabs + chat shown. No procurement content (BOM list, suppliers, quotes, shortfall badges) appears. snapshot uids 17_38 main → 17_92 last toolbar btn → 17_93 separator → chat. Nothing in between.
  - Repro: log in, open project 30, click Procurement tab.
  - Expected: BOM list with shortfall badges per BL-0150.
  - Severity: P0 — feature appears completely broken to user.

(Will continue testing remaining tabs and update this file as findings accumulate.)
