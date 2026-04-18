---
name: E2E walkthrough — PASS 2 — Visual + Flow + Audience Critique
description: Frontend E2E findings for 'PASS 2 — Visual + Flow + Audience Critique' chunk from 2026-04-18 walkthrough. 180 E2E IDs; 19 🔴, 56 🟡, 71 🟢, 23 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 19
  ux: 56
  idea: 71
  works: 23
  e2e_ids: 180
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 2 — Visual + Flow + Audience Critique

This pass adds visual layout critique, beginner-vs-expert audience analysis, and flow assessment that the text-snapshot pass missed. Screenshots saved to `docs/audits/screenshots-2026-04-18/`. Findings begin at E2E-314.

(See per-tab Pass 2 sections appended below.)

### Pass 2 — Dashboard (visual)

Screenshot: `screenshots-2026-04-18/01-dashboard.png`

- **E2E-314 🔴 P1 visual** — Top toolbar has **32+ icon-only buttons** stacked tight with NO visible labels (sidebar 21 icons + workspace toolbar ~12 icons). Brand-new users will be paralyzed. Need either (a) labels by default with a "compact" toggle, (b) hover-tooltips with delay <200ms, or (c) collapsible group categories.
- **E2E-315 🔴 BUG (CONTRADICTION)** — Validation card on Dashboard now shows **"Warnings Present — 1 issue to review"** AND **"0 errors, 0 warnings, 1 info"**. "Warnings Present" with 0 warnings is internally contradictory.
- **E2E-316 🟡 UX label** — Header button "Saved + restore" — incomprehensible label. Means "autosave is on + click to restore from snapshot"? Rename "Autosaved" with a separate Restore action.
- **E2E-317 🟡 UX redundancy** — Breadcrumb "Architecture > Schematic > PCB Layout > Validation > Export" duplicates the tab strip immediately above. Pick one.
- **E2E-318 🟢 IDEA** — Stats bar "Components 1 / Connections 0 / BOM Items 0 / Est. Cost $0.00 / Issues 1" is redundant with the Architecture and BOM cards (cf. E2E-016). Collapse stats into card headers.
- **E2E-319 🟢 IDEA** — Lots of vertical whitespace in Architecture card. Could fit a tiny network preview SVG or recent activity.
- **E2E-320 🟡 visual hierarchy** — H2 "Blink LED (Sample)" + paragraph description repeats project metadata already visible in the header bar (`workspace-project-name`). Pick one location.
- **E2E-321 🟡 UX** — Right-side AI Assistant panel collapsed to vertical sidebar with rotated "AI ASSISTANT" text. Clever but easy to miss for first-time users — needs a small icon nudge.
- **E2E-322 🟢 IDEA** — Bottom-right `1 Design Suggestions` floating button untested. Should toast-preview the suggestion title on hover instead of requiring click to discover.
- **E2E-323 🟡 visual** — Color palette: black + cyan + zinc. Looks "cyberpunk" / Linear-esque. Accent cyan well-used. **However**: Yellow warning triangle on Validation card has no visible text label until you read carefully. Color-only severity violates WCAG.
- **E2E-324 🟢 audience-newbie** — A first-time user lands on Dashboard with 0 BOM, 0 connections. Empty cards say "No BOM items yet. Add parts in Procurement." That's text in a card. Should be a big CTA button "Open Procurement →" inline. Cards are clickable (E2E-201) but the text doesn't TELL the user to click.
- **E2E-325 🟢 audience-expert** — A power user wants to see ALL recent activity at once — currently "Recent Activity" card just says "No activity recorded yet." Power users need actual feed.

### Pass 2 — Architecture (visual)

Screenshot: `02-architecture.png`

