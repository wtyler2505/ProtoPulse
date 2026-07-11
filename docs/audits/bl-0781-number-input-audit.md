---
title: BL-0781 NumberInput Migration — Per-Instance Audit
date: 2026-07-02
mode: read-only research (Phase 0 of docs/plans — implementation plan file: `~/.claude/plans/claude-devfleet-sp-write-plan-bl-0781-hidden-pancake.md`)
---

# BL-0781: NumberInput Migration — Per-Instance Audit

Single source of truth for the Phase 1 migration wave. 25 files, **62 real instances**
(66 raw `type="number"` grep hits in `client/src/components` minus 2 in the `NumberInput`
primitive itself minus 2 Recharts `<XAxis type="number">` false positives in `BodePlot.tsx`).

Verified against the live tree 2026-07-02 (the plan's file list was written before a refactor
moved `BoardViewer3DView.tsx` → `views/board-viewer-3d/CssBoardViewer.tsx`; all 25 *target*
paths below were re-confirmed to exist as-is). Corrections to the original plan's visual-risk
claims are called out inline where the audit found different class names or additional
HIGH-risk instances the plan missed.

**Migration contract:** every row's Action decides the primitive's `min`/`max` props:
- **KEEP** — existing bound is real and intentional; convert to numeric literal if currently a string.
- **ADD-MAX** — no existing max, but a genuine domain ceiling justifies adding one (rare — only
  2 rows below).
- **OMIT-MAX** — no existing max and no real domain ceiling exists; do not invent one. The
  primitive correctly omits `aria-valuemax` in this case, which itself fixes the underlying
  Chromium synthesized-`valuemax="0"` bug.

**Cross-cutting migration note:** 6 instances currently pass `min`/`max`/`step` as **string
literals** (`min="0"` etc.) rather than numeric (`min={0}`). `NumberInput`'s bound props are
typed `number` and internally gated by `typeof x === 'number' && Number.isFinite(x)` — a string
fails that check silently and the bound (and its ARIA mirror) disappears. These rows are
flagged **[STRING→NUM]** and must convert the literal, not just forward it.

**No `Controller`/react-hook-form usage exists anywhere in the 25-file set** — confirmed by
direct read of every file. Every instance is a plain `useState`/reducer-`dispatch` +
`onChange` controlled input; the migration is a mechanical wrapper swap for all 62 rows.

---

## Circuit-editor (13 files, 33 instances)

