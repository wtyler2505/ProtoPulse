---
description: "Multiple SPI devices on one bus (like W5100 + SD card on the Ethernet shield) share MOSI/MISO/SCK but each needs a dedicated CS pin held HIGH when inactive — violating this causes bus contention"
type: claim
source: "docs/parts/velleman-pka042-ethernet-shield-w5100-for-arduino.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[shields]]"
related_components:
  - "velleman-pka042-ethernet-shield"
---

# SPI bus sharing on a single shield requires per-device chip select discipline where unused devices must be explicitly deselected

The Ethernet shield puts two SPI devices on the same bus: the W5100 Ethernet IC (CS on D10) and a micro-SD card slot (CS on D4). Both share MOSI, MISO, and SCK through the ICSP header. Only one device can be active at a time — the active device's CS is pulled LOW while all others must be held HIGH, or both devices will try to drive MISO simultaneously, corrupting data on the bus.

The W5100 Ethernet library documentation warns: "D10 — Reserved — even if not using Ethernet, keep as OUTPUT." This is because if D10 floats or is configured as INPUT, the ATmega's SPI hardware may exit master mode (per [[uno-d10-must-stay-output-for-hardware-spi-master-mode]]), and the W5100 may not properly tri-state its MISO line, causing bus contention with the SD card.

**The general SPI CS discipline pattern:**
1. Initialize ALL CS pins as OUTPUT and set HIGH before `SPI.begin()`
2. Before talking to device A, set A's CS LOW
3. After the transaction, set A's CS HIGH immediately
4. Only then can device B's CS go LOW

This pattern scales to any number of SPI devices on one bus (SD card, RFID reader, display, shift register) but the failure mode is always the same: two devices driving MISO at once → garbled reads → mysterious data corruption that looks like a wiring problem.

**ProtoPulse implication:** The schematic DRC should detect multiple SPI CS pins in a design and verify that the code initializes all of them as OUTPUT/HIGH before any SPI transactions. The BOM view could highlight "SPI bus participants" as a group when the Ethernet shield is present, flagging potential CS conflicts with other SPI devices like the [[rc522-mfrc522-rfid-reader-13mhz-spi-3v3]].

---

Relevant Notes:
- [[uno-d10-must-stay-output-for-hardware-spi-master-mode]] -- the D10/SS silicon trap is a special case of CS discipline
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- CS pin numbers change on Mega; discipline must adapt
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] -- inter-shield CS conflicts are the multi-shield version of this pattern

Topics:
- [[communication]]
- [[shields]]
