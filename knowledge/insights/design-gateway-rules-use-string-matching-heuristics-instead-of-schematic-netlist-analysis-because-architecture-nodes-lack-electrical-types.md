---
summary: Design Gateway validation rules use substring-matching heuristics on node labels and types (e.g. "mcu", "capacitor") because architecture nodes are semantic blocks without formal electrical pin models, making true ERC impossible at this level
category: architectural-decision
areas: ["[[index]]"]
related insights:
  - "[[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — the gateway suggestions include specific component values and guidance for beginners"
  - "[[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — heuristic rules are appropriate for the architecture level where beginners work; formal ERC belongs to the schematic level"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker.md
  - the-maker-to-professional-spectrum-is-the-fundamental-ux-tension.md
---

The Design Gateway (`client/src/lib/design-gateway.ts`) runs 12 heuristic validation rules against architecture-level design state. Unlike the formal DRC engine (`shared/drc-engine.ts`) which operates on schematic/PCB data with real electrical connectivity, the gateway operates on `DesignNode` objects that have only `label`, `type`, and a freeform `properties` map — no pin models, no netlists, no voltage domains.

This forces every rule to use **substring matching** for component classification. For example:
- `isIC()` checks if the label or type contains any of 25 patterns: "mcu", "microcontroller", "arduino", "esp32", "op-amp", "timer", etc.
- `isCapacitor()` matches "capacitor", "cap", "decoupling", "bypass"
- `isI2COrSPI()` searches across label + type + properties.bus + properties.protocol

The adjacency graph is reconstructed per-rule from flat edge arrays via `buildAdjacency()`, since architecture edges don't carry pin-level connectivity. This means the "missing decoupling capacitor" rule simply checks whether any capacitor node is connected to the IC node — it cannot verify that the cap is actually on the VCC pin, or that it's the right value.

The architecture choice to run heuristic validation at the block-diagram level (before the user has even started schematic capture) is pedagogically motivated: it teaches beginners about decoupling caps, pull-up resistors, crystal load caps, and reverse polarity protection at the moment they're designing their system topology, not after they've already committed to a schematic. The trade-off is false positives (a cap connected for signal coupling will satisfy the "has decoupling cap" check) and false negatives (the rule can't catch a decoupling cap that's placed but wired to the wrong power rail).

Rules include specific, actionable suggestions (e.g., "Add a 100 nF ceramic capacitor between VCC and GND as close to the IC as possible") that embed electronics domain knowledge — making the gateway simultaneously a validation tool and a teaching tool.

---

Related:
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — the gateway suggestions embed the same pedagogical pattern as DRC explanations
- [[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — heuristic rules are appropriate for the architecture level where beginners work; formal ERC belongs to the schematic level
- [[drc-engine-exports-two-completely-separate-rule-systems-from-one-file-creating-a-hidden-api-surface-split]] — the gateway is effectively a third DRC system (heuristic, not geometric) that operates at the architecture abstraction level
- [[progressive-disclosure-hides-downstream-views-until-architecture-nodes-exist-preventing-empty-state-errors]] — the gateway validates AT the architecture level, before the user even reaches schematic/PCB where formal DRC applies

## Topics

- [[index]]
