# BL-0781 — Per-instance NumberInput migration audit

**Date:** 2026-05-27
**Author:** Claude (Phase 0 of [claude-devfleet-sp-write-plan-bl-0781-hidden-pancake.md](../../../../.claude/plans/claude-devfleet-sp-write-plan-bl-0781-hidden-pancake.md))
**Scope:** 25 files, 62 raw number-input instances. BodePlot.tsx excluded — false positive (Recharts `<XAxis type="number">`).
**Status:** Implemented and Phase-2b verified. The migration table is historical record; future changes should preserve the regression guards below.

---

## Background

The Chromium accessibility tree synthesizes `aria-valuemax="0"` for `<input type="number">` elements lacking an explicit HTML `max` attribute, breaking spinbutton announcements (E2E-236/271/284). The [NumberInput primitive](../../client/src/components/ui/number-input.tsx) plus its focused tests are the canonical fix.

### Adoption gap

| Status | Count |
|--------|-------|
| Already migrated | 3 files ([BoardViewer3DView](../../client/src/components/views/BoardViewer3DView.tsx), [PcbOrderingView](../../client/src/components/views/PcbOrderingView.tsx), [CalculatorsView](../../client/src/components/views/CalculatorsView.tsx)) |
| Migrated by BL-0781 wave | **25 files (62 instances)** — this audit |
| False positive | 1 file (BodePlot.tsx — Recharts axis-type, not HTML input) |

---

## WAI-ARIA vs Chromium nuance — read before deciding actions