| File | Line | Wrapper | Has min | Has max | Action | Proposed bounds | Visual risk | Notes |
|---|---|---|---|---|---|---|---|---|
| WorstCaseAnalysisPanel.tsx | 121-129 | `<Input>` | — | — | OMIT-MAX | — | LOW | `wca-param-nominal` — unit-agnostic magnitude, no natural bound |
| WorstCaseAnalysisPanel.tsx | 135-144 | `<Input>` | `"0"` | — | OMIT-MAX; KEEP min **[STRING→NUM]** | `min={0}` | LOW | `wca-param-tolerance` — dual-mode %/absolute, bound conditional on sibling field, can't statically max |
| FailureInjectionPanel.tsx | 180-187 | `<Input>` | — | — | OMIT-MAX | — | LOW | noise amplitude, unclamped in `failure-injection.ts` |
| FailureInjectionPanel.tsx | 190-198 | `<Input>` | — | — | OMIT-MAX | — | LOW | drift %, legitimately can exceed 100 (simulated failure magnitude) |
| FailureInjectionPanel.tsx | 202-209 | `<Input>` | — | — | OMIT-MAX | — | LOW | PRNG seed, arbitrary integer |
| ScenarioManagerPanel.tsx | 183-190 | `<Input>` | — | — | OMIT-MAX | — | LOW | ambient temperature °C, can be negative |
| ScenarioManagerPanel.tsx | 195-202 | `<Input>` | — | — | OMIT-MAX | — | LOW | AC sweep start freq Hz |
| ScenarioManagerPanel.tsx | 203-210 | `<Input>` | — | — | OMIT-MAX | — | LOW | AC sweep end freq Hz |
| ScenarioManagerPanel.tsx | 211-218 | `<Input>` | — | — | OMIT-MAX | — | LOW | sweep point count, no coded ceiling — don't invent a UX sanity cap |
| ScenarioManagerPanel.tsx | 224-232 | `<Input>` | — | — | OMIT-MAX | — | LOW | transient time span (s) |
| ScenarioManagerPanel.tsx | 233-241 | `<Input>` | — | — | OMIT-MAX | — | LOW | transient time step (s) |
| ImpedanceTraceWidthPanel.tsx | 171-182 | `<Input>` | `"1"` | `"20"` | KEEP **[STRING→NUM]** | `min={1} max={20}` | LOW | dielectric constant εr — real substrate range |
| ImpedanceTraceWidthPanel.tsx | 190-201 | `<Input>` | `"0.01"` | `"5"` | KEEP **[STRING→NUM]** | `min={0.01} max={5}` | LOW | dielectric height mm |
| ImpedanceTraceWidthPanel.tsx | 209-220 | `<Input>` | `"0"` | `"0.5"` | KEEP **[STRING→NUM]** | `min={0} max={0.5}` | LOW | copper thickness mm |
| ImpedanceTraceWidthPanel.tsx | 251-262 | `<Input>` | `"0"` | `"100"` | KEEP **[STRING→NUM]** | `min={0} max={100}` | LOW | impedance tolerance % |
| DiffPairLengthMatchPanel.tsx | 257-267 | `<Input>` | `0` | — | OMIT-MAX | — | LOW | target length-match delta mm |
| DiffPairLengthMatchPanel.tsx | 271-281 | `<Input>` | `0.1` | — | OMIT-MAX | — | LOW | max meander amplitude mm |
| DiffPairLengthMatchPanel.tsx | 285-295 | `<Input>` | `0.1` | — | OMIT-MAX | — | LOW | serpentine spacing mm |
| NetClassPanel.tsx | 521-530 | `<Input>` | `0.01` | — | OMIT-MAX | — | LOW | trace width mm |
| NetClassPanel.tsx | 538-547 | `<Input>` | `0.01` | — | OMIT-MAX | — | LOW | clearance mm |
| NetClassPanel.tsx | 555-564 | `<Input>` | `0.1` | — | OMIT-MAX | — | LOW | via diameter mm |
| BreadboardQuickIntake.tsx | 81-89 | `<Input>` | `1` | — | OMIT-MAX | — | LOW | bench-stash quantity — no schema-level max, bulk packs legitimate |
| BaudRateSelector.tsx | 246-258 | `<Input>` | `1` | — | OMIT-MAX | — | LOW | custom (non-standard) baud rate — exists specifically to exceed the standard-rate table |
| FunctionGeneratorPanel.tsx | 181-195 | `<Input>` | `0` | — | OMIT-MAX | — | LOW | frequency, `setFrequency()` only floors at 0 |
| FunctionGeneratorPanel.tsx | 299-313 | `<Input>` | `0` | — | OMIT-MAX | — | LOW | amplitude V, `setAmplitude()` only floors at 0 |
| FunctionGeneratorPanel.tsx | 321-334 | `<Input>` | — | — | OMIT-MIN, OMIT-MAX | — | LOW | DC offset — bipolar, no floor or ceiling |
| RotationInputPanel.tsx | 161-172 | `<Input>` | `0` | `359` | KEEP | `min={0} max={359}` | LOW | already numeric, drop-in |
| BusPinMappingDialog.tsx | 272-286 | `<Input>` | `1` | `64` | KEEP | `min={1} max={64}` | LOW | already numeric, drop-in |
| MysteryPartConfigurator.tsx | 341-349 | `<Input>` | `MYSTERY_PART_MIN_PINS` | `MYSTERY_PART_MAX_PINS` | KEEP | constants (2/40, `shared/component-types.ts:288,290`) | LOW | already numeric, drop-in |
| MysteryPartConfigurator.tsx | 381-389 | `<Input>` | `1` | `20` | KEEP | `min={1} max={20}` | LOW | body width, grid units |
| MysteryPartConfigurator.tsx | 393-401 | `<Input>` | `1` | `20` | KEEP | `min={1} max={20}` | LOW | body height, grid units |
| PCBLayoutView.tsx | 1005-1016 | raw `<input>` | `10` | `500` | KEEP | `min={10} max={500}` | **HIGH** | board width mm, `w-12 h-5 px-1 text-[10px]` toolbar chip — raw input, no shadcn base today |
| PCBLayoutView.tsx | 1018-1029 | raw `<input>` | `10` | `500` | KEEP | `min={10} max={500}` | **HIGH** | board height mm, identical toolbar context |

