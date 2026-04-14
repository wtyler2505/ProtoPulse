---
type: enrichment
target_note: "[[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "Explicit 470uF 63V electrolytic capacitor placement across each ZS-X11H's V+/V- as the motor-side flyback absorber — existing note mentions this cap in passing but does not tabulate it alongside the other capacitor placements (LM2596 inputs/outputs, ESP32 Vin) as a systemic power-distribution pattern"
source_lines: "344-352"
---

# Enrichment 015: ZS-X11H protection note — add 470uF 63V cap placement detail

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 344-352)

## Reduce Notes

Enrichment for [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]]. Source provides the complete capacitor placement table for a rover power system, of which the 470uF 63V across ZS-X11H is one row. Tabulating all capacitor placements together gives the reader the full decoupling strategy in context.

Rationale: The existing note already mentions 470uF, but the enrichment places it within the complete decoupling strategy (6 specific cap placements across all power tiers) which makes the ZS-X11H requirement part of a coherent pattern rather than an isolated rule.

---

## Enrich
## Connect
## Revisit
## Verify
