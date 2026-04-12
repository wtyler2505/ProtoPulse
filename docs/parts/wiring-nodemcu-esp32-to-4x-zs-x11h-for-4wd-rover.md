---
description: "Complete wiring for ESP32-based 4WD hoverboard rover — 4 ZS-X11H controllers, 24 GPIO used, strapping pin protection via 74HC14 buffer"
topics: ["[[wiring-guides]]"]
parts_involved: ["[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]", "[[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]"]
status: needs-test
quantity: 0
voltage: [3.3, 5, 36]
interfaces: [PWM, Digital]
---

# Wiring NodeMCU ESP32 to 4x ZS-X11H for 4WD Rover

This is the full 4-motor wiring guide for an ESP32-based 4WD hoverboard rover. Four [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] controllers, four [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]], one ESP32 DevKit, one [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]. This guide extends the concepts from [[wiring-zs-x11h-to-esp32-with-level-shifter]] and [[wiring-dual-zs-x11h-for-hoverboard-robot]] to a 4-motor configuration.

**The key challenges at 4 motors:**
1. You're using 24 GPIO pins — nearly every available pin on the ESP32
2. Some GPIOs are strapping pins that affect boot behavior — you must buffer them
3. Some GPIOs are input-only and cannot drive outputs — they need external pull-ups for feedback inputs
4. Rear motor signal wires run longer distances — shielded cable prevents noise coupling
5. Wire bundle management becomes critical — 4 controllers means a lot of wires

## GPIO Allocation Table — 24 Pins Across 4 Controllers

### Motor Controller 1 (MC1) — Front Left

| ESP32 GPIO | ZS-X11H Signal | Function | Notes |
|-----------|----------------|----------|-------|
| GPIO16 | EL (speed) | PWM speed — ACTIVE LOW | Safe GPIO, no boot function |
| GPIO17 | Z/F (direction) | Direction control | Safe GPIO |
| GPIO18 | CT (brake) | Brake — LOW = engage | SPI SCK but SPI not used |
| GPIO19 | STOP (enable) | Enable — LOW = stop | SPI MISO but SPI not used |
| GPIO4 | SC (feedback) | Speed pulse input | Interrupt-capable, safe GPIO |
| GND | GND | Common ground | MANDATORY |

### Motor Controller 2 (MC2) — Front Right

| ESP32 GPIO | ZS-X11H Signal | Function | Notes |
|-----------|----------------|----------|-------|
| GPIO25 | EL (speed) | PWM speed — ACTIVE LOW | DAC1 pin, but LEDC PWM overrides |
| GPIO26 | Z/F (direction) | Direction control | DAC2 pin, works as digital output |
| GPIO27 | CT (brake) | Brake — LOW = engage | Safe GPIO |
| GPIO14 | STOP (enable) | Enable — LOW = stop | Strapping pin — see note below |
| GPIO34 | SC (feedback) | Speed pulse input | **INPUT-ONLY** — needs external pull-up |
| GND | GND | Common ground | MANDATORY |

**MC2 Notes:**
- GPIO14 is a strapping pin (MTMS/JTAG) but safe for output after boot. It has an internal pull-up during boot which means the controller defaults to "enabled" at startup — acceptable behavior.
- GPIO34 is input-only (no internal pull-up). Add an external 10K pull-up resistor to 3.3V on this pin to ensure clean HIGH/LOW transitions from the SC pulse signal via voltage divider.

### Motor Controller 3 (MC3) — Rear Left

| ESP32 GPIO | ZS-X11H Signal | Function | Notes |
|-----------|----------------|----------|-------|
| GPIO32 | EL (speed) | PWM speed — ACTIVE LOW | Safe GPIO, has ADC but LEDC overrides |
| GPIO33 | Z/F (direction) | Direction control | Safe GPIO |
| GPIO23 | CT (brake) | Brake — LOW = engage | SPI MOSI but SPI not used |
| GPIO22 | STOP (enable) | Enable — LOW = stop | I2C SCL but I2C not used |
| GPIO35 | SC (feedback) | Speed pulse input | **INPUT-ONLY** — needs external pull-up |
| GND | GND | Common ground | MANDATORY |