## Component-editor + views (6 files, 16 instances)

| File | Line | Wrapper | Has min | Has max | Action | Proposed bounds | Visual risk | Notes |
|---|---|---|---|---|---|---|---|---|
| GeneratorModal.tsx | 201-209 | `<Input>` | conditional (4 or 2) | — | OMIT-MAX | — | LOW | pin count — no coded ceiling despite real DIP/SOIC/QFP max pin counts existing; not enforced anywhere today |
| GeneratorModal.tsx | 216-224 | `<Input>` | `0.1` | — | OMIT-MAX | — | LOW | pin pitch mm |
| GeneratorModal.tsx | 231-239 | `<Input>` | `1` | — | OMIT-MAX | — | LOW | row spacing mm |
| GeneratorModal.tsx | 246-254 | `<Input>` | `1` | — | OMIT-MAX | — | LOW | QFP body size mm |
| GeneratorModal.tsx | 262-269 | `<Input>` | `1` | — | OMIT-MAX | — | LOW | header column count |
| GeneratorModal.tsx | 273-280 | `<Input>` | `1` | — | OMIT-MAX | — | LOW | header row count |
| DRCPanel.tsx | 166-174 | raw `<input>` | — | — | OMIT-MAX | — | **HIGH** | DRC rule param mm (clearance/trace-width/etc); `w-12 h-4 text-[9px]` — corrects plan's `h-5` citation to actual `h-4` |
| ShapeCanvas.tsx | 642-644 | raw `<input>` | — | — | OMIT-MAX | — | **HIGH** | ref-image X offset, canvas coord; `w-14 h-5` — corrects plan's `w-12` citation to actual `w-14` |
| ShapeCanvas.tsx | 648-650 | raw `<input>` | — | — | OMIT-MAX | — | **HIGH** | ref-image Y offset, canvas coord; same sizing |
| ComponentInspector.tsx | 74-85 (`NumberField` wrapper, cascades to 13 call sites) | `<Input>` | per-call-site | per-call-site | KEEP per-call-site bounds (already optional/correct) | — | MEDIUM | highest-leverage single swap in the set — fixes ARIA mirroring for all 13 `<NumberField>` usages (X/Y, W/H, Rotation, Stroke Width, Opacity, CX/CY) without touching call sites |
| ComponentInspector.tsx | 381-390 | `<Input>` | — | — | OMIT-MAX | — | **HIGH** (not in original plan) | constraint "distance" param mm; `h-5 w-14 text-[10px]` — as tight as DRC/ShapeCanvas, add to HIGH set |
| ComponentInspector.tsx | 392-402 | `<Input>` | — | — | OMIT-MAX | — | **HIGH** (not in original plan) | constraint "pitch" param mm; same tight sizing |
| DigitalTwinView.tsx | 371-379 | raw `<input>` | `1` | `100` | KEEP | `min={1} max={100}` | LOW | telemetry sample rate Hz — real intentional UI cap |
| DigitalTwinView.tsx | 407-418 | raw `<input>` | — | — | OMIT-MAX (static) | — | MEDIUM | GPIO pin number; no height override today — base `Input` `h-9` is *larger* than current native height, risk of layout bump not clipping. Dynamic per-board max (`boardPinCount()`) is a real future enhancement but out of scope for this pure wrapper-swap wave |
| GenerativeDesignView.tsx | 186-195 | raw `<input>` | `2` | `20` | KEEP | `min={2} max={20}` | LOW | GA population size — intentional bound |
| GenerativeDesignView.tsx | 206-215 | raw `<input>` | `1` | `50` | KEEP | `min={1} max={50}` | LOW | GA generation count — intentional bound |

