---
description: "MAX7219 pins 4 and 9 are both GND but not connected internally -- leaving one unconnected creates a partial ground path that causes erratic behavior"
type: knowledge-note
source: "docs/parts/max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins.md"
topics:
  - "[[displays]]"
  - "[[breadboard-intelligence]]"
confidence: high
verified: false
---

# Both MAX7219 GND pins must be connected because they are not internally bridged

The MAX7219 has two GND pins (pin 4 and pin 9) that are NOT internally connected. Both must be wired to ground. Leaving either one floating means the chip operates on a partial ground path, which causes:

- Display flickering at random intervals
- Corrupted SPI data reception
- Inconsistent brightness across digits/rows
- Intermittent total display failure

**Why beginners miss this:**
Most ICs with multiple GND pins have them internally bridged as a convenience (and for thermal dissipation). The expectation that "one GND is enough" is valid for most chips but fails for the MAX7219. The datasheet specifies both must be connected, but beginners often skim past pin tables.

**Breadboard-specific risk:**
On a breadboard, the two GND pins are physically separated (pins 4 and 9 on a 24-pin DIP). If the ground bus has a break or poor contact on one side, one GND pin may be effectively disconnected. This produces symptoms identical to SPI communication errors, leading to a wild goose chase through software debugging when the issue is physical wiring.

This parallels [[l293d-ground-pins-are-the-primary-thermal-dissipation-path-not-just-electrical-connections]] -- another IC where "extra" ground pins serve a critical function beyond redundancy.

---

Topics:
- [[displays]]
- [[breadboard-intelligence]]
