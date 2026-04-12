---
description: "ESP32 to ZS-X11H wiring with required 3.3V-to-5V level shifting — the ZS-X11H expects 5V logic, ESP32 outputs 3.3V"
topics: ["[[wiring-guides]]"]
parts_involved: ["[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]"]
status: needs-test
quantity: 0
voltage: [3.3, 5, 36]
interfaces: [PWM, Digital]
---

# Wiring ZS-X11H to ESP32 with Level Shifter

The [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] expects 5V TTL logic inputs. The ESP32 outputs 3.3V on its GPIOs. Connecting them directly will give unreliable behavior — 3.3V is right on the edge of the 5V TTL HIGH threshold, and some ZS-X11H units will recognize it while others won't. Don't gamble on it. Level shift properly and it works every time.

## The Problem

| Signal Level | 5V TTL HIGH Threshold | ESP32 Output | Margin |
|-------------|----------------------|-------------|--------|
| 5V TTL | 2.0V minimum (spec), 2.5-3.5V typical | 3.3V | Barely above minimum, unreliable |
| 5V CMOS | 3.5V minimum | 3.3V | BELOW threshold — will NOT work |

Some ZS-X11H boards use TTL-level inputs (2.0V threshold), others use CMOS-level inputs (3.5V threshold). You won't know which you have until you test it, and even TTL inputs at 3.3V leave zero noise margin. Level shift.

## The Solution: 3.3V to 5V Level Shifting

You need level shifting on the **output signals** from ESP32 to ZS-X11H (EL, Z/F, CT, STOP). You need voltage division on the **input signal** from ZS-X11H to ESP32 (SC speed feedback).

### Option 1: Bidirectional Level Shifter Module (Recommended)

Use a cheap 4-channel bidirectional level shifter module (based on BSS138 MOSFETs). These are available for under $1 and handle both directions.

```
    ESP32 (3.3V side)          Level Shifter          ZS-X11H (5V side)
    ┌─────────────┐        ┌───────────────┐        ┌──────────────┐
    │         GPIO16 ──────┤ LV1     HV1 ├──────── EL (speed)    │
    │         GPIO17 ──────┤ LV2     HV2 ├──────── Z/F (dir)     │
    │         GPIO18 ──────┤ LV3     HV3 ├──────── CT (brake)    │
    │         GPIO19 ──────┤ LV4     HV4 ├──────── STOP (enable) │
    │                      │               │        │              │
    │         3V3 ─────────┤ LV      HV ├───── 5V (from LM2596) │
    │         GND ─────────┤ GND    GND ├──────── GND            │
    └─────────────┘        └───────────────┘        └──────────────┘
```

**Level shifter module connections:**
- **LV** (low voltage reference) → ESP32 3V3 pin
- **HV** (high voltage reference) → 5V supply (from [[lm2596-adjustable-buck-converter-module-3a-step-down]] set to 5V)
- **GND** → Common ground
- **LV1-LV4** → ESP32 GPIO outputs
- **HV1-HV4** → ZS-X11H control inputs

### Option 2: MOSFET-Based Level Shift (DIY)

If you don't have a level shifter module, build one per channel with a 2N7000 N-channel MOSFET and two resistors:

```
    ESP32 GPIO ──┬── 10K to 3.3V
                 │
              Gate
           2N7000 MOSFET
              Source ── GND
              Drain ──┬── 10K to 5V
                      └── ZS-X11H input
```

Logic:
- ESP32 HIGH (3.3V) → MOSFET on → Drain pulled LOW → ZS-X11H sees LOW
- ESP32 LOW (0V) → MOSFET off → Drain pulled HIGH (5V) → ZS-X11H sees HIGH

**This inverts the signal.** Account for the inversion in your code, or add a second MOSFET stage to re-invert.

For the EL (speed PWM) signal, the MOSFET-based shifter works fine — the 2N7000 switches fast enough for Arduino PWM frequencies (490Hz or 980Hz). It will NOT work for high-frequency PWM (>100kHz).

### Option 3: 74HCT245 Buffer (Best for PWM)

For the cleanest level shifting, especially for the PWM speed signal, use a 74HCT245 octal bus transceiver. HCT-family logic accepts 3.3V inputs as valid HIGH when powered from 5V, and outputs clean 5V signals.

```
    ESP32 GPIO → 74HCT245 input (A side) → 74HCT245 output (B side) → ZS-X11H
    VCC = 5V, DIR = HIGH (A→B), OE = LOW (enabled)
```

This is overkill for 4 signals but gives you 8 channels of clean, fast level shifting.

## Speed Feedback: ZS-X11H SC to ESP32

The SC (speed feedback) output from the ZS-X11H is a 5V signal. **ESP32 GPIOs are NOT 5V tolerant.** Connecting 5V directly to an ESP32 GPIO will damage or destroy the pin.