- **E2E-326 🔴 visual** — Category icon row at top of Asset Library: just 6 icon glyphs with tiny number badges (12, 2, 3, 2, 3, 2) — **completely opaque to first-time users.** Beginners can't tell if these are filters, counts, or something else. Add labels under each icon.
- **E2E-327 🟡 visual** — Asset Library's first row of icons (the "All / MCU / Power / Comm / Sensor / Connector" filters) sit right above "Favorites (1)" header — visually they look like part of Favorites. Add separator + spacing.
- **E2E-328 🟡 UX** — Single BME280 node sits floating in the middle of a vast empty canvas. **No grid background visible** in screenshot (despite Toggle Grid tool). For a beginner, this looks broken — the tiny node lost in a sea of dark.
- **E2E-329 🟢 IDEA** — Architecture canvas has React Flow attribution bottom-left + Mini Map bottom-right. Both small. Mini Map could include navigation arrows for keyboard users.
- **E2E-330 🟡 visual** — `1 Design Suggestions` floating button overlaps Mini Map. Z-order conflict.
- **E2E-331 🟢 audience-newbie** — Beginner sees "Drag a component onto the canvas" hint in asset list — but no visible affordance shows components are draggable (no drag handle icon). Add a `≡` drag-handle icon left of each part name.
- **E2E-332 🟢 audience-expert** — Expert wants tile-grid view of parts vs the current list view. No view toggle available.
- **E2E-333 🟢 visual** — The Asset Library is fixed-width 240px. On a 1920px screen, that wastes canvas space. Make resizable like the right chat panel (which already has a resize-handle).

### Pass 2 — Schematic (visual)

Screenshot: `03-schematic.png`

- **E2E-334 🔴 visual** — Toolbar has 12 icon-only tools at top of canvas — **no labels, only icons**. Hover-tooltip required to discover. ATtiny85 sidebar shows tag chips "DIP" and "8 PINS" in cyan — readable. Empty state has icon + "Empty Schematic" + "Add Component" button — well-done.
- **E2E-335 🟡 UX** — `New Circuit` selector top-left + `New` button + `New Circuit` text label top-right = TRIPLE redundancy. Confusing.
- **E2E-336 🟡 visual** — Two zoom-control sets visible: top-left toolbar AND bottom-left React Flow controls (+/-/fit/lock). Pick one location (industry standard is bottom-left).
- **E2E-337 🟢 audience-newbie** — Canvas dot grid is dim (low-contrast). Can a beginner tell where to drop a component? Increase grid contrast in light spots, or add "drop zones" on hover.
- **E2E-338 🟢 audience-expert** — `45` and `90` angle constraint pills sit naked in toolbar — expert KiCad users would recognize but should be grouped under a "Wire angle" label/icon.
- **E2E-339 🟡 UX** — Sub-tabs `Parts / Power / Sheets / Sim` are tiny secondary tabs with icons — easy to miss. "Sim" is ambiguous (Simulation? Similar?).
- **E2E-340 🟢 visual** — Left sidebar takes ~16% width. Could be collapsible like Asset Library on Architecture (this one already collapses).

### Pass 2 — Arduino (visual)

Screenshot: `04-arduino.png`

- **E2E-341 🔴 visual** — Sidebar shows "Board Manager" and "Serial Monitor" labels obscured/cut off — text truncated. Plus there are visual artifacts (icons that look misaligned, e.g. the chevron `>` after Board Manager).
- **E2E-342 ✅ visual** — "Arduino readiness" trust receipt is the BEST visual on the entire app. Color-coded "Profile required" amber + "SETUP REQUIRED" badge + 8 status fields in 2-column grid. Beautiful and dense without being cluttered.
- **E2E-343 🟢 audience-newbie** — A beginner sees "Verify" + "Upload" buttons enabled at top right. They'll click them — fail confusingly. Disable until profile selected (cf. E2E-027).
- **E2E-344 🟡 visual** — Output panel is huge and empty. "No output yet" text only. Could pre-populate with example log explaining what compile output looks like.
- **E2E-345 🟢 IDEA** — `Verify` is Arduino IDE terminology — beginners may not know what it means. Tooltip: "Verify (compile) sketch without uploading".
- **E2E-346 🟡 visual** — Right side of header has icon-only buttons: copy/save/format/etc — no labels. Discoverability fail.
- **E2E-347 🟢 audience-expert** — Expert wants quick-toggle libraries panel from keyboard. No keyboard shortcut hint visible.
- **E2E-348 🔴 visual** — Sub-tabs OUTPUT / SERIAL MONITOR / LIBRARIES / BOARDS / PIN CONSTANTS / SIMULATE — "SIMULATE" is a tab here AND there's a Simulation TAB at workspace level. Two simulators? Confusing IA.

### Pass 2 — Breadboard (visual)

Screenshot: `05-breadboard.png`

