# Schematic Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve all Pass 1/2/10/11/12/12B Schematic findings — click-to-place fallback, net-name autocomplete during wire draw, live ERC, reference-designator auto-numbering, power-symbol annotation on VCC/GND pins, empty-state DOM leak (01 Phase 5), vestigial Place-Component/Place-Power buttons (02 Phase 8), populated-canvas corrections from Pass 12B — while preserving the hotkey-in-label best-in-class pattern and integrating with the Push-to-PCB / BOM-toast closed loops that the audit praised.

**Architecture:** 6 waves: (1) click-to-place parity with Architecture, (2) wire draw experience (net-name dropdown, live ERC squiggles, bus wires), (3) ref-designator auto-numbering + inline value edit + resistor color bands / cap body variants, (4) net spotlight + net browser dual-pane, (5) Pass 12B correction wave (reference vs part-name separation, power symbols, DOM empty-state cleanup), (6) multi-select + align tools + auto-tidy + cleanup.

**Tech Stack:** React Flow for schematic canvas (separate instance from Architecture), shadcn/ui toolbar primitives, Radix Dialog for Replace-With modal, Vault integration for pin-function tooltips (consumed from 07 Wave 6 pattern).

**Parent:** `00-master-index.md` Tier D. §3.1 routing of E2E-026-034, E2E-334-340, E2E-845-941, E2E-942-967 (Pass 12B corrections). Cross-owner on E2E-966 empty-state (both 01 Phase 5 narrow fix and 16 Phase 8 shared primitive). Innovations E2E-870-873 / E2E-905-914 / E2E-927-941 routed to `18-innovation-roadmap.md`.

**Tier:** D. **Depends on:** 01, 02, 03, 16, 17. **Blocks:** none (but `14-community-tasks-history.md` Comments feature pairs with pin-level commenting).

---

## Coverage

| Source | IDs | Count | Routing |
|--------|-----|-------|---------|
| Pass 1 | E2E-026-034 | 9 | owned |
| Pass 2 | E2E-334-340 | 7 | owned |
| Pass 10 | E2E-845-873 | 29 | owned except E2E-870-873 (→18) |
| Pass 11 | E2E-874-914 | 41 | owned except E2E-905-914 (→18) |
| Pass 12 | E2E-915-941 | 27 | E2E-915 (=E2E-849, via 02); owned through E2E-926; E2E-927-941 → 18 |
| Pass 12B | E2E-942-967 | 26 | owned (corrections applied in Wave 5) |
| Cross | E2E-221 (kbd shortcuts), E2E-225 (Add Component via 02), E2E-849/915 (vestigial via 02), E2E-856 (via 02), E2E-866-869, E2E-950/966 (via 01 + 03) | various | many already routed |

Detailed coverage TSV (Task 0): `coverage/06-schematic-coverage.tsv`.

## Existing Infrastructure (verified 2026-04-18)

| Concern | File | Notes |
|---------|------|-------|
| Schematic view | `client/src/components/views/SchematicView.tsx` | Main orchestrator |
| Schematic canvas | `client/src/components/schematic/*` (grep) | React Flow instance |
| Parts / Power / Sheets / Sim sub-panels | see audit surface inventory Pass 10 | Parts = component placer |
| Toolbar | Schematic-specific — hotkey-in-label best-in-class (E2E-865) | Wave 4 replicates this to net browser / ERC toggles |
| Empty state | `client/src/components/schematic/EmptyState.tsx` (grep) | Consumed/replaced per 01 Phase 5 + 16 Phase 8 |
| Push to PCB button | Dynamic gate confirmed (E2E-953) | Preserve |
| BOM auto-populate toast | Closed loop (E2E-954) | Preserve + replicate pattern per 16 Phase 5 |
| DRC engine | `server/services/drc/*` (fixed in 01 Phase 3) | Consume for Wave 2 live ERC |
| Net store | grep `useNets|nets\.state` | Wave 2/4 consumer |

## Research protocol

- **Context7** `reactflow` — `query-docs "custom edge labels + edge type metadata + stroke color per edge"`
- **WebSearch** "KiCad net naming convention + autoname rules" — informs Wave 2
- **WebSearch** "IEEE 315 power symbol glyphs (VCC, GND, +5V)" — Wave 5 Task 5.3
- **Context7** `@radix-ui/react-combobox` or `cmdk` — net-name autocomplete Wave 2
- **Codebase** `rg "reference|designator|auto.?number" client/src/components/schematic/`
- **Advisor** — before Wave 2 (ERC as-you-wire performance on 1000-wire designs), before Wave 5 (reference/value/part-name hierarchy).

## Waves

### Wave 1 — Click-to-place + toolbar polish (E2E-335, E2E-336, E2E-338, E2E-339, E2E-846-850, E2E-855, E2E-883-887, E2E-918-919)

