---
description: "A 300-500 ohm resistor between the MCU GPIO pin and the NeoPixel DIN pin damps voltage reflections from wire inductance that can corrupt the timing-critical 800kHz NZR protocol"
type: knowledge-note
source: "docs/parts/ws2812b-neopixel-ring-status-led-array-for-system-feedback.md"
topics:
  - "[[displays]]"
  - "[[breadboard-intelligence]]"
confidence: high
verified: false
---

# NeoPixel data line needs a 300-500 ohm series resistor to suppress signal reflections

The WS2812B data protocol uses 800kHz NZR encoding where bit values are determined by pulse width (400ns vs 800ns HIGH time). This makes the data line sensitive to signal reflections -- voltage spikes caused by impedance mismatches between the MCU output, the wire, and the LED input.

**The fix:**
Place a 330 ohm resistor (any value 300-500 ohm works) in series between the MCU GPIO pin and the first NeoPixel's DIN pin. This:
- Damps reflections at the source before they propagate
- Limits current spikes on the data pin during transitions
- Has negligible effect on signal voltage (the LED input is high-impedance, so voltage drop across the resistor is minimal)

**When it matters most:**
- Wire length > 10cm between MCU and first LED
- Breadboard wiring (high parasitic inductance from jumper wire routing)
- Multiple NeoPixel chains on nearby GPIO pins (crosstalk)

**When you can skip it (but shouldn't):**
- Short wires (<5cm) on a PCB with controlled traces
- Even then, the 330 ohm resistor costs nothing and prevents intermittent failures that are extremely hard to debug

This is a different protection mechanism than decoupling capacitors (which filter power supply noise). The series resistor protects the signal path; the capacitor protects the power path.

---

Topics:
- [[displays]]
- [[breadboard-intelligence]]