- **E2E-349 ✅ visual EXCELLENT** — Real breadboard grid renders beautifully (columns a-j labeled, center channel split, tie-points as dots). Looks like a physical breadboard. Best canvas in the app.
- **E2E-350 🟡 visual** — Stats row at top (8 stats: PROJECT PARTS / TRACKED / OWNED / PLACED / BENCH READY / LOW STOCK / MISSING / VERIFIED / STARTER SAFE) is **9 stat cards in a row** — visually overwhelming. Group as I suggested in E2E-035.
- **E2E-351 🟢 visual** — "Build like a real bench session" hero + 5 colored action buttons (Manage stash / Open schematic / Component editor / Community / Shop missing parts) — buttons look like a primary nav. Color-coded well but no icons on the buttons.
- **E2E-352 🟢 audience-newbie** — Hint text "Drag a starter part... use the Wire tool (2) to connect real pin pairs. Double-click finishes a wire run." Beginner-friendly explanation. Great.
- **E2E-353 🟢 audience-expert** — Bench shortcuts: Wire (2), but no shortcut palette for advanced users to discover all available actions.
- **E2E-354 🟡 visual** — Toolbar above breadboard has 6 tools (icons only). Same labeling problem. "Wire tool (2)" is referenced in hint but not labeled in toolbar. Add label.
- **E2E-355 🟡 UX flow** — Breadboard tab is **its own canvas**, separate from Schematic and Architecture. User has to mentally map which tab is which. Add an inset breadcrumb "Layouts > Breadboard" to clarify.
- **E2E-356 🟢 audience-newbie** — A first-timer might not know what "stash" means. Tooltip: "Stash = your inventory of physical parts available to use".

### Pass 2 — PCB (visual)

Screenshot: `06-pcb.png`

- **E2E-357 ✅ visual** — Layer Stack panel uses color-coded dots (red Top, green Inner Ground, red Inner Power, yellow Bottom Signal, etc.) — proper EDA convention. Mil + 1oz spec shown.
- **E2E-358 🔴 visual** — Board outline (yellow dashed) is rendered tiny in upper-left of huge empty canvas — board is 50x40mm but canvas zoom doesn't auto-fit on load. New users will think "PCB is broken / not showing". Auto-fit board to viewport on tab entry.
- **E2E-359 🟡 visual** — Layer toggle "F.Cu (Front)" pill is bright red (warning color?). For active layer, red implies danger. Use blue or theme-accent.
- **E2E-360 🟡 visual** — Layer preset row "2-layer 4-layer 6-layer 8-layer 10-layer 16-layer 32-layer" — 32-layer is impractical for 99% of users. Hide behind "More" disclosure.
- **E2E-361 🟡 visual** — Layers legend bottom-left shows "F.Cu / B.Cu / Board Outline" with colored bars but doesn't sync with the Layer Stack panel above (which shows 4-layer state with Inner Ground/Power). Two layer concepts displayed.
- **E2E-362 🟢 audience-newbie** — Beginner sees "Trace: 2.0mm" with slider — what's a sensible value? Add tooltip "Default 2.0mm is fine for power; signal traces use 0.25mm".
- **E2E-363 🟢 audience-expert** — Expert wants Diff Pair tool + Length matching + Net colors. Diff Pair (D) is in toolbar but no length tuning visible.

### Pass 2 — 3D View (visual)

Screenshot: `07-3dview.png`

- **E2E-364 🔴 visual** — 3D board renders as a flat green parallelogram (no visible thickness). For an iso/perspective view this is wrong — board should show 1.6mm thickness depth.
- **E2E-365 🟢 visual** — Layer checkboxes use color swatches (green/orange/grey) — good visual key. But Internal layer is uncheckable yet shown (faintly?).
- **E2E-366 🟡 UX** — Edit Board form sits at right side disconnected from the board itself — should be inline-editable on hover (drag corner to resize).
- **E2E-367 🟢 audience-newbie** — A first-timer sees a green rectangle and "0 components" — won't realize they need to populate Schematic + PCB before components appear here. Add hint: "Place components in Schematic to see them here".
- **E2E-368 🟢 audience-expert** — Expert wants STL/STEP export of the 3D model (Export button visible top right but unverified). Also wants pin-1 markers, polarity indicators.
- **E2E-369 🟡 visual** — View angle buttons (Top/Bottom/Front/Back/Left/Right/Iso) are flat pills — no icon to telegraph each view. Icon (e.g. cube face) would help.

### Pass 2 — Component Editor (visual)

Screenshot: `08-component-editor.png`

