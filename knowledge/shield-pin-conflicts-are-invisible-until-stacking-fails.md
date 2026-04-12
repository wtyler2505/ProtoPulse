---
description: "Arduino shields share pins silently -- the HW-130, Ethernet W5100, and TFT shields all use overlapping SPI/digital pins but no standard mechanism warns about conflicts before stacking"
type: claim
source: "docs/parts/shields.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[eda-fundamentals]]"
related_components:
  - "dk-electronics-hw-130-motor-shield"
  - "velleman-pka042-ethernet-shield"
  - "2p8-inch-tft-lcd-touch-shield"
---

# shield pin conflicts are invisible until stacking fails

The shield inventory reveals significant pin overlap that has no built-in detection mechanism. The HW-130 motor shield uses D3, D4, D5, D6, D8, D11, D12. The Ethernet W5100 uses SPI (ICSP) + D10 + D4. The TFT LCD shield uses SPI + analog + D8-D10. Attempting to stack the motor shield with either the Ethernet or TFT shield creates hard conflicts on D4 (motor + Ethernet) and D8 (motor + TFT) that manifest as silent malfunction, not an error message.

The shields.md MOC includes a "Pin Conflict Warnings" section that's currently empty -- this is itself evidence that pin conflicts are tracked as an afterthought rather than a first-class concern.

**Maker impact:** A beginner stacking shields will get mysterious behavior (motor not responding, SPI communication failing) with no clear diagnostic path. The failure mode is "works individually, fails together" which is particularly confusing.

**ProtoPulse implication:** A shield stacking DRC that cross-references pin usage tables from the BOM would catch these conflicts at design time rather than after assembly. The shields MOC already has the data (Pins Used column) -- it just needs automated cross-referencing.

---

Relevant Notes:
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- Mega has physical shield compatibility considerations too
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- Shield selection relates to driver IC choice

Topics:
- [[shields]]
- [[eda-fundamentals]]
