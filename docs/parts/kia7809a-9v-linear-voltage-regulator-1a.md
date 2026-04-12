---
description: "9V fixed linear voltage regulator — 1A output, TO-220 package, drop-in replacement for 7809. Use when you need a stable 9V rail from a higher-voltage source"
topics: ["[[power]]"]
status: needs-test
quantity: 1
voltage: [9]
interfaces: []
logic_level: "N/A"
manufacturer: "KIA (KEC)"
part_number: "KIA7809A"
package: "TO-220"
pinout: |
  Pin 1 → Input (11.5-35V DC)
  Pin 2 → GND
  Pin 3 → Output (9V regulated)
  Tab   → GND
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[lm2596-adjustable-buck-converter-module-3a-step-down]]"]
used_in: []
warnings: ["Linear regulator — dissipates (Vin - 9V) * I_load as heat. Needs heatsink at high current or high input voltage", "Minimum dropout ~2.5V — input must be at least 11.5V for stable 9V output", "Add 0.33uF cap on input and 0.1uF cap on output close to the regulator for stability"]
datasheet_url: ""
---

# KIA7809A — 9V Linear Voltage Regulator 1A

A standard 78xx-series fixed voltage regulator outputting 9V at up to 1A. Drop-in compatible with the LM7809. Takes a higher DC voltage (11.5-35V) and regulates it down to a stable 9V. Being a linear regulator, it dumps excess voltage as heat — so if you're dropping from 24V to 9V at 500mA, that's (24-9)*0.5 = 7.5W of heat, which absolutely requires a heatsink.

## Specifications

| Spec | Value |
|------|-------|
| Output Voltage | 9V |
| Max Output Current | 1A |
| Input Voltage | 11.5-35V |
| Dropout Voltage | ~2.5V |
| Package | TO-220 |
| Thermal Shutdown | Yes |
| Short Circuit Protection | Yes |

## Wiring

```
Vin (11.5-35V) → [0.33uF cap to GND] → Pin 1 (Input)
                                          Pin 2 → GND
                                          Pin 3 (Output) → [0.1uF cap to GND] → 9V rail
```

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — 9V output can power via Vin pin (Mega's onboard regulator steps down to 5V)
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — same Vin power path as genuine Mega
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — a 12V buck output makes a good input source for this 9V regulator (only 3V drop = 1.5W at 500mA, manageable heat)
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — do NOT feed 36V directly into this regulator at high current; (36-9)*1A = 27W of heat dissipation is impractical

Categories:
- [[power]]
