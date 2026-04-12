---
description: "Medium power NPN transistor — higher gain than PN2222A (hFE up to 400) but lower voltage ceiling, good for 3.3V-driven switching"
topics: ["[[passives]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [GPIO]
logic_level: "5V"
manufacturer: "Generic"
part_number: "S8050"
package: "TO-92"
pinout: |
  Pin 1 → Emitter  (flat side facing you, left)
  Pin 2 → Base     (flat side facing you, center)
  Pin 3 → Collector (flat side facing you, right)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Always use a base resistor (1K-10K) — never drive base directly from GPIO", "Max Vceo is only 25V — do NOT use for loads above 25V, use PN2222A instead", "Power dissipation limited to 625mW in TO-92"]
alternatives: ["[[pn2222a-npn-transistor-40v-600ma-general-purpose-to92]]"]
datasheet_url: ""
---

# S8050 NPN Transistor — 25V 500mA Medium Power TO-92

A medium-power NPN transistor commonly found in Asian component kits. Higher gain (hFE 40-400) than the PN2222A makes it easier to saturate from a 3.3V GPIO, but the lower Vceo (25V) limits what loads you can switch. Best for low-voltage switching: LEDs, small motors, buzzers, logic-level loads.

## Specifications

| Spec | Value |
|------|-------|
| Type | NPN Bipolar Junction Transistor |
| Vceo (max) | 25V |
| Ic (max) | 500mA |
| hFE (DC gain) | 40-400 (typ ~200 @ 50mA) |
| Vbe(sat) | ~0.7V |
| Vce(sat) | ~0.6V @ 500mA |
| Power Dissipation | 625mW (TO-92, free air) |
| Package | TO-92 |

## Typical Wiring (Low-side switch)

```
Load+ → V+ supply (up to 25V)
Load- → Collector (pin 3)
Emitter (pin 1) → GND
Base (pin 2) → 1K resistor → Arduino/ESP digital pin
```

## PN2222A vs S8050 — Which One?

| Factor | PN2222A | S8050 | Pick |
|--------|---------|-------|------|
| Max voltage | 40V | 25V | PN2222A for higher voltage loads |
| Max current | 600mA | 500mA | PN2222A for higher current |
| Gain (hFE) | 100-300 | 40-400 | S8050 for 3.3V GPIO drive |
| Availability | Global standard | Common in kits | PN2222A for replacements |

**Rule of thumb:** If your load is under 25V and you're driving from 3.3V, the S8050's higher gain makes it the better pick. For anything else, use the PN2222A.

---

Related Parts:
- [[pn2222a-npn-transistor-40v-600ma-general-purpose-to92]] — higher voltage/current sibling, interchangeable for many circuits
- [[p30n06le-n-channel-logic-level-mosfet-60v-30a]] — for loads above 500mA, switch to a MOSFET
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V GPIO drives this with ease
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — same 5V GPIO compatibility

Categories:
- [[passives]]
