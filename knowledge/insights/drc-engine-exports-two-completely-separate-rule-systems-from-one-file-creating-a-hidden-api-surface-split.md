---
summary: shared/drc-engine.ts exports two independent DRC systems — component-level (PartState + shapes + DRCRule) and PCB-level (traces/vias/pads + PcbDrcRuleSet) — with different input types, rule schemas, and violation formats, all from the same file
type: pattern
---

# DRC engine exports two completely separate rule systems from one file

`shared/drc-engine.ts` is actually two DRC engines packaged as one module. This is non-obvious from the file name or import path — consumers see one `drc-engine` but get two fundamentally different APIs:

**Engine 1 — Component DRC** (`runDRC`):
- Input: `PartState` (shapes + connectors organized by view)
- Rules: `DRCRule[]` with type-discriminated params (e.g., `{ type: 'min-clearance', params: { minClearance: 10 } }`)
- Operates on: geometric shapes (rect, path, circle) with layer-awareness
- 11 rule types: min-clearance, min-trace-width, pad-size, pin-spacing, silk-overlap, courtyard-overlap, annular-ring, thermal-relief, trace-to-edge, via-in-pad, solder-mask
- Rule severity: per-rule `severity` field

**Engine 2 — PCB DRC** (`runPcbDrc`):
- Input: `PcbDrcInput` (traces, vias, pads, optional board outline)
- Rules: `PcbDrcRuleSet` (flat object with numeric thresholds, not an array)
- Operates on: real PCB primitives (traces with points, vias with drill/outer diameters, pads with instance IDs)
- Net-class overrides via `Map<string, NetClassRules>`
- Individual check functions exported: `checkTraceClearance`, `checkTraceWidth`, `checkViaDrill`, `checkViaAnnularRing`, `checkPadClearance`, `checkBoardEdgeClearance`
- Manufacturer presets: `MANUFACTURER_PRESETS` with basic/standard/advanced tiers
- Geometry helpers exported: `pointToSegmentDistance`, `segmentToSegmentDistance`, `pointToPolygonDistance`

The test files reveal this split clearly: `drc-engine.test.ts` (87 lines of imports from component types) never touches `PcbDrcInput`, while `pcb-drc.test.ts` (18 lines of imports including geometry functions) never touches `PartState`. The two test files use completely different helper factory functions and have zero shared setup.

Both engines produce `DRCViolation` objects, but the component engine uses `DRCViolation` from `component-types.ts` while the PCB engine constructs violations with PCB-specific `ruleType` strings (snake_case like `trace_clearance` vs kebab-case like `min-clearance`). This naming inconsistency means consumers must handle both conventions.

**Connection:** This is a natural consequence of [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — the component DRC predates the PCB layout engine (Wave 30 vs Wave 44), and both were added to the same file because it was the canonical "DRC" location. A future split would follow the [[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] pattern.

---

Related:
- [[three-diff-engines-share-identical-algorithm-shape-but-are-not-abstracted-creating-a-subtle-maintenance-trap]] — another case of duplicated infrastructure in shared/
- [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — component DRC and PCB DRC were built in different waves
- [[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] — the natural refactoring path for splitting this file