**MC3 Notes:**
- GPIO35 is input-only, same treatment as GPIO34 — external 10K pull-up to 3.3V.
- Rear motor wiring runs are longer — use shielded cable for the signal bundle.

### Motor Controller 4 (MC4) — Rear Right

| ESP32 GPIO | ZS-X11H Signal | Function | Notes |
|-----------|----------------|----------|-------|
| GPIO21 | EL (speed) | PWM speed — ACTIVE LOW | I2C SDA but I2C not used |
| GPIO5 | Z/F (direction) | Direction control | **Strapping pin — buffer via 74HC14** |
| GPIO15 | CT (brake) | Brake — LOW = engage | **Strapping pin — buffer via 74HC14** |
| GPIO2 | STOP (enable) | Enable — LOW = stop | **Strapping pin — buffer via 74HC14** |
| GPIO36 (VP) | SC (feedback) | Speed pulse input | **INPUT-ONLY** — needs external pull-up |
| GND | GND | Common ground | MANDATORY |

**MC4 Notes:**
- GPIO2, GPIO5, and GPIO15 are all ESP32 strapping pins. Their state at boot determines flash mode, SDIO timing, and boot log behavior. The 74HC14 Schmitt-trigger buffer isolates the ZS-X11H inputs from these pins during boot, preventing the controller from pulling strapping pins to unexpected states. See the 74HC14 section below.
- GPIO36 (VP) is input-only — external 10K pull-up to 3.3V.

## GPIO Summary by Category

| Category | GPIOs Used | Count |
|----------|-----------|-------|
| PWM speed (EL) | 16, 25, 32, 21 | 4 |
| Direction (Z/F) | 17, 26, 33, 5 | 4 |
| Brake (CT) | 18, 27, 23, 15 | 4 |
| Enable (STOP) | 19, 14, 22, 2 | 4 |
| Feedback (SC) | 4, 34, 35, 36 | 4 |
| Ground | GND x4 | 4 |
| **Total GPIO** | | **20 unique** |
| **Total wires** | | **24 (20 signal + 4 ground)** |

**Remaining available GPIOs:** GPIO0 (strapping, avoid), GPIO12 (strapping, avoid), GPIO13 (free), GPIO39 (input-only, free)

## 74HC14 Schmitt-Trigger Buffer for MC4 Strapping Pin Protection

The ESP32 reads GPIO0, GPIO2, GPIO5, GPIO12, and GPIO15 at boot to determine operating mode. If external circuitry holds these pins at unexpected levels during the ~100ms boot window, the ESP32 may enter flash download mode, fail to boot, or behave erratically.

For MC4, GPIO2, GPIO5, and GPIO15 drive ZS-X11H inputs. The ZS-X11H has internal pull-ups on its control inputs, which could pull the ESP32 strapping pins HIGH during boot. The 74HC14 hex inverting Schmitt-trigger buffer solves this:

```
    ESP32 GPIO ──→ 74HC14 Input ──→ 74HC14 Output (inverted) ──→ ZS-X11H Input
                   (high impedance     (clean 5V signal)
                    during boot)

    74HC14 powered from 5V rail
    74HC14 OE (output enable) controlled by ESP32 "boot complete" signal
```

### 74HC14 Wiring

```
                    74HC14 (14-pin DIP)
                    ┌───────U───────┐
    GPIO5  ──→  1A  │ 1          14 │ VCC ── 5V
    to ZS-X11H ←── 1Y  │ 2          13 │ 6A  ←── (unused, tie to GND)
    GPIO15 ──→  2A  │ 3          12 │ 6Y  ── (unused)
    to ZS-X11H ←── 2Y  │ 4          11 │ 5A  ←── (unused, tie to GND)
    GPIO2  ──→  3A  │ 5          10 │ 5Y  ── (unused)
    to ZS-X11H ←── 3Y  │ 6           9 │ 4A  ←── (unused, tie to GND)
                GND │ 7           8 │ 4Y  ── (unused)
                    └───────────────┘
```

