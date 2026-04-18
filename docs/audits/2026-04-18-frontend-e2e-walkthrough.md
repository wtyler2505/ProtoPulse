# Frontend E2E Walkthrough — 2026-04-18

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

## PASS 2 — APP-WIDE CRITIQUE (cross-tab themes)

After visual review of all 32+ tabs:

- **E2E-483 🔴 systemic** — **Top toolbar overload.** ~32 icon-only buttons in tight cluster, no labels, no group separation. New users panic, experts can't tell modes. Group by purpose (workspace / view / collab / help / mode) with inline labels by default + a "Compact" toggle.
- **E2E-484 🔴 systemic** — **Tab strip overflow.** 35 tabs requires horizontal scroll. Show only top 8-10 + an "All Tabs" overflow drawer, OR collapse into vertical sidebar like VS Code.
- **E2E-485 🔴 systemic** — **Confidence labels self-contradict** in 4+ places ("Evidence strong" + "SETUP REQUIRED" / "All Checks Passing" + "128 issues"). Pick ONE source of truth.
- **E2E-486 🟡 systemic** — **Empty-state overuse.** Many tabs are 80%+ empty space. Either prefill with useful demos or merge thin tabs.
- **E2E-487 🟡 systemic** — **Three Learning surfaces:** Learn / Patterns / Starter Circuits + Vault. All overlap. Merge into a single "Learn Hub" with type filters.
- **E2E-488 🟡 systemic** — **Three board sources:** PCB tab default 50×40, 3D View 100×80, Order PCB 100×80 (E2E-228/235/270). One source of truth needed.
- **E2E-489 🟢 systemic** — **Trust receipt + confidence panel pattern is ProtoPulse's superpower.** Replicate to every tab that involves trust (Procurement, Validation, Generative).
- **E2E-490 🟢 systemic** — **Card → action integration (E2E-283 Calculator → BOM)** should be the universal pattern. Every card across Patterns, Learn, Community, Starter Circuits should have one-click "Use this" CTAs that wire to the rest of the app.
- **E2E-491 🟡 systemic** — **Color taxonomy untaught.** Cyan = primary action, orange = warning, red = error/critical, green = success, purple = info-pill. But categories also use these colors (Power=red, Passive=green) creating clash. Document the color system.
- **E2E-492 🔴 systemic** — **Beginner mode (Student) doesn't visibly change UI.** Promised "simpler" but nothing different from Hobbyist mode in this audit. Verify mode actually does something.
- **E2E-493 🔴 systemic** — **AI Assistant collapsed sidebar** (right side, vertical text "AI ASSISTANT") is a key feature buried as a slim strip. Make it a clear floating chat icon like ChatGPT.
- **E2E-494 🟡 systemic** — **Accessibility gaps systemic:** role="button" on divs, missing aria-labels on icon-only buttons, color-only state indicators. Run axe-core scan and fix top-50 issues.
- **E2E-495 🟢 IDEA systemic** — Add a global Command Palette (Ctrl+K) — power user productivity multiplier.
- **E2E-496 🟢 IDEA systemic** — Add an "Onboarding tour" using the Coach button (when fixed) — guided first-time walkthrough of all major workflows.

---

## PASS 3 — Missed sections + competitive innovation (E2E-497 onwards)

Pass 3 covers areas missed in passes 1-2 (Projects list, Settings 404, sidebar groups, AI chat panel, hover-peek docks) PLUS injects competitive inspiration from Flux.ai, Wokwi, KiCad 9, and modern web-EDA platforms.

### Missed: Project list (`/projects`)

Screenshot: `33-projects-list.png`

The list page renders Sample Projects (5 cards: Blink LED, Temperature Logger, Motor Controller, Audio Amplifier, IoT Weather Station) + filter pills (All / Beginner / Intermediate / Advanced) + filter taxonomy (Recent / Sample / Learning / Beginner / Experimental / Archived) + project grid with ~25 user-created projects (many "E2E Test Project" cards from earlier testing).

- **E2E-497 ✅ visual** — Sample project cards include cost estimate, time estimate, parts count, and learning topics (e.g. "10 min / $23.45 / 3 parts / Architecture Design / BOM Management / Validation"). Excellent at-a-glance metadata.
- **E2E-498 🟡 visual** — Project grid is dense — 25+ active projects no obvious sort/group. Add "Recent activity" sort + "Group by status" toggle.
- **E2E-499 🔴 UX** — Lots of "E2E Test Project" duplicates from my testing — no way to filter or bulk-delete. Add multi-select + "Delete N selected".
- **E2E-500 🟢 IDEA** — Sample projects don't show a "remix / fork" CTA. Should let user clone any sample as starting point (cf. CodePen pattern).
- **E2E-501 🟢 IDEA** — Add project templates by industry: IoT / Robotics / Audio / Motor control / Power supply / Sensor logger. Pre-populate matching architecture + BOM.

### Missed: Settings page (BUG)

Screenshot: `34-settings.png`

- **E2E-502 🔴 P0 BUG** — `/settings` returns **404 Page Not Found**. The Settings gear icon at bottom of left sidebar is presumably the entry point but the route doesn't exist. Either route is wrong or page never built.
- **E2E-503 🟡 UX** — 404 page has "Return to Dashboard" button but it goes to **`/projects`** (project list), not a dashboard. Misleading button copy.
- **E2E-504 🟢 IDEA** — Settings should include: profile / account / API keys (Gemini, Anthropic, OpenAI) / theme (light/dark/auto) / hotkey customization / notification preferences / data export (GDPR) / delete account.

### Missed: Sidebar (left icon strip)

The 21-icon sidebar groups visible in DOM: design / analysis / hardware / manufacturing / ai_code / documentation. But UI shows them as tight icon column with no visible group labels.

- **E2E-505 🔴 visual** — Sidebar groups (design / analysis / hardware / etc.) exist in DOM but **no visible group separators or labels**. Beginners can't see structure. Add expandable group headers (cf. VS Code Activity Bar).
- **E2E-506 🟡 UX** — Sidebar icons are 21 — equal weight. The most-used (Architecture, Schematic, PCB) deserve top-pinning + larger size.
- **E2E-507 🟢 IDEA** — Add user-customizable pin/unpin per icon. Power users can hide tabs they never use.

### Missed: AI Assistant chat panel (deeper)

Right-side chat panel (`AI Assistant` vertical strip when collapsed → full chat panel when expanded).

- **E2E-508 🔴 visual** — When collapsed, AI Assistant is a 24px vertical strip with rotated text — most users will never discover it. Add a floating chat-bubble icon at bottom-right (industry standard cf. Intercom, Crisp).
- **E2E-509 🟡 UX** — Chat panel has 7 quick-action buttons (Generate Architecture / Optimize BOM / Run Validation / Add MCU Node / Project Summary / Show Help / Export BOM CSV) — but these aren't context-aware. Same buttons on every tab. Should change based on tab (e.g. on Schematic show "Auto-route", on PCB show "Auto-place").
- **E2E-510 🟢 IDEA** — Add multi-modal: drag-drop a datasheet PDF → AI extracts pins + creates component. Drag a hand-drawn circuit photo → AI digitizes to schematic. (Flux Copilot does this.)
- **E2E-511 🟢 IDEA** — Voice input button visible but untested. Industry standard is push-to-talk. Add waveform visualizer during recording.
- **E2E-512 🟡 UX** — "Local • —" status footer is opaque. What does "Local" mean? Local model? Local cache? Add tooltip.

### Missed: Welcome dialog / Mode picker

The first-visit welcome overlay has Student / Hobbyist / Pro presets but my testing didn't visually verify what each mode actually changes.

- **E2E-513 🔴 visual UNVERIFIED** — Workspace Mode (Student / Hobbyist / Pro) — no visible UI difference observed across modes. If mode is supposed to hide tabs / labels / advanced features, the implementation isn't visible. Either deliver the difference or remove the picker.
- **E2E-514 🟢 IDEA** — Add one more mode: "Educator" — exports student worksheets, includes grading rubrics, no AI by default to encourage learning.

### Missed: Hover-peek docks

Discovered in testid scan: `hover-peek-dock-left`, `hover-peek-panel-left`, `hover-peek-hotspot-left`, `hover-peek-dock-right`, `hover-peek-panel-right`. These appear to be hover-reveal sidebars for collapsed Sidebar + AI panel.

- **E2E-515 🟡 visual** — Hover-peek pattern is clever but undocumented in UI. First-time users won't discover. Add a subtle handle on the edge with `<` / `>` chevron.
- **E2E-516 🟢 IDEA** — Hover-peek delay should be configurable (some users want instant, others want 500ms grace).

### Missed: Theme toggle

`theme-toggle` button at top right ("Switch to light mode"). Untested. Cyberpunk dark theme is the default.

- **E2E-517 🟡 UX** — Theme toggle is icon-only sun/moon. No "Auto (system)" option visible — modern apps offer 3 modes (Light / Dark / Auto).
- **E2E-518 🟢 IDEA** — Save theme as project preference (some Pro EDA users want dark for schematics, light for docs).
- **E2E-519 🟢 IDEA** — Add "Print mode" preset — high contrast, white background, optimized for paper export.

### Missed: Mobile bottom nav

`mobile-bottom-nav` testid found in DOM with 5 buttons (Dashboard / Architecture / Component Editor / Procurement / More). Only visible on narrow viewport.

- **E2E-520 🔴 UX** — Mobile bottom nav has only 5 items — but the desktop has 35 tabs. Mobile users get a tiny subset; rest are inaccessible.
- **E2E-521 🟢 IDEA** — Mobile-first patterns: swipe between tabs, FAB for AI chat, drawer-based navigation. Untested.

### Pass 3 — Competitive innovation findings (E2E-522+)

Inspired by Flux.ai, Wokwi, KiCad 9, Altium 365, Cadence Allegro X.

