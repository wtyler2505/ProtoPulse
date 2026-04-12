---
description: "The MAX7219 DIG pins sink current (pull to GND), so only common-cathode displays are compatible -- common-anode displays need sourced current on the digit pin, which this IC cannot provide"
type: knowledge-note
source: "docs/parts/max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# MAX7219 only works with common-cathode displays because DIG pins are current sinks

The MAX7219's 8 DIG (digit/column) pins are designed as current sinks -- they pull current from the LED common pin down to ground. This means:

- **Common cathode displays:** The shared cathode connects to a DIG pin. Current flows from V+ through the SEG (segment) pin, through the LED, into the DIG pin to ground. This works.
- **Common anode displays:** The shared anode needs current sourced TO it (from a high-side driver). The DIG pin cannot source current. Nothing lights up.

**Why this is a hard constraint:**
- There is no software setting, jumper, or external circuit that can work around this. It is an architectural decision in the MAX7219's silicon.
- The MAX7221 (the SPI-compatible variant) has the same limitation.
- If you have common-anode displays and need a driver, the AS1107 or a discrete transistor multiplexing circuit are alternatives.

**DRC relevance for ProtoPulse:**
When a schematic pairs a MAX7219 with a 7-segment display or LED matrix, the bench coach should verify that the display is common-cathode. This check should be an immediate hard error, not a warning, because the mismatch produces zero output with no diagnostic clue.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
