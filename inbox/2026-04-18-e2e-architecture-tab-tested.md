---
name: E2E walkthrough — Architecture tab — TESTED
description: Frontend E2E findings for 'Architecture tab — TESTED' chunk from 2026-04-18 walkthrough. 20 E2E IDs; 3 🔴, 5 🟡, 6 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0777-0779
severity_counts:
  p1_bug: 3
  ux: 5
  idea: 6
  works: 0
  e2e_ids: 20
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Architecture tab — TESTED

URL `/projects/30/architecture`. React Flow canvas with Asset Library sidebar.

Asset Library sub-categories: All (12), MCU (2), Power (3), Comm (2), Sensor (3), Connector (2). Recent (3): BME280, LDO 3.3V, ESP32-S3-WROOM-1. Has Add Custom Part button.

Toolbar: tool-select, tool-pan, tool-grid, tool-fit, tool-analyze. Standard React Flow widgets (background, controls, minimap).

Empty state: "Start Building Your Architecture", Generate Architecture button.

### Architecture findings

- **E2E-019 🔴 BUG** — Loading state showed `panel-skeleton` with **empty text** for ~3 seconds before content appeared. No loading spinner or "Loading…" label was visible to the user.
- **E2E-020 🟡 UX** — Asset Library has 12 parts. No virtualization concern at this size — but the categories `MCU(2)`, `Power(3)`, `Comm(2)`, `Sensor(3)`, `Connector(2)` total 12 yet appear in a flat list with no category dividers.
- **E2E-021 🟡 UX** — Asset Library shows numeric badges next to category icons but no labels until hover. Beginners will not know what 11/4/1 mean (counts? IDs? A-Z sort?). Top reads: `A-Z 12 2 3 2 3 2` — totally opaque.
- **E2E-022 🟢 IDEA** — Recently Used (3) appears even on a fresh blank project — those are global recents not project recents. Confusing scope.
- **E2E-023 🟢 IDEA** — Generate Architecture button is the empty-state CTA — but no API key configured = clicking will surely fail. Button should be disabled with hint "Add API key in chat to enable".
- **E2E-024 🟢 IDEA** — `asset-item-11` testids by integer ID — fragile for tests. Prefer testid by part name slug.
- **E2E-076 ⚪ OBS** — Asset search "esp" → 4 results (correctly filters across MCU + sensor + power). Search debounce works.
- **E2E-077 ⚪ OBS** — `button-add-asset-N` adds a node to the React Flow canvas. Empty state replaced by node "BME280 sensor".
- **E2E-078 🔴 BUG** — **`tool-analyze` button (Analyze design) does NOTHING visible** when clicked with a node on canvas. No dialog, no panel update, no toast, no console error. Silent dead button. Severity P1.
- **E2E-079 🟡 UX** — Tool buttons have aria-labels but no `aria-pressed` state — users with screen readers can't tell which mode is active (Select vs Pan).
- **E2E-080 🟢 IDEA** — Generate Architecture button disappears once you add the first node. No "Generate from current state" follow-up.
- **E2E-081 🟡 UX** — Node label reads "sensorBME280" — concatenated category+name with no separator. Should be "BME280 (sensor)" or just "BME280".
- **E2E-082 ⚪ OBS** — Node click → opens `node-inspector-panel` with: Label input, Type select, Description textarea, X/Y position inputs, Connections count, Delete button. Solid.
- **E2E-083 ⚪ OBS** — Right-click on node → context menu with: Add Node / Paste / Select All / Zoom to Fit / Toggle Grid / Run Validation / Copy Summary / Copy JSON / Edit Component / Create Schematic Instance. Excellent feature surface.
- **E2E-084 🔴 BUG** — First context menu detected (6 empty items) — shadow menu present in DOM but with no labels. Suggests duplicated menu/portal mount. Investigate menu portal cleanup.
- **E2E-085 🟢 IDEA** — "Type: Sensor" select in inspector — what other types exist? Allow user to recategorize. If wrong category breaks downstream rules, validate at change.
- **E2E-086 🟢 IDEA** — X/Y position editable as number inputs is power-user gold. Add unit toggle (px/mm/grid).
- **E2E-087 🟡 UX** — `node-inspector-type` button has no aria-label and value="" — looks like a popover trigger but content opaque to screen reader.
- **E2E-088 ⚠️ NEEDS VERIFICATION** — Context menu Run Validation tested with synthetic `click()`; given E2E-074 correction, the click likely needs real pointer events. Re-test pending.

### Architecture edge cases

- Drag node off-canvas (does it clamp to bounds?)
- Add 1000 nodes (perf)
- Connect node to itself (self-loop)
- Delete node with N edges (cascade)
- Two users editing positions simultaneously (CRDT?)
- Zoom to fit with no nodes
- Pan-mode + select-mode hotkey collision

---

