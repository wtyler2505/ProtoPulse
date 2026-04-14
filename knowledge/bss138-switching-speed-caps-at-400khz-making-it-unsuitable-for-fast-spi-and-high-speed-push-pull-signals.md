---
description: "BSS138-based bidirectional level shifters cap at roughly 400kHz reliable operation because the HV-side rising edge depends on the 10K pull-up charging bus capacitance through an RC time constant — this ceiling rules out SPI above 1MHz, fast push-pull signals, and any protocol with strict edge-rate requirements regardless of the BSS138 MOSFET's intrinsic switching speed"
type: claim
source: "docs/parts/hw-221-8-channel-bidirectional-level-shifter-bss138-based.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[communication]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hw-221-level-shifter"
  - "txs0108e-level-shifter"
---

# BSS138 switching speed caps at 400kHz making it unsuitable for fast SPI and high-speed push-pull signals

The BSS138 MOSFET itself can switch in tens of nanoseconds. The BSS138-based level shifter cannot, and the reason is topological: the rising edge on both LV and HV sides is not driven actively — it is the RC charge of the pull-up resistor pulling against the line's capacitance. Treating the shifter as "as fast as its MOSFET" is the source of many marginal-signal debugging sessions.

**The RC math that sets the ceiling:** Each side has a 10K pull-up. Bus capacitance on a short breadboard I2C run is 50-100pF. RC time constant is 0.5-1µs. A clean logic transition requires roughly 3 time constants (~95% of final value), so rise time is 1.5-3µs. For reliable data, the bit period must be several times the rise time. At 400kHz bus clock, the bit period is 2.5µs — already close to the rise time limit. At 1MHz (SPI standard mode), the bit period drops to 1µs, which is shorter than the rise time on a typical bus. The signal becomes a triangle wave rather than a square wave and the receiver cannot sample it reliably.

**Why this is different from the BSS138 datasheet spec:** the BSS138 can turn ON in under 10ns. Its fall time in the shifter is fast because the MOSFET actively pulls the line LOW through its channel. But the rise is not driven by the MOSFET — the MOSFET turns OFF, and the pull-up alone charges the capacitance. The asymmetry between fast falling edges and slow rising edges is characteristic of any open-drain or pull-up-based circuit.

**What this rules out:**
- SPI at or above 1MHz (most useful SPI clocks for SD cards, ADCs, radios)
- NeoPixel data at 800kHz (edges must be within ~150ns — the pull-up rise alone consumes that)
- Hall sensor quadrature at kart-motor speeds
- I2S (any audio bit clock — see [[i2s-timing-requirements-make-level-shifting-a-non-solution-for-voltage-incompatible-mcus]])

**What this permits:**
- I2C standard mode (100kHz) and fast mode (400kHz) — the spec was designed around pull-up RC behavior
- UART at standard baud rates (up to ~1Mbaud with careful pull-up selection)
- Low-speed SPI (bit-bang or SD card initialization at <=1MHz)
- Any slow bidirectional signal where the topology needs pull-up resistors anyway

**Mitigations that don't work:** Reducing pull-up resistance below ~1.5K violates I2C sink-current spec (drivers cannot pull LOW against the pull-up current). Increasing pull-up resistance makes rise times worse. Active pull-up circuits exist but defeat the simplicity that made BSS138 shifters attractive. The correct move is to pick a different shifter class when speed is needed — see [[signal-topology-not-voltage-alone-determines-level-shifter-selection]].

---

Source: [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]

Relevant Notes:
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — the mechanism that produces the RC-limited rise
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — the broader selection principle where this speed limit slots in
- [[i2s-timing-requirements-make-level-shifting-a-non-solution-for-voltage-incompatible-mcus]] — specific case where this speed limit combines with edge-rate requirements to rule out level shifting entirely
- [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — the faster alternative for unidirectional push-pull signals
- [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]] — the pull-up sizing constraint that interacts with this RC behavior

Topics:
- [[shields]]
- [[communication]]
- [[eda-fundamentals]]
