---
name: E2E walkthrough — Dashboard — meticulous
description: Frontend E2E findings for 'Dashboard — meticulous' chunk from 2026-04-18 walkthrough. 21 E2E IDs; 1 🔴, 7 🟡, 3 🟢, 2 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0785-0785
severity_counts:
  p1_bug: 1
  ux: 7
  idea: 3
  works: 2
  e2e_ids: 21
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Dashboard — meticulous

### Baby step 1: click Architecture summary card

- Click works. Navigates to `/projects/30/architecture` (URL change confirmed).
- **E2E-201 ✅ VERIFIED** — Dashboard Architecture card click-through works with real DevTools click. Confirms E2E-018 correction.
- **E2E-202 🟡 UX** — When clicking the card, all attention shifts to Architecture tab — but no animation/transition tells user "you went somewhere". A brief highlight on the Architecture tab in the strip would orient them.

### Baby step 2: Architecture tab a11y improvement (vs initial pass)

Re-examining Architecture asset library: I previously called category buttons "opaque" (E2E-021). Correction: they DO have aria-labels (`Microcontrollers`, `Power`, `Communication`, `Sensors`, `Connectors`, `All`) — visible in this snapshot. Visual labels are still icon-only, but the screen-reader path is fine.

- **E2E-203 ⚪ OBS (CORRECTION TO E2E-021)** — Asset Library category icons HAVE proper aria-labels. Visual-only "MCU/Power/Comm/Sensor/Connector" badges still need on-hover tooltips for sighted users.
- **E2E-204 ⚪ OBS** — The 12 parts in the library are: BME280, LDO 3.3V, ESP32-S3-WROOM-1, JST-PH 2mm, L86 GNSS, SHT40, SIM7000G, STM32L432KC, SX1262 LoRa, TP4056, TPS63020, USB-C Receptacle. (BME280 + ESP32 + LDO appear twice — once in "Recently Used" group + once in main list. Not a bug per se but worth de-duplicating visually.)
- **E2E-205 🟡 UX** — Each part has TWO buttons: "Toggle favorite" + "Add to canvas". The favorite has no visual indicator of state (filled vs outline star). Confirm via click test next.

### Baby step 3: click Toggle favorite on BME280 (Recently Used section)

- New "Favorites" section appeared at top of Asset Library (with `Collapse favorites` button), showing BME280.
- "Recently Used" section persists below.
- **E2E-206 ✅ WORKS** — Favorites toggle creates persistent UI section. Real-time append.
- **E2E-207 🟡 UX** — Now BME280 appears THREE TIMES in the asset library: Favorites, Recently Used, and main list. Visual clutter.
- **E2E-208 🟡 a11y** — `Toggle favorite` button has same aria-label whether starred or not. Should be `Add BME280 to favorites` / `Remove BME280 from favorites` based on state.
- **E2E-209 🟢 IDEA** — A "Hide already-favorited from main list" toggle would cut the visual duplicates.

### Baby step 4: type "esp" into Asset Library search

Result: Main list filtered to ESP32-S3-WROOM-1 only (correct). **HOWEVER:**
- Favorites section still shows BME280 (doesn't match "esp")
- Recently Used still shows BME280 + LDO 3.3V + ESP32 (mostly doesn't match)

- **E2E-210 🔴 BUG** — Search filter doesn't apply to Favorites and Recently Used sections. Inconsistent. User searches "esp" but sees BME280 and LDO 3.3V at top — confusing. Fix: either filter ALL sections or hide non-matching sections entirely during search.
- **E2E-211 🟡 UX** — Search input gives no result count ("Showing 1 of 12"). Empty result would be silently confusing.
- **E2E-212 🟡 UX** — Search has no clear-X button. To clear, must select-all + delete.

### Baby step 5: clear search input (set to empty)

Result: search field empty, but main asset list **still shows only 5 items (favorites + recents + 2 ESP32)** — should restore to 12.

- **E2E-213 🟡 PARTIAL** — `fill("")` did not clear the React-controlled input value (it re-snapped back to "esp" on next render). Likely the controlled input is rebound on re-render. Try sending Backspace key sequence instead next time. Reclassifying as test methodology issue, not necessarily a bug — but UX impact still: with no clear-X button (E2E-212), recovery is awkward.

### Baby step 6: click Microcontrollers category filter (with "esp" still in search)

Result: Microcontrollers button focused but main asset list still includes BME280 (sensor) and LDO 3.3V (power). Either filter did not apply OR is intersected with search.

- **E2E-214 ❓ UNCLEAR** — Category filter behavior with active search is muddied. Cannot tell if filter ANDs with search, replaces it, or did nothing visible.
- **E2E-215 🟢 IDEA** — Category filters should show count badges ("Microcontrollers (2)") so user knows what's behind each.
- **E2E-216 🟢 IDEA** — Active filter should be visually distinct (background color, underline, checkmark) — currently only `focused` style which is keyboard-only.

### Architecture remaining buttons (not yet click-verified — list for follow-up)

Sort assets, Close asset library, Toggle asset manager, Select mode (already noted no aria-pressed), Pan mode, Toggle snap to grid, Fit view to canvas, Analyze design (E2E-078: dead), Zoom In (disabled at default zoom), Zoom Out, Fit View, Toggle Interactivity, Add custom part. Plus React Flow attribution link, Mini Map. Plus the Design Suggestions button bottom-right (`1 Design Suggestions`).

Moving to Schematic tab.

---

