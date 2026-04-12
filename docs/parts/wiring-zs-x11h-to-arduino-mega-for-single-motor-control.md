---
description: "Complete wiring recipe for controlling one hoverboard BLDC motor from Arduino Mega via ZS-X11H controller — PWM speed, direction, brake, and speed feedback"
topics: ["[[wiring-guides]]"]
parts_involved: ["[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]"]
status: verified
quantity: 0
voltage: [5, 36]
interfaces: [PWM, Digital]
---

# Wiring ZS-X11H to Arduino Mega for Single Motor Control

This guide covers wiring one [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] to an [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] for controlling a single [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]. The ZS-X11H handles all the BLDC commutation — the Arduino just sends speed, direction, brake, and enable signals.

## Connection Table

| Arduino Mega Pin | ZS-X11H Signal | Wire Color (typical) | Function |
|-----------------|----------------|---------------------|----------|
| D9 (PWM) | EL (speed) | White/Yellow | PWM speed control — **ACTIVE LOW** |
| D8 | Z/F (direction) | Green | Direction: LOW = forward, HIGH = reverse |
| D7 | CT (brake) | Blue | Brake: LOW = brake engaged, HIGH = free run |
| D6 | STOP (enable) | Orange | Enable: LOW = motor stopped, HIGH = motor enabled |
| D2 (INT0) | SC (speed feedback) | Purple | Speed pulse output — use interrupt for RPM counting |
| GND | GND | Black | **MANDATORY common ground** |

```
    ARDUINO MEGA                          ZS-X11H
    ┌──────────┐                     ┌──────────────┐
    │          D9 ──── PWM ─────────→ EL (speed)    │
    │          D8 ──── DIR ─────────→ Z/F (dir)     │
    │          D7 ──── BRK ─────────→ CT (brake)    │
    │          D6 ──── EN ──────────→ STOP (enable) │
    │          D2 ←─── PULSE ─────── SC (feedback)  │
    │         GND ──── GND ─────────→ GND           │
    └──────────┘                     │               │
                                     │  MOTOR ──→ [BLDC HUB MOTOR]
                                     │  POWER ──→ [36V BATTERY]
                                     │  HALL  ←── [MOTOR HALL SENSORS]
                                     └──────────────┘
```

## CRITICAL: Common Ground

**The Arduino GND and ZS-X11H GND MUST be connected.** Without a common ground reference, the logic signals from the Arduino will be meaningless to the ZS-X11H. This is the most common cause of "it doesn't work" — you forget the ground wire.

The Arduino is powered separately (USB or its own 5V supply via [[lm2596-adjustable-buck-converter-module-3a-step-down]]). The ZS-X11H is powered from the [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]. They share ONLY the ground reference and the signal wires.

## Understanding the EL (Speed) Pin — Active LOW

This is the one that trips everyone up. The EL pin uses **inverted PWM logic**:

| analogWrite Value | Duty Cycle | EL Pin State | Motor Speed |
|-------------------|------------|-------------|-------------|
| 0 | 0% (LOW) | Always LOW | **FULL SPEED** |
| 127 | 50% | 50% duty | ~50% speed |
| 255 | 100% (HIGH) | Always HIGH | **STOPPED** |

Yes, it's backwards from what you'd expect. `analogWrite(9, 0)` = full speed. `analogWrite(9, 255)` = stopped. To think about it naturally, invert your speed value: `analogWrite(9, 255 - desiredSpeed)`.

## Signal Descriptions

### Z/F (Direction) — Pin D8
- `digitalWrite(8, LOW)` = Forward rotation
- `digitalWrite(8, HIGH)` = Reverse rotation
- Change direction only when motor is stopped or at very low speed. Switching direction at full speed puts mechanical stress on the motor and gearbox.

### CT (Brake) — Pin D7
- `digitalWrite(7, LOW)` = Brake engaged (motor actively resists rotation)
- `digitalWrite(7, HIGH)` = Brake released (normal operation)
- The brake is an electrical brake — it shorts the motor windings to create resistance. It's NOT a mechanical lock.

### STOP (Enable) — Pin D6
- `digitalWrite(6, LOW)` = Motor disabled (no power to motor regardless of other signals)
- `digitalWrite(6, HIGH)` = Motor enabled (responds to speed/direction signals)
- Use this as your master kill switch. In an emergency, pull this LOW.

### SC (Speed Feedback) — Pin D2
- Outputs pulses proportional to motor speed
- Connect to an interrupt-capable pin (D2 = INT0 on Mega)
- Count pulses over a fixed time window to calculate RPM
- The number of pulses per revolution depends on the motor's pole count (typically 15 pole pairs for hoverboard motors = 15 pulses per revolution)

## Arduino Code — Basic Motor Control

