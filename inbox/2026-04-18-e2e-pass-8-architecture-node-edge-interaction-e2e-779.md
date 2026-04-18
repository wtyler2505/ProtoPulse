---
name: E2E walkthrough — PASS 8 — ARCHITECTURE NODE/EDGE INTERACTION (E2E-779+)
description: Frontend E2E findings for 'PASS 8 — ARCHITECTURE NODE/EDGE INTERACTION (E2E-779+)' chunk from 2026-04-18 walkthrough. 43 E2E IDs; 9 🔴, 2 🟡, 17 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 9
  ux: 2
  idea: 17
  works: 0
  e2e_ids: 43
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 8 — ARCHITECTURE NODE/EDGE INTERACTION (E2E-779+)

Mirroring Pass 5 for Architecture. Focus: actually creating edges, manipulating nodes, the experimentation loop on the architecture canvas.

### Pass 8 — Edge creation UX

- **E2E-779 🔴 visual GAP** — Pin handles are tiny dots on top/bottom of node (8px). Hard to grab. Should grow to 16px on hover.
- **E2E-780 🔴 visual GAP** — When hovering near a handle ready to drag-connect, no visible "I can connect from here" indicator. Industry standard: the handle pulses.
- **E2E-781 🔴 visual GAP** — During edge drag (handle → empty space), no preview line follows the cursor (verified via observation).
- **E2E-782 🔴 visual GAP** — Edge endpoints hint at "data flow direction" but ProtoPulse has no obvious arrowhead style — undirected vs directed unclear.
- **E2E-783 🟡 UX** — No way to label an edge (e.g. "I2C", "5V", "SPI MOSI"). Architecture should support edge labels (Lucidchart pattern).
- **E2E-784 🟡 UX** — No way to color-code edges (signal=blue, power=red, ground=black). Critical for readable big diagrams.
- **E2E-785 🟢 IDEA** — **Edge-from-handle pulse**: when wire-tool not active but cursor hovers a handle, faint cyan pulse invites drag.
- **E2E-786 🟢 IDEA** — **Smart connector**: drag from one handle → auto-route to nearest compatible handle on another node.
- **E2E-787 🟢 IDEA** — **Multi-handle connect**: hold Shift while dragging → spawn parallel edges (e.g. 8 SPI signals at once).
- **E2E-788 🟢 IDEA** — **Wire-from-AI**: select 2 nodes + click "Suggest connections" → AI proposes typical edges (e.g. "ESP32 → BME280 via SDA/SCL").

### Pass 8 — Node manipulation

- **E2E-789 ⚪ NEEDS VERIFY** — Drag a node — should snap to grid when grid toggled on. Verify smoothness.
- **E2E-790 ⚪ NEEDS VERIFY** — Resize a node? React Flow supports node resizing but unclear if enabled.
- **E2E-791 🔴 GAP** — No visible **multi-select marquee**. Same gap as Breadboard (E2E-635).
- **E2E-792 🔴 GAP** — No **align tools** (left/right/center/distribute) — Figma essentials.
- **E2E-793 🟢 IDEA** — **Group-as-subsystem**: select N nodes → "Group" → collapses into a single "subsystem" node that shows internal nodes on click. Hierarchical architecture.
- **E2E-794 🟢 IDEA** — **Hide/show non-critical nodes**: filter "show only Power nodes" temporarily to focus.
- **E2E-795 🟢 IDEA** — **Pin-mode**: lock a node so it can't be moved (great for the central MCU you don't want shifting).

### Pass 8 — Visualizing relationships

- **E2E-796 🔴 GAP** — No **net browser** for architecture. If 12 nodes share VCC, that's invisible. Add side panel showing all "nets" + click-to-highlight.
- **E2E-797 🔴 GAP** — No **dependency visualization** — what depends on what? Power flow? Data flow? Add a `tool-dependency-trace`.
- **E2E-798 🟢 IDEA** — **"Show me power"** mode — highlight only power-related nodes + edges. Same for "data", "signal", "GPIO".
- **E2E-799 🟢 IDEA** — **Heatmap by node-degree**: nodes with many edges glow brighter. Identifies the "central" components.
- **E2E-800 🟢 IDEA** — **Critical-path overlay**: AI marks the longest signal path from input to output.

### Pass 8 — Experimentation / play (Architecture)

- **E2E-801 🔴 GAP** — No **"Try alternate component"** — select an LDO, click "Alternates" → see a list of swap candidates with cost/efficiency comparison.
- **E2E-802 🟢 IDEA** — **What-if branching** for architecture (cf. E2E-538) — "What if I add a BME680 instead of BME280?" — instant comparison.
- **E2E-803 🟢 IDEA** — **Arch templates as DSL**: type `iot:wifi+temp+display` → instant 4-node architecture appears.
- **E2E-804 🟢 IDEA** — **Architecture diff vs Schematic diff** — visually highlight nodes that are in arch but not yet in schematic (or vice versa). Cross-tab consistency check.
- **E2E-805 🟢 IDEA** — **"Why is this architecture good/bad?"** — AI critique button. Lists strengths + risks.

### Pass 8 — Off-canvas play

- **E2E-806 🟢 IDEA** — **Drag node OFF canvas to delete** — drag to a trash zone outside React Flow. Discoverable destruction.
- **E2E-807 🟢 IDEA** — **Stash slot beside canvas** — temporarily park nodes you removed but might re-add.
- **E2E-808 🟢 IDEA** — **Library item drag-back**: drag a placed node back into the Asset Library to remove + return inventory.

### Pass 8 — Innovation (Architecture-specific)

- **E2E-809 🚀** — **Animated dataflow during sim**: arch edges pulse in flow direction during a simulated run. Visual debugger of message routing.
- **E2E-810 🚀** — **3D architecture mode**: nodes float in 3D space (depth = abstraction layer). Cool for huge IoT systems.
- **E2E-811 🚀** — **Voice annotations**: record a 10s voice memo on a node ("This is where we'll add Bluetooth in v2"). Plays on click.
- **E2E-812 🚀** — **Node thumbnails**: render a tiny preview of the schematic symbol or 3D model on each node. At-a-glance recognition.
- **E2E-813 🚀** — **Live BOM cost on edge**: edges show "$0.45" when carrying a BOM-billable signal (e.g. extra cable required). Cost visible in design.
- **E2E-814 🚀** — **AI architecture critique persona**: "I'm Dr. Kirchhoff, I'll review your architecture" — opens AI chat scoped to your architecture diagram with domain-specific feedback.
- **E2E-815 🚀** — **Architecture-as-Code DSL editor**: split-pane with YAML/Python representation of the canvas. Edit code, canvas updates live (cf. Mermaid).
- **E2E-816 🚀** — **Auto-document**: click "Generate spec PDF" → produces a 2-page architecture document with diagram + per-node responsibility + cost summary.
- **E2E-817 🚀** — **Real-time multiplayer cursors**: each collaborator's cursor visible with name; live edits propagate.
- **E2E-818 🚀** — **Architecture remixes**: "1,234 people built variations of this; click to see top 5". Crowd-sourced learning.

---