- [ ] Task 1.1 — Remove zoom duplication (E2E-336, E2E-845): keep React Flow bottom-left controls; remove top-toolbar zoom.
- [ ] Task 1.2 — Sub-panel tabs prominence (E2E-339, E2E-846): upgrade tiny icon tabs to shadcn Tabs primitive (from 16) with clearer headings; rename `Sim` → `Simulation`.
- [ ] Task 1.3 — Toolbar grouping with dividers (E2E-848): Tools | Edit | View | Help.
- [ ] Task 1.4 — Click-to-place Parts (E2E-883, E2E-918): click part in placer → `enterPlaceMode(part)` → click canvas places. Same pattern as 07 Wave 3.
- [ ] Task 1.5 — Parts panel group header click filters (E2E-885, E2E-919): click "MICROCONTROLLER (1)" → filter list + `+` on header to add new part inline.
- [ ] Task 1.6 — Quick-place hotkeys (E2E-887): `R` resistor, `C` capacitor, `L` inductor (cf. KiCad). Gate behind Pro mode default or expose via Command Palette.
- [ ] Task 1.7 — Angle constraint visual + tooltip (E2E-850, E2E-878, E2E-917): active radio gets cyan border + mini diagram; unused radios show micro-preview on hover.
- [ ] Task 1.8 — New Circuit redundancy (E2E-335): remove duplicate "New" button; keep selector + name readout.
- [ ] Task 1.9 — Tests + commit.

### Wave 2 — Wire draw experience + ERC (E2E-874-882, E2E-894-896, E2E-922, E2E-955)

- [ ] Task 2.1 — Hotkey unification (E2E-612, E2E-874): decide global convention. Advisor: KiCad uses `W`. Breadboard currently `2`. Make both tabs support `W` + `2`.
- [ ] Task 2.2 — Net-name autocomplete dropdown during wire draw (E2E-876, E2E-916): above cursor, shadcn Combobox with auto-suggestions (VCC/GND/from pin function/NET17 fallback) + "Add new net name…" option.
- [ ] Task 2.3 — Wire color during sim (E2E-877): when simulation running, wire strokes reflect signal state (high=red, low=blue, hi-Z=dashed grey).
- [ ] Task 2.4 — Bus wire visualization (E2E-879): thick stroke for ribbon/SPI/I2C nets that carry >1 signal group. User right-click → "Convert to bus" / "Split bus".
- [ ] Task 2.5 — Net auto-name (E2E-880): on wire finalize, auto-name based on topology; offer inline rename.
- [ ] Task 2.6 — Net validator (E2E-881): warn when 2 wires same auto-name but different topology (split nets).
- [ ] Task 2.7 — Live ERC squiggles (E2E-896, E2E-922): yellow squiggle under floating input pins, red for shorts, updates during drag. Consumes the DRC engine (already empty-state-guarded in 01 Phase 3).
- [ ] Task 2.8 — Real-pointer wire-creation Playwright (E2E-955): like 07 Task 2.6.
- [ ] Task 2.9 — Tests + commit.

### Wave 3 — Reference designators, values, visual variants (E2E-892-893, E2E-920-921, E2E-944-945, E2E-958, E2E-888-891)

- [ ] Task 3.1 — Reference vs part-name separation (E2E-944-945): show "U1" as reference (bold, top of body) and "ATtiny85" as value label (small, below body). Component label in sidebar preserves full part name.
- [ ] Task 3.2 — Auto-number references (E2E-892, E2E-920): dropping 3 resistors auto-names R1, R2, R3. Smart-skip when deleted. `Tools > Renumber` batch reflow.
- [ ] Task 3.3 — Inline value edit (E2E-637, E2E-688, E2E-921): double-click → inline editor with unit autocomplete + E12/E24/E96 snap.
- [ ] Task 3.4 — Resistor color-band rendering (E2E-893): compute color bands for the current value, render on body.
- [ ] Task 3.5 — Capacitor body variants (E2E-893): electrolytic (polarized rectangular) vs ceramic (hemispheric) distinct.
- [ ] Task 3.6 — Auto-U2/R2/C2 on duplicate (E2E-958): verify behavior; add test.
- [ ] Task 3.7 — Rotate/Mirror/Delete keyboard (E2E-888): verify `R`/`M`/`Del` work; add Playwright e2e.
- [ ] Task 3.8 — Multi-select marquee + align tools (E2E-889-890): same pattern as 07 Wave 3.5 but for schematic canvas.
- [ ] Task 3.9 — Pin-by-pin labeling overlay (E2E-891, E2E-961-963): hover pin → HoverCard with pin name + net + voltage during sim + alternate functions.
- [ ] Task 3.10 — Tests + commit.

### Wave 4 — Net spotlight + net browser dual-pane (E2E-858, E2E-897-899, E2E-923-924)

