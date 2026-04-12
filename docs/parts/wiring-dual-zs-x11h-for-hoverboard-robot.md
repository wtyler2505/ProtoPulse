---
description: "Dual motor wiring for hoverboard robot — two ZS-X11H controllers driven from one Arduino Mega with independent speed and direction per motor"
topics: ["[[wiring-guides]]"]
parts_involved: ["[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]", "[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]"]
status: verified
quantity: 0
voltage: [5, 36]
interfaces: [PWM, Digital]
---

# Wiring Dual ZS-X11H for Hoverboard Robot

This guide extends [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] to a full dual-motor hoverboard robot. Two [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] controllers, two [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]], one [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]], one [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]. Tank steering — each motor runs independently for skid-steer turning.

## Pin Assignments

### LEFT Motor Controller

| Arduino Mega Pin | ZS-X11H Signal | Function |
|-----------------|----------------|----------|
| D9 (PWM) | EL (speed) | Left motor speed — **ACTIVE LOW** |
| D8 | Z/F (direction) | Left motor direction |
| D7 | CT (brake) | Left motor brake |
| D6 | STOP (enable) | Left motor enable |
| D2 (INT0) | SC (feedback) | Left motor speed pulses |

### RIGHT Motor Controller

| Arduino Mega Pin | ZS-X11H Signal | Function |
|-----------------|----------------|----------|
| D10 (PWM) | EL (speed) | Right motor speed — **ACTIVE LOW** |
| D4 | Z/F (direction) | Right motor direction |
| D5 | CT (brake) | Right motor brake |
| D3 (INT1) | STOP (enable) | Right motor enable |
| D3 (INT1) | SC (feedback) | Right motor speed pulses |

**Note on D3:** D3 serves double duty here — it's used as the enable pin for the right controller AND as the interrupt pin for the right speed feedback. This works because the enable signal is a static digital output (HIGH/LOW), and the interrupt reads incoming pulses from SC. However, if this creates conflicts in your application, reassign the enable to another free digital pin (D11, D12, D13, D22-D53 are all available on the Mega) and use D3 exclusively for the interrupt.

### Alternative Right Motor Pin Assignment (Cleaner)

If you want to avoid the D3 conflict:

| Arduino Mega Pin | ZS-X11H Signal | Function |
|-----------------|----------------|----------|
| D10 (PWM) | EL (speed) | Right motor speed |
| D4 | Z/F (direction) | Right motor direction |
| D5 | CT (brake) | Right motor brake |
| D11 | STOP (enable) | Right motor enable |
| D3 (INT1) | SC (feedback) | Right motor speed pulses |

## Wiring Diagram

```
                          36V BATTERY
                     ┌────────┴────────┐
                     │                 │
               ┌─────┴─────┐    ┌─────┴─────┐
               │  ZS-X11H  │    │  ZS-X11H  │
               │   LEFT     │    │   RIGHT    │
               │            │    │            │
    ARDUINO    │  EL  ←── D9│    │D10 ──→ EL  │
    MEGA       │  Z/F ←── D8│    │D4  ──→ Z/F │
               │  CT  ←── D7│    │D5  ──→ CT  │
               │  STOP←── D6│    │D3  ──→ STOP│
               │  SC  ──→ D2│    │D3  ←── SC  │
               │  GND ← GND │    │GND → GND   │
               │            │    │            │
               │  MOTOR     │    │     MOTOR  │
               └──┬──┬──┬──┘    └──┬──┬──┬──┘
                  │  │  │          │  │  │
               [LEFT HUB]      [RIGHT HUB]
                MOTOR            MOTOR
```

## Common Ground — Say It Again

**ALL THREE devices must share a common ground:**
- Arduino GND
- Left ZS-X11H GND
- Right ZS-X11H GND

Use a common ground bus. A piece of copper bus bar or a terminal strip works well. Star topology (all grounds meet at one point) is better than daisy-chain (ground hops from device to device) for minimizing ground loops.

