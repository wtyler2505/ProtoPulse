---
type: enrichment
target_note: "[[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "The specific ANL 100A slow-blow fuse as the hardware mitigation that complements firmware current limiting, and the Albright SW200 contactor (200A continuous, 36-48V DC) as the high-current-capable e-stop replacement for panel-mount pushbuttons"
source_lines: "286-325"
---

# Enrichment 014: 4-motor BMS note — add ANL fuse and SW200 contactor as hardware mitigation

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 286-325)

## Reduce Notes

Enrichment for [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]]. Source adds the specific part selections (ANL 100A fuse + Albright SW200 contactor) that complement firmware current limiting as the hardware side of the protection stack. Current note covers the software side only.

Rationale: Naming specific parts with their ratings makes the note actionable for BOM selection, not just a principle. The SW200's 200A continuous rating provides margin above the 60A+ peak draw.

---

## Enrich
## Connect
## Revisit
## Verify
