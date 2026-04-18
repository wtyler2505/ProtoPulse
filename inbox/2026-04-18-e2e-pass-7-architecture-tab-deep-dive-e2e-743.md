---
name: E2E walkthrough — PASS 7 — ARCHITECTURE TAB DEEP DIVE (E2E-743+)
description: Frontend E2E findings for 'PASS 7 — ARCHITECTURE TAB DEEP DIVE (E2E-743+)' chunk from 2026-04-18 walkthrough. 39 E2E IDs; 7 🔴, 12 🟡, 14 🟢, 1 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0822-0828
severity_counts:
  p1_bug: 7
  ux: 12
  idea: 14
  works: 1
  e2e_ids: 39
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 7 — ARCHITECTURE TAB DEEP DIVE (E2E-743+)

Mirroring Pass 4 (Breadboard deep dive) for Architecture. Screenshots: `37-architecture-with-node.png`, `38-architecture-multi-nodes.png`.

### Surface inventory observed

Architecture tab uses React Flow canvas. Major panels:

1. **Asset Library (left sidebar, ~240px)** — Search + Sort + 6 category filters (All/MCU/Power/Comm/Sensor/Connector) + Favorites section + Recently Used (5) + main parts list (12 parts: BME280, ESP32-S3-WROOM-1, JST-PH 2mm, L86 GNSS, LDO 3.3V, SHT40, SIM7000G, STM32L432KC, SX1262 LoRa, TP4056, TPS63020, USB-C Receptacle) + "Add Custom Part" CTA + asset-resize-handle.
2. **Canvas Toolbar (top, 5 tools)** — `tool-select`, `tool-pan`, `tool-grid`, `tool-fit`, `tool-analyze` (icon-only).
3. **React Flow Canvas** — `architecture-drop-zone` background + nodes (rendered as cards with category badge "SENSOR/POWER/MCU" + name + 2 pin handles on top/bottom).
4. **React Flow built-ins** — `rf__background` (dot grid), `rf__controls` (zoom in/out/fit/lock at bottom-left), `rf__minimap` (bottom-right), `rf__wrapper` (root).
5. **Node Inspector Panel (when node selected)** — Label / Type / Description / Pos X / Pos Y / Connections count / ID (UUID) / Delete.
6. **Right-click Context Menu** — Add Node, Paste, Select All, Zoom to Fit, Toggle Grid, Run Validation, Copy Summary, Copy JSON, Edit Component, Create Schematic Instance.
7. **Floating button** — `1 Design Suggestions` bottom-right.
8. **Workflow nav top** — Architecture > Schematic > PCB Layout > Validation > Export.

### Pass 7 — Visual / hierarchy findings

- **E2E-743 ✅ visual** — React Flow canvas with dot-grid background is **clean and professional**. Nodes have proper category color/icon (SENSOR cyan / POWER orange) + name + pin handles. Best canvas next to Breadboard.
- **E2E-744 🔴 visual** — Asset Library category icons row at top of sidebar (`A-Z 12 2 3 2 3 2`) is **completely opaque** — bare numbers + sort glyph with no labels. Beginners can't decode.
- **E2E-745 🟡 visual** — Asset Library sections "Favorites (1)" + "Recently Used (5)" + main list are stacked but main list is unlabeled. Should have header "All Parts (12)" for consistency.
- **E2E-746 🟡 visual** — Toolbar has 5 unlabeled icon buttons. Same density issue as everywhere. Add hotkey-in-label (`Select (V)`, `Pan (H)`, `Grid (G)`, `Fit (F)`, `Analyze (A)`).
- **E2E-747 🔴 visual** — On a freshly-loaded canvas with 4 nodes, nodes are spread randomly with no obvious layout. **No auto-layout** triggered after add. Should auto-arrange (force-directed, hierarchical, or grid).
- **E2E-748 🟡 visual** — Each node has 2 pin handles (top/bottom) — but only 2! Real components have many pins (ATtiny85=8, ESP32=38). Architecture is "abstract block diagram" but limit is unstated. Add a pin count badge on the node.
- **E2E-749 🟡 visual** — Nodes use color-by-category (SENSOR cyan, POWER orange) but no legend visible. Add a tiny legend in the toolbar or at canvas edge.
- **E2E-750 🟢 visual** — Node cards are pretty (icon + bold uppercase category + readable name). Could use a description/subtitle line ("Pressure/humidity/temp sensor") on the node itself, not just sidebar.
- **E2E-751 🟢 visual** — Mini map renders nodes as cyan rectangles but no edge preview when sparse. Add edge tracing in mini map.
- **E2E-752 🟡 visual** — Empty-state ("Start Building Your Architecture" with Generate button) disappears after first node. But there's no progressive guidance after that ("Now connect 2 nodes by dragging from one handle to another"). Lost teaching moment.
- **E2E-753 🟢 visual** — Asset Library has a resize handle (`asset-resize-handle`) — great for power users. Verify it works smoothly without breaking React Flow layout.
- **E2E-754 🟡 visual** — Node inspector panel (when shown) is on the right but text overlaps with collapsed AI Assistant strip. Z-index conflict potential.