Per the [primitive’s docstring (lines 6-13)](../../client/src/components/ui/number-input.tsx#L6-L13):

> **The two-part remediation is:**
> **1. Consumers of NumberInput must pass a real `max` (and `min` where meaningful).** That way the HTML `max` attribute is present and Chromium does NOT synthesise a zero default on the accessibility tree.
> 2. NumberInput explicitly mirrors the `min`/`max`/`value` props onto `aria-valuemin`/`aria-valuemax`/`aria-valuenow`...

And lines 17-20:

> **When `max` (or `min`) is intentionally undefined, we OMIT the ARIA attribute entirely** rather than emitting a bogus `0` — matching the WAI-ARIA 1.2 guidance that `aria-valuemax` should be absent when the spinbutton has no defined upper bound.

These two passes interact:

| Approach | HTML `max` | `aria-valuemax` | Chromium a11y tree | WAI-ARIA spec |
|----------|------------|------------------|--------------------|----------------|
| **ADD-MAX** (pass real `max={N}`) | `max="N"` present | `aria-valuemax="N"` mirrored | Reports `N` (correct) | ✅ Correct |
| **OMIT-MAX** (pass `max={undefined}`) | omitted | omitted | Current BL-0781 OMIT-MAX rows verified clean in Phase 2; future omitted-bound cases still require smoke coverage | ✅ Correct |
| Raw `<input type="number">` (status quo) | omitted | omitted | Synthesizes `valuemax=0` ⚠️ | ⚠️ Misleading |

**Implication:** The advisor's framing ("both fix the bug") is *WAI-ARIA-correct* but may be *Chromium-pragmatic-incomplete*. The Phase 2 Playwright smoke is the definitive verification. As of 2026-06-03 it passes across the BL-0781 view set, so this audit keeps **ADD-MAX with a domain-appropriate semantic bound** wherever a sensible bound exists. OMIT-MAX remains reserved for cases where any artificial ceiling would actively mislead assistive tech (e.g., a "raw seed value" with no physical meaning).

### Action key

| Action | When | Result |
|--------|------|--------|
| **KEEP** | `min` AND `max` already set on the existing input | Wrap-only: convert `<Input>`/`<input>` → `<NumberInput>`, preserve all props. Convert string min/max (`"0"`, `"20"`) to number literals (`0`, `20`) — NumberInput's TS signature requires `number` not `string`. |
| **ADD-MAX** | `max` missing; a reasonable semantic ceiling exists | Add `max={N}` per per-instance proposal. Preserve existing `min`. |
| **ADD-MIN** | `min` missing; meaningful (e.g., negative values prohibited) | Add `min={N}`. |
| **OMIT-MAX** | `max` missing AND any artificial ceiling would be actively misleading to AT (e.g., arbitrary signed integer seed; "any frequency") | Pass `max={undefined}`. Mark for Phase-2 Playwright verification. |
| **CONVERT-TYPE** | Existing min/max are strings — required by HTML attr but not by NumberInput's TS signature | Change `min="1"` → `min={1}`. Combined with KEEP/ADD-MAX as relevant. |

### Visual risk key

| Risk | Source | Treatment |
|------|--------|-----------|
| **LOW** | Already wrapped in shadcn `<Input>` — base styles unchanged | Mechanical swap. |
| **MED** | Raw `<input>` with default-ish Tailwind classes; visual delta likely minor | Screenshot before+after; document delta in commit. |
| **HIGH** | Raw `<input>` with tight custom sizing (`w-12 h-5 px-1 text-[10px]`) or focus-ring overrides | Mandatory dev-server screenshot diff. Use `!` modifiers or accept documented change. See [PCBLayoutView toolbar inputs](../../client/src/components/circuit-editor/PCBLayoutView.tsx#L1148-L1168), [BomTable row inputs](../../client/src/components/views/procurement/BomTable.tsx#L243-L244), [ShapeCanvas coord inputs](../../client/src/components/views/component-editor/ShapeCanvas.tsx#L642-L650), [DRCPanel rule-param inputs](../../client/src/components/views/component-editor/DRCPanel.tsx#L168). |

---

## Per-instance table

### Teammate 1: `circuit-editor-calc` (5 files, 19 instances)

#### `client/src/components/circuit-editor/WorstCaseAnalysisPanel.tsx` (2 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 124 | `wca-param-nominal` | `<Input>` | — | — | **OMIT-MAX, OMIT-MIN** | `min=undefined, max=undefined` | LOW | "Nominal" can legitimately be 1pF, 1Ω, 1GHz, 1MΩ. No semantic upper bound. Phase 2 Playwright verified 2026-06-03: no synthesized `aria-valuemax="0"` offender. |
| 138 | `wca-param-tolerance` | `<Input>` | `"0"` | — | **ADD-MAX, CONVERT-TYPE** | `min={0}, max={form.toleranceType === 'percentage' ? 100 : 1_000_000}` | LOW | Tolerance is either `%` (0–100) or absolute units (placeholder example `500`). Mirror that branching to the `max` prop. |

#### `client/src/components/circuit-editor/FailureInjectionPanel.tsx` (3 instances)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 184 | `fault-form-noise-amplitude` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={10_000}` | LOW | Noise amplitude (likely V or A). Physical-reality ceiling. |
| 195 | `fault-form-drift-percent` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={-100}, max={100}` | LOW | Drift % — can be negative (component drifting low) or positive. |
| 206 | `fault-form-seed` | `<Input>` | — | — | **OMIT-MAX, OMIT-MIN** | `min=undefined, max=undefined` | LOW | PRNG seed — arbitrary signed 32-bit integer. Any artificial ceiling would mislead AT. Phase 2 Playwright verified 2026-06-03: no synthesized `aria-valuemax="0"` offender. |

#### `client/src/components/circuit-editor/ScenarioManagerPanel.tsx` (6 instances)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 187 | `scenario-form-temperature` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={-273}, max={1000}` (°C) | LOW | Absolute zero to extreme operating temp. |
| 199 | `scenario-form-freq-start` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={1_000_000_000_000}` (1 THz) | LOW | DC to THz covers any RF sim. |
| 207 | `scenario-form-freq-end` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={1_000_000_000_000}` (1 THz) | LOW | |
| 215 | `scenario-form-freq-points` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={2}, max={100_000}` | LOW | Sim resolution. Min 2 (need a start+end). |
| 228 | `scenario-form-timespan` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={86400}` | LOW | Final implementation uses the semantic lower bound of 0 because time cannot be negative. Phase 2b verified that the primitive can now normalize exponential ARIA bounds if future domain fields need them. |
| 237 | `scenario-form-timestep` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={1}` | LOW | Final implementation uses the semantic lower bound of 0 because time cannot be negative. Phase 2b verified that the primitive can now normalize exponential ARIA bounds if future domain fields need them. |

#### `client/src/components/circuit-editor/ImpedanceTraceWidthPanel.tsx` (4 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 173 | `dielectric-constant` | `<Input>` | `"1"` | `"20"` | **KEEP, CONVERT-TYPE** | `min={1}, max={20}, step={0.01}` | LOW | String → number literals. |
| 192 | `dielectric-height` | `<Input>` | `"0.01"` | `"5"` | **KEEP, CONVERT-TYPE** | `min={0.01}, max={5}, step={0.01}` | LOW | |
| 211 | `copper-thickness` | `<Input>` | `"0"` | `"0.5"` | **KEEP, CONVERT-TYPE** | `min={0}, max={0.5}, step={0.001}` | LOW | |
| 253 | `tolerance` | `<Input>` | `"0"` | `"100"` | **KEEP, CONVERT-TYPE** | `min={0}, max={100}, step={1}` | LOW | |

#### `client/src/components/circuit-editor/DiffPairLengthMatchPanel.tsx` (3 instances)

| Line | binding | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|---------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 258 | `targetDelta` | `<Input>` | `0` | — | **ADD-MAX** | `min={0}, max={100}, step={0.01}` | LOW | Target Δ in mm. 100mm generous. |
| 272 | `maxAmplitude` | `<Input>` | `0.1` | — | **ADD-MAX** | `min={0.1}, max={100}, step={0.1}` | LOW | mm |
| 286 | `spacing` | `<Input>` | `0.1` | — | **ADD-MAX** | `min={0.1}, max={100}, step={0.1}` | LOW | mm |

---

### Teammate 2: `circuit-editor-tools` (5 files, 11 instances)

#### `client/src/components/circuit-editor/BreadboardQuickIntake.tsx` (1 instance)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 84 | `quick-intake-quantity` | `<Input>` | `1` | — | **ADD-MAX** | `min={1}, max={9999}` | LOW | Quick-add quantity. |

#### `client/src/components/circuit-editor/BaudRateSelector.tsx` (1 instance)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 248 | `baud-rate-custom-input` | `<Input>` | `1` | — | **ADD-MAX** | `min={1}, max={4_000_000}, step={1}` | LOW | 4 Mbaud (USB CDC max). Consider importing max from `client/src/lib/serial/baud-rate-manager.ts` if a `MAX_BAUD` const exists; otherwise inline. |

#### `client/src/components/circuit-editor/FunctionGeneratorPanel.tsx` (3 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 184 | `funcgen-frequency` | `<Input>` | `0` | — | **ADD-MAX** | `min={0}, max={1_000_000_000}, step="any"` | LOW | 1 GHz max. |
| 302 | `funcgen-amplitude` | `<Input>` | `0` | — | **ADD-MAX** | `min={0}, max={1000}, step="any"` | LOW | 1000 V. |
| 324 | `funcgen-dc-offset` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={-1000}, max={1000}, step="any"` | LOW | DC offset can be negative. |

#### `client/src/components/circuit-editor/RotationInputPanel.tsx` (1 instance)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 163 | `rotation-angle-input` | `<Input>` | `0` | `359` | **KEEP** | `min={0}, max={359}` | LOW | Already correct. |

#### `client/src/components/circuit-editor/MysteryPartConfigurator.tsx` (3 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 344 | `mystery-pin-count` | `<Input>` | `MYSTERY_PART_MIN_PINS` (2) | `MYSTERY_PART_MAX_PINS` (40) | **KEEP** | Preserve constant refs | LOW | Constants live in [shared/component-types.ts:288-290](../../shared/component-types.ts#L288-L290). |
| 384 | `mystery-body-width` | `<Input>` | `1` | `20` | **KEEP** | `min={1}, max={20}` | LOW | |
| 396 | `mystery-body-height` | `<Input>` | `1` | `20` | **KEEP** | `min={1}, max={20}` | LOW | |

---

### Teammate 3: `circuit-editor-pcb` (3 files, 6 instances)

#### `client/src/components/circuit-editor/NetClassPanel.tsx` (3 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 524 | `nc-trace-width` | `<Input>` | `0.01` | — | **ADD-MAX** | `min={0.01}, max={10}, step={0.05}` | LOW | mm. 10mm is a generous trace upper bound. |
| 541 | `nc-clearance` | `<Input>` | `0.01` | — | **ADD-MAX** | `min={0.01}, max={10}, step={0.05}` | LOW | mm |
| 558 | `nc-via-diameter` | `<Input>` | `0.1` | — | **ADD-MAX** | `min={0.1}, max={10}, step={0.1}` | LOW | mm |

#### `client/src/components/circuit-editor/BusPinMappingDialog.tsx` (1 instance)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 275 | `bus-width-input` | `<Input>` | `1` | `64` | **KEEP** | `min={1}, max={64}` | LOW | |

#### `client/src/components/circuit-editor/PCBLayoutView.tsx` (2 instances)

| Line | aria/title | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|------------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 1149 | `Board width (mm)` | `<input>` raw | `10` | `500` | **KEEP**, raw→NumberInput | `min={10}, max={500}, step={5}` | **HIGH** | Toolbar input `w-12 h-5 px-1 text-[10px]`. Verify pixel match. |
| 1162 | `Board height (mm)` | `<input>` raw | `10` | `500` | **KEEP**, raw→NumberInput | `min={10}, max={500}, step={5}` | **HIGH** | Same as above. |

---

### Teammate 4: `component-editor + views` (6 files, 14 instances)

#### `client/src/components/views/component-editor/DRCPanel.tsx` (1 instance)

| Line | binding | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|---------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 168 | dynamic `rule.params[key]` | `<input>` raw | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={1_000_000}` | **HIGH** | Generic DRC param (clearance, width, etc.) — `1e6` covers most. Inputs are `w-12 h-5 text-[10px]` inline. |

#### `client/src/components/views/component-editor/ComponentInspector.tsx` (3 instances)

| Line | binding | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|---------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 76 | inspector field generic | `<Input>` | passes-through prop `min` | passes-through prop `max` | **KEEP** | preserve `{min}, {max}, {step}` prop forwarding | LOW | Already parameterized via props — clean wrapper swap. |
| 382 | `c.params.distance` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={1000}` (mm) | LOW | Constraint distance. |
| 394 | `c.params.pitch` | `<Input>` | — | — | **ADD-MIN, ADD-MAX** | `min={0.1}, max={10}` (mm) | LOW | Constraint pitch. |

#### `client/src/components/views/component-editor/ShapeCanvas.tsx` (2 instances)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 642 | `ref-image-x` | `<input>` raw | — | — | **ADD-MIN, ADD-MAX** | `min={-10000}, max={10000}` (px) | **HIGH** | Canvas X coord. Class `w-14 h-5 text-xs`. |
| 648 | `ref-image-y` | `<input>` raw | — | — | **ADD-MIN, ADD-MAX** | `min={-10000}, max={10000}` (px) | **HIGH** | Canvas Y coord. |

#### `client/src/components/views/component-editor/GeneratorModal.tsx` (6 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 204 | `pin-count` | `<Input>` | dynamic (`packageType === 'qfp' ? 4 : 2`) | — | **ADD-MAX** | `min` preserved, `max={500}, step` preserved | LOW | High-pin-count QFP/BGA up to 500. |
| 219 | `pitch` | `<Input>` | `0.1` | — | **ADD-MAX** | `min={0.1}, max={10}, step={0.01}` | LOW | mm |
| 234 | `row-spacing` | `<Input>` | `1` | — | **ADD-MAX** | `min={1}, max={100}, step={0.01}` | LOW | mm (variable named bodyWidth in state) |
| 249 | `body-size` | `<Input>` | `1` | — | **ADD-MAX** | `min={1}, max={100}, step={0.1}` | LOW | mm |
| 265 | `cols` | `<Input>` | `1` | — | **ADD-MAX** | `min={1}, max={100}` | LOW | BGA matrix columns. |
| 276 | `rows` | `<Input>` | `1` | — | **ADD-MAX** | `min={1}, max={100}` | LOW | BGA matrix rows. |

#### `client/src/components/views/GenerativeDesignView.tsx` (2 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 221 | `population-size-input` | `<input>` raw | `2` | `20` | **KEEP**, raw→NumberInput | `min={2}, max={20}` | MED | `rounded border border-zinc-700 bg-zinc-900 p-1.5 text-[12px] text-zinc-100`. |
| 242 | `generations-input` | `<input>` raw | `1` | `50` | **KEEP**, raw→NumberInput | `min={1}, max={50}` | MED | Same class. |

#### `client/src/components/views/DigitalTwinView.tsx` (2 instances)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 753 | `sample-rate-input` | `<input>` raw | `1` | `100` | **KEEP**, raw→NumberInput | `min={1}, max={100}` (Hz) | MED | `mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm`. |
| 789 | `pin-id-${i}` (pin number) | `<input>` raw | — | — | **ADD-MIN, ADD-MAX** | `min={0}, max={99}` | MED | Arduino-class pin number; 99 covers most boards. |

---

### Teammate 5: `procurement` (6 files, 12 instances)

#### `client/src/components/views/procurement/SupplierDrawer.tsx` (1 instance)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 204 | `comparison-quantity` | `<Input>` | `1` | — | **ADD-MAX** | `min={1}, max={999_999}` | LOW | |

#### `client/src/components/views/procurement/AddItemDialog.tsx` (2 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 85 | `add-quantity` | `<Input>` | `"1"` | `"999999"` | **KEEP, CONVERT-TYPE** | `min={1}, max={999_999}` | LOW | |
| 97 | `add-unit-price` | `<Input>` | `"0"` | `"99999.99"` | **KEEP, CONVERT-TYPE** | `min={0}, max={99_999.99}, step={0.01}` | LOW | |

#### `client/src/components/views/procurement/CostOptimizerPanel.tsx` (3 instances)

| Line | id | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|-----|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 76 | `cost-opt-budget` | `<input>` raw | `0` | — | **ADD-MAX**, raw→NumberInput | `min={0}, max={1_000_000_000}` ($) | MED | $1B ceiling. |
| 91 | `cost-opt-pcb` | `<input>` raw | `0` | — | **ADD-MAX**, raw→NumberInput | `min={0}, max={1_000_000}, step={0.5}` ($) | MED | PCB fab $1M ceiling. |
| 106 | `cost-opt-assembly` | `<input>` raw | `0` | — | **ADD-MAX**, raw→NumberInput | `min={0}, max={1_000_000}, step={0.5}` ($) | MED | Assembly $1M ceiling. |

#### `client/src/components/views/procurement/OrderHistoryPanel.tsx` (3 instances)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 450 | `input-quantity` | `<input>` raw | `1` | — | **ADD-MAX**, raw→NumberInput | `min={1}, max={999_999}` | MED | |
| 464 | `input-unit-cost` | `<input>` raw | `0` | — | **ADD-MAX**, raw→NumberInput | `min={0}, max={1_000_000}, step={0.01}` ($) | MED | |
| 479 | `input-total-cost` | `<input>` raw | `0` | — | **ADD-MAX**, raw→NumberInput | `min={0}, max={1_000_000_000}, step={0.01}` ($) | MED | |

#### `client/src/components/views/procurement/PcbOrderTrackerPanel.tsx` (2 instances)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 433 | `input-pcb-quantity` | `<input>` raw | `1` | — | **ADD-MAX**, raw→NumberInput | `min={1}, max={999_999}` | MED | |
| 461 | `input-pcb-delivery-days` | `<input>` raw | `0` | — | **ADD-MAX**, raw→NumberInput | `min={0}, max={365}` | MED | One year max. |

#### `client/src/components/views/procurement/BomTable.tsx` (2 instances)

| Line | testId | Current wrapper | Current min | Current max | Action | Proposed bounds | Visual risk | Notes |
|------|--------|-----------------|-------------|-------------|--------|-----------------|-------------|-------|
| 243 | `edit-quantity-${item.id}` | `<input>` raw | `1` | `999999` | **KEEP**, raw→NumberInput | `min={1}, max={999_999}` | **HIGH** | Inline table-row input with cyan focus ring. |
| 244 | `edit-unit-price-${item.id}` | `<input>` raw | `0` | `99999.99` | **KEEP**, raw→NumberInput | `min={0}, max={99_999.99}, step={0.01}` | **HIGH** | Same row class. |

---

## Per-teammate totals

Counts are per *instance* (a single `<input type="number">` or `<Input type="number">`), and per *action* (a single instance may incur both ADD-MIN and ADD-MAX, so column sums exceed instance counts).

| Teammate | Files | Instances | KEEP | ADD-MAX | ADD-MIN | OMIT-MAX | HIGH-risk files |
|----------|-------|-----------|------|---------|---------|----------|-----------------|
| 1 circuit-editor-calc | 5 | 18 | 4 | 12 | 8 | 2 | 0 |
| 2 circuit-editor-tools | 5 | 9 | 4 | 5 | 1 | 0 | 0 |
| 3 circuit-editor-pcb | 3 | 6 | 3 | 3 | 0 | 0 | 1 (PCBLayoutView) |
| 4 component-editor + views | 6 | 16 | 4 | 12 | 6 | 0 | 2 (DRCPanel, ShapeCanvas) |
| 5 procurement | 6 | 13 | 4 | 9 | 0 | 0 | 1 (BomTable) |
| **Total** | **25** | **62** | **19** | **41** | **15** | **2** | **4** |

OMIT-MAX is reserved for `wca-param-nominal` ([WorstCaseAnalysisPanel.tsx:124](../../client/src/components/circuit-editor/WorstCaseAnalysisPanel.tsx#L124)) and `fault-form-seed` ([FailureInjectionPanel.tsx:206](../../client/src/components/circuit-editor/FailureInjectionPanel.tsx#L206)). Phase 2 Playwright verification passed 2026-06-03 with no synthesized `aria-valuemax="0"` offenders, so these WAI-ARIA-correct omissions stand. Same instances also carry OMIT-MIN (2 occurrences) — not separately columned to keep the table readable.

---

## Pattern reminders for teammates

### Mechanical replacement template (for `<Input type="number">` → `<NumberInput>`)

```diff
- <Input
+ <NumberInput
    id="..."
    data-testid="..."
-   type="number"
    min={...}
    max={...}
    step={...}
    value={...}
    onChange={(e) => ...}
    className="..."
  />
```

### Raw `<input>` → `<NumberInput>` (visual risk applies)

```diff
- <input
+ <NumberInput
    data-testid="..."
-   type="number"
    min={...}
    max={...}
    step={...}
    value={...}
    onChange={(e) => ...}
    className="w-12 h-5 px-1 text-[10px] ..."  // verify pixel match in Phase 1 dev-server check
  />
```

### String → number conversion (when audit says CONVERT-TYPE)

```diff
- min="0"
- max="99999.99"
- step="0.01"
+ min={0}
+ max={99_999.99}
+ step={0.01}
```

NumberInput's TS signature requires `min?: number`, not `string`. The shadcn `<Input>` accepts string min/max because it spreads to native HTML — NumberInput is stricter.

### Test template (one per file at minimum)

```typescript
// client/src/components/<dir>/__tests__/<Filename>.aria.test.tsx
/// <reference lib="dom" />

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import <ComponentName> from '../<Filename>';

describe('<ComponentName> — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max to aria-valuemin/aria-valuemax for <input-testid>', () => {
    render(<ComponentName {...minimumProps} />);
    const input = screen.getByTestId('<testid>') as HTMLInputElement;

    // For KEEP/ADD-MAX rows:
    expect(input.getAttribute('aria-valuemax')).toBe('<NumericMax>');
    expect(input.getAttribute('aria-valuemin')).toBe('<NumericMin>');

    // For OMIT-MAX rows:
    // expect(input.hasAttribute('aria-valuemax')).toBe(false);
    // expect(input.getAttribute('max')).toBe(null);
  });
});
```

Tests verify the NumberInput primitive's prop-mirroring CONTRACT in happy-dom. Chromium's synthesized a11y tree is covered by the Phase 2 Playwright smoke.

---

## Open questions / lead review needed

1. **OMIT-MAX rows** (`wca-param-nominal`, `fault-form-seed`) — resolved 2026-06-03. Phase 2 Playwright smoke passed with these rows still omitting artificial bounds, so the WAI-ARIA-correct omission stands.
2. **CostOptimizerPanel budget ceiling** ($1B) — overly generous for hobbyist projects but harmless; OK?
3. **GeneratorModal pin-count max** (500) — covers BGA-484 and BGA-1024. Increase to 2000 for FPGA-class? Or trust 500 is enough?
4. **DRCPanel generic rule param max** (1e6) — applies to any rule key (clearance, width, drill, etc.). A per-key max table would be more accurate but adds scope.
5. **Visual-regression escape hatch** — if a HIGH-risk file's screenshot diff is unacceptable AND no className tweak (with `!`) achieves parity, may teammates leave that one input as a `// FIXME(BL-0781-visual)` documented exception and split into a follow-up BL? Or must they fix it inline?

---

## Verification plan (forwarded to Phase 1/2)

| Phase | Check | Tool |
|-------|-------|------|
| 1 | Per-file ARIA prop-mirroring | Vitest + happy-dom (one `.aria.test.tsx` per file) |
| 1 | Visual regression on HIGH-risk files | `npm run dev` + Chrome DevTools MCP screenshot |
| 1 | Zero typecheck errors | `npm run check` |
| 2 | Chromium-real a11y tree has no `aria-valuemax="0"` | `npm run test:e2e -- e2e/bl-0781-spinbutton-a11y.spec.ts --project=chromium` — verified 2026-06-03, 12/12 passed with no retries |
| 2 | Regression guard prevents reintroduction | `scripts/check-raw-number-inputs.mjs` + `npm run lint:no-raw-number-input` — verified 2026-06-03 |
| 3 | Backlog statuses flipped | Manual grep + read of [docs/MASTER_BACKLOG.md](../MASTER_BACKLOG.md) BL-0781/0773/0790/0850 |

---

## Sources (Phase 0 research)

- [WAI-ARIA: Role=Spinbutton (DigitalA11Y)](https://www.digitala11y.com/spinbutton-role/)
- [Communicating Value and Limits for Range Widgets (W3C APG)](https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/)
- [Spinbutton Pattern (W3C APG)](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/)
- [ARIA: spinbutton role (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/spinbutton_role)
- [ARIA: aria-valuemax attribute (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuemax)
- [axe-core rule: aria-valid-attr-value (Deque)](https://dequeuniversity.com/rules/axe/4.7/aria-valid-attr-value)
- [Existing primitive: client/src/components/ui/number-input.tsx](../../client/src/components/ui/number-input.tsx) (lines 1-128)
- [Primitive tests: client/src/components/ui/__tests__/number-input.test.tsx](../../client/src/components/ui/__tests__/number-input.test.tsx) (19 cases)
- [Reference adopter: client/src/components/views/BoardViewer3DView.tsx](../../client/src/components/views/BoardViewer3DView.tsx)
- [Existing constants: shared/component-types.ts:288-290](../../shared/component-types.ts#L288-L290) (`MYSTERY_PART_MIN_PINS=2`, `MYSTERY_PART_MAX_PINS=40`)
- [Existing constants: client/src/lib/serial/baud-rate-manager.ts:37](../../client/src/lib/serial/baud-rate-manager.ts#L37) (`STANDARD_BAUD_RATES`)
