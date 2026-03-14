---
summary: The view-sync engine reconciles schematic nets and breadboard wires by computing sorted-pair "connection signatures" (instanceId:pin sorted alphabetically), enabling direction-independent comparison across views
category: implementation-detail
areas: ["[[index]]"]
related insights:
  - "[[every-component-must-define-geometry-three-times-schematic-breadboard-pcb-because-eda-tools-traditionally-decouple-logical-from-physical-representations]] — view-sync is the mechanism that keeps these three representations consistent"
  - "[[the-gap-between-feature-exists-and-feature-is-wired]] — view-sync is pure logic but needs UI triggers to actually execute"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - every-component-must-define-geometry-three-times-schematic-breadboard-pcb-because-eda-tools-traditionally-decouple-logical-from-physical-representations.md
  - the-gap-between-feature-exists-and-feature-is-wired.md
---

The view-sync engine (`client/src/lib/circuit-editor/view-sync.ts`) solves a fundamental EDA problem: how to keep schematic connections (logical nets with segments) in sync with breadboard wires (physical pixel-coordinate paths) when either view can be edited independently.

The key insight is the **canonical connection signature**: `segmentSignature()` takes a net segment's `fromInstanceId:fromPin` and `toInstanceId:toPin`, sorts them alphabetically, and joins them with `<>`. This creates a direction-independent identifier (`"3:SDA<>7:A4"` is the same regardless of which end is "source"). This matters because schematic connections are directional (source→target) but physical wires are not.

The reconciliation works in two directions:

**Schematic→Breadboard (`syncSchematicToBreadboard`)**: For each net segment, compute its signature and check if a matching breadboard wire exists (by resolving breadboard wire endpoints back to instance:pin pairs via `resolvePixelToPin`). Missing connections produce `wiresToCreate` entries. Orphaned breadboard wires produce `wireIdsToDelete` entries, BUT with a critical distinction: wires whose net still exists but whose segment doesn't match are reported as **conflicts** rather than deletions, because the user may have intentionally routed them differently on the breadboard.

**Breadboard→Schematic (`syncBreadboardToSchematic`)**: The reverse — resolve each breadboard wire's endpoints to instance:pin pairs, check if a matching schematic segment exists. Missing connections produce schematic wire entries. The asymmetry: schematic-only connections (nets with no breadboard wire) are reported as informational conflicts, never as deletions, because the schematic is treated as the source of truth.

The **pin resolution pipeline** has three fallback levels: (1) precise pin terminal positions from the component part's connector definitions, (2) instance origin as approximation when no pin data exists, (3) null when the instance isn't placed on the target view at all. A 15-pixel snap tolerance (`PIN_SNAP_TOLERANCE`) handles minor placement imprecision.

## Topics

- [[index]]