### Voltage Divider for SC Signal

Use a simple resistive voltage divider to bring 5V down to ~3.3V:

```
    ZS-X11H SC ──── 10K ──┬── 20K ──── GND
                           │
                      ESP32 GPIO (input)
```

Calculation: Vout = 5V x (20K / (10K + 20K)) = 3.33V -- safe for ESP32.

**Alternative values that also work:**
- 4.7K + 10K → 3.38V (close enough)
- 2.2K + 4.7K → 3.41V (acceptable)
- 1K + 2K → 3.33V (lower impedance, better for fast signals)

For speed feedback pulses, the lower impedance option (1K + 2K) is better because it handles the pulse edges more cleanly. The 10K + 20K works fine for the typical pulse rates from a hoverboard motor.

## Connection Table

| ESP32 Pin | Level Shifter | ZS-X11H Signal | Function |
|-----------|--------------|----------------|----------|
| GPIO16 (output) | LV1 → HV1 | EL (speed) | PWM speed — ACTIVE LOW |
| GPIO17 (output) | LV2 → HV2 | Z/F (direction) | Direction control |
| GPIO18 (output) | LV3 → HV3 | CT (brake) | Brake control |
| GPIO19 (output) | LV4 → HV4 | STOP (enable) | Motor enable |
| GPIO4 (input) | Voltage divider (no shifter) | SC (feedback) | Speed pulse input |
| GND | GND | GND | **Common ground — MANDATORY** |

