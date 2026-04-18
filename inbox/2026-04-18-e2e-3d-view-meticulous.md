---
name: E2E walkthrough — 3D View — meticulous
description: Frontend E2E findings for '3D View — meticulous' chunk from 2026-04-18 walkthrough. 7 E2E IDs; 2 🔴, 2 🟡, 1 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 2
  ux: 2
  idea: 1
  works: 0
  e2e_ids: 7
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## 3D View — meticulous

URL `/projects/30/viewer_3d`. Board 100×80mm × 1.6mm thick × 0mm corner radius. View angles: Top/Bottom/Front/Back/Left/Right/Iso. Export/Import buttons. Layer checkboxes: Top Silkscreen ✓, Top Solder Mask ✓, Top Copper ✓, Substrate ✓, **Internal ☐ (unchecked)**, Bottom Copper ✓, Bottom Solder Mask ✓, Bottom Silkscreen ✓. Edit Board section with Width/Height/Thickness spinbuttons + Apply.

- **E2E-235 🔴 BUG (CONFIRMED)** — 3D View board = 100×80 mm. PCB tab board = 50×40 mm. Same project, same circuit, two different board sizes. Source-of-truth split.
- **E2E-236 🔴 BUG** — Edit Board spinbuttons have `valuemax="0"` and `valuemin="0"` — invalid constraint range. Spinner up/down buttons disabled effectively. User can only manually type values; even then no validation.
- **E2E-237 ⚪ OBS** — 3D View HAS Internal layer visibility (PCB tab does not — E2E-233 is PCB-only).
- **E2E-238 🟡 UX** — Internal layer is unchecked by default but stack only has substrate at this point (board hasn't synced from PCB tab's 4-layer setting). Confusing.
- **E2E-239 🟢 IDEA** — No "Reset board to defaults" button.
- **E2E-240 🟡 UX** — `Iso` button (isometric view) is great. But no perspective vs orthographic toggle.

(Skipping further 3D click-tests — 3D canvas requires WebGL pointer interaction which is outside snapshot tooling.)

Moving to Procurement tab.

---