- **E2E-370 🔴 visual** — 6 sub-tabs (Breadboard/Schematic/PCB/Metadata/Pin Table/SPICE) + 13 toolbar buttons = visually dense top bar. Two rows of tabs+toolbar squeeze into ~80px height. Group toolbar by purpose (cf. E2E-040).
- **E2E-371 🟢 visual** — Pin Table tab has a 2-line label "Pin Table" wrapping to two lines — looks awkward. Either widen tab or shorten label.
- **E2E-372 ✅ visual** — Trust strip uses color-coded pills (orange "Candidate exact part" / cyan "ic-package" / cyan "Community-only" / "Authoritative wiring unlocked"). Excellent semantic encoding.
- **E2E-373 🟡 visual** — Form layout (Title/Family full-width, Manufacturer+MPN side-by-side, Mounting+Package side-by-side, Tags full-width) — well-organized but no visual grouping headers ("Identity" / "Physical" / "Categorization").
- **E2E-374 🟢 audience-newbie** — Beginner sees "Family", "Mounting Type", "Package Type", "MPN" — needs definitions. Tooltip with hover help.
- **E2E-375 🟢 audience-expert** — Expert wants bulk-edit across multiple parts (no multi-select visible).
- **E2E-376 🟡 visual** — PARTS sidebar has just 1 part (ATtiny85). For users with 100+ parts this list will scroll forever — needs search and group-by.

### Pass 2 — Procurement (visual)

Screenshot: `09-procurement.png`

- **E2E-377 🔴 visual** — 17 sub-tabs in Procurement = horizontal-scroll tab strip. Even 11 visible at this width is overwhelming. Group as nested tabs: BOM (Management/Comparison/Templates) / Sourcing (Alternates/Live Pricing/Cost Optimizer/Order History) / Manufacturing (Assembly Cost/Risk/Groups/Mfg Validator/PCB Tracking) / Compliance (Risk Scorecard/AVL/Cross-Project/Supply Chain) / Personal Inventory.
- **E2E-378 🟡 visual** — Empty BOM has icon + headline + sub-text + "+ Add First Item" button — empty state pattern is clean.
- **E2E-379 🟡 UX** — `Cost Optimisation`, `ESD`, `Assembly` toggles look like buttons. Active state unclear without click.
- **E2E-380 🟢 audience-newbie** — "ESD" abbreviation has no explanation. Beginners won't know it = electrostatic discharge filter.
- **E2E-381 🟡 visual** — Cost summary "$0.00 / unit @ 1k qty" right-aligned, Export CSV next to it. Text is small. Make `$0.00` larger as KPI.
- **E2E-382 🟢 IDEA** — Sortable column headers (sort icons next to Status / Part Number / Manufacturer / Stock / Qty / Unit Price / Total) — good. But no "save view" so user must reorder every session.

### Pass 2 — Validation (visual)

Screenshot: `10-validation.png`

- **E2E-383 ✅ visual** — System Validation 2-column layout: left = Design Gateway / Manufacturer Rule Compare / BOM Completeness, right = Design Troubleshooter (with vertical scrolling list of 17 issues). Solid structure.
- **E2E-384 🔴 visual** — Issue rows in Design Gateway use color tags (orange "power" / "signal" / "best-practice" / red severity dot). Hard to scan at a glance — same orange for "power" and severity is confusing.
- **E2E-385 🟡 visual** — "Run DRC Checks" button is **bright cyan filled** (high-emphasis primary). But there's also "Run" buttons inside Design Gateway and DFM Check sections. Three Run buttons with same visual weight = which is the master?
- **E2E-386 🟡 visual** — Issue toggle (chevron down) on right of each row is tiny — affordance for collapse unclear.
- **E2E-387 🟢 audience-newbie** — Design Troubleshooter "Describe symptoms" input is excellent for beginners — they describe what's broken in plain English. Promote to top of validation page.
- **E2E-388 🟢 audience-expert** — Expert wants to see DRC ruleset diff (current vs preset). No diff view.
- **E2E-389 🟡 visual** — Severity filter "Errors (32) / Warnings (96) / Info (1)" — filter buttons but can multi-select? Unclear from styling.

### Pass 2 — Simulation (visual)

Screenshot: `11-simulation.png`

