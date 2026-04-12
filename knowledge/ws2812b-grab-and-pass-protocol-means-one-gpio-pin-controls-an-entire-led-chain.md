---
description: "Each WS2812B NeoPixel has an integrated controller that consumes its 24-bit color value from the serial data stream and forwards the remainder to the next LED -- one GPIO pin drives any chain length"
type: knowledge-note
source: "docs/parts/ws2812b-neopixel-ring-status-led-array-for-system-feedback.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# WS2812B grab-and-pass protocol means one GPIO pin controls an entire LED chain

The WS2812B (NeoPixel) architecture embeds a tiny controller inside each LED package. When a stream of 24-bit color values arrives on the data input (DIN), each LED:

1. **Grabs** the first 24 bits (8 green, 8 red, 8 blue) for itself.
2. **Passes** all remaining bits to its data output (DOUT), which connects to the next LED's DIN.

This cascade means:
- **One GPIO pin** controls the entire chain, regardless of length (8, 16, 64, or more LEDs).
- **No addressing** -- LED position is determined by physical order in the chain, not a register or address byte.
- **800kHz NZR protocol** -- the data timing is strict (T0H=400ns, T0L=850ns, T1H=800ns, T1L=450ns). This is bit-banged on most platforms, which means interrupts during transmission corrupt the data.

**Comparison with MAX7219 (the other LED driver in inventory):**
- MAX7219 uses SPI (3 pins) to address specific registers. The WS2812B uses a single-wire protocol with no register model.
- MAX7219 is interrupt-safe (latched SPI). WS2812B transmission must not be interrupted.
- MAX7219 handles 64 LEDs max. WS2812B chains are theoretically unlimited (limited by refresh rate and power).

**The PIO connection:**
The RP2040's PIO state machines ([[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]]) can generate the WS2812B timing in hardware, freeing the CPU entirely. This is why NeoPixels and RP2040/Pico are a natural pairing.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