**Important:** The 74HC14 inverts the signal. Account for this in your firmware:
- To set ZS-X11H STOP HIGH (enabled): write GPIO2 LOW
- To set ZS-X11H Z/F HIGH (forward): write GPIO5 LOW
- To set ZS-X11H CT HIGH (no brake): write GPIO15 LOW

Alternatively, use a 74HCT245 non-inverting buffer powered from 5V (which also handles the 3.3V→5V level shifting).

### Boot Sequence Safety

Even with the 74HC14 buffer, add these steps to your `setup()`:

```cpp
void setup() {
  // MC4 uses inverted signals through 74HC14
  // Set strapping pins to safe state FIRST
  pinMode(2, OUTPUT);   // STOP → via 74HC14 → ZS-X11H
  pinMode(5, OUTPUT);   // Z/F → via 74HC14 → ZS-X11H
  pinMode(15, OUTPUT);  // CT → via 74HC14 → ZS-X11H

  // 74HC14 inverts: LOW output → HIGH at ZS-X11H
  // Set motor to safe state: stopped, no brake, forward
  digitalWrite(2, HIGH);  // → inverted → STOP LOW = motor disabled
  digitalWrite(15, HIGH); // → inverted → CT LOW = brake engaged
  digitalWrite(5, LOW);   // → inverted → Z/F HIGH = forward

  // ... rest of setup
}
```

## Input-Only Pin External Pull-ups for MC2/MC3/MC4

GPIOs 34, 35, 36, and 39 on the ESP32 are input-only. They have NO internal pull-up or pull-down resistors. For the SC speed feedback signal (which comes through a voltage divider from the 5V ZS-X11H), add a 10K pull-up to 3.3V to ensure the signal doesn't float when the motor is stopped:

```
    ZS-X11H SC (5V) ──── 10K ──┬── 20K ──── GND
                                │
                           10K to 3.3V (pull-up)
                                │
                           ESP32 GPIO34/35/36 (input)
```

The voltage divider drops 5V to 3.3V (safe for ESP32). The pull-up ensures a clean HIGH when no pulses are present.

## Level Shifting — 3.3V to 5V for All Output Signals

The ESP32 outputs 3.3V logic. The ZS-X11H expects 5V TTL. Use level shifting on ALL output signals (EL, Z/F, CT, STOP) — 16 channels total across 4 controllers.

**Recommended:** Two 8-channel 74HCT245 octal bus transceivers powered from 5V. HCT-family logic accepts 3.3V as valid HIGH and outputs clean 5V. This handles level shifting AND provides buffering.

**Alternative:** Four 4-channel bidirectional level shifter modules (BSS138-based). Cheaper, readily available, but bulkier for 16 channels.

```
    ESP32 3.3V outputs ──→ 74HCT245 #1 (8 channels) ──→ MC1 + MC2 (8 signals)
    ESP32 3.3V outputs ──→ 74HCT245 #2 (8 channels) ──→ MC3 + MC4 (8 signals)

    For MC4 strapping pins: 74HC14 replaces 3 channels of the 74HCT245
```

## Shielded Cable for Rear Motor Runs

Front motors (MC1, MC2) sit close to the ESP32 — short signal wires work fine. Rear motors (MC3, MC4) are 1-2 meters away. At these distances, unshielded signal wires act as antennas picking up EMI from the 36V motor phase wires running alongside them.

**For rear motor signal bundles:**
1. Use shielded multi-conductor cable (5+ conductors per controller)
2. Connect the shield to GND at the ESP32 end only (single-point grounding prevents ground loops)
3. Route signal cables AWAY from motor phase wires — ideally on opposite sides of the chassis
4. If signal and power must cross, cross them at 90 degrees to minimize coupling

## Wire Bundle Organization

With 4 controllers, cable management prevents debugging nightmares:

| Bundle | Wires | Color Coding Suggestion |
|--------|-------|------------------------|
| MC1 (Front Left) | 5 signal + 1 GND | White heat shrink on connector end |
| MC2 (Front Right) | 5 signal + 1 GND | Blue heat shrink |
| MC3 (Rear Left) | 5 signal + 1 GND (shielded) | Green heat shrink |
| MC4 (Rear Right) | 5 signal + 1 GND (shielded) | Red heat shrink |
| Power bus | 36V+, 36V-, 5V, GND | Thick wires, clearly labeled |
| ESP32 power | 5V in, 3.3V, GND | Separate from motor power |