### Pass 7 — Functional findings (Architecture)

- **E2E-755 ⚪ NEEDS VERIFY** — Drag-from-handle to another node should create an edge. Verified visually that handles render but synthetic events likely won't trigger React Flow's connection logic. Real DevTools click + drag needed.
- **E2E-756 🔴 BUG (carries E2E-078)** — `tool-analyze` button does nothing on click. Same dead-button as before.
- **E2E-757 ⚪ NEEDS VERIFY** — `tool-grid` toggle: visual confirmation that grid rendering changes — verify on/off works.
- **E2E-758 🟡 UX** — `Generate Architecture` empty-state CTA disappears after first node added. Should remain accessible (keyboard `G` or via toolbar) so users can regenerate from any state.
- **E2E-759 🟡 UX** — Adding a part via `+` button always drops at fixed position (witness: 4 nodes spawned at offset; second covered the third). Should auto-find empty space or let user click on canvas to choose drop point.
- **E2E-760 🔴 UX** — Asset Library shows "BME280" THREE times (Favorites, Recently Used, main list) even though same part. Visually noisy.
- **E2E-761 🔴 UX** — Adding the same part 3x adds 3 separate nodes (verified earlier that Components count went 1→4). Architecture allows duplicate components; Schematic/PCB will multiply pin nets accordingly. Worth clarifying in UI ("Add another instance" vs "Increase quantity").
- **E2E-762 🟡 UX** — `asset-search` input has placeholder `Search parts… ( / )` — slash-key shortcut implied but unverified. Also implies parts-only search (does it search by part number? manufacturer? tags?).
- **E2E-763 🟢 UX** — Right-click context menu has 10 items including `Copy JSON` — power-user gold. Document.
- **E2E-764 🟡 UX** — Inspector panel `pos-x / pos-y` numeric inputs work for keyboard-precise placement. But no unit indicator (px? grid units? mm?).
- **E2E-765 🟢 UX** — Inspector includes UUID — useful for debugging. Could include Copy-UUID button.

### Pass 7 — Toolbar critique (Architecture)

- **E2E-766 🟡 visual** — `tool-analyze` icon is opaque (looks like a "play" or "graph" — unclear). Need clear label.
- **E2E-767 🟡 visual** — Tool buttons lack `aria-pressed` to indicate active mode (E2E-079 already noted; restated in context).
- **E2E-768 🟢 NEW** — Add `tool-auto-layout` (run a force-directed or hierarchical re-layout on all nodes).
- **E2E-769 🟢 NEW** — Add `tool-add-text` (place a text annotation on the canvas).
- **E2E-770 🟢 NEW** — Add `tool-group-region` (encircle nodes with a labeled colored region — "Power section", "MCU subsystem").

### Pass 7 — Audience-specific (Architecture)

- **E2E-771 🔴 newbie** — A first-time user sees "drag from sidebar to canvas, click + button" — both work but neither is obvious. Onboarding callout needed.
- **E2E-772 🟢 newbie** — Categories MCU/Power/Comm/Sensor/Connector are intuitive — beginner-friendly.
- **E2E-773 🟢 newbie** — Empty state CTA "Generate Architecture" is the perfect AI-first beginner path. But requires API key.
- **E2E-774 🔴 expert** — Power user wants keyboard-only architecture creation: `N` adds node, arrow keys move, `E` enters edge mode. Currently mouse-required.
- **E2E-775 🟢 expert** — Expert wants saved layouts ("This is my standard IoT stack template"). Copy JSON helps but no native template manager.

### Pass 7 — Competitive (Architecture vs Lucidchart / draw.io / Figma / Linear)

- **E2E-776 🟢 STRATEGIC vs Lucidchart** — Lucidchart's connector lines auto-bend, label themselves, and can carry traffic icons. ProtoPulse architecture edges are unverified — verify edge-rendering quality.
- **E2E-777 🟢 STRATEGIC vs Figma** — Figma's auto-layout + smart guides + nudge-by-arrow keys are table stakes. Add to Architecture.
- **E2E-778 🟢 STRATEGIC vs Linear** — Linear's "Project graph" view shows entity relationships. ProtoPulse Architecture should add a graph view of cross-tab relationships (Architecture node ↔ BOM item ↔ Schematic instance ↔ PCB footprint).

---

