# Breadboard Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve all Pass 1/2/4/5/6 Breadboard-tab findings — density collapse of the 25-region left column, wire-tool UX (snap targets, rubber-band, auto-color by net), starter-shelf click-to-place, empty-state DRC/Audit guards (already gated in 01), connectivity explainer completion, bench tray + trash zone, undo/redo, pedagogical hover-pin Vault tooltips — while keeping the gorgeous breadboard SVG canvas that the audit flagged as best-in-app.

**Architecture:** 6 waves: (1) density collapse into 3 collapsible groups (Build / AI / Health), (2) wire-tool experience (snap targets, rubber band, net-name coloring, HUD footer), (3) component placement (click-to-place, ghost preview, legality overlay, multi-select, inline value edit), (4) connectivity explainer + net browser + voltage probe, (5) off-canvas play (bench tray, trash zone, recently-removed), (6) pedagogical hooks (hover-pin tooltip from Vault, mistake catalog proactive alerts).

**Tech Stack:** React 19, React Flow (for nodes in some contexts), SVG primary breadboard render in `breadboard-canvas/index.tsx` (1666 lines), Vitest + jest-axe, Playwright for drag/pointer workflows, existing Breadboard Intelligence MOC in Ars Contexta vault.

**Parent:** `00-master-index.md` Tier D, §3.1 routing of E2E-035-043 / E2E-349-356 / E2E-562-742. Cross-owner on E2E-571/572/573 (P0 fixes in `01-p0-bugs.md` Phase 3 — this plan consumes, does NOT re-fix). Innovations E2E-586-600 / E2E-660-675 / E2E-709-742 routed to `18-innovation-roadmap.md`.

**Tier:** D. **Depends on:** `01-p0-bugs.md` (empty-state DRC), `02-p1-dead-buttons.md` (board geometry), `03-a11y-systemic.md` (InteractiveCard, EmptyState, keyboard nav suite, tie-point aria pattern E2E-625), `16-design-system.md` (all primitives + tool-active pattern), `17-shell-header-nav.md` (tab in "Build" activity-bar group).

---

## Coverage

### Pass 1 (E2E-035 → E2E-043)
All 9 IDs — density stats overlap, workbench buttons color confusion, starter drops, "stash" term, coach overlay.

### Pass 2 (E2E-349 → E2E-356)
All 8 IDs — 9-stat overwhelming row, 5 action buttons look like nav, beginner hint good, advanced shortcut palette missing, toolbar labels, "Layouts > Breadboard" breadcrumb, "stash" tooltip.

### Pass 4 (E2E-562 → E2E-610)
49 IDs — all visual/functional/toolbar/workflow except E2E-586-600 (competitive/innovation → 18).

### Pass 5 (E2E-611 → E2E-675)
65 IDs — wire-tool UX (E2E-611-625), component drag/drop (E2E-626-637), off-canvas play (E2E-638-641), live sim (E2E-642-645), undo/redo (E2E-646-648), learning aids (E2E-649-654), visualization (E2E-655-659), wire creative (E2E-660-665 → 18), component play creative (E2E-666-670 → 18), sandbox ideas (E2E-671-675 → 18).