**Label every connector.** When you have 24 wires going to 4 controllers, a mislabeled wire means a debugging session, not a quick fix. Use a label maker or at minimum colored tape with a written legend.

## Power Architecture

```
    36V BATTERY
        │
    ┌───┴───────────────────────────────────┐
    │                                       │
    ├──→ MC1 Power (V+/V-)                  │
    ├──→ MC2 Power (V+/V-)                  │
    ├──→ MC3 Power (V+/V-)                  │
    ├──→ MC4 Power (V+/V-)                  │
    │                                       │
    └──→ LM2596 #1 (→ 5V) ──→ ESP32 Vin    │
         LM2596 #1 (→ 5V) ──→ 74HCT245 VCC│
         LM2596 #1 (→ 5V) ──→ 74HC14 VCC  │
                                            │
                              All GND tied together
```

See [[wiring-36v-battery-power-distribution-4-tier-system]] for the complete power distribution design.

## Common Wiring Mistakes

| Mistake | Consequence | Prevention |
|---------|------------|------------|
| Forgetting common GND between ESP32 and ZS-X11H | Control signals float, motors behave randomly | Star-ground all controllers to a central ground bus |
| Connecting 5V SC feedback directly to ESP32 | Damaged GPIO pin | Always use voltage divider (10K/20K) on SC signal |
| Swapping strapping pin wires during debugging | ESP32 won't boot | Use 74HC14 buffer, label all MC4 wires distinctly |
| Running signal wires alongside motor phase wires | EMI causes false triggers, erratic speed readings | Separate routing, use shielded cable for rear motors |
| Powering ESP32 from ZS-X11H 5V output | Noisy power causes resets and WiFi dropouts | Dedicated LM2596 for ESP32 power |
| Not adding flyback capacitor on ZS-X11H power input | Motor flyback spikes damage controller | 470uF 63V cap across V+/V- at each controller |
| Forgetting signal inversion through 74HC14 | MC4 does the opposite of what you command | Document inversion in firmware comments, test each pin |

## Brake Function Details

The CT (brake) pin on the ZS-X11H provides regenerative braking by shorting the motor phases through the low-side MOSFETs:

| CT State | Motor Behavior | Current Flow | Thermal Notes |
|---------|---------------|-------------|---------------|
| HIGH (float) | Normal operation | Through motor phases | Normal |
| LOW | Active braking | Motor back-EMF through MOSFETs | MOSFETs heat up under heavy braking |

**Braking rules for 4WD:**
1. Brake all 4 motors simultaneously for straight-line stops
2. Never brake at full speed under high voltage — reduce PWM first
3. Release brake within 2-3 seconds of motor stopping — holding brake on a stationary motor just heats the MOSFETs
4. For emergency stop: pull all STOP pins LOW (disables controllers entirely) rather than braking

```cpp
void emergencyStop() {
  // Disable all controllers — no current to motors at all
  // MC1-MC3: direct logic
  digitalWrite(19, LOW);   // MC1 STOP
  digitalWrite(14, LOW);   // MC2 STOP
  digitalWrite(22, LOW);   // MC3 STOP
  // MC4: inverted through 74HC14
  digitalWrite(2, HIGH);   // → inverted → MC4 STOP LOW

  // Zero all speed signals
  ledcWrite(0, 255);  // MC1 EL HIGH = stopped
  ledcWrite(1, 255);  // MC2
  ledcWrite(2, 255);  // MC3
  ledcWrite(3, 255);  // MC4
}
```

---

Related Parts:
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — the motor controllers (need 4)
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — the motors (need 4)
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — the battery
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — powers ESP32 and logic from 36V battery
- [[wiring-zs-x11h-to-esp32-with-level-shifter]] — single motor ESP32 guide (foundation for this guide)
- [[wiring-dual-zs-x11h-for-hoverboard-robot]] — dual motor Arduino Mega guide
- [[wiring-36v-battery-power-distribution-4-tier-system]] — power distribution for this system

Categories:
- [[wiring-guides]]