- **E2E-390 ✅ visual EXCELLENT** — Simulation Readiness Confidence panel: "Guided build candidate" amber pill + "Evidence strong" cyan pill on same row + paragraph + 2-column TOP BLOCKERS / NEXT ACTIONS. **Best layout in the whole app** — clear, dense, actionable.
- **E2E-391 ✅ visual** — Simulation trust ladder amber-bordered card with "Need components" + "SETUP REQUIRED" badges. Triple-confirmation that you can't run sim yet — pedagogical.
- **E2E-392 🟡 UX** — `Start Simulation` green button top-right is BIG but disabled. Disabled green = visual lie (green normally = go).
- **E2E-393 🟡 visual** — Right ⅓ of viewport empty (white space). Could host live waveform preview placeholder, or last result thumbnail.
- **E2E-394 🟢 audience-newbie** — Beginner reads "DC Operating Point" in DETECTION row — what's that? Need plain-English mode (per "Use plain labels" workspace toggle, but doesn't seem to apply here).
- **E2E-395 🟢 audience-expert** — Expert wants Spice netlist editor visible inline. Currently buried in collapsibles further down the page.

### Pass 2 — Vault (visual)

Screenshot: `12-vault.png`

- **E2E-396 ✅ visual EXCELLENT** — 3-column layout (Topic Maps | Notes | Note Detail) is the canonical knowledge-base layout. Tag-Wiki / Notion-database flavor. Beautiful.
- **E2E-397 🟡 visual** — MOC count badges are small purple pills next to title — could be brighter / larger.
- **E2E-398 🟡 visual** — Two empty-state panels (Notes + Note Detail) both show book icons. Slightly redundant — could pre-load most-recently-viewed note in detail pane.
- **E2E-399 🟢 audience-newbie** — "Topic Maps" might confuse beginners — could call them "Categories" or "Topics".
- **E2E-400 🟢 audience-expert** — Expert wants graph view of vault relationships (like Obsidian). No graph mode visible.
- **E2E-401 🟡 visual** — Search input is wide and readable. Placeholder "Search the vault (min 3 chars)…" tells the user the threshold up front. Good.
- **E2E-402 🟢 IDEA** — Expand into a knowledge-graph visualization tab next to Topic Maps. Cf. Obsidian's strength.

### Pass 2 — Community (visual)

Screenshot: `13-community.png`

- **E2E-403 ✅ visual** — 3-column card grid is clean. Each card has: title + author + type-badge top-right + star rating + downloads/version + license badge + tag chips. Industry-standard marketplace layout.
- **E2E-404 🟡 visual** — Type badges color-coded (PCB Module purple / Footprint green / Snippet orange / Schematic cyan / 3D Model teal) — readable but no visible legend. Beginners can't tell what colors mean.
- **E2E-405 🟡 UX** — Sub-tabs Browse/Featured/Collections sit centered on a single row. Easy to scan but visually competes with header counts.
- **E2E-406 🟢 audience-newbie** — License badges (MIT/CC0/CC-BY/CC-BY-SA) — beginners don't know what these mean. Tooltip with plain-English ("Free to use commercially" / "Free to use, must share-alike").
- **E2E-407 🟢 audience-expert** — Expert wants version-pinning, dependency management, security advisories. None visible.
- **E2E-408 🟡 visual** — All cards share same star-rating renderer with full + outline stars. Readable but no half-star granularity.
- **E2E-409 🔴 BUG (cf. E2E-266)** — Cards look interactive but click does nothing. Visual affordance lies.

### Pass 2 — Order PCB (visual)

Screenshot: `14-orderpcb.png`

- **E2E-410 ✅ visual** — Confidence panel + Trust receipt + 5-step wizard footer (1. Board Specs / 2. Select Fab / 3. DFM Check / 4. Quotes / 5. Summary) with Previous + Design Suggestions buttons. Wizard pattern is well-established for purchase flows.
- **E2E-411 🟡 visual** — Compatible Fabs "4 / 5" stat is shown but not linked to which 5 fabs are checked (cf. E2E-065).
- **E2E-412 🟡 visual** — Step indicator dots (small dot under each step) at bottom — barely visible. Use larger numbered circles.
- **E2E-413 🟢 audience-newbie** — A first-timer doesn't know which fab is best for them. Add wizard step "Tell me about your project (cost vs speed vs quality)" → recommend fab.
- **E2E-414 🟢 audience-expert** — Expert wants saved fab profiles ("My JLCPCB account", "My PCBWay account") with API key for auto-quote. Untested.
- **E2E-415 🟡 visual** — Bottom navigation Previous / step-dots / Design Suggestions = floating, low-contrast. Promote to a real footer bar.