### Pass 6 (E2E-676 → E2E-708 + packaging)
Iterate-deepenings for wire, component, visualization, audit, learning. Pass 6 Innovate section (E2E-709-742) → 18 except quick-wins packaging (E2E-packaging-* → this plan's Wave 1).

**Count:** ~180 IDs. Broken down:
- Owned (fix in this plan): ~110
- Routed to 18 (innovation/moonshot): ~70

Full coverage table in `docs/superpowers/plans/2026-04-18-e2e-walkthrough/coverage/07-breadboard-coverage.tsv` (generate via grep + cross-ref in Task 0).

- [ ] **Task 0 — Build coverage TSV**

```bash
grep -nE "E2E-0(3[5-9]|4[0-3])|E2E-(349|35[0-6])|E2E-(5[6-9][0-9]|60[0-9]|61[0-1])|E2E-6[1-9][0-9]|E2E-70[0-8]" docs/audits/2026-04-18-frontend-e2e-walkthrough.md > /tmp/bb-findings.txt
# Manually categorize each into owned/routed-to-18 and write TSV
```

Every phase below MUST reference the TSV — every owned ID is a test or comment tag.

## Existing Infrastructure (verified 2026-04-18)

| Concern | File(s) | Notes |
|---------|---|---|
| Breadboard view shell | `client/src/components/circuit-editor/BreadboardView.tsx` | Top-level wrapper — orchestrates panels + canvas |
| Breadboard canvas monolith | `client/src/components/circuit-editor/breadboard-canvas/index.tsx` (1666 lines) | **Too large** — Phase 1 splits into focused modules |
| Tool-bar | `breadboard-canvas/CanvasToolbar.tsx` (118 lines) | Wire, select, delete, zoom, DRC toggle, connectivity toggle — icon-only |
| Empty guidance | `breadboard-canvas/CanvasEmptyGuidance.tsx` (33 lines) | Replace with `<EmptyState>` from 16 |
| Wire color menu | `breadboard-canvas/WireColorMenu.tsx` (43 lines) | Exists — Wave 2 extends to auto-color by net |
| DRC overlay | `BreadboardDrcOverlay.tsx` | Consumes DRC engine output |
| Connectivity explainer | `BreadboardConnectivityExplainer.tsx` | Wave 4 — upgrade to dual-pane + zoom-to-net |
| Connectivity overlay | `BreadboardConnectivityOverlay.tsx` | Renders the highlight during explainer mode |
| Audit panel | `BreadboardBoardAuditPanel.tsx` | Empty-state guard shipped in 01 Phase 3; this plan extends UX |
| Grid render | `BreadboardGrid.tsx` | Holes + rails + column letters |
| Part inspector | `BreadboardPartInspector.tsx` | Wave 3 — inline value edit target |
| Bench part renderer | `BreadboardBenchPartRenderer.tsx` | Wave 5 — bench tray consumer |
| Starter shelf | `BreadboardStarterShelf.tsx` (grep to confirm) | Wave 3 — click-to-place primary target |
| Coach overlay | `BreadboardCoachOverlay.tsx` | Wave 6 — pedagogical hooks |
| Inventory dialog | `BreadboardInventoryDialog.tsx` | Wave 5 — stash |
| Breadboard data | `server/services/breadboard/*` | Preflight, audit, DRC rules |
| Component placer | `breadboard-canvas/index.tsx` (within monolith) | Wave 3 — extract |

## Research protocol

- **Context7** `react@19.2` — `query-docs "usePointerCapture pattern for drag interactions with preview overlay"`
- **Context7** `reactflow` — `query-docs "snap to grid with custom snap predicate"`
- **Ars Contexta Vault** — `qmd search "breadboard intelligence"`, `qmd search "esp32 gpio strapping"`, `qmd search "i2c pullup"` — seed the hover-pin tooltip dataset
- **WebSearch** "interactive breadboard wire tool UX — Wokwi / Tinkercad / Fritzing patterns" — inspire Wave 2
- **WebSearch** "WCAG 2.1 keyboard navigation for SVG canvas with 830 cells" — inform Wave 4 + cross-ref 03-a11y E2E-625
- **Codebase** `rg "wire-tool|drag-starter|connectivity" client/src/components/circuit-editor/` — locate current handlers
- **Advisor** — before Wave 1 (monolith split is high-risk), before Wave 2 (wire-tool UX choice: click-pair vs click-drag), before Wave 4 (connectivity explainer depth).

---

## Wave 1 — Density collapse + monolith split (E2E-562-570, E2E-350, E2E-035)

- [ ] **Task 1.1 — `advisor()` on monolith split**

`breadboard-canvas/index.tsx` is 1666 lines. Propose split:
- `BreadboardCanvas.tsx` (root) — orchestration
- `BreadboardSvgGrid.tsx` — rail + hole rendering (uses `BreadboardGrid`)
- `BreadboardWireLayer.tsx` — all wire rendering + wire-tool state machine
- `BreadboardPartLayer.tsx` — placed parts + drag
- `BreadboardOverlayLayer.tsx` — DRC / connectivity / legality / coord readout
- `BreadboardWireToolMachine.ts` — state machine (xstate or useReducer)

Advisor to validate.

- [ ] **Task 1.2 — Extract state machine first (no visual change)**

Failing test: state machine transitions are exhaustively tested.

- [ ] **Task 1.3 — Split modules with unit tests**

- [ ] **Task 1.4 — Collapse left column to 3 groups (Build / AI / Health)**

`<CollapsibleGroup title="Build" defaultOpen>` wraps Workbench actions / Quick Intake / Starter Shelf / Component Placer. Same for AI (Bench AI card) and Health (Stats / Audit / Pre-flight).

- [ ] **Task 1.5 — Stat consolidation (E2E-563-565, E2E-350)**

Replace 9 tiny tiles with 3 KPI cards (from `<Heading kpiMd>` in 16 Phase 2): "In design" (project parts) / "Ready to build" (bench-ready + owned intersected) / "Needs attention" (missing + low-stock + starter-unsafe). "More" disclosure shows the 9 original stats for power users.

Resolve semantic overlap (E2E-565: 1 tracked AND missing AND starter-safe simultaneously): each part has an ENUM state, never multi-state. Document the state machine in `docs/design-system/breadboard-part-states.md`.

- [ ] **Task 1.6 — "Stash" terminology pass (E2E-356, E2E-581)**

Rename all "stash" → "Inventory" (matching tab name). Alternative: keep "stash" but add tooltip on first hover: "Stash = your on-hand parts inventory". Poll advisor on preference.

- [ ] **Task 1.7 — Tests + commit**

---

## Wave 2 — Wire tool UX (E2E-611-625, E2E-676-684, E2E-334, E2E-864-865 cross-ref)

- [ ] **Task 2.1 — Snap-target indicator 3-stage (E2E-614, E2E-676)**

When wire-tool active + cursor near a hole:
- Within 60px: row cyan-stripe highlight
- Within 20px: hole glow with `+` cursor
- On hover: hole magnifies 1.5× + label "left+ row 5"

Implement via a Float overlay layer that tracks pointermove + computes nearest hole.

- [ ] **Task 2.2 — Rubber-band preview line (E2E-615, E2E-677)**

During wire creation (first-click → mouse-move), render:
- Line from first hole to cursor
- Distance label in mm
- Legality color (green / amber / red)
- Predicted DRC outcome badge if connecting to a checked pin

- [ ] **Task 2.3 — Auto-color wires by net role (E2E-616, E2E-678)**

Derive net from connected pins. Default:
- VCC / +5V / +3V3 → red
- GND / COM → black
- Others → cyan (default), purple (I2C), green (signal), etc.

Apply via `<WireColorMenu>` extension; user override wins. Persist per-wire.

- [ ] **Task 2.4 — Live wires counter triple-state (E2E-617, E2E-679)**

Replace `0 LIVE WIRES` with:

```tsx
<WireStatusBadge total={N} live={n} broken={m} />
// renders: "N wires · n live · m broken" with tone=warning if m>0
```

- [ ] **Task 2.5 — Wire-tool HUD footer (E2E-618, E2E-680)**

Fixed-position at bottom of canvas when tool active:
"WIRING — click destination · Shift auto-route · Alt 90° bend · Esc cancel"

- [ ] **Task 2.6 — Real-pointer Playwright test (E2E-619, E2E-681)**

Synthetic pointerdown/up failed in audit. Use Playwright's real pointer:

```ts
const start = await page.locator('[data-testid="hole-r:left_pos:0"]').boundingBox();
const end = await page.locator('[data-testid="hole-r:left_pos:5"]').boundingBox();
await page.mouse.click(start.x + start.width / 2, start.y + start.height / 2);
await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
await page.mouse.click(end.x + end.width / 2, end.y + end.height / 2);
await expect(page.getByTestId('live-wires-counter')).toContainText('1 wire');
```

Add to CI regression suite.

- [ ] **Task 2.7 — Wire thickness slider + physics bow + tangent magnet (E2E-682-684)**

Optional polish; gate behind "Expert bench mode" setting.

- [ ] **Task 2.8 — Tests + commit**

---

## Wave 3 — Component placement (E2E-571, E2E-626-637, E2E-685-692, E2E-883)

- [ ] **Task 3.1 — Click-to-place from Starter Shelf (E2E-571, E2E-626, E2E-883)**

Current: drag-only. Add click-to-place: click starter → cursor becomes placeholder ghost → click hole → placed.

```tsx
function StarterShelfItem({ part }: { part: StarterPart }) {
  const { enterPlaceMode } = useBreadboard();
  return (
    <InteractiveCard onClick={() => enterPlaceMode(part)}>
      ...
    </InteractiveCard>
  );
}
```

- [ ] **Task 3.2 — Ghost preview during drag (E2E-627, E2E-685)**

As user drags from starter, render a semi-transparent footprint following cursor. Include pin numbers, polarity marker, mounting orientation.

- [ ] **Task 3.3 — Legality overlay 3-color (E2E-628, E2E-686)**

During drag, overlay rows/holes in green (legal + recommended) / yellow (legal, suboptimal) / red (illegal — e.g. DIP straddling rail, polarized on power rail backwards).

- [ ] **Task 3.4 — Component lift on hover + drop shadow (E2E-689)**

`hover:-translate-y-[1px] hover:shadow-md transition-transform duration-[var(--motion-tactile)]`.

- [ ] **Task 3.5 — Multi-select marquee + Shift-click + Ctrl-click (E2E-635, E2E-687)**

Add marquee selection layer (like Figma). Keyboard: `Ctrl+A` select all placed.

- [ ] **Task 3.6 — Component swap (E2E-636, E2E-690)**

Select → `S` → modal "Replace with…" → filter same-footprint alternates → preview diff → swap preserves wires where pin mapping matches.

- [ ] **Task 3.7 — Inline value edit (E2E-637, E2E-688)**

Double-click resistor → inline editor with unit autocomplete + E12/E24/E96 snap + arrow-key step.

- [ ] **Task 3.8 — Magnetic alignment + heat-on-hover (E2E-691, E2E-692)**

Snap to other components' edges within 8px during drag. Hover 1s → thermal dissipation indicator.

- [ ] **Task 3.9 — Tests + commit**

---

## Wave 4 — Connectivity explainer, net browser, voltage probe (E2E-620-624, E2E-693-698, E2E-577-579, E2E-655-659)

- [ ] **Task 4.1 — Connectivity explainer full reachability (E2E-620-621, E2E-693)**

Toggle ON → hovering ANY hole highlights ALL tied points (rail strip, terminal column, wire-connected holes in same net). Overlay: net name.

- [ ] **Task 4.2 — Net browser sidebar (E2E-622, E2E-622→ cross-ref with schematic 06)**

Right-rail panel listing every net (VCC, GND, NET3...). Click net → highlight + zoom-to-fit. Filter "Floating", "Multi-driver", "VCC", "GND".

- [ ] **Task 4.3 — Continuity tester (E2E-623)**

Toolbar button: click → cursor changes → click two holes → toast "Connected via rail left_pos" or "Not connected". Fixes the #1 beginner breadboard question.

- [ ] **Task 4.4 — Probe pin overlay (E2E-624)**

Searchable dropdown "Find pin 13 of ATtiny85" → canvas pans/highlights the hole.

- [ ] **Task 4.5 — Toolbar labels + aria-pressed (E2E-577-579)**

Every tool button gets label via 16 Phase 3 hotkey-in-label pattern: `Wire (2)`, `Select (1)`, `Delete (3)`. `aria-pressed={active}` on toggles.

- [ ] **Task 4.6 — Voltage probe ghost-meter + Vpp/Vavg (E2E-655, E2E-694)**

During live sim (future wave or Wokwi-class engine from 18), hover → 4-number overlay (Vinst / Vavg / Vpp / Vrms).

- [ ] **Task 4.7 — Show-me-current / voltage / time modes (E2E-696-698)**

Toggle buttons in a new "Explorer" sub-group.

- [ ] **Task 4.8 — Tests + commit**

---

## Wave 5 — Off-canvas play (E2E-638-641, E2E-603, E2E-602, E2E-610)

- [ ] **Task 5.1 — Bench tray beside canvas (E2E-640)**

Horizontal strip between left column and canvas. Contains parts removed from canvas; drag back to reuse.

- [ ] **Task 5.2 — Trash zone (E2E-639)**

Visible red/grey drop-target at bottom-left of canvas area. Drag a component or wire onto it → deletes + offers undo toast.

- [ ] **Task 5.3 — Recently-removed stack with undo (E2E-641)**

Below trash zone: top 5 recently-removed items with click-to-restore (or `Ctrl+Z`).

- [ ] **Task 5.4 — Quick Intake repositioned (E2E-602)**

Move from top-of-page to inside Inventory dialog. Keep a small "Scan" FAB on the bench toolbar.

- [ ] **Task 5.5 — Live Sim prominent (E2E-603, E2E-642)**

Replace tiny pill with primary CTA Button (from 16 Phase 3): `▶ Run Simulation` (green if ready, disabled-with-reason if no MCU placed).

- [ ] **Task 5.6 — Hold-Shift-drag to copy (E2E-610)**

Figma parity.

- [ ] **Task 5.7 — Tests + commit**

---

## Wave 6 — Pedagogical hooks (E2E-649-654, E2E-704-708, E2E-580-585, E2E-607-609, E2E-352, E2E-582, E2E-606)

- [ ] **Task 6.1 — Hover-pin Vault tooltip (E2E-649, E2E-704)**

Hover any placed component's pin → `<HoverCard>` with 140-char summary from Ars Contexta vault (`qmd get` the relevant note). Example: ESP32 GPIO12 → "STRAPPING PIN — must be LOW at boot. Avoid for sensitive signals. (vault: esp32-gpio12-boot-strapping)".

- [ ] **Task 6.2 — Mistake catalog proactive alerts (E2E-652, E2E-705)**

Fire DRC-class tips DURING wire creation, not just on Audit click:
- Wire LED without resistor → inline tip "LEDs need a current-limiting resistor"
- Wire VCC directly to GPIO → inline tip "Direct VCC to GPIO may exceed 40mA limit"

Store tip catalog in `client/src/lib/breadboard-mistake-catalog.ts`. Each rule has `when` predicate + message + "Why?" link to Vault note.

- [ ] **Task 6.3 — "Why is this WRONG?" on DRC errors (E2E-706)**

Every DRC error row gets "?" button → opens Vault explainer + shows "correct" example circuit diff.

- [ ] **Task 6.4 — Common-mistake badges (E2E-708)**

Track which DRC rules user triggered + fixed without help → `achievements` localStorage. "I learned this" badge appears in profile.

- [ ] **Task 6.5 — Student-mode simplification (E2E-580)**

When `useWorkspaceMode() === 'student'`: hide AI buttons, hide Stats panel, collapse Health by default, only show Starter Shelf + canvas + Audit.

- [ ] **Task 6.6 — Expert CLI mode (E2E-583)**

`Ctrl+K` shows command palette with `R 220 a5` syntax: place 220Ω resistor at column a row 5. Power user productivity.

- [ ] **Task 6.7 — Saved breadboard patterns (E2E-584)**

Drag-place from Patterns tab; cross-tab action from 13-learning-surfaces.

- [ ] **Task 6.8 — Starter descriptions clickable (E2E-607)**

Each Starter Shelf item's subtitle becomes clickable → opens 30s explainer video / vault note.

- [ ] **Task 6.9 — Filter tooltips (E2E-608)**

Component Placer filters (All / Owned / Bench-ready / Verified / Starter) each get a tooltip explaining criterion.

- [ ] **Task 6.10 — Health pill dynamic (E2E-609)**

"HEALTHY 100" updates after every placement/deletion. Test: add LED → click Audit → score updates (not sticky).

- [ ] **Task 6.11 — Tests + commit**

---

## Wave 7 — A11y polish + toolbar/labels (E2E-625 already handled by 03, here we consume)

- [ ] **Task 7.1 — Consume 03 Phase 7 hole-aria pattern**

- [ ] **Task 7.2 — Keyboard nav across holes (cross-ref 03 Phase 6)**

Arrow keys move focus between holes; Enter places selected part; Space activates the wire tool; `Delete` removes focused item.

- [ ] **Task 7.3 — Tests + commit**

---

## Wave 8 — Visual polish (E2E-036-043, E2E-351-356, E2E-566-570)

- [ ] **Task 8.1 — Workbench action button color taxonomy (E2E-566)**

Apply 16 Phase 3 semantic variants: `Manage stash` = primary, `Open schematic` = tertiary, `Component editor` = tertiary, `Community` = outline, `Shop missing parts` = secondary.

- [ ] **Task 8.2 — Breadcrumb inset (E2E-355, E2E-567)**

Add `Layouts > Breadboard` breadcrumb inside canvas top.

- [ ] **Task 8.3 — Rail labels `+` `−` icons (E2E-569)**

Verify rendered text shows + and − (not "left_pos-top" testid).

- [ ] **Task 8.4 — DIP straddle ghost preview (E2E-570)**

Hover DIP IC starter → ghost preview on breadboard center channel.

- [ ] **Task 8.5 — Toolbar grouping (E2E-567)**

Split tools / view / mode into visual groups with vertical dividers.

- [ ] **Task 8.6 — Tests + commit**

---

## Vault integration (added 2026-04-19)

Per master-index §7 + §13. Breadboard is THE richest pedagogical surface — every pin hover, mistake catalog rule, and saved pattern is a vault-backed teaching moment.

### Planned insertions

| Task | Insertion site | Target vault slug | Status |
|------|----------------|-------------------|--------|
| Wave 6 Task 6.1 (hover-pin Vault tooltip) | Each MCU pin on the board — `<VaultHoverCard slug={pin.vaultSlug}>` | `esp32-gpio12-must-be-low-at-boot-or-module-crashes` + one slug per strapping pin | ✅ existing content |
| Wave 6 Task 6.2 (mistake catalog rule alerts) | Each `MistakeRule.message` gets a `vaultSlug`; toast gets "Learn more" | `drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit` + per-rule slugs | ✅ partial — inventory per rule |
| Wave 6 Task 6.7 (saved pattern cards) | Pattern card metadata `vaultSlug` linking to canonical circuit notes | `555-timer-astable-oscillator`, `h-bridge-mosfet-layout`, `i2c-pullup-sizing` | 🟡 seed gaps |
| Wave 4 Task 4.1 (connectivity explainer rail math) | Rail trace popover — `<VaultExplainer slug="breadboard-power-rail-topology">` | `breadboard-power-rail-topology-dual-side-vs-single` | 🟡 seed gap |
| Wave 2 Task 2.1 (wire color conventions) | Color picker — inline definitions + vault deep link | `wire-color-code-conventions-red-vcc-black-gnd` | 🟡 seed gap |
| Wave 4 Task 4.3 (voltage probe readings) | Probe HUD — "Why this voltage?" link | `voltage-divider-math-and-probing-methodology` | 🟡 seed gap |

### Gap stubs to seed

```
/vault-gap "breadboard power rail topology dual side vs single" --origin-plan 07-breadboard.md --origin-task 4.1
/vault-gap "wire color code conventions red VCC black GND yellow clock" --origin-plan 07-breadboard.md --origin-task 2.1
/vault-gap "voltage divider math and probing methodology" --origin-plan 07-breadboard.md --origin-task 4.3
/vault-gap "555 timer astable oscillator canonical breadboard pattern" --origin-plan 07-breadboard.md --origin-task 6.7
/vault-gap "h-bridge MOSFET breadboard layout canonical pattern" --origin-plan 07-breadboard.md --origin-task 6.7
/vault-gap "i2c pullup sizing for breadboard vs production" --origin-plan 07-breadboard.md --origin-task 6.7
```

### Consumption pattern

```tsx
<Tooltip>
  <TooltipTrigger asChild><BoardPin data-pin={pin.label} /></TooltipTrigger>
  <TooltipContent>
    <VaultHoverCard slug={pin.vaultSlug} fallback={`${pin.label} — no vault note yet`}>
      <PinSummary pin={pin} />
    </VaultHoverCard>
  </TooltipContent>
</Tooltip>
```

### Gate

- Every MistakeRule added MUST include a `vaultSlug` (registry enforced in CI via T3 backlink index).
- Every saved pattern card MUST include a `vaultSlug` OR an inbox stub with the pattern's origin.

## Team Execution Checklist

```
□ Prereqs: 01/02/03/16/17 merged
□ npm run check                         ← zero errors
□ npm test                              ← all green
□ npx eslint .                          ← zero warnings
□ Playwright bb-* suites green (wire-tool e2e, placement e2e, connectivity e2e, pedagogical e2e)
□ Coverage TSV — every owned E2E-XXX has a test or commit ref
□ No agent exceeded 6-concurrent cap
□ docs/design-system/breadboard-part-states.md shipped
□ advisor() called ≥4× (Wave 1 split, Wave 2 wire-tool UX, Wave 4 explainer depth, before final merge)
```

## Research log

- Context7 `react@19` pointer events — pending Wave 2
- Context7 `reactflow` snap — pending Wave 3
- Vault `qmd search "breadboard intelligence"` — pending Wave 6
- WebSearch "Wokwi/Tinkercad/Fritzing wire tool comparison" — pending Wave 2
- Codebase — breadboard-canvas/index.tsx is 1666 lines (verified) → Wave 1 split justified
- Codebase — 7 subcomponents already extracted (CanvasToolbar, CanvasEmptyGuidance, etc.) → Wave 1 continues the pattern
- advisor() calls pending as scheduled