## Procurement (6 files, 13 instances)

| File | Line | Wrapper | Has min | Has max | Action | Proposed bounds | Visual risk | Notes |
|---|---|---|---|---|---|---|---|---|
| SupplierDrawer.tsx | 201-209 | `<Input>` | `1` | — | OMIT-MAX | — | LOW | order-comparison quantity |
| PcbOrderTrackerPanel.tsx | 431-439 | raw `<input>` | `1` | — | OMIT-MAX | — | LOW | PCB order quantity |
| PcbOrderTrackerPanel.tsx | 459-467 | raw `<input>` | `0` | — | ADD-MAX | `max={365}` | LOW | estimated delivery days — real-world-bounded, prevents fat-finger entry (99999) |
| AddItemDialog.tsx | 83-91 | `<Input>` | `"1"` | `"999999"` | KEEP **[STRING→NUM]** | `min={1} max={999999}` | LOW | BOM item quantity — matches BomTable convention |
| AddItemDialog.tsx | 95-104 | `<Input>` | `"0"` | `"99999.99"` | KEEP **[STRING→NUM]** | `min={0} max={99999.99}` | LOW | unit price $ — matches BomTable convention |
| CostOptimizerPanel.tsx | 73-82 | raw `<input>` | `0` | — | OMIT-MAX | — | LOW | budget target $ |
| CostOptimizerPanel.tsx | 88-97 | raw `<input>` | `0` | — | OMIT-MAX | — | LOW | PCB fab cost $ |
| CostOptimizerPanel.tsx | 103-112 | raw `<input>` | `0` | — | OMIT-MAX | — | LOW | assembly cost $ |
| OrderHistoryPanel.tsx | 448-456 | raw `<input>` | `1` | — | OMIT-MAX | — | LOW | order quantity — no `999999` convention here today, don't invent one |
| OrderHistoryPanel.tsx | 462-471 | raw `<input>` | `0` | — | OMIT-MAX | — | LOW | unit cost $ |
| OrderHistoryPanel.tsx | 477-486 | raw `<input>` | `0` | — | OMIT-MAX | — | LOW | total cost $ |
| BomTable.tsx | 240 | raw `<input>` (table cell) | `1` | `999999` | KEEP | `min={1} max={999999}` | **HIGH — confirmed** | inline edit, `w-16 text-xs text-right font-mono` + bespoke `focus-visible:ring-cyan-400/50` editing-state ring; preserve `onKeyDown={handleEditKeyDown}` |
| BomTable.tsx | 241 | raw `<input>` (table cell) | `0` | `99999.99` | KEEP | `min={0} max={99999.99} step={0.01}` | **HIGH — confirmed** | inline edit unit price, identical cyan-ring pattern; sibling `<td>` computes a live total from this value — verify unaffected |

---

## HIGH visual-risk files (screenshot before/after in Phase 2)

Corrected/expanded from the plan's original list:

- `PCBLayoutView.tsx` (board width/height toolbar chips, `w-12 h-5 px-1 text-[10px]`)
- `DRCPanel.tsx` (rule param, actual `w-12 h-4 text-[9px]` — plan said h-5)
- `ShapeCanvas.tsx` (ref-image X/Y, actual `w-14 h-5` — plan said w-12) ×2
- `ComponentInspector.tsx` constraint distance/pitch (`h-5 w-14 text-[10px]`) — **new, not in original plan** ×2
- `BomTable.tsx` (inline quantity/price edit, cyan focus ring) ×2 — confirmed

MEDIUM: `ComponentInspector.tsx`'s shared `NumberField` wrapper (`h-7` vs base `h-9`, multiplies
across 13 call sites), `DigitalTwinView.tsx` GPIO pin number (no height override — risk is a
height *increase*, not clipping).

## Out of scope (unchanged)

- `BodePlot.tsx` — 2 Recharts `<XAxis type="number">` matches, not HTML inputs.
- `client/src/components/ui/number-input.tsx` — the primitive itself.
- The 3 existing adopters (`views/board-viewer-3d/CssBoardViewer.tsx`, `PcbOrderingView.tsx`,
  `CalculatorsView.tsx`).