- [ ] Task 4.1 — Net spotlight on wire click (E2E-897): all wires/pins on that net glow; right-click → "Select all instances of this net".
- [ ] Task 4.2 — Net browser dual-pane (E2E-898, E2E-924): toggle `schematic-toggle-net-browser` opens a sidebar with left=nets list / right=pins-on-selected-net. Filters: Floating / Multi-driver / VCC / GND / regex.
- [ ] Task 4.3 — Cross-probe to Breadboard/PCB (E2E-899): select schematic wire → 07 and 08 highlight corresponding wire/trace. Implement via shared `useSelectedNet()` hook.
- [ ] Task 4.4 — Net spotlight sim tooltip (E2E-923): during live sim, spotlight tooltip shows voltage + current + pin count.
- [ ] Task 4.5 — Tests + commit.

### Wave 5 — Pass 12B corrections + power symbols + DOM cleanup (E2E-942-967)

- [ ] Task 5.1 — Power-symbol annotation on VCC/GND pins (E2E-947): render `▲ 5V` / `⏚` (IEEE glyphs) next to power-role pins of every IC. Requires per-pin `role` metadata (VCC/GND/signal/analog/digital) in component library. Audit `server/services/component-library/`; extend schema.
- [ ] Task 5.2 — Toast auto-dismiss behavior (E2E-948): `Add U1 to BOM?` toast — 30s timeout → auto-dismiss + silently skip (NOT auto-add). User re-opens via BOM sub-tab.
- [ ] Task 5.3 — Empty-state DOM leak (E2E-950, E2E-966): owned by `01-p0-bugs.md` Phase 5 (narrow) + `16-design-system.md` Phase 4 (shared primitive) + `03-a11y-systemic.md` Phase 8. Migrate to the shared `<EmptyState>` primitive here.
- [ ] Task 5.4 — Duplicate hover-tooltip DOM remnant (E2E-951): grep DOM for duplicated ATtiny85 metadata; ensure single source of render.
- [ ] Task 5.5 — Empty-state "import existing design" CTA works (E2E-862, E2E-965): wire import button to file picker + SPICE/KiCad/Eagle parser router.
- [ ] Task 5.6 — Coordinate readout units (E2E-957): append `grid` or `mm` suffix.
- [ ] Task 5.7 — Drag-from-pin to start wire (E2E-959): without explicit wire-tool activation, pin hover-drag enters wire mode. Industry standard.
- [ ] Task 5.8 — Power-pin drag auto-creates power symbol (E2E-960): dragging wire from VCC pin, releasing over empty canvas, auto-creates power symbol at endpoint.
- [ ] Task 5.9 — Pin detail dialog (E2E-963): click pin NAME (PB0) → modal showing alternate functions (AIN0, MOSI, OC0A, PCINT0) from datasheet metadata.
- [ ] Task 5.10 — Tests + commit.

### Wave 6 — Tidy / cleanup / import/export / hierarchical sheets (E2E-925-926, E2E-860, E2E-863, E2E-902-903)

- [ ] Task 6.1 — Auto-tidy / cleanup action (E2E-925, E2E-905): button "Tidy" → reflow components left→right, minimize wire crossings. Use a simple force-directed layout or `d3-hierarchy`.
- [ ] Task 6.2 — Whiteboard sketch import (E2E-926): drop PNG behind canvas as tracing template.
- [ ] Task 6.3 — Hierarchical sheets verification (E2E-860, E2E-869): verify Sub-panel `Sheets` delivers KiCad-class hierarchy. Add tests.
- [ ] Task 6.4 — Unsaved-changes confirmation on New (E2E-863): if current circuit unsaved, prompt before creating new.
- [ ] Task 6.5 — Probe + tweak-and-watch placeholder (E2E-900-902): sub-panel Sim shows "Placeholder — full simulation via Simulation tab". Placeholder with deep link.
- [ ] Task 6.6 — Tray for unused parts (E2E-903): mirror 07 Wave 5 Task 5.1 bench tray.
- [ ] Task 6.7 — Drag-to-Architecture cross-tab (E2E-904): drag schematic instance → Architecture tab drops as new arch node (via shared drag data mime-type).
- [ ] Task 6.8 — Tests + commit.

## Team Execution Checklist

```
□ Prereqs merged: 01, 02, 03, 16, 17
□ npm run check                 ← zero errors
□ npm test                      ← all green
□ npx eslint .                  ← zero warnings
□ Playwright schematic-* specs pass (click-place, wire-draw real pointer, ERC live, net-browser, Pass 12B corrections)
□ Coverage TSV — every owned E2E-XXX has a test or commit ref
□ advisor() called ≥3× (pre-Wave 2 ERC perf, pre-Wave 5 reference hierarchy, pre-final-merge)
```

## Research log

- Context7 `reactflow` edge customization — pending Wave 2
- WebSearch "IEEE 315 power symbols" — pending Wave 5 Task 5.1
- WebSearch "KiCad reference designator auto-numbering algorithm" — pending Wave 3
- Codebase — verified Pass 12B populated-canvas behavior (drag WORKS; click-fallback gap)
- advisor() calls pending as scheduled
