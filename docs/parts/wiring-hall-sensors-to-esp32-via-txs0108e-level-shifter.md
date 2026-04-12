---
description: "Level-shifted Hall sensor wiring from BLDC motor controller to ESP32 — TXS0108E handles 5V-to-3.3V translation for position feedback signals"
topics: ["[[wiring-guides]]"]
parts_involved: ["[[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]", "[[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]"]
status: needs-test
quantity: 0
voltage: [3.3, 5]
interfaces: [Digital]
---

# Wiring Hall Sensors to ESP32 via TXS0108E Level Shifter

This guide covers connecting the Hall effect position sensors from a BLDC hub motor (via the [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]) to the ESP32's GPIO pins through a [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]]. The Hall sensors output 5V logic and the ESP32 is 3.3V — direct connection risks damage.

This wiring is for **one motor controller** (MC1, Front-Left). Repeat the pattern for each additional motor, using a separate TXS0108E per controller or grouping signals if channels are available.

## Why Level Shift Hall Sensors?

The BLDC motor has three Hall effect sensors (A, B, C) that output the rotor position as a 3-bit Gray code. The RioRand controller uses these internally for commutation, but the Hall signals are also available on the controller's output header as 5V push-pull signals. Reading these on the ESP32 gives you:

- **Motor speed** (count Hall transitions per unit time)
- **Motor position** (track cumulative Hall state changes)
- **Motor direction** (Gray code sequence direction)
- **Motor temperature** (Hall Temp output, some controllers)

## Complete Wiring Diagram (MC1 Front-Left)

```
RioRand ZS-X11H (MC1)          TXS0108E                  ESP32 DevKit
                              B-Side    A-Side

Hall-A  ──────────────→  B1 (pin 3)  A1 (pin 17)  ──→  GPIO 34 (input-only)
Hall-B  ──────────────→  B2 (pin 4)  A2 (pin 16)  ──→  GPIO 35 (input-only)
Hall-C  ──────────────→  B3 (pin 5)  A3 (pin 15)  ──→  GPIO 36 (input-only)
Hall Temp ────────────→  B4 (pin 6)  A4 (pin 12)  ──→  GPIO 39 (input-only)

+5V (thin red wire) ──→  VCCB (pin 10)
                                                    ←──  3.3V → VCCA (pin 11)
                              OE (pin 19) ──────────←──  3.3V (ENABLE)

GND ──────────────────→  GND (pin 1)  ──────────────←──  GND
```

## Decoupling Capacitors (MANDATORY)

```
VCCB (pin 10) ──┬── +5V from RioRand
                |
              [0.1uF ceramic]
                |
               GND

VCCA (pin 11) ──┬── 3.3V from ESP32
                |
              [0.1uF ceramic]
                |
               GND
```

Place capacitors as close to the TXS0108E VCC pins as physically possible. Without them, signal integrity degrades and you'll get phantom Hall transitions.

## GPIO Selection Rationale

GPIOs 34, 35, 36, and 39 are used because:

1. **Input-only pins** — Hall sensors are read-only, so input-only GPIOs are perfect
2. **No internal pull-ups** — the TXS0108E provides the pull-ups via its A-side resistors
3. **No strapping pin conflicts** — these pins don't affect ESP32 boot behavior
4. **ADC2 not used** — these are on ADC1, which doesn't conflict with WiFi

## Critical Warnings

1. **NEVER connect the 36V motor battery directly to the TXS0108E.** Power the B-side ONLY from the thin red +5V wire on the RioRand controller. The 36V will instantly destroy the level shifter and likely the ESP32.

2. **OE must be connected to VCCA (3.3V)** or the outputs are tri-stated (disabled).

3. **Common ground is mandatory.** ESP32 GND, RioRand GND, and TXS0108E GND must all be connected at the same point. Ground loops between 36V and 3.3V systems cause noise and false readings.

4. **Use short wires** between the TXS0108E and ESP32 (< 10cm). Longer runs pick up motor switching noise.

## Reading Hall Sensors in Code

```cpp
#define HALL_A  34
#define HALL_B  35
#define HALL_C  36
#define HALL_T  39

void setup() {
  Serial.begin(115200);
  pinMode(HALL_A, INPUT);
  pinMode(HALL_B, INPUT);
  pinMode(HALL_C, INPUT);
  pinMode(HALL_T, INPUT);
}

void loop() {
  uint8_t hallState = (digitalRead(HALL_A) << 2) |
                      (digitalRead(HALL_B) << 1) |
                      (digitalRead(HALL_C));

  Serial.print("Hall State: ");
  Serial.print(hallState, BIN);
  Serial.print(" (0b");
  Serial.print(digitalRead(HALL_A));
  Serial.print(digitalRead(HALL_B));
  Serial.print(digitalRead(HALL_C));
  Serial.println(")");

  delay(100);
}
```

## Scaling to 4 Motors

For a 4WD rover with 4 motor controllers, you need 4 sets of Hall signals (16 channels total). Options:

1. **4 separate TXS0108E boards** — one per controller, cleanest wiring
2. **2 TXS0108E boards** — each handles 2 controllers (8 channels = 4 Hall + 4 Hall)
3. **Mix TXS0108E and direct reading** — if some controllers' Hall outputs happen to be 3.3V compatible (verify with oscilloscope first!)

The 4WD wiring guide [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]] covers the full GPIO allocation for all 4 motors.

## Source Documentation

Wiring diagram verified against `Hall_Sensor_ESP32_Interfacing_Guide.pdf` (Guide 01 — Front-Left Wheel Hall Sensors MC1 → ESP32-S3 via TXS0108E). Pin mappings, decoupling cap placement, and GPIO selection match the reference exactly.

---

Categories:
- [[wiring-guides]]
