---
description: "Multi-output power management IC for TFT-LCD panels — 8-16.5V input, generates AVDD, VGH, VGL, VCOM via step-up/step-down + charge pumps. 40-pin TQFN package"
topics: ["[[power]]"]
status: needs-test
quantity: 1
voltage: [8, 16.5]
interfaces: [SPI]
logic_level: "3.3V"
manufacturer: "Analog Devices (Maxim)"
part_number: "MAX17113"
warnings: ["Surface mount TQFN-40 — requires reflow soldering", "Multi-rail output — read datasheet carefully for sequencing requirements"]
datasheet_url: ""
---

# MAX17113 TFT-LCD PMIC

A dedicated power management IC designed to generate all the supply rails a TFT-LCD panel needs from a single 8V–16.5V input. Integrates step-up converters, charge pumps, and a VCOM buffer to produce AVDD, VGH, VGL, and VCOM — the four rails every TFT panel requires.

## Key Specs

| Parameter | Value |
|-----------|-------|
| Input Voltage | 8V–16.5V |
| Output Rails | AVDD, VGH, VGL, VCOM |
| Topology | Step-up/step-down + charge pumps |
| Control Interface | SPI |
| Logic Level | 3.3V |
| Package | TQFN-40 (6mm x 6mm) |
| Manufacturer | Analog Devices (Maxim Integrated) |
| Part Number | MAX17113 |

## Output Rails

| Rail | Typical Voltage | Purpose |
|------|----------------|---------|
| AVDD | ~15V (adjustable) | Analog supply for source drivers |
| VGH | ~25V (adjustable) | Gate-high voltage for TFT gate drivers |
| VGL | ~-7V (adjustable) | Gate-low voltage for TFT gate drivers |
| VCOM | Adjustable | Common electrode voltage, panel-specific |

## Usage Notes

- This is a surface mount TQFN-40 part — not breadboard-friendly. Requires a custom PCB and reflow soldering
- Rail sequencing is critical for LCD panels — power-on and power-off order prevents latch-up. Follow the datasheet timing diagrams exactly
- VCOM calibration is panel-specific — you'll need the LCD panel's datasheet to set the correct VCOM voltage
- SPI interface allows dynamic adjustment of output voltages and soft-start control
- External components (inductors, capacitors, diodes) are required for each rail — this is not a standalone solution

## Typical Applications

- Custom LCD driver boards
- Laptop/tablet display power supplies
- Industrial HMI panels
- Salvaged from existing LCD driver boards — may be useful for driving recovered TFT panels

---

Categories:
- [[power]]
