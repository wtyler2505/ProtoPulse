---
description: "NTC thermistor for temperature measurement — 10K ohm at 25C, B-value ~3950. Use with voltage divider on analog input for temperature sensing in 3D printers and climate projects"
topics: ["[[passives]]", "[[sensors]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [Analog]
manufacturer: "Generic"
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Requires a voltage divider with a known fixed resistor (typically 10K) to read temperature", "NTC means resistance DECREASES as temperature rises — don't confuse with PTC"]
datasheet_url: ""
---

# NTC 103 10K Thermistor Temperature Sensor for 3D Printers

NTC thermistor for temperature measurement — 10K ohm at 25C, B-value ~3950. The "103" in the name means 10 x 10^3 = 10,000 ohms nominal resistance. Paired with a voltage divider and an analog input, this gives you a surprisingly accurate temperature reading for the price.

## Specifications

| Parameter | Value |
|-----------|-------|
| Type | NTC (Negative Temperature Coefficient) |
| Nominal Resistance | 10K ohm at 25°C |
| B-Value (B25/50) | ~3950K |
| Temperature Range | -40°C to +300°C (depends on housing) |
| Tolerance | ±1% (resistance), ±1°C (typical) |
| Response Time | ~7 seconds (in air) |
| Operating Voltage | 3.3V or 5V (via voltage divider) |
| Interface | Analog (voltage divider output) |
| Package | Glass bead with leads (bare) or crimped with connector (3D printer style) |

## Resistance vs Temperature

| Temperature (°C) | Approx. Resistance (ohm) |
|-------------------|--------------------------|
| 0 | ~32,650 |
| 25 | 10,000 |
| 50 | ~3,600 |
| 100 | ~680 |
| 150 | ~180 |
| 200 | ~60 |
| 250 | ~25 |

## Voltage Divider Circuit

Wire the thermistor in a voltage divider with a fixed 10K resistor to read temperature via an analog pin.

```
VCC (5V or 3.3V)
    │
   [10K fixed resistor]
    │
    ├──── Analog Pin (A0)
    │
   [NTC 10K thermistor]
    │
   GND
```

| Connection | Pin |
|------------|-----|
| Fixed resistor top | VCC (5V or 3.3V) |
| Junction (resistor + thermistor) | Analog input (A0) |
| Thermistor bottom | GND |

## Temperature Calculation

The Steinhart-Hart equation converts resistance to temperature:

```
1/T = 1/T0 + (1/B) * ln(R/R0)
```

Where:
- T0 = 298.15K (25°C)
- R0 = 10,000 ohm
- B = 3950
- R = measured resistance from voltage divider

In Arduino code, read the ADC, calculate resistance, then apply the equation. Or use a lookup table for speed.

## 3D Printer Usage

This is the standard thermistor type used in most budget 3D printer hotends and heated beds. Marlin firmware uses thermistor table #1 for this type (B-value 3950, 10K). If you're replacing a thermistor on a 3D printer, this is almost certainly the right one unless the printer documentation says otherwise.

## Accuracy Notes

- Best accuracy is near 25°C (the calibration point). Accuracy degrades at temperature extremes.
- For precise work above 200°C, consider a thermocouple (Type K with MAX6675) instead — thermistors get imprecise at high temps where resistance changes become very small.
- Self-heating can skew readings if you push too much current through the divider. Keep the current low — a 10K fixed resistor at 5V gives 0.5mA max, which is fine.

---

## Related Parts

- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — Compatible controller (analog input for voltage divider reading)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — Compatible controller (16 analog inputs available)

## Categories

- [[passives]]
- [[sensors]]