```cpp
// Pin definitions
const int PIN_SPEED = 9;    // PWM → EL (active LOW)
const int PIN_DIR   = 8;    // Digital → Z/F
const int PIN_BRAKE = 7;    // Digital → CT
const int PIN_ENABLE = 6;   // Digital → STOP
const int PIN_FEEDBACK = 2; // Interrupt → SC

// Speed feedback
volatile unsigned long pulseCount = 0;
unsigned long lastRPMCheck = 0;

void countPulse() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_SPEED, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_BRAKE, OUTPUT);
  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_FEEDBACK, INPUT);

  // Start in safe state: stopped, brake on, disabled
  analogWrite(PIN_SPEED, 255);   // EL HIGH = stopped (active LOW)
  digitalWrite(PIN_DIR, LOW);     // Forward
  digitalWrite(PIN_BRAKE, LOW);   // Brake engaged
  digitalWrite(PIN_ENABLE, LOW);  // Motor disabled

  // Attach interrupt for speed feedback
  attachInterrupt(digitalPinToInterrupt(PIN_FEEDBACK), countPulse, RISING);

  Serial.println("Motor controller ready. Send 0-255 for speed.");
}

void setMotorSpeed(int speed) {
  // speed: 0 = stopped, 255 = full speed
  // Invert for active-LOW EL pin
  analogWrite(PIN_SPEED, 255 - speed);
}

void enableMotor() {
  digitalWrite(PIN_BRAKE, HIGH);  // Release brake
  digitalWrite(PIN_ENABLE, HIGH); // Enable motor
}

void disableMotor() {
  analogWrite(PIN_SPEED, 255);    // Stop speed signal
  digitalWrite(PIN_BRAKE, LOW);   // Engage brake
  digitalWrite(PIN_ENABLE, LOW);  // Disable motor
}

void setDirection(bool forward) {
  digitalWrite(PIN_DIR, forward ? LOW : HIGH);
}

float getRPM() {
  unsigned long now = millis();
  unsigned long elapsed = now - lastRPMCheck;
  if (elapsed < 100) return -1; // Too soon

  noInterrupts();
  unsigned long count = pulseCount;
  pulseCount = 0;
  interrupts();

  lastRPMCheck = now;

  // 15 pulses per revolution (typical hoverboard motor)
  // RPM = (count / 15) / (elapsed / 60000)
  float rpm = (count * 60000.0) / (15.0 * elapsed);
  return rpm;
}

void loop() {
  // Example: ramp up, hold, ramp down
  enableMotor();
  setDirection(true); // Forward

  // Ramp up
  for (int speed = 0; speed <= 200; speed += 5) {
    setMotorSpeed(speed);
    delay(50);
  }

  // Hold for 3 seconds
  delay(3000);

  // Print RPM
  float rpm = getRPM();
  if (rpm >= 0) {
    Serial.print("RPM: ");
    Serial.println(rpm);
  }

  // Ramp down
  for (int speed = 200; speed >= 0; speed -= 5) {
    setMotorSpeed(speed);
    delay(50);
  }

  disableMotor();
  delay(2000);
}
```

## Power Wiring (ZS-X11H Side)

This guide covers only the Arduino-to-controller signal wiring. The power side of the ZS-X11H connects as follows (refer to the ZS-X11H part record for details):

- **Battery +** → ZS-X11H power input (red, thick wire)
- **Battery -** → ZS-X11H power ground (black, thick wire)
- **Motor phase wires** (3x) → ZS-X11H motor output (thick wires, order matters for direction)
- **Hall sensor cable** (5-pin) → ZS-X11H Hall sensor input (from motor)

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Motor doesn't respond at all | No common GND between Arduino and ZS-X11H | Connect GND wires |
| Motor runs at full speed always | EL pin not connected or PWM not working | Check D9 connection, verify PWM with oscilloscope or LED |
| Motor runs backwards | Z/F logic inverted for your motor | Swap motor phase wires OR invert direction logic |
| Motor stutters/vibrates | Hall sensor wiring wrong | Check Hall sensor connection order |
| Speed feedback reads zero | SC not connected or wrong interrupt pin | Verify D2 connection, check interrupt setup |
| Motor spins then stops | BMS overcurrent protection tripping | Reduce acceleration rate, check for mechanical binding |

## Common Wiring Mistakes

| Mistake | Consequence | Prevention |
|---------|------------|------------|
| No common GND between Arduino and ZS-X11H | Signals float, motor behaves randomly | Dedicated GND wire, verify with multimeter |
| EL pin left floating on power-up | Motor runs at full speed immediately | Initialize EL HIGH (stopped) in setup() before enabling |
| Reversing direction at full speed | Current spike can exceed 20A peak, stresses MOSFETs | Always ramp speed to 0 before toggling Z/F |
| Powering Arduino from ZS-X11H 5V output | Noisy power causes resets, erratic analog readings | Use separate LM2596 for Arduino power |
| Missing flyback capacitor on ZS-X11H V+/V- | Motor inductive spikes damage controller | 470uF 63V electrolytic cap across V+/V- |
| Using thin wire (22AWG) for motor power | Wire overheats at 15A, fire risk | 14AWG minimum for motor power connections |
| Swapping Hall sensor wires between motors | Motor vibrates instead of rotating | Label cables before disconnecting, one motor at a time |

## Brake Function Details

The CT (brake) pin provides regenerative braking by shorting the motor phases:

| CT State | Action | Current Flow | Notes |
|---------|--------|-------------|-------|
| HIGH (float) | Normal operation | Through motor phases | Default state |
| LOW | Active braking | Motor back-EMF through low-side MOSFETs | Braking force proportional to speed |

**Braking rules:**
- Reduce speed below 50% before activating brake — high-speed braking at high voltage stresses the controller
- Do NOT hold brake indefinitely after motor stops — draws continuous current through MOSFETs with no back-EMF opposition
- For emergency stop, use STOP (LOW) instead of brake — it disables the controller entirely
- Brake is for controlled deceleration, not emergency stop

---

Related Parts:
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — the motor controller
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — the microcontroller
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — the motor being driven
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — power source
- [[wiring-dual-zs-x11h-for-hoverboard-robot]] — dual motor version of this guide

Categories:
- [[wiring-guides]]
