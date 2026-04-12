---
description: "Short-range IR proximity sensor with analog voltage output — best for detecting objects within 2-15cm, non-contact. Voltage curve is nonlinear so use a lookup table, not linear math"
topics: ["[[sensors]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [Analog]
logic_level: "Analog output (0.4-3.1V typical)"
manufacturer: "Sharp"
part_number: "GP2Y0A51SK0F"
measurement_range: "2cm to 15cm"
output_type: "Analog voltage (inversely proportional to distance)"
pinout: |
  3-pin JST connector:
  Pin 1 → VO (Analog voltage output)
  Pin 2 → GND
  Pin 3 → VCC (3.3-5V)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Output voltage is NOT linear with distance — use a lookup table or inverse curve fit", "Below 2cm the output voltage DROPS (ambiguous zone) — objects too close read as far away", "IR sensors are affected by surface color and reflectivity — dark/black surfaces give weak returns", "Add 10uF cap across VCC-GND close to sensor to reduce supply noise"]
datasheet_url: "https://global.sharp/products/device/lineup/data/pdf/datasheet/gp2y0a51sk_e.pdf"
---

# Sharp GP2Y0A51SK0F IR proximity sensor 2 to 15cm analog

A compact IR proximity sensor for short-range object detection. It projects an IR beam and measures the reflection angle to determine distance, outputting an analog voltage. Good for paper/edge detection, object presence sensing, and close-range obstacle avoidance where the [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] is overkill or too bulky.

The critical thing to understand: the output voltage is NOT linearly proportional to distance. It follows an inverse curve — voltage rises as objects get closer, peaks around 2-3cm, then DROPS if objects are even closer. This means an object at 1cm can give the same voltage reading as an object at 10cm. Always treat readings below 2cm as invalid.

## Specifications

| Spec | Value |
|------|-------|
| Sensor Type | Infrared triangulation |
| Detection Range | 2cm to 15cm |
| Output | Analog voltage (higher voltage = closer object) |
| Output Voltage | ~0.4V (15cm) to ~3.1V (2cm) |
| Supply Voltage | 4.5-5.5V (or 3.3V with reduced range) |
| Supply Current | ~12mA typical |
| Response Time | ~16.5ms (first measurement), ~5ms (subsequent) |
| Update Rate | ~60Hz |
| Dimensions | 29.5 x 13 x 13.5mm |

## Typical Output Voltage vs Distance

| Distance (cm) | Output Voltage (approximate) |
|---------------|------------------------------|
| 2 | ~3.1V |
| 3 | ~2.3V |
| 5 | ~1.5V |
| 7 | ~1.1V |
| 10 | ~0.7V |
| 15 | ~0.4V |

These values are approximate — calibrate for your specific sensor and target surface.

## Wiring to Arduino

| Sensor Pin | Arduino Pin | Notes |
|------------|-------------|-------|
| VO (output) | Any analog pin (A0-A5) | Read with analogRead() |
| GND | GND | |
| VCC | 5V | Add 10uF cap close to sensor |

```cpp
int rawValue = analogRead(A0);    // 0-1023 on Arduino (10-bit ADC)
float voltage = rawValue * 5.0 / 1023.0;
// Use lookup table or inverse formula for distance
```

## Wiring to ESP8266

The ESP8266's analog input has a 0-1V range. The sensor outputs up to 3.1V. You need a voltage divider:

```
VO → [220k] → junction → [100k] → GND
                 |
                 → A0 (max ~1V)
```

On ESP32, the ADC handles 0-3.3V natively — connect VO directly to any ADC pin.

## Why Not Linear Math?

The distance-to-voltage relationship follows approximately: `distance = k / (voltage - offset)` where k and offset are calibration constants. But even this inverse formula is an approximation. For best accuracy, measure voltages at known distances and build a lookup table. The `SharpIR` Arduino library handles this for common Sharp sensors.

---

Related Parts:
- [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] — longer range alternative (ultrasonic, 2-400cm)
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] — motion detection (different principle)
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via analog input at 5V, direct connection
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via analog input at 5V, direct connection
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via analog input at 5V, direct connection
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via analog input at 5V, direct connection
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via ADC at 3.3V, output up to 3.1V fits within ESP32 ADC range
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via A0 but needs voltage divider (output up to 3.1V, ESP8266 A0 max is 1V)

Categories:
- [[sensors]]
