---
description: "A 1000uF electrolytic capacitor across 5V and GND near the NeoPixel ring absorbs the inrush current surge when all LEDs turn on simultaneously at full brightness"
type: knowledge-note
source: "docs/parts/ws2812b-neopixel-ring-status-led-array-for-system-feedback.md"
topics:
  - "[[displays]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# NeoPixel rings need a bulk electrolytic capacitor across power to absorb inrush current

When a NeoPixel ring transitions from off (or low brightness) to all-white at full brightness, the current demand jumps by hundreds of milliamps instantaneously. A 16-LED ring going from 0 to full white jumps from 0 to 800mA in microseconds. This inrush current:

- Causes a voltage dip on the 5V rail that can brown out the MCU
- Produces voltage transients that corrupt the WS2812B data protocol
- Can trip overcurrent protection on regulated supplies

**The fix:**
A 1000uF electrolytic capacitor across the ring's 5V and GND pins, placed physically close to the ring. The capacitor:
- Acts as a local charge reservoir that supplies the instantaneous current
- Smooths the voltage dip before it propagates back to the power supply
- Absorbs transients during rapid color changes

**This is distinct from other capacitor use cases in the inventory:**
- [[78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability]] -- regulator stability (preventing oscillation)
- [[max7219-requires-both-ceramic-and-electrolytic-decoupling-caps-or-spi-communication-becomes-unreliable]] -- SPI noise filtering
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] -- flyback spike protection
- NeoPixel bulk cap -- inrush current smoothing (a current problem, not a voltage spike problem)

**The three NeoPixel wiring rules (all mandatory):**
1. 300-500 ohm series resistor on data line
2. 1000uF electrolytic capacitor across power
3. Common ground between MCU and ring

---

Topics:
- [[displays]]
- [[power-systems]]
