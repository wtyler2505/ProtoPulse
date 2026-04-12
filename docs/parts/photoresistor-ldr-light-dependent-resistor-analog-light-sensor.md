---
description: "Cadmium sulfide LDR — resistance drops from ~1M ohm in darkness to ~100 ohm in bright light. Dead simple analog light sensor, but needs a 10K voltage divider to read with an ADC. No polarity, 2 pins"
topics: ["[[sensors]]"]
status: needs-test
quantity: 5
voltage: [3.3, 5]
interfaces: [Analog]
logic_level: "N/A (passive resistive element)"
manufacturer: "Generic"
part_number: ""
pinout: |
  2-pin (no polarity):
    Pin 1 → VCC (3.3V or 5V)
    Pin 2 → Analog input + 10K resistor to GND (voltage divider)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["Must use voltage divider — without the 10K pulldown resistor, ADC reads won't be useful", "Not suitable for precision light measurement — response is logarithmic and varies between units", "Contains cadmium sulfide (CdS) — RoHS restricted in some applications", "Slow response time (~20-30ms rise, ~30ms fall) — not suitable for fast light changes or optical communication"]
datasheet_url: ""
---

# Photoresistor (LDR) — Light-Dependent Resistor, Analog Light Sensor

A photoresistor (also called LDR — Light Dependent Resistor) is a passive component whose resistance changes with light intensity. In darkness, resistance is very high (~1M ohm). In bright light, it drops to ~100 ohm. Wire it as a voltage divider with a 10K resistor and read the midpoint with an analog input — you get a voltage proportional to light level.

This is the simplest possible light sensor. Two pins, no polarity, no protocol, no library. Just `analogRead()`. The trade-off is precision — the response is logarithmic, varies between units, and isn't calibrated to any specific lux value. Perfect for "is it light or dark?" decisions, not for measuring exact illuminance.

## Specifications

| Spec | Value |
|------|-------|
| Type | CdS (Cadmium Sulfide) photoresistor |
| Dark Resistance | ~1M ohm |
| Bright Light Resistance | ~100 ohm |
| Spectral Peak | ~540nm (green light) |
| Response Time | ~20-30ms (rise), ~30ms (fall) |
| Max Voltage | 150V DC |
| Max Power | 100mW |
| Operating Temp | -30C to +70C |

## Wiring — Voltage Divider Circuit

```
VCC (5V or 3.3V)
    │
  [LDR]
    │
    ├───→ Analog Input (A0)
    │
  [10K resistor]
    │
   GND
```

**How it works:** The LDR and the 10K resistor form a voltage divider. In bright light (LDR resistance low), most voltage drops across the 10K resistor, so the analog input reads high. In darkness (LDR resistance high), most voltage drops across the LDR, so the analog input reads low.

| Light Condition | LDR Resistance | ADC Reading (10-bit, 5V) | Approx Voltage |
|----------------|---------------|-------------------------|----------------|
| Bright sunlight | ~100 ohm | ~950-1023 | ~4.7-5V |
| Indoor light | ~1-10K ohm | ~300-700 | ~1.5-3.5V |
| Dim room | ~10-100K ohm | ~50-300 | ~0.25-1.5V |
| Darkness | ~1M ohm | ~5-50 | ~0.025-0.25V |

## Arduino Code

```cpp
const int ldrPin = A0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int lightLevel = analogRead(ldrPin);

  // Simple threshold for light/dark detection
  if (lightLevel > 500) {
    Serial.println("Bright");
  } else if (lightLevel > 200) {
    Serial.println("Dim");
  } else {
    Serial.println("Dark");
  }

  delay(500);
}
```

## ESP32 Notes

The ESP32 ADC is 12-bit (0-4095) but notoriously noisy and nonlinear. For better results with the LDR:
- Use ADC1 pins only (GPIO 32-39) — ADC2 conflicts with WiFi
- Take multiple samples and average them
- Consider using `analogReadMilliVolts()` on ESP-IDF 4.4+

## Use Cases

- **Auto-brightness** for LCD/LED displays
- **Day/night detection** for outdoor projects
- **Light-following robot** (use two LDRs, steer toward the brighter one)
- **Security system** light-change detection
- **Plant monitoring** light level tracking alongside [[soil-moisture-sensor-capacitive-analog-3v3-5v]]

---

Related Parts:
- [[soil-moisture-sensor-capacitive-analog-3v3-5v]] — another analog sensor, pairs well for plant monitoring
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 6 analog inputs (A0-A5) at 10-bit resolution
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — 12-bit ADC, use ADC1 pins only

Categories:
- [[sensors]]