## Power Distribution

Both ZS-X11H controllers run from the same [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]. Wire them in parallel from the battery:

```
    BATTERY + ──┬──→ LEFT ZS-X11H Power +
                └──→ RIGHT ZS-X11H Power +

    BATTERY - ──┬──→ LEFT ZS-X11H Power -
                ├──→ RIGHT ZS-X11H Power -
                └──→ COMMON GND BUS ──→ Arduino GND
```

**Add an inline fuse** between the battery and the power distribution point. A 30A automotive blade fuse is appropriate. If a motor stalls or a wire shorts, the fuse blows instead of the BMS (or worse, the battery catching fire).

The Arduino gets its own 5V supply from a [[lm2596-adjustable-buck-converter-module-3a-step-down]] connected to the same battery. Do NOT try to power the Arduino from the ZS-X11H's 5V output (if it even has one) — keep the control electronics on a clean, separate power rail.

## Tank Steering Logic

Tank steering (also called skid-steer or differential drive) works by varying the speed of each motor independently. No steering mechanism needed — the robot turns by driving the wheels at different speeds.

| Desired Motion | Left Motor | Right Motor |
|---------------|------------|-------------|
| Forward | Forward, speed X | Forward, speed X |
| Reverse | Reverse, speed X | Reverse, speed X |
| Turn left (pivot) | Reverse, speed X | Forward, speed X |
| Turn right (pivot) | Forward, speed X | Reverse, speed X |
| Turn left (arc) | Forward, speed X/2 | Forward, speed X |
| Turn right (arc) | Forward, speed X | Forward, speed X/2 |
| Spin in place | Forward, speed X | Reverse, speed X |
| Stop | Brake | Brake |

### Direction Convention

**Important:** The left and right motors face opposite directions on the chassis. When both motors spin "forward" electrically, the wheels should both propel the robot in the same direction. If the robot spins in place when you command "forward," one motor's direction is inverted.

Fix options:
1. Swap the motor phase wires on one ZS-X11H (swap any two of the three motor wires)
2. Invert the direction logic in software for one motor

Software inversion is easier and reversible:

```cpp
// If right motor is physically reversed:
void setRightDirection(bool forward) {
  digitalWrite(PIN_RIGHT_DIR, forward ? HIGH : LOW);  // Inverted from left
}
void setLeftDirection(bool forward) {
  digitalWrite(PIN_LEFT_DIR, forward ? LOW : HIGH);   // Normal
}
```

## Arduino Code — Dual Motor Control