**GPIO choice notes:**
- GPIO16 and GPIO17 are safe general-purpose pins on most ESP32 boards
- GPIO18 and GPIO19 are also available (they're SPI pins but SPI is not used here)
- GPIO4 is a good interrupt-capable input pin
- Avoid GPIO0, GPIO2, GPIO12, GPIO15 — these are strapping pins that affect boot behavior
- Avoid GPIO6-GPIO11 — these are connected to the internal flash on most modules

## ESP32 PWM Note

The ESP32 does NOT use `analogWrite()`. It uses the LEDC (LED Control) peripheral for PWM:

```cpp
#include <Arduino.h>

// Pin definitions
const int PIN_SPEED  = 16;  // → level shifter → EL
const int PIN_DIR    = 17;  // → level shifter → Z/F
const int PIN_BRAKE  = 18;  // → level shifter → CT
const int PIN_ENABLE = 19;  // → level shifter → STOP
const int PIN_FB     = 4;   // ← voltage divider ← SC

// LEDC PWM config
const int PWM_CHANNEL  = 0;
const int PWM_FREQ     = 1000;  // 1kHz — good for motor control
const int PWM_RESOLUTION = 8;   // 8-bit: 0-255

volatile unsigned long pulseCount = 0;

void IRAM_ATTR countPulse() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);

  // Configure PWM
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PIN_SPEED, PWM_CHANNEL);

  // Configure digital outputs
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_BRAKE, OUTPUT);
  pinMode(PIN_ENABLE, OUTPUT);

  // Configure feedback input
  pinMode(PIN_FB, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_FB), countPulse, RISING);

  // Start safe
  ledcWrite(PWM_CHANNEL, 255);    // EL HIGH = stopped (active LOW)
  digitalWrite(PIN_DIR, LOW);
  digitalWrite(PIN_BRAKE, LOW);    // Brake on
  digitalWrite(PIN_ENABLE, LOW);   // Disabled

  Serial.println("ESP32 motor controller ready.");
}

void setSpeed(int speed) {
  // speed: 0 = stopped, 255 = full speed
  ledcWrite(PWM_CHANNEL, 255 - speed);  // Invert for active LOW
}

void enableMotor() {
  digitalWrite(PIN_BRAKE, HIGH);
  digitalWrite(PIN_ENABLE, HIGH);
}

void disableMotor() {
  ledcWrite(PWM_CHANNEL, 255);
  digitalWrite(PIN_BRAKE, LOW);
  digitalWrite(PIN_ENABLE, LOW);
}

void loop() {
  enableMotor();
  digitalWrite(PIN_DIR, LOW);  // Forward

  // Ramp up
  for (int s = 0; s <= 200; s += 5) {
    setSpeed(s);
    delay(50);
  }

  delay(3000);

  // Read RPM
  noInterrupts();
  unsigned long count = pulseCount;
  pulseCount = 0;
  interrupts();

  float rpm = (count * 60000.0) / (15.0 * 3000.0);  // 3 second window
  Serial.printf("RPM: %.1f\n", rpm);

  // Ramp down
  for (int s = 200; s >= 0; s -= 5) {
    setSpeed(s);
    delay(50);
  }

  disableMotor();
  delay(5000);
}
```

## Alternative Level Shifter: TXS0108E

The BSS138-based module is the budget standard, but the **TXS0108E** is a better option for higher-speed signals:

| Feature | BSS138 Module | TXS0108E |
|---------|--------------|----------|
| Channels | 4 | 8 |
| Direction | Bidirectional (auto-sensing) | Bidirectional (auto-sensing) |
| Max speed | ~200 kHz | **100 MHz** — far faster |
| Drive strength | Weak (pull-up based) | Strong (active push-pull) |
| Price | ~$0.50 | ~$1.50 |
| Best for | I2C, slow digital | **PWM, SPI, fast digital** |

**For the ZS-X11H wiring, TXS0108E is recommended** because it drives clean 5V PWM edges on the EL pin. The BSS138 module's weak pull-ups can produce sluggish rise times on PWM signals, which the ZS-X11H may misinterpret at higher frequencies.

**Wiring is identical** — LV side to ESP32 3.3V, HV side to 5V supply, same pin mapping.

## ESP32-S3 GPIO Assignments

If using an ESP32-S3 variant instead of the original ESP32, note the input-only pins:

| ESP32-S3 GPIO | Type | Recommended Use |
|---------------|------|-----------------|
| GPIO 34 | Input only | Hall A feedback (via voltage divider) |
| GPIO 35 | Input only | Hall B feedback (via voltage divider) |
| GPIO 36 | Input only | Hall C feedback (via voltage divider) |
| GPIO 39 | Input only | SC speed pulse (via voltage divider) |

These input-only pins are ideal for reading the 5V Hall sensor signals (through voltage dividers) since you never need to drive them as outputs. This frees up the bidirectional GPIOs for the output control signals (EL, Z/F, CT, STOP).

## Why ESP32 Instead of Arduino Mega?

The Arduino Mega works great for motor control (see [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]). But the ESP32 adds:

| Feature | Arduino Mega | ESP32 |
|---------|-------------|-------|
| WiFi | No (need shield) | Built-in |
| Bluetooth | No (need module) | Built-in (BLE + Classic) |
| Clock Speed | 16 MHz | 240 MHz |
| Cores | 1 | 2 (run motor control on one, comms on other) |
| ADC | 10-bit, 16 channels | 12-bit, 18 channels |
| Logic Level | 5V | 3.3V (needs level shifting) |
| Price | ~$15 | ~$5 |

The tradeoff is clear: ESP32 gives you wireless control (phone app, web interface, telemetry) at the cost of needing level shifters. For a robot that you want to control remotely, the ESP32 is the better choice.

## WARNING: ESP32 is NOT 5V Tolerant

This cannot be overstated. The ESP32's GPIO pins are rated for 3.3V maximum. Applying 5V to any GPIO pin **will damage the chip**. This applies to:

- The SC speed feedback signal (use the voltage divider described above)
- Any other 5V signal you might connect
- Even momentary 5V spikes can cause damage

If you're unsure whether a signal is 3.3V or 5V, measure it with a multimeter first. Assume 5V until proven otherwise.

## Common Wiring Mistakes

| Mistake | Consequence | Prevention |
|---------|------------|------------|
| Connecting 5V SC output directly to ESP32 GPIO | Damaged or destroyed GPIO pin | Always use voltage divider (10K/20K) |
| No level shifting on ESP32 → ZS-X11H signals | Unreliable motor control (3.3V barely meets 5V TTL threshold) | Use bidirectional level shifter or 74HCT245 |
| Using strapping pins (GPIO0/2/12/15) for outputs | ESP32 fails to boot or enters wrong mode | Avoid strapping pins, or buffer with 74HC14 |
| Forgetting common GND | Control signals float, motor ignores commands | Dedicated GND wire between ESP32 and ZS-X11H |
| Powering level shifter HV side from ZS-X11H 5V | Noisy 5V causes erratic shifting | Use clean 5V from LM2596 for HV reference |
| Using `analogWrite()` with ESP32 | Won't compile — ESP32 uses LEDC, not analogWrite | Use `ledcSetup()`, `ledcAttachPin()`, `ledcWrite()` |

## Brake Function Details

The CT (brake) signal through the level shifter works identically to the Arduino version:

| ESP32 Output | Level Shifter Output | ZS-X11H CT | Motor Behavior |
|-------------|---------------------|-----------|---------------|
| HIGH (3.3V) | HIGH (5V) | Normal | Motor runs per EL/Z/F settings |
| LOW (0V) | LOW (0V) | Brake | Motor phases shorted, active braking |

**Braking rule:** Always reduce speed (ramp EL toward stop) before engaging brake. High-speed braking generates large back-EMF currents. Release brake within 2-3 seconds of motor stopping.

---

Related Parts:
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — the motor controller
- [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] — simpler version without level shifting (5V Arduino)
- [[wiring-dual-zs-x11h-for-hoverboard-robot]] — dual motor version with Arduino Mega
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — the motor
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — the battery
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — provides 5V for the level shifter's HV reference

Categories:
- [[wiring-guides]]
