---
description: "NPO/C0G ceramic cap — the crystal oscillator's best friend, required pair for 16MHz ATmega resonators on bare-chip Arduino builds"
topics: ["[[passives]]"]
status: needs-test
quantity: 3
voltage: [5]
interfaces: [Passive]
logic_level: "N/A"
manufacturer: "Generic"
capacitance: "22pF"
dielectric: "NPO/C0G"
tolerance: "5%"
voltage_rating: "50V"
package: "Through-hole radial"
compatible_with: []
used_in: []
warnings: ["Value is critical for crystal accuracy — do NOT substitute with random capacitors", "NPO/C0G dielectric is required — X7R or Y5V will shift crystal frequency with temperature", "Leads are tiny and easy to confuse with other small caps — mark or bag separately"]
datasheet_url: ""
---

# 22pF Ceramic Capacitor — NPO/C0G 50V Crystal Load Cap

The standard crystal load capacitor for ATmega328P and ATmega2560 boards running a 16MHz crystal. A matched pair (one on each crystal pin to GND) provides the load capacitance the crystal needs to oscillate at the correct frequency. NPO/C0G dielectric means near-zero capacitance drift with temperature — critical for clock accuracy.

## Specifications

| Spec | Value |
|------|-------|
| Capacitance | 22pF |
| Dielectric | NPO/C0G (Class 1) |
| Tolerance | 5% |
| Voltage Rating | 50V |
| Temperature Stability | +/- 30ppm/C |
| Package | Through-hole radial (disc or MLCC) |
| Marking | Often unmarked or "22" |

## Typical Usage — Crystal Oscillator Circuit

```
Crystal pin 1 → MCU XTAL1
Crystal pin 2 → MCU XTAL2
22pF cap from XTAL1 → GND
22pF cap from XTAL2 → GND
```

This gives a total load capacitance of ~11pF per pin (series combination) plus stray capacitance, matching the typical 20pF load spec of 16MHz HC49 crystals.

## Why NPO/C0G Matters

| Dielectric | Temp Stability | Cap Drift | Use For |
|-----------|---------------|-----------|---------|
| NPO/C0G | Excellent | <1% | Crystal load caps, precision timing |
| X7R | Fair | ~15% | Decoupling, general filtering |
| Y5V | Poor | up to -80% | Bulk bypass only |

---

Related Parts:
- [[100nf-ceramic-capacitor-104-50v-decoupling-bypass]] — different role (decoupling), different dielectric requirements
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — uses this cap value on the onboard 16MHz crystal
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — same crystal circuit, same cap value

Categories:
- [[passives]]