```cpp
// === PIN DEFINITIONS ===
// Left motor
const int L_SPEED  = 9;   // PWM → EL (active LOW)
const int L_DIR    = 8;   // Digital → Z/F
const int L_BRAKE  = 7;   // Digital → CT
const int L_ENABLE = 6;   // Digital → STOP
const int L_FB     = 2;   // Interrupt → SC (INT0)

// Right motor
const int R_SPEED  = 10;  // PWM → EL (active LOW)
const int R_DIR    = 4;   // Digital → Z/F
const int R_BRAKE  = 5;   // Digital → CT
const int R_ENABLE = 11;  // Digital → STOP (clean assignment)
const int R_FB     = 3;   // Interrupt → SC (INT1)

// Speed feedback counters
volatile unsigned long leftPulses = 0;
volatile unsigned long rightPulses = 0;

void leftPulseISR()  { leftPulses++; }
void rightPulseISR() { rightPulses++; }

void setup() {
  Serial.begin(115200);

  // Configure all pins
  int outputs[] = {L_SPEED, L_DIR, L_BRAKE, L_ENABLE,
                   R_SPEED, R_DIR, R_BRAKE, R_ENABLE};
  for (int pin : outputs) pinMode(pin, OUTPUT);

  pinMode(L_FB, INPUT);
  pinMode(R_FB, INPUT);

  // Start safe: everything off
  stopAll();

  // Attach interrupts
  attachInterrupt(digitalPinToInterrupt(L_FB), leftPulseISR, RISING);
  attachInterrupt(digitalPinToInterrupt(R_FB), rightPulseISR, RISING);

  Serial.println("Dual motor controller ready.");
}

// === MOTOR CONTROL FUNCTIONS ===

void setMotor(int speedPin, int dirPin, int brakePin, int enablePin,
              int speed, bool forward) {
  digitalWrite(enablePin, HIGH);           // Enable
  digitalWrite(brakePin, HIGH);            // Release brake
  digitalWrite(dirPin, forward ? LOW : HIGH); // Direction
  analogWrite(speedPin, 255 - speed);      // Speed (invert for active LOW)
}

void stopMotor(int speedPin, int brakePin, int enablePin) {
  analogWrite(speedPin, 255);              // EL HIGH = stopped
  digitalWrite(brakePin, LOW);             // Brake on
  digitalWrite(enablePin, LOW);            // Disabled
}

void stopAll() {
  stopMotor(L_SPEED, L_BRAKE, L_ENABLE);
  stopMotor(R_SPEED, R_BRAKE, R_ENABLE);
}

// === MOVEMENT COMMANDS ===

void driveForward(int speed) {
  setMotor(L_SPEED, L_DIR, L_BRAKE, L_ENABLE, speed, true);
  setMotor(R_SPEED, R_DIR, R_BRAKE, R_ENABLE, speed, true);
}

void driveReverse(int speed) {
  setMotor(L_SPEED, L_DIR, L_BRAKE, L_ENABLE, speed, false);
  setMotor(R_SPEED, R_DIR, R_BRAKE, R_ENABLE, speed, false);
}

void turnLeft(int speed) {
  // Pivot turn: left motor reverse, right motor forward
  setMotor(L_SPEED, L_DIR, L_BRAKE, L_ENABLE, speed, false);
  setMotor(R_SPEED, R_DIR, R_BRAKE, R_ENABLE, speed, true);
}

void turnRight(int speed) {
  // Pivot turn: left motor forward, right motor reverse
  setMotor(L_SPEED, L_DIR, L_BRAKE, L_ENABLE, speed, true);
  setMotor(R_SPEED, R_DIR, R_BRAKE, R_ENABLE, speed, false);
}

void arcLeft(int speed, float ratio) {
  // Arc turn: left motor slower, right motor full speed
  setMotor(L_SPEED, L_DIR, L_BRAKE, L_ENABLE, speed * ratio, true);
  setMotor(R_SPEED, R_DIR, R_BRAKE, R_ENABLE, speed, true);
}

void arcRight(int speed, float ratio) {
  // Arc turn: right motor slower, left motor full speed
  setMotor(L_SPEED, L_DIR, L_BRAKE, L_ENABLE, speed, true);
  setMotor(R_SPEED, R_DIR, R_BRAKE, R_ENABLE, speed * ratio, true);
}

// === SPEED FEEDBACK ===

void printRPM() {
  static unsigned long lastCheck = 0;
  unsigned long now = millis();
  unsigned long elapsed = now - lastCheck;
  if (elapsed < 500) return;

  noInterrupts();
  unsigned long lc = leftPulses;  leftPulses = 0;
  unsigned long rc = rightPulses; rightPulses = 0;
  interrupts();

  lastCheck = now;

  float leftRPM  = (lc * 60000.0) / (15.0 * elapsed);
  float rightRPM = (rc * 60000.0) / (15.0 * elapsed);

  Serial.print("L: "); Serial.print(leftRPM, 1);
  Serial.print(" RPM | R: "); Serial.print(rightRPM, 1);
  Serial.println(" RPM");
}

void loop() {
  // Example: drive forward, turn, drive forward, stop
  driveForward(150);
  delay(3000);
  printRPM();

  turnRight(100);
  delay(1000);

  driveForward(150);
  delay(3000);
  printRPM();

  stopAll();
  delay(5000);
}
```

