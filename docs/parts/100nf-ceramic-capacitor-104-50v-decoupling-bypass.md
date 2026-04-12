---
description: "The universal decoupling capacitor — every IC needs one, place 100nF as close to VCC/GND pins as possible to suppress noise and prevent brownout resets"
topics: ["[[passives]]"]
status: needs-test
quantity: 3
voltage: [3.3, 5]
interfaces: [Passive]
logic_level: "N/A"
manufacturer: "Generic"
capacitance: "100nF (0.1uF)"
dielectric: "X7R or Y5V"
tolerance: "10-20%"
voltage_rating: "50V"
package: "Through-hole radial"
compatible_with: []
used_in: []
warnings: ["Essential for every IC — place as close to VCC/GND pins as possible", "Marking '104' means 10 x 10^4 pF = 100,000pF = 100nF", "Without decoupling caps, MCUs will randomly reset, ADC readings will be noisy, and I2C/SPI will glitch"]
datasheet_url: ""
---

# 100nF Ceramic Capacitor — 104 Marking, 50V Decoupling/Bypass

The single most important passive component in electronics. One of these belongs next to every IC's VCC/GND pins — it absorbs the high-frequency current spikes that digital switching generates, preventing supply voltage dips that cause resets, ADC noise, and communication errors. The "104" marking means 10 x 10^4 picofarads = 100nF = 0.1uF.

## Specifications

| Spec | Value |
|------|-------|
| Capacitance | 100nF (0.1uF) |
| Marking | "104" |
| Dielectric | X7R or Y5V |
| Tolerance | 10-20% (doesn't matter for decoupling) |
| Voltage Rating | 50V |
| Package | Through-hole radial (disc or MLCC) |

## How to Use

**Rule: one per IC, as close as possible.**

```
IC VCC pin → 100nF cap → IC GND pin
Keep leads SHORT. Long leads = more inductance = less effective.
```

### Where to place them:

| IC | Decoupling Needed? | Notes |
|----|-------------------|-------|
| ATmega328P/2560 | YES | One per VCC pin (Uno has 2 VCC pins) |
| ESP32 | Built in | Dev boards have caps on-board |
| Op-amps | YES | One per supply rail |
| Shift registers (74HC595) | YES | Prevents glitchy outputs |
| Sensors (I2C/SPI) | YES | Breakout boards usually include them |
| Analog ICs (ADC, DAC) | CRITICAL | Noisy supply = noisy readings |

## Reading Capacitor Codes

| Marking | Value | Common Name |
|---------|-------|-------------|
| 104 | 100nF | 0.1uF — decoupling |
| 103 | 10nF | 0.01uF — filtering |
| 105 | 1uF | bulk bypass |
| 102 | 1nF | RF filtering |
| 220 | 22pF | crystal load |

---

Related Parts:
- [[22pf-ceramic-capacitor-npo-50v-crystal-load-cap]] — different role (crystal loading), needs NPO dielectric
- [[200mxr470m-electrolytic-capacitor-470uf-200v-radial]] — bulk capacitance for power supply filtering (different from high-frequency decoupling)

Categories:
- [[passives]]
