---
description: "IR flame detector module tuned to 760-1100nm — detects fire/flame via infrared emission. Dual output: D0 for threshold alarm (adjustable pot), A0 for flame intensity. Works at 3.3-5V, detection angle ~60 degrees"
topics: ["[[sensors]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [Analog, GPIO]
logic_level: "3.3-5V"
manufacturer: "Generic"
part_number: ""
pinout: |
  4-pin header:
    VCC → 3.3-5V supply
    GND → Ground
    D0  → Digital output (LOW when flame detected, adjustable threshold via pot)
    A0  → Analog output (lower value = stronger flame signal)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["D0 output is active LOW — goes LOW when flame is detected, HIGH when no flame", "Detects ANY strong IR source — sunlight, incandescent bulbs, and halogen lamps WILL trigger false positives", "Detection range is limited to ~1m for a candle flame — not a replacement for a proper smoke detector", "60-degree detection angle means you need multiple sensors for full coverage", "NOT a safety device — do not rely on this as your only fire detection method"]
datasheet_url: ""
---

# Flame Sensor Module — IR 760-1100nm Fire Detector, Analog + Digital Output

An infrared flame sensor module that detects the IR emission signature of fire in the 760-1100nm wavelength range. The core sensing element is an IR phototransistor (or photodiode) tuned to the near-infrared spectrum where flames emit strongly.

It provides two outputs: D0 (digital) gives a binary flame/no-flame signal based on a threshold set by the onboard potentiometer, and A0 (analog) gives a continuous reading proportional to the IR intensity — lower value = stronger flame signal.

**Important caveat:** This detects IR radiation, not "fire" specifically. Sunlight, incandescent bulbs, and any strong IR source will trigger it. Useful for robotics (fire-fighting robot competitions), maker projects, and supplementary monitoring — but do NOT use it as your sole fire safety device.

## Specifications

| Spec | Value |
|------|-------|
| Sensor Type | IR phototransistor/photodiode |
| Wavelength Range | 760-1100nm (near-IR) |
| Detection Angle | ~60 degrees |
| Detection Range | ~80cm for candle flame (varies with flame size) |
| Operating Voltage | 3.3-5V DC |
| Digital Output (D0) | Active LOW (LOW = flame detected) |
| Analog Output (A0) | Lower voltage = stronger IR signal |
| Threshold Adjustment | Onboard potentiometer |
| Comparator IC | LM393 |
| Indicator LEDs | Power LED + signal LED |

## Wiring

| Sensor Pin | Arduino Pin | Notes |
|------------|-------------|-------|
| VCC | 3.3-5V | |
| GND | GND | |
| D0 | Any digital input | Active LOW — use INPUT_PULLUP |
| A0 | Any analog input | Optional, for intensity measurement |

## Arduino Code — Digital Detection

```cpp
const int flamePin = 2;

void setup() {
  pinMode(flamePin, INPUT);
  Serial.begin(115200);
}

void loop() {
  if (digitalRead(flamePin) == LOW) {  // Active LOW!
    Serial.println("FLAME DETECTED!");
  } else {
    Serial.println("No flame");
  }
  delay(100);
}
```

## Arduino Code — Analog Intensity

```cpp
const int flameAnalog = A0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int irValue = analogRead(flameAnalog);
  Serial.print("IR intensity: ");
  Serial.print(irValue);

  if (irValue < 100) {
    Serial.println(" — STRONG flame nearby!");
  } else if (irValue < 500) {
    Serial.println(" — Flame detected");
  } else {
    Serial.println(" — No flame");
  }
  delay(200);
}
```

## Reducing False Positives

- **Shield from sunlight** — direct sunlight saturates the sensor
- **Use a narrow tube** over the sensor to restrict the detection angle
- **Threshold tuning** — turn the pot until the sensor doesn't trigger from ambient IR, only from actual flame
- **Software filtering** — require sustained detection over multiple readings before triggering an alarm
- **Multiple sensors** — if 2+ sensors agree, it's more likely a real flame

---

Related Parts:
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] — another IR-based sensor, but detects motion not flame
- [[generic-ir-receiver-module-38khz-demodulator]] — receives modulated IR signals (remote controls), not thermal IR
- [[sound-sensor-module-lm393-electret-mic-analog-digital-out]] — same LM393 comparator design pattern, analog + digital output
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — direct connection at 5V

Categories:
- [[sensors]]
