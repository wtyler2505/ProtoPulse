---
description: "The TXS0108E's OE (output enable) pin is active HIGH with no internal pull-up — leaving it unconnected lets the CMOS input drift LOW and disables all eight channels silently, which looks exactly like a wiring fault because signals reach the pins but never appear on the other side, and the standard fix is to tie OE directly to VCCA so outputs are enabled whenever the low-voltage rail is present"
type: claim
source: "docs/parts/txs0108e-8-channel-bidirectional-level-shifter-auto-direction.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[eda-fundamentals]]"
related_components:
  - "txs0108e-level-shifter"
---

# TXS0108E OE pin is active HIGH and floating by default silently disabling all outputs

The TXS0108E has an OE (Output Enable) pin that gates all eight channels. Its default state when floating is the disabled state, which creates a specific failure class: a freshly-wired level shifter appears dead, signals reach the input pins, but nothing comes out the other side. Probing with a multimeter shows correct supply voltages and correct input signals. The fault is not in any data pin — it is an unterminated control pin.

**The polarity that catches beginners:** OE on the TXS0108E is active HIGH. The typical mental model from other parts ([[74hc595-srclr-and-oe-are-active-low-control-pins-that-must-be-tied-correctly-or-outputs-fail-silently]]) is that OE is active LOW and "tie to GND for always on." On the TXS0108E the opposite is true — tie to VCCA for always on. Tying to GND keeps the chip permanently disabled.

**The floating-input failure:** the OE pin has no internal pull-up or pull-down. Left floating, the CMOS input gate voltage depends on board capacitance, humidity, and nearby signal coupling. It typically drifts LOW, which disables outputs. The chip consumes quiescent current, the channels are powered, but nothing propagates. Some breakout boards include a pull-up resistor on OE; many do not. The design rule is to treat OE as always requiring an explicit connection, regardless of breakout.

**Why this is the same failure class as 74HC595 OE:** both parts have output-enable pins that are floating-hazardous control inputs. The polarity differs (74HC595 is active LOW, TXS0108E is active HIGH), but the failure mode is identical — a CMOS input drifts to the disabled state, and outputs are silent. Adding both chips to a DRC rule as "enable pins requiring explicit tie" catches the same mistake in both families.

**The always-on connection:** tie OE directly to VCCA. This gives a correct enable signal whenever VCCA is present, which is exactly when the A-side is powered and translating. No separate logic is needed for "enable" in a continuous-operation design. For dynamic enable (power gating, hot-swap detection, bus arbitration), OE can be driven by a GPIO from the MCU on the A-side, but the default is hard-tied to VCCA.

**The DRC-level consequence:** a net connected to OE should either (a) reach VCCA directly, or (b) reach an MCU GPIO on the A-side rail. A floating OE net or an OE net tied to GND on a "standard" level-shifter deployment is almost always a wiring error. Detecting this requires a part-specific rule because the correct tie depends on polarity — the 74HC595 expects OE to GND, the TXS0108E expects OE to VCCA, and a generic "tie OE somewhere" rule misses both.

---

Source: [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]]

Relevant Notes:
- [[74hc595-srclr-and-oe-are-active-low-control-pins-that-must-be-tied-correctly-or-outputs-fail-silently]] — the same failure class in a different chip with opposite polarity
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]] — broader family of silent-failure-on-floating-input hazards
- [[active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling]] — the active architecture that requires a gated enable in the first place
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — same principle applied to power-FET gates

Topics:
- [[shields]]
- [[eda-fundamentals]]
