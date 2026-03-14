---
summary: The PartViews type requires breadboard + schematic + pcb ViewData for every component, meaning each component carries three independent shape sets with no automatic cross-view consistency
type: pattern
---

# Every component must define geometry three times because the triple-view architecture couples identity to representation

In `shared/component-types.ts`, the `PartViews` interface mandates three independent visual representations:

```typescript
export interface PartViews {
  breadboard: ViewData;   // realistic physical appearance
  schematic: ViewData;    // abstract symbol (IC box, resistor zigzag)
  pcb: ViewData;          // footprint pads and silkscreen
}
```

Each `ViewData` contains `shapes: Shape[]` with full geometry (positions, dimensions, styles). Connectors link to shapes via `shapeIds: Record<string, string[]>` — the key is the view name, the value is shape IDs within that view. Terminal positions are similarly per-view: `terminalPositions: Record<string, TerminalPosition>`.

**What this means practically:**
- The standard library (`shared/standard-library.ts`) currently only defines schematic views for its 120+ components. Breadboard and PCB views are empty `{ shapes: [] }`. This means components render as invisible in breadboard/PCB views until someone creates those shape sets.
- The `buildDipView()` helper generates schematic shapes only. There's no equivalent `buildBreadboardView()` or `buildPcbView()`.
- The `buildMysteryPartView()` function (for unknown components) also only generates schematic shapes.
- Adding a new component to the library is ~3x the effort of a single-view system because three shape sets must be authored independently.

**The connector bridge:** Connectors tie the three views together. A connector like pin 1 has `shapeIds: { schematic: ['pin1-sch'], breadboard: ['pin1-bb'], pcb: ['pin1-pcb'] }` mapping to the physical shape in each view. These shape references are stored in [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary|JSONB columns]] without DB-level referential integrity. The `terminalPositions` provide the wire attachment point in each view's coordinate space. This means connectors are the semantic anchor — the shapes are just visuals, but the connector is the electrical identity.

**Architectural tension:** This design mirrors professional EDA tools (KiCad has separate symbol and footprint editors) but creates a bootstrapping problem for a platform aimed at beginners. Professional users expect separate representations; beginners expect "I placed a resistor" to show something in every view automatically. The `createDefaultPartState()` factory initializes all three views as empty — the component exists but is invisible until shapes are authored for each view.

Each component part uses [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary|dual IDs]] (serial `id` for DB references, text `nodeId` for canvas operations) to bridge database storage and the per-view rendering across all three representations.

**Connection:** This is related to [[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — components can exist in the library but be functionally invisible in 2 of 3 views.

---

Related:
- [[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — components with empty breadboard/PCB views are "unwired" in 2 of 3 views
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — PartViews is stored in JSONB, making the triple-view structure DB-invisible
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — componentParts dual IDs bridge DB storage and canvas rendering
- [[three-diff-engines-share-identical-algorithm-shape-but-are-not-abstracted-creating-a-subtle-maintenance-trap]] — the arch-diff engine diffs the architecture view; if triple-view components were diffable, three more diff engines would be needed
- [[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — beginners expect one placement = visible everywhere; pros expect separate symbol/footprint editors
- [[progressive-disclosure-hides-downstream-views-until-architecture-nodes-exist-preventing-empty-state-errors]] — components with empty breadboard/PCB views are an invisible form of non-disclosure: the view is unlocked but the content is blank
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — DRC rules span all three views; a missing explanation in one view's rules creates a pedagogical gap
