---
description: "The MAX7219 needs a 100nF ceramic AND a 10uF electrolytic capacitor between V+ and GND close to the chip -- omitting either causes display flicker and SPI data corruption"
type: knowledge-note
source: "docs/parts/max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins.md"
topics:
  - "[[displays]]"
  - "[[breadboard-intelligence]]"
confidence: high
verified: false
---

# MAX7219 requires both ceramic and electrolytic decoupling caps or SPI communication becomes unreliable

The MAX7219 draws up to 330mA (all segments on) in rapid switching patterns, creating significant power supply noise. It requires TWO decoupling capacitors:

1. **100nF ceramic** -- filters high-frequency noise from the internal multiplexing oscillator and SPI clock transitions. Must be placed physically close to the chip (within 10mm of V+ and GND pins).
2. **10uF electrolytic** -- provides a bulk charge reservoir for the sudden current surges when multiple segments switch simultaneously. Can be slightly further from the chip than the ceramic.

**Why both are needed (not just one):**
- A ceramic capacitor alone handles high-frequency noise but cannot supply the bulk current during full-display transitions.
- An electrolytic capacitor alone handles bulk current but is too slow (high ESR) to filter the MHz-range switching noise.
- Together, they cover the full frequency spectrum: ceramic for fast transients, electrolytic for sustained current demand.

**Symptoms of missing caps:**
- Random display flicker that does not correlate with code changes
- SPI data corruption (wrong digits displayed, or digits that change spontaneously)
- Symptoms that worsen as more segments are lit simultaneously (higher current demand)

This is stricter than typical IC decoupling, which usually needs only a single 100nF ceramic. The MAX7219's high switching current demands the dual-cap approach, similar to [[78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability]].

---

Topics:
- [[displays]]
- [[breadboard-intelligence]]