### Pass 2 — Tasks (visual)

Screenshot: `15-tasks.png`

- **E2E-416 ✅ visual** — Classic 4-column kanban board. Color-coded status dots per column (orange backlog/todo/in-progress, green done). My E2E Test Task card visible with Medium priority pill. Standard.
- **E2E-417 🟡 visual** — Each column header has an X button (Remove column) — risky next to a "1 task" badge. Move to overflow menu.
- **E2E-418 🟡 UX** — "All priorities" filter is the only filter. Add labels, due-date, assignee filters.
- **E2E-419 🟢 audience-newbie** — Beginner sees an empty kanban with no guidance. Add "What is a kanban board?" tooltip.
- **E2E-420 🟢 visual** — Lots of empty space below cards. Each column is fixed-width — could be auto-fit-content.

### Pass 2 — Learn (visual)

Screenshot: `16-learn.png`

- **E2E-421 ✅ visual** — 3-column card grid with nice density. Each card: title + difficulty pill (Beginner cyan / Intermediate orange) + category pill (Passive Components green / Active Components red / Power yellow) + description + tag chips + tag overflow `+N`.
- **E2E-422 🟡 visual** — 4 categories used (Passive/Active/Power) but no legend. Color taxonomy unclear.
- **E2E-423 🟡 visual** — Same overlap with Vault — vault has `passives` MOC with 62 notes; Learn has "Resistors / Capacitors / Inductors" articles. Learn is a subset / curated wrapper. Add cross-link from Learn article → Vault MOC for deeper dive.
- **E2E-424 🟢 audience-newbie** — Excellent landing page for beginners — pick a card, learn a concept. Perfect.
- **E2E-425 🟢 audience-expert** — Expert wants offline copy / PDF export. Untested.

### Pass 2 — Inventory (visual)

Screenshot: `17-inventory.png`

- **E2E-426 🔴 visual** — Tab body is **mostly empty space** (just `Storage Manager` + Scan/Labels buttons + filter input + "No BOM items to display."). Wastes a whole tab. Either consolidate with Procurement → Inventory or load it lazily on first BOM item.
- **E2E-427 🟡 visual** — Page top-right has Scan + Labels buttons but no descriptions. Scan = barcode? QR? Labels = print? export? Confusing.
- **E2E-428 🟢 audience-newbie** — Beginners won't know what Storage Manager is. Add headline "Track where your physical parts are stored (drawer, bin, shelf, etc.)".

### Pass 2 — Serial Monitor (visual)

Screenshot: `18-serial.png`

- **E2E-429 ✅ visual EXCELLENT** — Top status row "Disconnected • Connect" + Monitor/Dashboard pills + Board/Baud/Ending dropdowns + 4 toggle switches + Save → consolidated control surface. Clean.
- **E2E-430 ✅ visual** — Serial device preflight panel mirrors Arduino preflight. Consistent across hardware tabs.
- **E2E-431 🟡 visual** — Bottom message input "Connect to a device first" placeholder is clear. Send button next to it disabled. Good gating.
- **E2E-432 🟢 audience-newbie** — Beginner sees baud rate `115,200` — what is baud? Tooltip: "Baud rate = serial communication speed; 115,200 is most common for Arduino".
- **E2E-433 🟢 audience-expert** — Expert wants RTS/DTR control with hex/binary mode + custom baud. Custom baud not visible.
- **E2E-434 🟡 visual** — DTR/RTS/Auto-scroll/Timestamps switches use cyan when ON — readable but no labels visible above the switch ("Show timestamps in log") on hover.

### Pass 2 — Calculators (visual)

Screenshot: `19-calculators.png`

