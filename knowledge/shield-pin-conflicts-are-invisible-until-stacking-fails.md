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

**The ICSP header as portable SPI path:** On the Arduino Mega, SPI pins move from D10-D13 to D50-D53 -- but the ICSP 6-pin header carries SPI in the same physical position on both Uno and Mega. Shields that route SPI through ICSP (like the Ethernet shield) work on either board without modification. Shields that hardwire D10-D13 for SPI will not work on a Mega. This creates a concrete resolution strategy: when evaluating shield compatibility, check whether SPI is routed via ICSP (portable) or via pin numbers (board-specific).

**Intra-shield conflicts exist too:** The Ethernet shield itself has two SPI devices (W5100 on D10, SD card on D4) sharing the same MOSI/MISO/SCK bus. Even within a single shield, chip select discipline matters — if D10 is not kept as OUTPUT, the W5100 may not tri-state MISO, corrupting SD card reads. This means pin conflicts aren't just an inter-shield stacking problem; they can happen within a single shield's own circuitry.

**Power budget compounds stacking risk:** The Ethernet shield alone draws ~150mA from the 5V rail. USB power supplies ~450mA usable to shields after board overhead. Stacking a motor shield or servo shield alongside the Ethernet shield can exceed USB power capacity, causing brownouts that manifest as network disconnects or SD card corruption — not obvious power symptoms.

**ProtoPulse implication:** A shield stacking DRC that cross-references pin usage tables from the BOM would catch these conflicts at design time rather than after assembly. The shields MOC already has the data (Pins Used column) -- it just needs automated cross-referencing. The DRC should also distinguish ICSP-routed SPI (Mega-safe) from pin-routed SPI (Mega-incompatible). A power budget checker should sum shield current draws and warn when total exceeds USB supply headroom.

---

Relevant Notes:
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- Mega has physical shield compatibility considerations too
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- Shield selection relates to driver IC choice
- [[spi-bus-sharing-on-a-single-shield-requires-per-device-chip-select-discipline-where-unused-devices-must-be-explicitly-deselected]] -- intra-shield SPI CS discipline (W5100 + SD card)

Topics:
- [[shields]]
- [[eda-fundamentals]]
