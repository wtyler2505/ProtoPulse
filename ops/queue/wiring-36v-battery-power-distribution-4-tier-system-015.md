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

Added complete capacitor-placement table to target insight `knowledge/zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory.md`. Table tabulates 7 specific placements across battery bus, ZS-X11H V+/V-, LM2596 input/output, 5V rail, ESP32 Vin, and per-IC VCC. Wiki-linked to `[[10uf-ceramic-on-esp32-vin...]]` and `[[every-digital-ic-requires-a-100nf...]]`. Places the 470uF in systemic context rather than as an isolated rule. Ralph lead 2026-04-14.

## Connect

**Discovery Trace:**
- Topic maps — target note has [[power-systems]] as topic; also should appear in an actuator/motor-driver MOC.
- Target note inline links verified: 11 wikilinks including 10uF-ESP32-cap (claim-004), every-digital-IC-100nF, four-motor-BMS (enrich-014), zs-x11h component datasheet, driver-IC-selection, motor-shield-ladder.
- Sibling candidates: claim-004 (10uF ESP32) cited here; bidirectional link exists. [[four-motor-bldc-systems...]] (enrich-014) cited here; bidirectional link exists.

**Connections verified:** 11 inline prose links + 2+ topics. Articulation test PASS. Strong hub node spanning actuators and power distribution.

**MOC updates:** Target note sits at the power/actuators boundary. [[power-systems]] MOC should cross-link to an actuators MOC (if exists) for this note. Flagged for future MOC polish.

**Agent note:** This note answers "why does the bare ZS-X11H need external protection the datasheet doesn't call out?" — a gap-filling claim that covers a failure mode beginners discover the expensive way. High incoming potential as the "ZS-X11H reliability" canonical reference.

## Revisit
## Verify
