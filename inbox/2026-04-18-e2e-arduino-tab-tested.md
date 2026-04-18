---
name: E2E walkthrough — Arduino tab — TESTED
description: Frontend E2E findings for 'Arduino tab — TESTED' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 0 🔴, 2 🟡, 2 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 0
  ux: 2
  idea: 2
  works: 0
  e2e_ids: 5
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Arduino tab — TESTED

URL `/projects/30/arduino`. Arduino Workbench. Sub-tabs: Console, Serial, Libraries, Boards, Pins, Simulate.

Trust receipt panel: CLI v1.3.1 Connected, Workspace Provisioned, Board Profile None, Port Not set, Detected Device None, Port Safety Not checked, Sketch No file. Tells user "SETUP REQUIRED — toolchain not trustworthy yet". Excellent transparency.

Buttons: Save, Format, Compile, Upload, New File, Search files, Examples, Example Library, Library Manager, Board Manager, Serial Monitor.

### Arduino findings

- **E2E-025 🟡 UX** — Skeleton state took ~4s to resolve. Should show "Connecting to Arduino CLI…" not blank skeleton.
- **E2E-026 🟢 IDEA** — Trust receipt is great. Could add "Setup wizard" CTA that walks through Profile → Port → first sketch.
- **E2E-027 🟡 UX** — Verify and Upload buttons are visible but board profile is "None selected". Should be disabled with hover-tooltip "Select a board profile first" instead of letting user click and fail.
- **E2E-028 🟢 IDEA** — "No File Selected" empty state pane is good but lonely; offer "Open Blink example" one-click.
- **E2E-029 ⚪ OBS** — Sub-tabs: Console / Serial / Libraries / Boards / Pins / Simulate — solid coverage, no obvious gap.

### Arduino edge cases worth testing

- USB device unplugged mid-upload
- Two browser tabs editing same sketch concurrently
- Sketch file with non-ASCII filename
- Compile output with thousands of lines (virtualization?)
- Library Manager when offline
- Board profile that doesn't match physical device port

---

