---
description: "Classic general-purpose NPN transistor — the default choice for switching small loads and signal amplification, 40V/600mA in TO-92"
topics: ["[[passives]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [GPIO]
logic_level: "5V"
manufacturer: "Generic"
part_number: "PN2222A"
package: "TO-92"
pinout: |
  Pin 1 → Emitter  (flat side facing you, left)
  Pin 2 → Base     (flat side facing you, center)
  Pin 3 → Collector (flat side facing you, right)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Always use a base resistor (1K-10K) — driving base directly from GPIO will overcurrent the pin", "Max collector current is 600mA — for bigger loads use a MOSFET like the [[p30n06le-n-channel-logic-level-mosfet-60v-30a]]", "Power dissipation limited to 625mW in TO-92 — derate above 25C"]
alternatives: ["[[s8050-npn-transistor-25v-500ma-medium-power-to92]]"]
datasheet_url: ""
---

# PN2222A NPN Transistor — 40V 600mA General Purpose TO-92

The textbook NPN transistor. Use it to switch small DC loads (LEDs, relay coils, buzzers) from a microcontroller GPIO pin, or as a signal amplifier. A 1K base resistor from a 5V GPIO gives roughly 4.5mA base current, which with hFE of 100-300 can saturate the transistor for loads up to ~450-600mA.

## Specifications

| Spec | Value |
|------|-------|
| Type | NPN Bipolar Junction Transistor |
| Vceo (max) | 40V |
| Ic (max) | 600mA |
| hFE (DC gain) | 100-300 |
| Vbe(sat) | ~0.7V |
| Vce(sat) | ~0.3V @ 150mA |
| Power Dissipation | 625mW (TO-92, free air) |
| Package | TO-92 |

## Typical Wiring (Low-side switch)

```
Load+ → V+ supply (up to 40V)
Load- → Collector (pin 3)
Emitter (pin 1) → GND
Base (pin 2) → 1K resistor → Arduino digital pin
```

For inductive loads (relay coils, solenoids), add a flyback diode across the load (cathode to V+).

## Base Resistor Selection

| Supply | Load Current | Base Resistor | Notes |
|--------|-------------|---------------|-------|
| 5V GPIO | <100mA | 4.7K | Conservative, stays in saturation |
| 5V GPIO | 100-300mA | 1K-2.2K | Good saturation margin |
| 5V GPIO | 300-600mA | 470R-1K | Pushing limits, check Pd |
| 3.3V GPIO | <100mA | 2.2K-3.3K | Works but less headroom |

---

Related Parts:
- [[s8050-npn-transistor-25v-500ma-medium-power-to92]] — similar role, slightly lower voltage/current rating
- [[p30n06le-n-channel-logic-level-mosfet-60v-30a]] — for loads above 600mA, switch to a MOSFET
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V GPIO drives this transistor perfectly with a base resistor
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — same 5V GPIO compatibility

Categories:
- [[passives]]