## Wiring Checklist

Before powering on:

- [ ] Battery fuse installed (30A)
- [ ] Left ZS-X11H: power wires connected, motor phase wires connected, Hall sensor cable connected
- [ ] Right ZS-X11H: power wires connected, motor phase wires connected, Hall sensor cable connected
- [ ] Arduino D9 → Left EL
- [ ] Arduino D8 → Left Z/F
- [ ] Arduino D7 → Left CT
- [ ] Arduino D6 → Left STOP
- [ ] Arduino D2 → Left SC
- [ ] Arduino D10 → Right EL
- [ ] Arduino D4 → Right Z/F
- [ ] Arduino D5 → Right CT
- [ ] Arduino D11 → Right STOP
- [ ] Arduino D3 → Right SC
- [ ] Common ground connected (Arduino + Left ZS-X11H + Right ZS-X11H)
- [ ] Arduino powered from separate LM2596 at 5V (NOT from ZS-X11H)
- [ ] Multimeter confirms LM2596 output is 5.0V before connecting to Arduino

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| One motor works, other doesn't | Missing GND connection on non-working motor's controller | Check all ground connections |
| Robot spins in place when commanding forward | Motors face opposite directions, direction not compensated | Swap motor phase wires on one controller OR invert direction logic in code |
| Both motors jitter/vibrate | Hall sensor cables swapped between controllers | Each Hall cable must go to its own motor's controller |
| Robot veers to one side | Motors running at different speeds due to load/friction | Implement PID speed matching using SC feedback |
| BMS keeps tripping | Both motors accelerating simultaneously draws too much current | Add ramp-up in code, stagger motor start by 100ms |
| Arduino resets when motors start | EMI or power draw affecting 5V rail | Ensure Arduino has its own LM2596, add 100uF cap on Arduino 5V input |

## Common Wiring Mistakes

| Mistake | Consequence | Prevention |
|---------|------------|------------|
| Missing GND on one controller | That motor doesn't respond, other works fine | Check every ground connection individually |
| Both motors forward = robot spins | Motors face opposite directions on chassis, both spinning "forward" means opposite wheel motion | Swap phase wires on one motor OR invert direction in software |
| Hall cables swapped between controllers | Both motors vibrate instead of rotating | Label each Hall cable to its motor before connecting |
| Both motors accelerate simultaneously | Combined 30A inrush trips BMS overcurrent protection | Stagger motor startup by 100ms, use ramp-up acceleration |
| Arduino powered from ZS-X11H 5V | EMI from motor switching causes Arduino resets | Dedicated LM2596 for Arduino, add 100uF cap on Arduino 5V |
| Shared ground via daisy-chain | Ground loop causes erratic behavior on second controller | Star-ground topology — all grounds to one bus point |

## Brake Function Details — Dual Motor

With two motors, braking strategy matters more than with a single motor:

| Scenario | Left Motor | Right Motor | Result |
|----------|-----------|-------------|--------|
| Straight-line stop | Brake both | Brake both | Stops straight (if equal brake force) |
| Emergency stop | STOP both (LOW) | STOP both (LOW) | Both controllers disabled, motors coast |
| Controlled deceleration | Ramp PWM to 0, then brake | Same | Smoothest stop |
| Turn while braking | Brake inner wheel, coast outer | Coast or slow | Tighter turn during deceleration |

**Always reduce speed before braking.** High-speed braking at 36V generates significant back-EMF current through the MOSFETs. At 15A+ per motor, that's substantial heat dissipation.

---

Related Parts:
- [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] — single motor version of this guide
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — the motor controller (need two)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — the brain
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — the motors (need two)
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — the battery
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — powers the Arduino from the 36V battery
- [[salvaged-hoverboard-metal-frame-for-rover-chassis]] — the chassis that holds everything together

Categories:
- [[wiring-guides]]