- **E2E-522 🟢 STRATEGIC** — **Real-time multiplayer collaboration** (Flux's killer feature). Need true CRDT-based co-editing with live cursors, comments tied to design objects, presence indicators on canvas. ProtoPulse has "1 collaborator online" badge but no co-editing visible.
- **E2E-523 🟢 STRATEGIC** — **AI auto-routing that needs less cleanup** (Flux 2026 update). Current ProtoPulse has A* autorouter (BL-0081); compare quality + add "explain this trace" AI overlay.
- **E2E-524 🟢 STRATEGIC** — **Sourcing-aware design** (Flux 2026): show real-time pricing + stock + lifecycle on every BOM item INLINE in the schematic / component editor. Current ProtoPulse: Live Pricing is its own sub-tab. Surface inline.
- **E2E-525 🟢 STRATEGIC** — **Read-the-datasheet AI** (Flux Copilot): drag a PDF datasheet → AI extracts pin map + electrical specs + BOM-ready manufacturer/MPN. ProtoPulse Component Editor has "Datasheet" button but unverified depth.
- **E2E-526 🟢 STRATEGIC** — **VS Code integration** (Wokwi pattern): publish a `protopulse` VS Code extension so users can edit firmware in their preferred IDE while ProtoPulse handles schematic/PCB.
- **E2E-527 🟢 STRATEGIC** — **MQTT/HTTP/WiFi simulation built-in** (Wokwi). For IoT projects, simulate the whole network — virtual MQTT broker, mock cloud responses. ProtoPulse has Digital Twin tab but unverified depth.
- **E2E-528 🟢 STRATEGIC** — **Component Classes** (KiCad 9): tag components by class (Critical / Decoupling / High-speed / Mounting) and apply class-wide DRC rules. ProtoPulse has component metadata but no class-based rule sets.
- **E2E-529 🟢 STRATEGIC** — **Jobsets** (KiCad 9): one-click multi-format export pipelines ("On release: generate Gerbers + BOM CSV + Pick&Place + 3D STEP + Schematic PDF"). ProtoPulse Exports has 17 formats but no orchestrated bundles beyond Quick Profiles.
- **E2E-530 🟢 STRATEGIC** — **Selection Filter** (KiCad 9): on dense schematics, filter what's selectable by type (only nets, only labels, only components). ProtoPulse Schematic select tool has no filter.
- **E2E-531 🟢 STRATEGIC** — **Design Blocks** (KiCad 9): saveable schematic fragments to drag-place in new circuits. ProtoPulse has Patterns + My Snippets but no in-canvas-paste workflow verified.
- **E2E-532 🟢 STRATEGIC** — **True 1:1 scale rendering** (Flux 2026): viewer setting where on-screen mm = real mm with zoom-to-fit. Helps physical-sense-checking. ProtoPulse 3D View has dimensions but no 1:1 scale toggle.
- **E2E-533 🟢 STRATEGIC** — **Eagle/PADS import** (Flux 2026): ProtoPulse should import all major EDA formats. Current Import button untested across formats.
- **E2E-534 🟢 STRATEGIC** — **Self-correcting AI agent**: when user accepts an AI suggestion, AI can re-analyze impact and propose follow-up corrections. ProtoPulse has prediction-engine but no chained correction loop visible.
- **E2E-535 🟢 INNOVATION** — **Sound Effects (optional, opt-in)**: a satisfying audio cue when DRC passes, a low buzz when a wire fails, a click when components snap. (Linear / Asana have started this.)
- **E2E-536 🟢 INNOVATION** — **Haptic feedback on touch devices**: vibrate when snapping to grid / dropping a component. Untested for tablet UX.
- **E2E-537 🟢 INNOVATION** — **Time-travel debugger for circuits**: scrub a slider to see how DC operating point changes as you change a resistor value. Live derivative view.
- **E2E-538 🟢 INNOVATION** — **"What if" branching**: from any design state, fork "What if I use ESP32-C3 instead of ESP32-S3?" — instant comparison panel showing pin map differences, cost delta, power delta.
- **E2E-539 🟢 INNOVATION** — **Print-to-paper guide**: for makers, print-out of breadboard layout at 1:1 scale that you tape to your physical breadboard for component placement reference.
- **E2E-540 🟢 INNOVATION** — **Hardware diff viewer**: drag in two snapshots → see visual diff (added components highlighted green, removed red, modified yellow). Like a Git diff for circuits.
- **E2E-541 🟢 INNOVATION** — **Voice "What's wrong with my circuit?"** — open mic, describe symptoms verbally, AI listens + analyzes against architecture + simulation results.
- **E2E-542 🟢 INNOVATION** — **AR mode**: open project on phone, point camera at physical breadboard → AR overlays show next wire to place per the schematic. Wokwi has nothing like this; would be the killer feature.
- **E2E-543 🟢 INNOVATION** — **Embedded video tutorial player per tab**: Coach button could open a 30-90s loom-style screen recording showing "How to use the PCB tab" specifically.
- **E2E-544 🟢 INNOVATION** — **AI-explained components**: hover any component on canvas → AI generates plain-English explanation of role + pin functions + common mistakes. Per-component tooltip from Vault.
- **E2E-545 🟢 INNOVATION** — **Hardware "linter"** at GitHub PR level: integrate with GitHub Actions so PRs touching `.protopulse` files get auto-DRC + cost diff + lifecycle warnings posted as PR comment.

### Pass 3 — Build/expand on existing themes

- **E2E-546 (expands E2E-298 audit-trail leak)** — Build a project-scoped middleware: every list endpoint MUST take `projectId` filter. Add a server test that asserts no entity from other projects appears in the response.
- **E2E-547 (expands E2E-485 confidence contradictions)** — Single confidence-evaluator service that emits structured signals; UI labels derive from one schema. No more competing strings.
- **E2E-548 (expands E2E-093 dashboard-vs-validation)** — Validation summary = Dashboard's Issues counter. They must consume the same selector / hook.
- **E2E-549 (expands E2E-484 tab strip)** — Implement collapsible activity-bar nav (VS Code-style) with optional "Tab strip" mode for legacy users. Add power-user `Ctrl+P` quick-tab-switcher.
- **E2E-550 (expands E2E-074 Coach popover dead)** — Once fixed, design the TutorialMenu as a tracked-progress checklist of all major workflows: "1/12 — Place your first component", "2/12 — Run validation", etc. Gamify completion.
- **E2E-551 (expands E2E-091 128 false-positives)** — DRC engine should emit findings with `requiresPlacedComponents: boolean` flag so empty-design suppresses irrelevant rules.
- **E2E-552 (expands E2E-261 cards lack role=button)** — Add ESLint rule `jsx-a11y/no-static-element-interactions` and fix at codebase scale.
- **E2E-553 (expands E2E-228 board source-of-truth split)** — Single `useProjectBoard()` hook reads from server; PCB / 3D / Order all consume it. Server side: one `boards` table, one selector.
- **E2E-554 (expands E2E-074b keyboard activation)** — Add a keyboard navigation test suite (Playwright + tab order + Enter/Space activation per interactive element). Add to CI.
- **E2E-555 (expands E2E-205 favorite without state indicator)** — Use Lucide's `Star` (filled when favorited) + `StarOff` (outline when not). Universal pattern.

### Pass 3 — Workflow critiques (newbie → expert journey)

- **E2E-556 🔴 newbie journey** — A first-time user lands at `/projects` and sees "Select a project to continue." There's no "Take a tour" button. They have to click a Sample to start. Add an above-the-fold "New here? Watch 2 min intro" video.
- **E2E-557 🟡 newbie journey** — Sample project "Blink LED" loads with already-populated 1-component architecture (BME280 actually visible). But that's a SENSOR, not an LED — wrong starter content. Sample data is broken/seeded incorrectly.
- **E2E-558 🔴 newbie → first PCB journey** — From empty project to ordering a PCB requires: Architecture → add nodes → Schematic → push to PCB → place components → route traces → DRC → Order PCB → 5-step wizard. **No guided wizard for "Build my first PCB end to end"** — should be the killer first-week experience.
- **E2E-559 🟡 expert journey** — Power user wants keyboard-first navigation. Keyboard shortcuts dialog (E2E-221) is per-tab; need global Ctrl+P palette + Ctrl+Shift+P command palette + tab-cycling Ctrl+Tab.
- **E2E-560 🟢 expert journey** — Power user wants Git integration: "save current project as commit message" → push to a tracked repo. Untested but huge for serious teams.
- **E2E-561 🟢 expert journey** — Power user wants programmatic API access (REST + WebSocket) for CI integration. Untested.

Sources: [Flux.ai 2026 features](https://www.flux.ai/p/blog/we-raised-37m-to-take-the-hard-out-of-hardware), [Flux Copilot AI](https://www.flux.ai/p/blog/flux-copilot-under-the-hood), [Wokwi simulator](https://wokwi.com/), [KiCad 9 features](https://www.elektormagazine.com/articles/kicad-9-new-updated-features), [Quilter vs Flux 2026](https://www.quilter.ai/blog/the-2026-guide-to-autonomous-pcb-design-quilter-vs-deeppcb-vs-flux-ai)

---

## PASS 4 — BREADBOARD LAB DEEP DIVE (E2E-562 onwards)

Per Tyler request: exhaustive Breadboard Lab pass with visual + functional + competitive lens. Existing 2026-04-17 audit covered model + DRC; this pass focuses on UX/visual/workflow/innovation gaps NOT in that audit. Screenshots: `35-breadboard-fullpage.png`, `36-breadboard-with-led.png`.

### Surface inventory observed

Major panels (left column, top→bottom):
1. **Header strip** — "BREADBOARD LAB" + tagline + collapse toggle
2. **Workbench actions row** — 5 buttons: Manage stash / Open schematic / Component editor / Community / Shop missing parts
3. **Stats row** — 9 numeric tiles: PROJECT PARTS / TRACKED / OWNED / PLACED / BENCH-READY / LOW STOCK / MISSING / VERIFIED / STARTER-SAFE
4. **Quick Intake** — Scan + Add buttons, qty + storage inputs
5. **Bench AI card** — 6 AI actions (Resolve exact part / Explain / Diagnose / Find substitutes / Gemini ER stash / Gemini ER layout)
6. **Board Health card** — Audit + Pre-flight Check buttons
7. **Starter Shelf** — 7 starter drops (MCU / DIP IC / LED / Resistor / Capacitor / Diode / Switch)
8. **Component Placer** — search + 5 filter pills (All / Owned / Bench-ready / Verified / Starter) + group-by-category list

Right column (canvas):
9. **Toolbar** — 8 tools (select / wire / delete / zoom in / zoom out / reset view / DRC toggle / connectivity explainer)
10. **Health pill** ("HEALTHY 100") + circuit selector + Live Sim toggle
11. **Breadboard SVG** — 4 power rails (left_pos / left_neg / right_pos / right_neg) labeled top + bottom; columns a-j; rows 1-63 with 5-step labels (1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 63); ~830 tie-point holes rendered as `hole-r:rail:N`

### Pass 4 — Visual / hierarchy findings

- **E2E-562 🔴 visual** — Left workbench column is **9 sections + 8 stat tiles + 7 starter drops + 5 filter pills + parts list** = ~25 distinct UI regions stacked vertically. Vertical scroll required even at 1200px height. Way too dense for one column. Split into 3 collapsible groups: **Build** (Workbench actions / Quick Intake / Starter Shelf / Component Placer) / **AI** (Bench AI card) / **Health** (Stats / Audit / Pre-flight).
- **E2E-563 🔴 visual** — Stats tiles use 3×3 grid in a narrow column = each tile is tiny (~70×70px) with two text lines + number. Borderline unreadable on first glance. Either widen column or reduce to 4 most-important stats with "more" disclosure.
- **E2E-564 🟡 visual** — Stats tiles labels are uppercase semi-abbreviated ("BENCH-READY", "STARTER-SAFE") — beginners won't parse these mid-flow.
- **E2E-565 🔴 visual** — On a fresh project, all stats are 0 except "TRACKED 1", "MISSING 1", "STARTER-SAFE 1". So "1 part is tracked but missing"? Stat semantics overlap and contradict (an item can be both tracked AND missing AND starter-safe simultaneously). Need a single semantic taxonomy.
- **E2E-566 🟡 visual** — Workbench action buttons use cyan + green + purple + outline styling without clear semantic mapping. Unify or document the button-color taxonomy.
- **E2E-567 🟡 visual** — Top-right of canvas shows "HEALTHY 100" pill + "New Circuit" select + Live Sim toggle. Three different shapes in one strip — visually noisy.
- **E2E-568 ✅ visual** — Breadboard canvas itself is **gorgeous** — proper power rails with `+`/`-` color bands, real column letters a-j, real row numbers, and hole grid resembling a physical board. Best canvas in the app.
- **E2E-569 🟡 visual** — Power rail labels say `rail-label-left_pos-top` and `rail-label-left_pos-bottom` — these are RAIL-INDEX labels not user-facing. The actual rendered text is what matters; verify it shows `+` `−` icons.
- **E2E-570 🟢 visual** — Center channel rendered correctly but no DIP IC straddle preview when hovering DIP IC starter. Add ghost-component preview on hover-over-board with snap-to-grid feedback.

### Pass 4 — Functional findings

- **E2E-571 🔴 BUG** — Click on `breadboard-starter-led` registers but **does NOT place a component on canvas**. The "Drag a starter part…" hint persists. Starter Shelf is drag-only with no click-to-place affordance. Add a "click to add at next free position" alternative.
- **E2E-572 🔴 BUG (parallels E2E-091)** — `Audit` button on empty board reports **score 100/100 — Healthy — Board is healthy — no issues detected**. An empty board can't be "healthy" — it's empty. Same false-positive class as Validation tab.
- **E2E-573 🔴 BUG** — `Pre-flight Check` on empty board reports **All clear — ready to build! — Voltage Rail Compatibility: pass / Decoupling Capacitors: pass / USB Power Budget: pass / ESP32 ADC2/WiFi Conflict: pass / Required Pin Connections: pass**. Pre-flight checks pass on a project with NO components. Should report "Cannot pre-flight: no components placed".
- **E2E-574 🟡 UX** — Bench AI buttons are labeled with action names ("Resolve exact part request", "Diagnose likely wiring issues"). All require API key. None show disabled state when no key is configured (verified Bench AI panel exists; gating not visible).
- **E2E-575 🟡 UX** — Component Placer filter pills (All / Owned / Bench-ready / Verified / Starter) don't show count badges (cf. Architecture asset library which DOES). Inconsistency.
- **E2E-576 🟢 IDEA** — Bench AI has 2 "Gemini ER" labelled buttons ("build from my stash", "cleaner layout plan"). "ER" abbreviation unclear — Engineering Review? Expand or rename.

### Pass 4 — Toolbar critique

- **E2E-577 🟡 visual** — Canvas toolbar has 8 icon-only tools with NO visible labels. Zoom in/out/reset are guessable; DRC toggle and Connectivity explainer toggle are NOT. (cf. Schematic which uses `(V)` `(W)` hotkey-in-label pattern — apply here.)
- **E2E-578 🔴 visual** — `tool-drc-toggle` and `tool-connectivity-explainer-toggle` — toggle state (on/off) not visually obvious without aria-pressed.
- **E2E-579 🟢 IDEA** — Add `tool-measure` (click two points on board to show distance in mm + tie-point count). Common need for breadboard layout.

### Pass 4 — Audience-specific (Breadboard)

- **E2E-580 🔴 newbie** — A first-time user sees 9 stats + 6 AI buttons + 5 workbench actions + Starter Shelf BEFORE the actual breadboard. Cognitive overload. Beginner mode should hide everything except Starter Shelf + canvas + Audit.
- **E2E-581 🟡 newbie** — "Stash" terminology (E2E-356 again) — beginner won't grasp that this is "your physical parts at home".
- **E2E-582 🟢 newbie** — Hint text on canvas "Drag a starter part… use the Wire tool (2)…" is excellent. Promote it as the *only* visible thing for empty-board state.
- **E2E-583 🟢 expert** — Power user wants keyboard placement: type `R 220 a5` to place a 220Ω resistor at column a row 5. No CLI mode visible.
- **E2E-584 🟢 expert** — Power user wants saved breadboard "patterns" (e.g. "my standard ESP32 power chain") that drag-place all wires + parts at once. Closest is Patterns tab but no breadboard-specific drop-in.
- **E2E-585 🟢 expert** — Expert wants real-time current/voltage simulation overlays per net, not just "DRC pass/fail". Live ammeter on a wire.

### Pass 4 — Competitive (Breadboard vs Wokwi / Tinkercad / Fritzing)

- **E2E-586 🟢 STRATEGIC vs Wokwi** — Wokwi simulates Arduino + ESP32 firmware running against a virtual breadboard with real GPIO state (LED brightness, sensor readings). ProtoPulse Breadboard tab has "Live Sim" toggle in header but unverified depth. Should be: paste Arduino sketch → see virtual LED blink driven by code.
- **E2E-587 🟢 STRATEGIC vs Tinkercad** — Tinkercad Circuits offers schematic / breadboard / PCB switching with ONE shared component library. ProtoPulse splits these; the cross-tab sync is partly there but no smooth transitions.
- **E2E-588 🟢 STRATEGIC vs Fritzing** — Fritzing's "Welcome / Breadboard / Schematic / PCB" 4-view model with named graphical Sub-parts (with realistic colored body images). ProtoPulse uses generic "DIP-style starter drops" — could ship realistic PNG body images for popular ICs (LM7805 TO-220, ESP32 dev board PCB).
- **E2E-589 🟢 STRATEGIC** — Wokwi has built-in **virtual logic analyzer** + **virtual oscilloscope** that hooks to any breadboard pin. Killer for debugging. Add as a new toolbar tool.
- **E2E-590 🟢 STRATEGIC** — Wokwi's scenarios let you script test sequences ("at t=2s send button press, expect LED toggle"). ProtoPulse breadboard has "scenarios panel" mentioned in BL audit; verify it ships.

### Pass 4 — Innovation (Breadboard-specific)

- **E2E-591 🟢 INNOVATION** — **Animated wire-flow** during simulation: visualize current direction as moving dashes along wires (low-current = grey, normal = cyan, high = red).
- **E2E-592 🟢 INNOVATION** — **Heat map overlay**: color-tint components by power dissipation. Hot resistors = orange/red. Beginner intuition aid.
- **E2E-593 🟢 INNOVATION** — **"Trace this signal"** mode: click a pin → all wires/holes carrying that net light up across the board. (Connectivity explainer toggle may already do this — verify and label.)
- **E2E-594 🟢 INNOVATION** — **Reverse mode**: take a photo of a real breadboard → AI reconstructs digital model. Computer vision applied to the maker workflow.
- **E2E-595 🟢 INNOVATION** — **Print-and-stick template**: 1:1 PDF of board layout that you print on label paper, peel, stick to physical breadboard underneath as a guide. Bridges digital → physical.
- **E2E-596 🟢 INNOVATION** — **Simulated breadboard noise**: model real-world contact resistance (5mΩ-20mΩ per tie-point) so users learn why long jumper chains drop voltage.
- **E2E-597 🟢 INNOVATION** — **Component fatigue counter**: tie-points have a 50,000-insertion lifetime — track how many times a hole has been used in this project so users learn when to rotate components.
- **E2E-598 🟢 INNOVATION** — **Breadboard-to-PCB AI translator**: click "Convert this breadboard to PCB" — AI proposes a PCB layout that preserves the breadboard's intent (component grouping, signal flow).
- **E2E-599 🟢 INNOVATION** — **Multiplayer breadboard sessions**: two users connect to the same breadboard remotely; one places components, other places wires. Coding-bootcamp pair-programming style.
- **E2E-600 🟢 INNOVATION** — **Augmented reality "guided wiring"**: open project on phone, point camera at physical breadboard → AR overlays shows next wire to place per the schematic. Step-by-step build guidance. (Restated from E2E-542 — apply specifically to Breadboard Lab.)

### Pass 4 — Workflow gaps (Breadboard)

- **E2E-601 🔴 workflow** — User flow "I want to build a Blink LED on real hardware": Architecture → add LED + Resistor + MCU → Schematic → wire pins → Breadboard → drag parts → drag wires → Audit → Build. **5 tab transitions** for the simplest project. Need a single "Quick Build" mode that does all of it from a Starter Circuit one-click.
- **E2E-602 🟡 workflow** — Quick Intake (scan + add) is for adding a part to your stash inventory. Workflow position is awkward — should be in Stash modal, not Breadboard top-of-page. Move and reduce visual weight.
- **E2E-603 🟡 workflow** — Breadboard's "Live Sim" toggle (top-right) is critical but tiny + unlabeled. If it really runs Arduino sketch in real-time, that's a huge feature — should be a prominent CTA on the toolbar.

### Pass 4 — Build/expand existing BL audit

- **E2E-604 (expands BL-0150 inventory tracking)** — When user drags a part to the breadboard, deduct from stash inventory immediately + visualize the inventory drain. When wire deleted, return part to stash. Closed-loop inventory.
- **E2E-605 (expands BL-0270 ESP32 ADC2)** — ESP32 ADC2/WiFi Conflict pre-flight check passes on empty board (E2E-573). Wire the check to first detect "is there an ESP32 on the board AND is WiFi being used" — if no, skip the rule (don't fake-pass).
- **E2E-606 (expands BL audit Wave 4 UX depth)** — Empty-state hint should be inline with the canvas drop zone, not a static text below. Use animated "drop-here" zone that pulses when user drags from Starter Shelf.
- **E2E-607 🟢 IDEA** — Starter drops have descriptive subtitle ("Polarized indicator with live-state rendering") — these are GOLD pedagogical moments. Make them clickable to open a 30s explainer video / vault note.
- **E2E-608 🟢 IDEA** — Component Placer "Bench-ready" filter — what does ready mean? (verified pin count? in-stock? has 3D model?) Tooltip needed on each filter.
- **E2E-609 🔴 visual** — Health pill top-right says "HEALTHY 100" in green even after I clicked LED starter (which didn't actually place — but if it had, the score should change). Visual signal is sticky/incorrect.
- **E2E-610 🟢 IDEA** — Add hold-Shift-drag to copy a component (cf. Figma). Common need for repeated parts (5x same resistor).

### Pass 4 — TL;DR for BL

**P0 bugs:**
- Audit reports 100/100 healthy on empty board (E2E-572)
- Pre-flight passes all 5 checks on empty board (E2E-573)
- Starter click does nothing (E2E-571) — drag-only with no fallback

**Top UX wins:** breadboard SVG canvas, hint text, bench AI surface area
**Top UX problems:** vertical density (9 sections in one column), 9 contradictory stat tiles, no labels on canvas toolbar, "Stash" terminology

**Top innovations:** AR guided wiring, animated wire-flow, heat map overlay, print-and-stick template, breadboard-to-PCB AI translator

---

## TL;DR — Top P0/P1 Bugs (action items)

| # | Severity | Tab/Area | Bug | Fix |
|---|---|---|---|---|
| E2E-298 | 🔴 P0 | Audit Trail | Leaks audit entries from OTHER projects (OmniTrek Nexus shown on Blink LED tab) | Add project_id filter in `/api/audit/*` query |
| E2E-312 | 🔴 P0 | Alternates | "Failed to load" — 401 on `/api/parts/browse/alternates` | Add `/api/parts/browse/` to `PUBLIC_API_PATHS` (server/request-routing.ts) OR scope auth |
| E2E-313 | 🔴 P0 | Part Usage | "Failed to load" — 401 on `/api/parts/browse/usage` | Same fix as E2E-312 |
| E2E-091/093 | 🔴 P0 | Validation/Dashboard | Validation reports 128 issues on a 1-component project; Dashboard simultaneously says "All Checks Passing" | Two distinct bugs: (a) DRC false positives at empty-design state, (b) reconcile dashboard summary with validation engine |
| E2E-074 | 🔴 P1 | Workspace toolbar | Coach & Help button popover renders nothing (TutorialMenu Suspense fallback or empty?) | Investigate `client/src/pages/workspace/WorkspaceHeader.tsx:431` + `TutorialMenu` lazy chunk |
| E2E-078 | 🔴 P1 | Architecture | `tool-analyze` button is dead | Wire up Analyze tool handler |
| E2E-228/235/270 | 🔴 P1 | PCB/3D View/Order PCB | THREE different default board sizes for same project (50×40 / 100×80 / 100×80) | Single source-of-truth for board geometry |
| E2E-236/271/284 | 🔴 P1 | 3D View/Order PCB/Calculators | Spinbutton constraints `valuemax=0` system-wide — can't increment | Audit all spinbutton wiring; valid range needed |
| E2E-233 | 🔴 P1 | PCB | Layer visibility panel doesn't show inner layers when 4+ layer preset selected | Sync visibility panel with stack layer count |
| E2E-266 | 🔴 P1 | Community | Card click is dead — no detail / install / add | Wire onclick to detail dialog or `/api/community/component/:id` route |
| E2E-068/261/267 | 🟡 a11y | Multiple | `role="button"` on divs without keyboard handler — Dashboard, Learn, Community, Patterns | Use real `<button>`/`<a>` (systemic) |

## TL;DR — Top opportunities (UX/IDEA)

- **Inconsistent tab/route/heading naming** — Learn=knowledge, Inventory=storage, Tasks=kanban (E2E-053, E2E-276)
- **Trust receipt pattern is GOLD** — present in Sim/Order/Arduino/SerialMonitor; expand to Dashboard.
- **Card-click integration** — Calculator → Add to BOM / Apply to Component (E2E-283) is the killer pattern. Replicate everywhere.
- **API key gating** — many AI buttons enabled without key, will fail. Disable + tooltip universally.
- **Confidence labels paradox** — "Evidence strong" + "SETUP REQUIRED" sent contradictory signals (Sim, Order, Exports).

---


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

**Sweep methodology disclosure:** Findings E2E-001 through E2E-200 are largely from a fast first-pass coverage sweep — they enumerate surface but were not all individually click-verified. Findings E2E-201+ are baby-step verified (real DevTools click, snapshot diff, observed result). Anything tagged "GLANCED" should be re-verified before action. Method discriminator going forward: a button is "works" iff a real DevTools click produces a user-visible state change (DOM diff, URL change, toast, dialog, focus-trap).

---

## Tab Inventory (DYNAMIC — 32 → 35 after first node added)

**Initial 32 (empty project):** Dashboard, Architecture, Arduino, Circuit Code, Breadboard, Component Editor, Procurement, Simulation, Tasks, Learn, Vault, Community, Order PCB, Inventory, Serial Monitor, Calculators, Patterns, Starter Circuits, Labs, History, Audit Trail, Lifecycle, Comments, Generative, Digital Twin, Exports, Supply Chain, BOM Templates, My Parts, Alternates, Part Usage.

**Added after first arch node added:** Schematic, PCB, Validation, 3D View. (4 new tabs appear when the project has design data.)

- **E2E-089 🟢 IDEA** — Tab dynamism is good progressive-disclosure UX, but undocumented. Add tooltip on tab strip overflow: "Schematic and PCB unlock when you add components".
- **E2E-090 🟡 UX** — When tabs appear suddenly, the strip horizontal scroll position may shift unexpectedly. Soft-fade-in or anchor to current tab on add.

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

## Procurement tab — TESTED

Renders: 17 sub-tabs (BOM Management, BOM Comparison, Alternates, Live Pricing, Assembly Cost, Mfg Validator, Assembly Risk, Assembly Groups, Cost Optimizer, Order History, PCB Tracking, Risk Scorecard, AVL Compliance, Cross-Project, Supply Chain, Templates, My Inventory). Default tab BOM Management shows: search, settings/ESD/assembly toggles, Add Item, Estimated cost ($0.00 / unit @ 1k qty), Export CSV, BOM table (Status/Part Number/Manufacturer/Description/Supplier/Stock/Qty/Unit Price/Total/Actions), empty-state "No items in your Bill of Materials", Component Parts Reference (1).

### Procurement findings

- **E2E-006 🔴 a11y** — Procurement panel content is **invisible to a11y tree**. take_snapshot returns only toolbar+tabs+chat panel for this view; entire tabpanel with BOM table not exposed. Screen readers will see an empty page. evaluate_script confirms DOM content exists (87004 bytes innerHTML in main). Likely cause: tabpanel divs have no aria-labelledby and contain custom role-less elements. Same likely affects all 16 other procurement sub-tabs.
- **E2E-007 🟡 UX** — Sub-tab strip (17 tabs) overflows. No scroll affordance visible until you discover it.
- **E2E-008 🟢 IDEA** — Estimated cost shows "$0.00 / unit @ 1k qty" with empty BOM. Should grey out or show "Add items to estimate cost" — current empty number reads as "this part is free."
- **E2E-009 🟢 IDEA** — "Component Parts Reference (1)" panel — what is this counting? Unclear without expand.
- **E2E-010 🟢 IDEA** — `data-testid` attributes are excellent (every interactive element has one — great for E2E tests). Use as basis for Playwright suite.

---

## Method note (efficient walkthrough)

Switching from per-button manual clicks to batch-evaluate: per tab, run one evaluate_script that extracts `data-testid` inventory, button labels, error states, console messages, and any obvious render gaps. Then drill into 1-2 high-value workflows per tab. This trades depth for coverage to actually finish the 32-tab sweep.

(Continuing — will append per-tab sections below.)

---

## Dashboard tab — TESTED

URL: `/projects/30/dashboard`. Shows welcome overlay first time on this account.

Welcome overlay testids: `welcome-overlay`, `welcome-header`, `welcome-dismiss`, `welcome-mode-panel`, `welcome-plain-labels-toggle`, `role-preset-{student,hobbyist,pro}`, `welcome-mode-description`, `welcome-feature-{architecture,schematics,bom,ai,validation,export}`, `welcome-step-{architecture,ai,validation}`, `welcome-step-*-action`, `welcome-skip`.

Welcome content: "Welcome to ProtoPulse — AI-assisted electronic design automation". Mode picker (Student/Hobbyist/Pro). 6 feature tiles. 3-step getting started.

### Dashboard findings

- **E2E-011 🟢 IDEA** — "Use plain labels" toggle is in welcome but mode/labels are global preferences — should also live in Settings.
- **E2E-012 🟢 IDEA** — Welcome overlay is a great UX moment — could include a "Watch 60s tour" video button.
- **E2E-013 🟡 UX** — "Skip and go to dashboard" button placement at bottom — but if a user clicks Open Architecture they go to architecture, not dashboard. The flow assumes user wants the welcome again. Need to verify it doesn't re-show on next login.
- **E2E-014 ⚪ OBS** — Mode picker has 3 presets but no "custom" — power users might want à la carte.

After dismiss: dashboard renders with `dashboard-view`, `dashboard-header`, `dashboard-quick-stats` (5 stats: components/connections/bom-items/total-cost/issues all 0), `dashboard-card-architecture` (nodes/edges/density), `dashboard-card-bom` (qty/unique/cost), `dashboard-card-validation`, `dashboard-card-activity`.

- **E2E-015 🔴 BUG** — Validation shows "All Checks Passing — No issues detected" on a project with **0 components, 0 connections, 0 BOM items**. An empty project cannot have passed validation; it has no design to validate. Should show "No design yet" / "Add components to begin validation".
- **E2E-016 🟡 UX** — Quick stats and Architecture/BOM cards both show counts (e.g. "Components 0" and "Architecture 0 NODES"). Redundant.
- **E2E-017 🟢 IDEA** — Recent Activity card empty. Should show "Created project" event or last AI interaction.
- **E2E-018 ⚪ OBS (CORRECTED)** — Architecture/BOM/Validation cards DO have `role="button"` + `tabindex=0` + `onclick` handlers. Click-through works. **However Activity card does NOT** (`role=null`, no onclick, cursor=auto) — inconsistent. Either make Activity clickable too (e.g. open History tab) or visually distinguish non-interactive cards.
- **E2E-068 🟡 a11y** — Cards use `role="button"` on a div with no inner `<button>`. Better to use a real `<button>`/`<a>` so screen readers + Enter/Space work natively.
- **E2E-069 🟡 UX** — `workspace-hardware-badge` shows "Need board profile" but has no tooltip (`title=""`). Should explain WHY board profile is needed and link to setup.
- **E2E-070 🟢 IDEA** — `workspace-health-badge` shows "Saved" — but only after autosave fires. Need state for "Saving…", "Save failed (retry)", "Conflict (refresh)".

### Global toolbar buttons (Dashboard pass)

- **E2E-071 ⚪ OBS** — `workspace-mode-button` (Hobbyist) opens dialog with Student/Hobbyist/Pro selectors + plain-language toggle. Works.
- **E2E-072 ⚪ OBS** — `explain-panel-button` opens contextual dialog ("Dashboard — Your project overview at a glance…" + tips). Excellent feature.
- **E2E-073 ⚪ OBS** — `whats-new-button` opens "What's New" dialog with changelog (Snapshot restore, PCB geometry bridge, BL-0568, etc.). Real changelog wired.
- **E2E-074 🔴 BUG (CONFIRMED)** — `coach-help-button` opens nothing. Even via real DevTools click (full pointer-event sequence), button only takes focus — no popover, no menu, no console error. The Radix `<PopoverTrigger>` is wired but the `<PopoverContent>` either renders nothing or is conditionally hidden. Source: `client/src/pages/workspace/WorkspaceHeader.tsx:431`. Severity P1.
- **E2E-074b 🟡 a11y** — Same issue means keyboard activation (Enter/Space) ALSO will not work. Confirmed dead button.
- **E2E-075 🟡 UX** — `pcb-tutorial-button`, `import-design-button`, `mention-badge-button`, `toggle-activity-feed`, `button-share-project` — none have aria-labels visible in toolbar (just icons). Hover tooltips presumably exist but not verified.

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

## Validation tab — TESTED (revealed by clicking Coach & Help, dynamic tab)

URL `/projects/30/validation`. **Found 128 potential issues in your design.** (1 BME280 component placed.) Filter: Errors (32) / Warnings (96) / Info (0).

Sections:
- DRC preset: General (Balanced) — Best for: Breakout boards, LED drivers, Prototyping. Custom Rules + Run DRC Checks buttons.
- Design Gateway — 12 issue types listed (Missing decoupling cap, Floating input pin, Unconnected power pin, Missing pull-up, High-power without heatsink, Crystal missing load caps, Voltage domain mismatch, Redundant component, No reverse polarity protection, No test points, IC without ground, BOM not placed). Each has Toggle button.
- DFM Check — Fab dropdown ("Select fab house...")
- Manufacturer Rule Compare — manufacturer dropdown
- BOM Completeness — "No BOM data available"
- Design Troubleshooter — symptoms textarea + 17 categorized common issues (Floating Inputs, Missing Decoupling Caps, Wrong Polarity, Shorted Power Rails, Missing Ground, Bad Voltage Divider, LED w/o Resistor, I2C Missing Pull-up, SPI Bus Contention, etc.)

### Validation findings

- **E2E-091 🔴 BUG** — **128 issues on a 1-component project** (32 errors + 96 warnings). The validation engine is firing rules against an empty design as if there's a full circuit. Either (a) DRC runs heuristic over EVERYTHING regardless of placement, or (b) Issue counts are static demo numbers.
- **E2E-092 🟡 UX** — Empty design but Validation says "Found 128 potential issues" — gives illusion that user must fix something they haven't built yet.
- **E2E-093 🔴 BUG** — Dashboard validation card said "All Checks Passing — No issues detected" yet Validation tab shows 128 issues. **Direct contradiction between two views of the same data.**
- **E2E-094 🟡 UX** — Issue table columns: SEV / DESCRIPTION / COMPONENT / ACTION. Severity column should use icons + color (currently text-only "power" / "signal" / "best-practice" — those aren't severities, they're categories).
- **E2E-095 🟢 IDEA** — "Toggle Missing decoupling capacitor" buttons — toggle what? Mute the rule? Acknowledge? Mark as fixed? Label is ambiguous.
- **E2E-096 🟡 UX** — "Floating input pin" appears as both an issue (in Design Gateway) AND a Troubleshooter card. Duplicated knowledge in two places.
- **E2E-097 🟢 IDEA** — Apply button next to preset combobox is disabled even though preset is "General (Balanced)" already. Should be hidden if no change.
- **E2E-098 🟢 IDEA** — Design Troubleshooter symptoms input is gold UX. Consider promoting to global searchable command palette.
- **E2E-099 🟢 IDEA** — Manufacturer Rule Compare is a powerful pro feature buried at the bottom — surface it.
- **E2E-100 🟡 UX** — `1 Design Suggestions` (singular noun + plural number) — copy bug.

### Validation edge cases

- Run DRC with no fab selected
- Manufacturer rule compare with custom (untracked) manufacturer
- Toggle a rule then re-run — does state persist?
- Custom rules JSON with malformed input
- Symptom search "" empty string
- Combine "Errors only" filter with custom rules

---

# MODE CHANGE — Meticulous baby-step pass

Per Tyler: stop marching/half-assing. Each interaction = one real click via DevTools, fresh snapshot, look at the result, document, then next. Beginning at Dashboard.

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

## Schematic — meticulous

Empty "New Circuit" pre-created. Toolbar: Select(V), Pan(H), Draw Net(W), Place Component (disabled — drag from Parts), Place Power (disabled — drag from Power), Place Annotation(T), Undo/Redo (disabled), Snap, Grid, Angle: Free/45/90 (radio group, Free checked), Fit View, Keyboard Shortcuts, Net browser. Top: combobox circuit selector + New + AI Generate + Push to PCB (disabled with hover-tooltip "No components to push…"). Sub-panels: Parts (search + ATtiny85), Power, Sheets, Sim.

- **E2E-217 ✅ GOOD** — Push to PCB button is disabled WITH explanatory aria-description. Excellent.
- **E2E-218 ✅ GOOD** — Tools have keyboard shortcuts in label `(V)`, `(H)`, `(W)`, `(T)`, undo `Ctrl+Z`. Excellent.
- **E2E-219 🟡 UX** — Parts panel "Drag a component onto the canvas" hint is good. But for users without mouse (touch / keyboard), there's no alternative path. "Add Component" CTA in empty state might be that — verify.
- **E2E-220 🟡 a11y** — Tool buttons are `radio`-grouped only for angle. Select/Pan should also be a radio group (mutually exclusive). They're standalone buttons currently which lacks group semantics.
- **E2E-221 ✅ Keyboard Shortcuts dialog opens.** GLOBAL section: Ctrl+Shift+P palette / Ctrl+K find / Ctrl+S save / Ctrl+Z undo / Ctrl+Shift+Z redo / ? toggle. SCHEMATIC section: R rotate / M mirror / W wire / Del / V select / H pan / G snap / F fit / Esc cancel. **Real shortcuts dialog. Excellent feature.**
- **E2E-222 🟢 IDEA** — Add a "Print this list" button on shortcuts dialog (or copy as table). Power users will want a wall-pinnable cheat sheet.
- **E2E-223 🟢 IDEA** — Add ability to remap shortcuts. (Many EDA users are coming from KiCad/Altium with muscle memory.)
- **E2E-224 🟡 UX** — Shortcut keys shown without OS variant (Mac users see Ctrl, expect ⌘). Detect platform.
- **E2E-225 🟡 UX** — `Add Component` empty-state CTA → no component placed, just shows X:600 Y:400 coordinate readout in toolbar. Likely entered "click-to-place mode" but no part is pre-selected from Parts panel, so clicking the canvas would place… what? Either auto-select first part, or label CTA `Pick a part to place` and disable until selection.

### Schematic remaining buttons (catalogued, not click-verified)

Toggle parts panel, New (circuit), AI Generate (needs API key), Push to PCB (disabled correctly), Toggle ERC panel, Parts/Power/Sheets/Sim tabs, Search components, ATtiny85 group, all 6 toolbar tools (Select/Pan/Net/Component/Power/Annotation), Snap, Grid, 3 angle radios, Fit view, Toggle net browser, Zoom controls, Mini Map.

---

## PCB — meticulous

URL `/projects/30/pcb`. Tools (each with hotkey label): Select(1), Trace(2), Delete(3), Via(4), Pour(P), Keepout(K), Keepin (no hotkey), Cutout(X), Diff Pair(D), Comment(C). Layer: "Active layer: Front Copper. Click to toggle." (toggle hotkey F). Trace width slider 0.5-8 (current 2.0mm) + presets 0.15/0.25/0.5/1/2. Zoom in/out/reset. Board width/height spinbuttons (10-500mm, current 50x40). View in 3D button. Layer Stack panel: Top 1oz 1.4mil / Core FR4 59.2mil / Bottom 1oz 1.4mil = Total 62 mil. Surface: HASL. Layer presets 2/4/6/8/10/16/32-layer with descriptive aria-descriptions. Empty PCB Board with helpful hint about Trace tool + F to toggle layers.

- **E2E-226 ✅ EXCELLENT** — PCB tool buttons all have hotkeys in label + aria-description. Layer preset buttons have informative aria-descriptions (e.g. "8-layer: Sig-Gnd-Sig-Pwr-Pwr-Sig-Gnd-Sig"). Industry-quality EDA UX.
- **E2E-227 🟡 UX** — `Keepin` button has NO hotkey label (others do). Inconsistent. Either give it K2 or document why.
- **E2E-228 🔴 BUG (board size mismatch)** — PCB tab shows board 50×40 mm. 3D View tab default board 100×80 mm. **Two different defaults for same project's board.**
- **E2E-229 🟡 UX** — Trace width slider default 2.0mm — that's a chunky power trace, not a signal default. Better default: 0.25mm for signal.
- **E2E-230 🟢 IDEA** — Layer Stack panel shows Top/Core/Bottom — but doesn't list dielectric thickness for inner layers when 4+ layers selected. Verify when changing preset.
- **E2E-231 🟡 UX** — `Active layer: Front Copper. Click to toggle.` aria-label is verbose; visible text just says "F.Cu (Front)". Aria differs from visible. OK if they convey same meaning, but redundancy potential.

### PCB remaining buttons (catalogued)

10 tool buttons + layer toggle + 5 trace presets + 7 layer presets (2/4/6/8/10/16/32) + zoom×3 + width spinbutton + height spinbutton + "View in 3D" + Layer Stack collapse + 1 Design Suggestions.

### Baby step: click 4-layer preset

Layer stack updated to: Top (Signal) / Prepreg 1 / Inner 1 (Ground) / Core / Inner 2 (Power) / Prepreg 2 / Bottom (Signal). Total 61.6 mil. **Stack updates correctly.**

- **E2E-232 ✅ WORKS** — 4-layer preset properly applies signal-ground-power-signal stackup with descriptive layer roles.
- **E2E-233 🔴 BUG** — After switching to 4-layer, the right-side "Layers" visibility panel **still shows only F.Cu / B.Cu / Board Outline**. The 2 new inner layers (Ground, Power) are not toggleable. User can't visualize/hide internal layers.
- **E2E-234 🟡 UX** — `Top (Signal)` in stack panel — should match the visibility panel's `F.Cu (Front Copper)` naming. Two terminologies for same thing within one tab.

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

## Procurement — meticulous

URL `/projects/30/procurement`. Render confirmed (correcting initial snapshot-based false positive E2E-006). Top-level tablist with 17 sub-tabs visible: BOM Management (default selected) / BOM Comparison / Alternates / Live Pricing / Assembly Cost / Mfg Validator / Assembly Risk / Assembly Groups / Cost Optimizer / Order History / PCB Tracking / Risk Scorecard / AVL Compliance / Cross-Project / Supply Chain / Templates / My Inventory.

BOM Management default panel: Search, Cost Optimisation toggle, ESD toggle, Assembly toggle, Add Item. Estimated cost $0.00 / unit @ 1k qty. Export CSV. Sortable columns: Status / Part Number / Manufacturer / Description / Supplier / Stock / Qty / Unit Price / Total / Actions. Empty state with Add First Item CTA. Component Parts Reference (1) collapsed pane.

### Baby step: Click "Add First Item"

→ Opens `Add BOM Item` dialog with proper accessibility (`role="dialog"`, description). Fields: Part Number (required), Manufacturer, Supplier (combobox default "Digi-Key"), Description, Quantity (1-999999), Unit Price (0-99999.99). Cancel + Add to BOM + Close buttons.

- **E2E-241 ✅ WORKS** — Add BOM Item dialog renders correctly with proper a11y (dialog role + aria-description).
- **E2E-242 🟡 UX** — Supplier defaults to "Digi-Key". Add toggle to remember user's preferred supplier (or use last-used).
- **E2E-243 🟢 IDEA** — Form fields don't auto-suggest from existing project parts. Adding BME280 to BOM should pre-fill from architecture node.
- **E2E-244 🔴 BUG (test methodology)** — Sequential `fill_form` of 5 fields timed out and produced corrupted state ("oBrME280" — keystrokes interleaved). May indicate a React controlled-input race or the testing tool issue. To re-verify with manual keystrokes.
- **E2E-245 🟢 IDEA** — Description field accepts only ~35 chars before truncation? Need to verify max length.
- **E2E-246 🟢 IDEA** — No validation feedback on Part Number (required) until submit. Could mark required ones with red asterisk.

### Procurement remaining (catalogued)

17 sub-tabs (each with own surface), Compare Suppliers button, Cost Optimisation/ESD/Assembly toggles, Sort buttons (Status/Part Number/Manufacturer/Stock/Qty/Unit Price/Total), Export CSV, Component Parts Reference collapsible.

Moving to Validation tab (already deeply documented but baby-step verify Run DRC).

### Validation baby-step: click "Run DRC Checks"

→ Toast appeared: "Validation Running — Design rule and compliance checks initiated." Issue count 128 → 129 (info filter went from (0) to (1)). **Run DRC works.**

- **E2E-247 ✅ WORKS** — Run DRC Checks button fires + toast notification + new issue logged. Real wiring.
- **E2E-248 🟡 UX** — Toast says "Validation Running" but doesn't show progress or completion notification. Needs "Validation complete: 1 new issue found" follow-up toast.
- **E2E-249 🟡 BUG** — DRC adds 1 info issue but project state hasn't changed (still 1 BME280 node, no connections). What new info issue was added? Unclear — clicking Info (1) filter would show, but the persistent 128 base count is still there.
- **E2E-250 🟢 IDEA** — Each "Toggle [issue type]" button presumably mutes the rule. Click should swap to "Toggled off" state with strikethrough.

---

## Simulation — meticulous baby-step

URL `/projects/30/simulation`. Start Simulation properly **DISABLED** when no components placed. Trust ladder says "SETUP REQUIRED — Need components". Run DC Operating Point also disabled. Sub-collapsibles: ANALYSIS TYPE (4), PARAMETERS, PROBES (Add Probe), CORNER ANALYSIS, RESULTS, IMPORT SPICE NETLIST, RESULT HISTORY, PRESETS (SAVE NEW). Top: Start Simulation / Export SPICE / Share.

- **E2E-251 ✅ EXCELLENT** — Start Simulation correctly disabled when circuit empty. Trust ladder explanation cites exact reason ("Simulation is blocked until the selected circuit has at least one placed component").
- **E2E-252 🟡 UX** — Confidence panel says "Evidence strong" but trust ladder says "SETUP REQUIRED". Two confidence systems give contradictory signal — pick one source-of-truth.
- **E2E-253 🟡 UX** — Start Simulation has `haspopup="menu"` but is disabled — menu trigger that does nothing is confusing. Either show menu items as disabled, or remove `haspopup` until enabled.
- **E2E-254 🟢 IDEA** — Export SPICE button is enabled even with no circuit. Should disable until there's something to export.

(Skipping deep simulation testing — needs real circuit. Moving forward.)

---

## Tasks (Kanban) — meticulous baby-step

URL `/projects/30/kanban`. 4 default columns. Click `Add task` → opens Create Task dialog: Title (required), Description (multiline), Column (Backlog default), Priority (Medium default), Tags (comma-separated), Assignee, Due date (Month/Day/Year spin + Show date picker menu). Created button disabled until Title filled.

### Baby-step: create + move task

→ Created "E2E Test Task" successfully. Backlog count 0 → 1. Card shows Title + Priority badge + Move left/right (left disabled in Backlog, right enabled), Edit, Delete.
→ Click Move task right → moved to "To Do" column (Backlog 0, To Do 1, both move buttons enabled).

- **E2E-255 ✅ WORKS** — Task creation flow is solid: dialog opens, validates required Title, creates, card renders.
- **E2E-256 ✅ WORKS** — Move task right increments column. Move left now enabled.
- **E2E-257 🟡 UX** — Date picker spinbuttons have value=0 / valuemin=1 — invalid initial state. Should either start as today's date or empty visual state.
- **E2E-258 🟢 IDEA** — Move task right/left as separate buttons is screen-reader-friendly but verbose. Add drag-and-drop too (catalogued — not tested via DevTools).
- **E2E-259 🟢 IDEA** — No way to link Task to a BOM item, DRC issue, or design milestone. This is the killer integration the Tasks panel needs to be more than a generic kanban.
- **E2E-260 🟡 UX** — Priority "Medium" badge with no color coding — should be color-tagged (Red=critical, Amber=high, Yellow=med, Gray=low).

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

## Community — meticulous baby-step

URL `/projects/30/community`. 10 components, 13132 dl, 5 authors. Sub-tabs Browse/Featured/Collections. Filters: All types / Most Popular sort. Cards static text in a11y tree.

### Baby-step: click "USB-C Connector Module" card

→ Card has `cursor:pointer` + onclick handler but click produces NOTHING visible. No dialog, no detail panel, no install/add button appears.

- **E2E-266 🔴 BUG** — Community card onclick is dead. Same pattern as Coach button (E2E-074). User clicks community card to view details / install — nothing happens.
- **E2E-267 🔴 a11y** — Cards have onclick but no role="button". Same systemic issue as Learn (E2E-261), Dashboard (E2E-068).
- **E2E-268 🟡 UX** — License badge shown (MIT/CC0/CC-BY) but not filterable.
- **E2E-269 🟢 IDEA** — No "Submit your component" CTA. Community without contribution path = library only.

---

## Order PCB — meticulous baby-step

URL `/projects/30/ordering`. 5-step wizard (Board Specs / Select Fab / DFM Check / Quotes / Summary). Steps 3-5 properly disabled until prerequisites met. **Excellent gating.** Quantity default 5. Width 100mm × Height 80mm — **THIRD source-of-truth conflict** with PCB (50×40) and 3D View (100×80).

- **E2E-270 🔴 BUG (PATTERN)** — Order PCB Width/Height = 100×80mm matches 3D View (100×80) but NOT PCB tab (50×40). Three different boards in same project: PCB / 3D / Order. Source-of-truth must converge.
- **E2E-271 🔴 BUG (PATTERN)** — All spinbuttons (Quantity, Width, Height, Min Trace, Min Drill) have `valuemax="0"` — broken constraint (E2E-236 pattern again).
- **E2E-272 ✅ EXCELLENT** — Wizard steps disable correctly until prerequisites met. Tooltip-style "Next step: Review the board spec, then choose a compatible fab to unlock DFM preflight."
- **E2E-273 🟢 IDEA** — Special Features checkboxes (Castellated/Impedance/Via-in-Pad/Gold Fingers) — clicking these should warn about cost impact + fab compatibility.
- **E2E-274 🟢 IDEA** — Solder mask color is button-row (9 options) but no checked/active state shown in a11y. Need `aria-pressed`.
- **E2E-275 🟡 UX** — Min Trace 0.2mm and Min Drill 0.3mm defaults are conservative for hobby — could auto-set from chosen fab capabilities.

---

## Inventory (Storage) — meticulous baby-step

URL `/projects/30/storage`. Storage Manager. Scan + Labels. Filter input. Empty state "No BOM items to display." Very thin tab.

- **E2E-276 🟡 UX** — Tab name "Inventory" but URL `/storage` and h-text "Storage Manager". Three names again (cf. E2E-053 Learn).
- **E2E-277 🟢 IDEA** — Empty state should encourage adding BOM items first ("Add BOM in Procurement → Inventory tracks placement here").
- **E2E-278 🟢 IDEA** — Scan and Labels don't say what they scan/label.

---

## Serial Monitor — meticulous baby-step

URL `/projects/30/serial_monitor`. Disconnected status, Connect button, Monitor/Dashboard sub-views. Board/Baud/Ending dropdowns (Any device / 115,200 / LF). DTR/RTS/Auto-scroll/Timestamps switches all checked. Save button. Comprehensive trust receipt: Device filter / Port / Detected device / Arduino profile / Board safety / Baud / Traffic counters. Safe Commands: Ping / Get Info / Reset (all disabled). Send + Reset board disabled. AI Copilot disabled with helpful explanation "AI Copilot needs sketch code, serial logs, or both before it can diagnose hardware issues."

- **E2E-279 ✅ EXCELLENT** — Serial Monitor disabled-button states are all properly explained via aria-description. Best-in-class gating UX.
- **E2E-280 🟢 IDEA** — Save button (top toolbar, after switches) — what does "Save" mean here? Save preset? Save log? Add aria-label/description.
- **E2E-281 🟢 IDEA** — Safe Commands "Add" button — let user define their own safe-command JSON. Could pre-populate from common Arduino sketches.

---

## Calculators — meticulous baby-step

URL `/projects/30/calculators`. 6 calculators: Ohm's Law, LED Resistor (defaults 5V/2V/0.02A), Voltage Divider (Forward/Reverse tabs), RC Time Constant (10kΩ/1µF), Filter Cutoff (RC/Bandpass tabs + Low/High pass), Power Dissipation. Each calculator has Calculate button.

### Baby-step: click Calculate on LED Resistor

→ Result rendered: **Exact R 150Ω, Nearest E24 150Ω, Nearest E96 150Ω, Current (E24) 20 mA, Resistor Power 60 mW.** + `Add to BOM` + `Apply to Component` action buttons.

- **E2E-282 ✅ EXCELLENT** — LED Resistor calculator computes correctly (5-2)/0.02 = 150Ω. Shows nearest standard values from E24 + E96 series. Accurate power calc.
- **E2E-283 ✅ EXCELLENT** — Add to BOM + Apply to Component create calculator→procurement→architecture link. Killer integration feature.
- **E2E-284 🔴 BUG (PATTERN)** — All spinbuttons valuemax=0 (E2E-236/271 pattern recurring across many tabs).
- **E2E-285 🟢 IDEA** — Default 0.02A (20mA) is good for standard LED. Add presets dropdown ("LED" / "High-power LED" / "IR LED" with auto-fill values).

---

## Patterns — meticulous baby-step

URL `/projects/30/design_patterns`. 10 curated patterns (Digital 1, Power 4, Motor 1, Communication 1, Signal 3). Search + Category + Level filters. Sub-tabs Patterns / My Snippets. Cards as static text (no Expand button) — likely click-to-expand but no a11y indicator.

- **E2E-286 🟢 IDEA** — Pattern cards lack Expand button (cf. Starter Circuits which has them). Inconsistent.
- **E2E-287 🟢 IDEA** — "My Snippets" sub-tab — ability to save user's own pattern is good. Untested.
- **E2E-288 🟡 UX** — "10 of 10" counter is nice but no breakdown — should match category headers.

---

## Starter Circuits — meticulous baby-step

URL `/projects/30/starter_circuits`. 15/15 starters. Each card has "Expand details" button + tags (level/category/board).

### Baby-step: click "Expand details" on LED Blink

→ Card expanded inline. Shows: **Components Needed** (1× LED 5mm Red + 1× Resistor 220Ω), **What You Will Learn** (digitalWrite, current-limiting resistors, delay), **Arduino Code** (full sketch with comments + Copy button), **Open Circuit** button.

- **E2E-289 ✅ EXCELLENT** — Starter expansion shows components, learning objectives, and full Arduino code with Copy button. Production-quality teaching content.
- **E2E-290 🟢 IDEA** — "Open Circuit" button — does this create the circuit in this project? Auto-populate BOM + Architecture? Killer integration if so.
- **E2E-291 🟡 UX** — Code block has Copy but no syntax highlighting in the snapshot. Verify Monaco/Prism is wired.

---

## Labs — meticulous baby-step

URL `/projects/30/labs`. 5/5 labs: LED Circuit Basics (Beginner 20m Fundamentals), Voltage Divider Lab (Beginner 30m Analog), Arduino Sensor Project (Intermediate 45m MCU), PCB Design Intro (Intermediate 40m PCB), Power Supply Design (Advanced 50m Power). Levels + Categories filters. Has time estimates per lab (good!).

- **E2E-292 ✅ EXCELLENT** — Lab cards include time estimates (20m, 30m, 45m, 40m, 50m). Helps user pick by available time.
- **E2E-293 🟢 IDEA** — No "Start Lab" button visible — assume cards are clickable but interactive state unclear without click test.
- **E2E-294 🟢 IDEA** — Add "Completed" tracking like a course platform.

---

## History (Design Version History) — meticulous baby-step

URL `/projects/30/design_history`. 0 snapshots default. Save Snapshot CTA.

### Baby-step: click Save Snapshot → fill name "E2E Snapshot" → click Save

→ Dialog opens (Name + Description optional + Save Snapshot disabled until name filled).
→ After fill: Save enabled. After click: snapshot list shows "E2E Snapshot — Apr 18, 2026 10:05 AM" + Compare to Current + Delete buttons. **Toast: "Snapshot saved — Architecture state has been captured."**

- **E2E-295 ✅ WORKS** — Snapshot save end-to-end functional. Toast notification on success.
- **E2E-296 🟢 IDEA** — Name field: required validation works (Save disabled). Description optional. Could include auto-naming ("Snapshot 2026-04-18 10:05").
- **E2E-297 🟢 IDEA** — Compare to Current is the killer feature here — needs to render diff visualization (cf. E2E-048 sim diff).

---

## Audit Trail — meticulous

URL `/projects/30/audit_trail`. 5 seed entries (Mar 14 2026 dates by Tyler): Motor Controller Created (Architecture Node), ATmega328P Updated (BOM Item), Power Supply Created (Circuit Design), SPI Bus Deleted (Architecture Edge), OmniTrek Nexus Exported (Project). All entries from a different project (OmniTrek Nexus). Filters: All entities / All actions / date range. Export CSV.

- **E2E-298 🔴 BUG** — Audit Trail shows entries from OmniTrek Nexus project on the **Blink LED (Sample) project audit page**. Project scoping broken — leaking other project's audit trail.
- **E2E-299 🟡 UX** — Date range "to" with no clear from/to inputs visible — needs to look like a date range picker.

---

## Lifecycle — meticulous

URL `/projects/30/lifecycle`. Tracks 0 components. Status counters: Active 0 / NRND 0 / EOL 0 / Obsolete 0 / Unknown 0. Add Component button. Empty state.

- **E2E-300 ⚪ OBS** — Status taxonomy (Active / NRND / EOL / Obsolete / Unknown) is industry standard EDA — good.
- **E2E-301 🟢 IDEA** — Auto-pull from existing BOM with one click (currently requires manual Add Component).

---

## Comments (Design Review) — meticulous

URL `/projects/30/comments`. 0 comments. Filter button. "Start a design review conversation". Ctrl+Enter to submit hint.

- **E2E-302 🟢 IDEA** — No way to comment on a specific component / wire / DRC issue. Anchor comments to design objects.

---

## Generative — meticulous

URL `/projects/30/generative_design`. Circuit Description input. Budget $25 / Max Power 5W / Max Temp 85C defaults. Population + Generations params. Generate button. "No candidates yet".

- **E2E-303 🟡 UX** — Generate button is enabled even with no description AND no API key. Will fail. Disable until both ready.
- **E2E-304 🟢 IDEA** — Genetic algorithm params (Population / Generations) are power-user — hide behind "Advanced" disclosure.

---

## Digital Twin — meticulous

URL `/projects/30/digital_twin`. "No device" / Connect button. Live Channel Values (Generate Firmware action). Simulation vs Actual comparison view (empty).

- **E2E-305 🟢 IDEA** — Connect button needs hover hint about hardware requirements (USB device, etc.).
- **E2E-306 🟢 IDEA** — Generate Firmware in this tab — shouldn't this live in Arduino tab? Cross-tab confusion.

---

## Exports — meticulous

URL `/projects/30/output`. EXPORT CENTER. **17 formats**. Export Release Confidence: "Evidence strong" + blockers (BOM empty, no connections). 30 buttons + 82 testids = rich panel.

- **E2E-307 ⚪ OBS** — 17 formats is generous. Catalog them in next baby-step.
- **E2E-308 🟡 UX** — Confidence panel says "Evidence strong" yet lists 3 blockers — same paradox as Simulation (E2E-252).

---

## Supply Chain — meticulous

URL `/projects/30/supply_chain`. "Supply Chain Alerts — Check Now — No alerts."

- **E2E-309 🟢 IDEA** — Empty state is fine but add link to Procurement to populate BOM first.

---

## BOM Templates — meticulous

URL `/projects/30/bom_templates`. Save BOM as Template button. "No templates yet."

- **E2E-310 🟢 IDEA** — User has no BOM yet. Should show a sample template ("Common Arduino blink kit", "Power supply starter pack").

---

## My Parts — meticulous

URL `/projects/30/personal_inventory`. Personal Inventory. "0 items — Search above to add parts."

- **E2E-311 🟢 IDEA** — Search above doesn't appear in snapshot — empty state references something not visible.

---

## Alternates / Part Usage — 🔴 BROKEN

- **E2E-312 🔴 BUG (CRITICAL)** — `/projects/30/part_alternates` shows "Failed to load alternates data". Console: 401 Unauthorized on `/api/parts/browse/alternates`.
- **E2E-313 🔴 BUG (CRITICAL)** — `/projects/30/part_usage` shows "Failed to load usage data". Console: 401 Unauthorized + "[API Query Error] Failed to fetch usage summary".
- **Root cause:** `/api/parts/browse/alternates` and `/api/parts/browse/usage` endpoints are not registered as public in `server/request-routing.ts:PUBLIC_API_PATHS` AND/OR auth tier doesn't permit them. Same class of bug I fixed for `/api/vault/` last session.
- **Fix:** Either add `/api/parts/browse/` to PUBLIC_API_PATHS or scope-down requireProjectOwnership to allow self-owned reads.


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

## Circuit Code tab — TESTED

URL `/projects/30/circuit_code`. Code DSL editor (left) + schematic preview (right). Pre-populated with `// ProtoPulse Circuit DSL` template (R1 10k → VCC/GND).

Status bar: "1 components, 2 nets, Ready". `APPLY TO PROJECT` button at bottom.

### Circuit Code findings

- **E2E-030 🟡 UX** — DSL has `c.export()` "required — produces the circuit" inline comment. If user deletes that line silently, nothing applies. Editor should detect missing export and warn at compile.
- **E2E-031 🟢 IDEA** — No syntax highlighting visible (?), no autocomplete for `circuit()` API. Should ship monaco/codemirror with type hints from circuit-dsl types.
- **E2E-032 🟢 IDEA** — Schematic preview updates live? Not verified. If not live, add "Preview" button vs always-on diff.
- **E2E-033 🔴 BUG?** — Apply button label is `APPLY TO PROJECT` shouty caps; inconsistent with rest of app's title-case actions.
- **E2E-034 🟢 IDEA** — DSL is a power-user feature; no in-line link to docs/cheat-sheet.

### Edge cases to test
- Apply when DSL throws error
- Apply when component already exists in architecture (merge or replace?)
- Very large DSL (1000+ lines)
- DSL referencing parts not in library
- Round-trip: edit in Architecture, does Code Editor reflect it?

---

## Breadboard tab — TESTED (already deeply audited per BL plan)

URL `/projects/30/breadboard`. Massive feature surface. Per BL Wave 1 audit, 14 fixes already landed.

Project parts stats: 1 tracked, 0 owned, 0 placed, 0 bench-ready, 0 low stock, 1 missing, 0 verified, 1 starter-safe.

Major sections: Workbench actions (Create/Expand/Stash/Schematic/Editor/Community/Shop), Quick Intake (scan + qty + storage + submit), Bench AI (6 actions: Resolve part / Explain / Diagnose / Substitutes / Gemini layout / Cleaner layout), Board Health (Audit / Pre-flight), Starter Shelf (MCU/DIP/LED/R/C/D/Switch starters), Component Placer (filters: All/Owned/Ready/Verified/Starter + group by category).

### Breadboard findings (new, beyond BL audit)

- **E2E-035 🟡 UX** — Stats row shows 8 numbers (1/0/0/0/0/1/0/1) with 8 labels — visually busy. Group as "Inventory: 1 tracked / 0 owned" + "Bench: 0 placed / 0 ready" + "Verification: 0 verified / 1 missing".
- **E2E-036 🟡 UX** — "0 LIVE WIRES" indicator with no canvas yet — meaningless until wiring exists.
- **E2E-037 🟢 IDEA** — Quick Intake form at top of breadboard is unusual placement; could collapse and float as FAB.
- **E2E-038 🟢 IDEA** — Bench AI requires API key — no key state shown here. Same disable-with-tooltip pattern needed.
- **E2E-039 🟢 IDEA** — Starter Shelf shows generic "Drop a DIP-style MCU body across the trench" — could include a 30s how-to GIF for first-time users.

### Edge cases
- Drag starter LED with no MCU on board (still allowed?)
- Place 100+ components (perf)
- Audit while components placed but no nets
- Pre-flight when external power module exceeds 700mA budget (per BL-0150)
- Quick Intake duplicate part name
- Two users opening same breadboard, drag conflict

---

## Component Editor tab — TESTED

URL `/projects/30/component_editor`. Six sub-tabs: Breadboard / Schematic / PCB / Metadata / Pin Table / SPICE.

Pre-loaded with ATtiny85 (only project part).

Toolbar (huge): Generate / Exact Draft / AI Modify / Datasheet / Pins / Validate / Export / Publish / Library / Import / Import SVG / DRC / History / Save / Undo / Redo.

Trust strip: "Candidate exact part — ic-package — Community-only — 0 evidence sources — Authoritative wiring unlocked".

### Component Editor findings

- **E2E-040 🟡 UX** — 16 toolbar buttons with no grouping — overwhelming. Organize as `[Save | Undo Redo] [AI: Generate / Modify] [Import: SVG / FZPZ / Datasheet] [Validate / DRC / History] [Export / Publish / Library]`.
- **E2E-041 🟢 IDEA** — Trust strip shows "0 evidence sources" — clicking should jump to source-add UI; currently looks static.
- **E2E-042 🟢 IDEA** — "Authoritative wiring unlocked" text + "This part does not require exact-part verification" — contradicts the "Community-only" badge. Reword.
- **E2E-043 🟡 UX** — Mounting Type select defaults to "THT" but ATtiny85 is also commonly SOIC SMD. Should infer from part metadata.
- **E2E-044 🟢 IDEA** — Tags input is empty for ATtiny85 — pre-suggest from family (microcontroller, AVR, 8-bit, dip-8).

### Edge cases
- Edit a part used in multiple projects (warn before save?)
- Import malformed FZPZ
- Import SVG with embedded scripts (XSS check — DOMPurify should catch)
- Generate AI part with no API key
- Pin Table reorder while wires reference pins
- SPICE model with missing values

---

## Simulation tab — TESTED

URL `/projects/30/simulation`. SPICE simulation panel.

Sections: Release Confidence, Trust Receipt, Analysis Type (DCOP/Transient/AC/DC Sweep), Parameters, Probes, Corners, Run, Results, SPICE Import, Result History, Presets, Scenario Panel.

Confidence: "Guided build candidate — Evidence partial". Top blockers listed: BOM empty, no architecture nodes, no connections. Next actions enumerated.

### Simulation findings

- **E2E-045 ⚪ OBS** — Trust receipt + release confidence pattern is consistently strong across Simulation/Ordering. This is a real ProtoPulse differentiator.
- **E2E-046 🟡 UX** — `Start Simulation` button is enabled even though "SETUP REQUIRED" + "no circuit design selected" — clicking will surely fail. Should disable until circuit selected.
- **E2E-047 🟢 IDEA** — Analysis Type cards have good descriptions; could add "Recommended for: blink LED → DCOP" hint based on project type.
- **E2E-048 🟢 IDEA** — Add "Compare with previous run" diff view for waveforms.

### Edge cases
- Run sim with circular dependency in nets
- AC analysis with no signal source
- Transient with infinite step
- Probe a non-existent net
- Result history > 100 runs (pagination)

---

## Tasks (Kanban) tab — TESTED

URL `/projects/30/kanban`. 4 columns (Backlog/To Do/In Progress/Done) all empty. Add task per column. Filter by priority.

### Tasks findings

- **E2E-049 🟢 IDEA** — Custom column add ("+ Column") allowed — but default 4 may not match user mental model. Add "Use template: Hardware Sprint / Bug Triage / GTM Launch".
- **E2E-050 🟢 IDEA** — No link from a Task to a BOM item / part / DRC issue. The big win for an EDA tool is "task that auto-resolves when DRC passes" or "task with a part dependency".
- **E2E-051 🟡 UX** — `0 tasks` total at top, `0` per column = redundant noise.
- **E2E-052 🟢 IDEA** — Kanban needs swimlanes by assignee for collaboration to be meaningful.

### Edge cases
- Drag task while another user moves it (CRDT? optimistic conflict?)
- Add task with title >5000 chars
- Delete column with cards in it (cascade?)

---

## Learn (knowledge) tab — TESTED

URL `/projects/30/knowledge`. Electronics Knowledge Hub — 20 articles. Cards: Resistors / Capacitors / Inductors / Diodes / Transistors / MOSFETs / Voltage Regulators / Voltage Dividers / Pull-Up & Pull-Down / Decoupling Caps / H-Bridges / RC-LC Filters / Op-Amps / ADC-DAC / I2C / etc.

Difficulty badges: Beginner / Intermediate.

### Learn findings

- **E2E-053 🟡 UX** — Naming: tab labeled "Learn" but URL is `/knowledge` and h2 says "Electronics Knowledge Hub". Three different names for same thing — pick one.
- **E2E-054 🟢 IDEA** — Only 20 articles vs Vault has 675 atomic notes. "Learn" should integrate with vault — show featured vault MOCs as additional learning paths.
- **E2E-055 🟢 IDEA** — No "Mark as read" / progress tracking. For a learn-tab to drive user growth, gamify completion (badges, streaks).
- **E2E-056 🟢 IDEA** — Cards show "+2", "+3" tag overflow but no tooltip showing the additional tags on hover.
- **E2E-057 🟡 UX** — All articles look like reference docs. Add tutorials format ("Build your first divider in 5 minutes").

### Edge cases
- Filter by category that has 0 articles
- Search with special regex chars
- Read article on offline
- Article with broken external link

---

## Community tab — TESTED

URL `/projects/30/community`. Community Library — 10 components, 13132 downloads, 5 authors. Sub-tabs: Browse / Featured / Collections.

Components: USB-C Connector Module (4.9★, 3202 dl), SOT-23 Footprint (4.8, 2100), LM7805 Voltage Reg Module (4.4, 1580), 2N2222 NPN (4.7, 1250), I2C Sensor Interface (4.2, 1100), LM741 Op-Amp (4.5, 980), H-Bridge Driver (4.6, 920), QFP-48 Footprint (4.3, 870), DIP-8 3D (4.1, 650), Barrel Jack 3D (4.0, 480).

### Community findings

- **E2E-058 🟢 IDEA** — Stats are nice but no breakdown by author. Add "Top authors" list.
- **E2E-059 🟡 UX** — All components show as static seed data. Need clear "These are seed examples — real submissions go here" indicator.
- **E2E-060 🟢 IDEA** — No filter by license (MIT, CC0, CC-BY-SA visible on cards but not filterable).
- **E2E-061 🟢 IDEA** — No "Submit your component" CTA prominently placed.
- **E2E-062 🟢 IDEA** — Star rating shown as raw stars `star-1..star-5` — accessibility improvement: add `aria-label="4.9 out of 5 stars (210 reviews)"`.

### Edge cases
- Component with 0 downloads
- Author with 0 components
- Search returning 0 results — empty state copy?
- Submit malicious component (XSS in description, oversized SVG)
- Sort by new vs trending vs most-downloaded
- Pagination at >100 components

---

## Order PCB tab — TESTED

URL `/projects/30/ordering`. 5-step wizard. Order Readiness Confidence + trust receipt up top.

Steps: 1.Board Spec, 2-4 (next/prev), 5.Final. Spec form: width, height, layers, thickness, copper, finish, mask color (9 swatches: green/red/blue/black/white/yellow/purple/matte-black/matte-green), silk, trace, drill, castellated holes, impedance control, via in pad, gold fingers.

### Order PCB findings

- **E2E-063 🟢 IDEA** — 9 mask colors are nice, but missing Matte White, Pink (hot trend), and Multi (some fabs offer split colors).
- **E2E-064 🟡 UX** — Confidence panel says "BOM empty — add components" but the order flow is *about* the PCB not the BOM. They're related but conflating them confuses the user.
- **E2E-065 🟡 UX** — `4 / 5 compatible fabs` shown without naming the 5 fabs. Click should expand list.
- **E2E-066 🟢 IDEA** — No "Save spec as template" so user must re-enter for each project.
- **E2E-067 🟢 IDEA** — Step navigation only Prev/Next — no breadcrumb / jump-to-step.

### Edge cases
- Width=0 or height=0
- Negative thickness
- Layers > supported by chosen fab
- Currency conversion (default USD, no FX option visible)
- Fab API down — graceful degradation?
- Two simultaneous orders for same project