- **E2E-435 ✅ visual** — 2-column card grid of calculators. Each card: title + formula + inputs + Calculate button (full-width cyan) + reset icon. Clean, scannable, beautiful.
- **E2E-436 🟡 visual** — Forward/Reverse and RC Filter/Bandpass tabs inside cards — small text, easy to miss.
- **E2E-437 🟢 audience-newbie** — Each card states the formula (V = I × R) — beginner-friendly. But should also link to Learn article on the topic for deeper.
- **E2E-438 🟢 audience-expert** — Expert wants programmatic access — REPL-style command line (`ohm(v=5, i=0.02)` returns 250) for batch design.
- **E2E-439 🟢 IDEA** — Add unit conversion calculators (mil↔mm, AWG↔mm², dBm↔mW) — common EDA needs.
- **E2E-440 🟡 visual** — Cards have sharp corners. Soft rounded corners (matches rest of app's `rounded-md`) would feel less stark.

### Pass 2 — Patterns (visual)

Screenshot: `20-patterns.png`

- **E2E-441 ✅ visual** — Patterns/My Snippets sub-tabs + Search + Category + Level filters + grouped sections (Digital(1), Power(4)). Each card: title + level pill (Beginner green / Intermediate yellow / Advanced orange) + chevron expand + description.
- **E2E-442 🟡 visual** — Cards have chevron on right but click body NOT click chevron. Visual affordance unclear (cf. E2E-286).
- **E2E-443 🟢 IDEA** — "Apply pattern to project" CTA missing. Should one-click instantiate the pattern (resistor + cap + IC) into Architecture/Schematic.
- **E2E-444 🟢 audience-newbie** — Tagline "learn the 'why' not just the 'what'" — sets right expectation.
- **E2E-445 🟢 audience-expert** — Expert wants to author + share custom snippets. "My Snippets" tab serves this; ensure it has good editor UX.

### Pass 2 — Starter Circuits (visual)

Screenshot: `21-starter.png`

- **E2E-446 ✅ visual** — 3-column dense grid. Each card: title + chevron + description + tag chips (level/category/board). Filter pills at top: All / Basics / Sensors / Displays / Motors / Communication; All Levels / Beginner / Intermediate.
- **E2E-447 🟡 visual** — Filter pills lack active-state styling indicator beyond underline. Hard to tell which filter is selected at a glance.
- **E2E-448 🟢 audience-newbie** — Card descriptions are perfect for beginners ("classic Hello World", "Simulate a traffic light"). Excellent.
- **E2E-449 🟢 audience-expert** — Expert wants ESP32, RP2040, STM32 starter variants beyond Arduino Uno only.
- **E2E-450 🟢 IDEA** — "Open Circuit" button (in expanded view) — should also offer "Send to Schematic" / "Send to Breadboard" / "Send to PCB" multi-target.

### Pass 2 — Labs (visual)

Screenshot: `22-labs.png`

- **E2E-451 ✅ visual** — Single-column list. Each lab: title + description + Beginner/Intermediate pill + clock-icon time estimate + category pill. Time estimate is unique to Labs (cf. Patterns/Starters which lack it).
- **E2E-452 🔴 visual** — No CTA on each lab card (no "Start Lab" button visible). User doesn't know what to do.
- **E2E-453 🟢 IDEA** — Add progress bar per lab once started ("Step 3 of 7 done").
- **E2E-454 🟢 audience-newbie** — Excellent for guided learning. Add "Recommended for first-time" badge on the easiest lab.
- **E2E-455 🟢 IDEA** — Labs and Patterns and Starter Circuits are 3 different "learning material" tabs. Could merge into one Learn hub with cards filterable by type.

### Pass 2 — History (visual)

Screenshot: `23-history.png`

- **E2E-456 🔴 visual** — Massive empty space. Single snapshot card centered with vast dark area below. Should at least show grid background hint or version timeline placeholder.
- **E2E-457 🟢 IDEA** — Snapshot cards should show diff stats ("+3 components / 2 nets / -1 BOM item") for at-a-glance change history.
- **E2E-458 🟢 audience-expert** — Expert wants Git-like branching from snapshots ("Fork from this snapshot → new project"). Untested.

### Pass 2 — Audit Trail (visual)

Screenshot: `24-audit-trail.png`

- **E2E-459 ✅ visual** — Each entry has icon (+/edit/delete) + name + action pill (Created cyan / Updated purple / Deleted red / Exported blue) + entity type pill + timestamp + "by Tyler" + (N fields) link. Excellent timeline.
- **E2E-460 🔴 BUG REINFORCED (cf. E2E-298)** — Entries are from "OmniTrek Nexus" project but I'm on Blink LED tab. **Project scoping leak confirmed visually.**
- **E2E-461 🟢 IDEA** — Add ability to revert specific changes from audit trail (Click "Deleted SPI Bus" → "Undo this delete").
- **E2E-462 🟢 visual** — Date range pickers use native HTML date inputs — looks unstyled compared to the rest of the polished Tailwind components.

### Pass 2 — Lifecycle (visual)

Screenshot: `25-lifecycle.png`

- **E2E-463 ✅ visual** — 5 status cards (Active green / NRND yellow / EOL orange / Obsolete red / Unknown grey) — color-coded lifecycle states. Industry-standard EDA pattern.
- **E2E-464 🟢 IDEA** — Auto-pull from BOM should be the default workflow ("Track all BOM parts? [Yes]").
- **E2E-465 🟢 audience-newbie** — NRND = Not Recommended for New Designs. Need tooltip.
- **E2E-466 🟢 IDEA** — Add "Last checked" timestamp + "Refresh from supplier" action.

### Pass 2 — Comments (skipped repeated screenshot — covered in Pass 1)

- **E2E-467 🟢 IDEA** — Comments need to be anchored to design objects (component, wire, DRC issue). Currently general project chat only.

### Pass 2 — Generative (skipped repeated screenshot — covered in Pass 1)

- **E2E-468 🟡 visual** — Three sliders (Population/Generations) with no current-value labels visible. Need numeric value next to each slider.
- **E2E-469 🟡 UX** — "Budget: $25 / Max Power: 5W / Max Temp: 85C" defaults are arbitrary — should match common project profiles (Hobby / Industrial / Automotive).

### Pass 2 — Generative (visual updated)

Screenshot: `26-generative.png`

- **E2E-470 ✅ visual** — Sliders DO show current values inline (Budget: $25 / Max Power: 5W / Max Temp: 85C). Population/Generations are number inputs (6/5). Generate button cyan disabled-looking despite being enabled.
- **E2E-471 🔴 visual** — Generate button has dark teal styling — looks disabled. Should match other primary cyan CTAs (e.g. Schematic's `Add Component`).
- **E2E-472 🟡 UX** — "Population" + "Generations" without tooltips — beginner won't know these are GA params.

### Pass 2 — Exports (visual)

Screenshot: `27-exports.png`

- **E2E-473 ✅ visual** — EXPORT CENTER + "17 formats" badge + Confidence panel + amber Export preflight receipt with "USE WITH CARE" warning + 4-column trust receipt (Circuit / Formats Ready / PCB Placed / Build Profiles). **Most polished gating UX in the app.**
- **E2E-474 ✅ visual** — "Quick Export Profiles" with Fab Ready + Sim Bundle cards. Curated bundles for common workflows. Excellent.
- **E2E-475 🟡 visual** — "Local preflight only" + "USE WITH CARE" amber pills — could include link to remote preflight option (paid feature?).
- **E2E-476 🟢 IDEA** — Export center should preview file sizes before download ("BOM CSV ~3KB, Gerber ZIP ~120KB").
- **E2E-477 🟢 audience-newbie** — 17 formats overwhelms newbies. The Quick Profiles partly solve this — promote them above the format list.

### Pass 2 — Supply Chain / BOM Templates / My Parts (visual)

Screenshots: `28-supply-chain.png`, `29-bom-templates.png`, `30-my-parts.png`

- **E2E-478 🟡 visual** — All 3 tabs are vast empty space with single CTA (Check Now / Save BOM as Template / Search). Wastes screen. Bundle into a single "Library" parent tab with 3 sub-tabs.
- **E2E-479 🟢 IDEA** — Empty states should hint at value: Supply Chain → "Get notified when parts you depend on go EOL"; BOM Templates → "Save successful BOMs as starting points for new projects"; My Parts → "Track your physical parts inventory so AI knows what you have on hand."
- **E2E-480 🟢 audience-newbie** — Each is presented as a 1st-class workspace tab but they're really backstage utilities. Move to a dropdown / Settings.

### Pass 2 — Alternates / Part Usage (BROKEN)

Screenshots: `31-alternates.png`, `32-part-usage.png`

- **E2E-481 🔴 P0 visual CONFIRMED** — Both tabs render only a red "Failed to load X data" message + huge empty page. **Catastrophic UX failure** — user has no idea what's wrong, no retry, no link to setup. This is worse than the 401 console error (E2E-312/313); it's confirmed visually as broken.
- **E2E-482 🔴 visual** — Error message is small, centered, and red on dark background — barely visible. Use proper error toast + retry button.

---

