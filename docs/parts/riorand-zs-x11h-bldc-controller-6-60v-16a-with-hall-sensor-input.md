---
description: "3-phase trapezoidal BLDC motor controller — 6-60V input, 16A continuous (20A peak), 200-400W. PWM speed control, direction/brake inputs, Hall sensor feedback. NO reverse polarity protection — will blow up if power is connected backwards"
topics: ["[[actuators]]", "[[shields]]"]
status: verified
quantity: 4
voltage: [6, 12, 24, 36, 48, 60]
interfaces: [PWM, Digital, Hall, 3-Phase]
logic_level: "mixed"
logic_notes: "Control inputs generally accept 3.3V PWM/TTL from MCUs, but the SC feedback output and Hall power rail are 5V. Shift or divide 5V outputs before feeding a 3.3V MCU."
manufacturer: "RioRand"
part_number: "ZS-X11H"
pinout: |
  Power Input:
    V+ → Motor supply (6-60V)
    V- → Ground (common with MCU ground!)

  Motor Output (3-phase):
    MA → Motor Phase A (Yellow)
    MB → Motor Phase B (Green)
    MC → Motor Phase C (Blue)

  Hall Sensor Input:
    HA → Hall A (from motor, Yellow)
    HB → Hall B (from motor, Green)
    HC → Hall C (from motor, Blue)
    5V → Hall sensor power (from onboard 78L05)
    GND → Hall sensor ground

  Control Input:
    EL   → Speed control PWM (5V, 50Hz-20kHz, active LOW: 0%=full, 100%=stop)
    Z/F  → Direction (HIGH=CW, LOW=CCW, or motor-dependent)
    STOP → Enable (LOW=stop, HIGH or float=run)
    CT   → Brake (LOW=brake, HIGH or float=coast)

  Feedback Output:
    SC → Speed pulse output (one pulse per Hall state change, 5V)

  Jumper:
    J1 → Start mode: OFF=start from stop, ON=continue from current speed
max_current_per_channel: "16A continuous, 20A peak"
compatible_with: ["[[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]"]
used_in: []
warnings: ["NO REVERSE POLARITY PROTECTION — connecting V+/V- backwards destroys the controller instantly", "EL (speed) is ACTIVE LOW — 0% duty cycle = FULL SPEED, 100% = STOP. This is counterintuitive!", "V- MUST share common ground with the MCU — floating ground = erratic behavior", "16A continuous at 36V = 576W — needs adequate ventilation and properly rated wiring", "Hall sensor order (HA/HB/HC) must match motor phase order (MA/MB/MC) — wrong pairing = vibration, not rotation"]
datasheet_url: ""
---

# RioRand ZS-X11H BLDC Controller 6-60V 16A with Hall Sensor Input

This is a 3-phase trapezoidal BLDC motor controller designed for Hall-sensored brushless motors in the 200-400W range. It takes a DC supply (6-60V), reads Hall sensor position feedback from the motor, and drives the three motor phases with proper commutation timing. Speed is controlled via PWM input, direction via a logic pin, and it provides a speed pulse output for closed-loop feedback.

The ZS-X11H is the right controller for the [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — it handles the 36V/15A those motors need, reads their Hall sensors natively, and exposes simple logic-level control inputs that any Arduino can drive.

**The two things that will bite you hardest:**
1. **No reverse polarity protection.** Connect V+/V- backwards and the MOSFETs blow instantly. There is no fuse, no diode, no protection. Triple-check before powering on.
2. **EL (speed input) is ACTIVE LOW.** A 0% duty cycle PWM = full speed. A 100% duty cycle = stopped. This is backwards from what every other motor controller does. If you forget this, your motor will spin at full speed the moment you apply power.

## Physical Dimensions

| Measurement | Value |
|-------------|-------|
| Length | 2.48 inches / 63mm |
| Width | 1.77 inches / 45mm |
| Height | 1.22 inches / 31mm |
| Weight | ~30g |

The compact form factor fits easily in a rover chassis. Mounting holes accept M3 screws.

## DC Speed Pulse Output (SC Pin) Details

The SC pin outputs a 5V pulse for every Hall sensor state change. This is a digital open-collector output pulled up to 5V through the controller's internal circuitry.

| Parameter | Value |
|-----------|-------|
| Output voltage | 5V (pulled up to controller's internal 5V rail) |
| Pulse type | Rising edge per Hall state transition |
| Pulses per electrical revolution | 6 |
| Pulses per mechanical revolution | 6 x pole_pairs (e.g., 90 for 15 pole-pair motor) |
| Maximum frequency | Limited by motor RPM and pole count |
| Output impedance | Low (suitable for direct MCU connection at 5V) |

Connect to an interrupt-capable pin on your MCU for accurate RPM measurement. For 3.3V MCUs like the ESP32, use a voltage divider (10K + 20K) to bring the signal down to 3.3V.

## Model Variants

| Model | Difference | Notes |
|-------|-----------|-------|
| ZS-X11H | Original version | EL, Z/F, CT, SC control pins |
| ZS-X11H V2 | Adds dedicated STOP input | Additional emergency stop pin |
| ZS-Z11H | Older variant | Similar functionality, slightly different pinout |

Check which version you have — the V2 has the STOP input as a separate pin, while the original uses the combination of EL/Z/F to achieve stop behavior. All versions share the same core control logic.

## Specifications

| Spec | Value |
|------|-------|
| Input Voltage | 6-60V DC |
| Continuous Current | 16A |
| Peak Current | 20A |
| Power Rating | 200-400W (voltage dependent) |
| Commutation | Trapezoidal (6-step) |
| Position Sensing | 3x Hall effect sensors (required) |
| PWM Input Frequency | 50Hz - 20kHz |
| PWM Logic | Active LOW (0% = full speed, 100% = stop) |
| Control Logic Level | 5V (TTL) |
| Analog Control | 0-5V DC (10K input impedance, linear speed mapping) |
| Speed Feedback | SC pin, one pulse per Hall state change |
| Onboard Regulator | 78L05 (5V for Hall sensors) |
| MOSFETs | 6x N-channel (3 high-side, 3 low-side) |
| Reverse Polarity Protection | **NONE** |
| Operating Temperature | -20 to +85C (derate above 40C) |
| PCB Dimensions | ~55 x 55mm (V1), ~63 x 45 x 31mm (V2) |

## Pinout — Full Reference

```
              +--[ZS-X11H PCB]--+
              |                  |
  V+ ====[+] |  POWER           | [MA] ==== Motor Phase A
  V- ====[−] |  INPUT           | [MB] ==== Motor Phase B
              |                  | [MC] ==== Motor Phase C
              |                  |
              |  HALL SENSOR     |
              |  [5V] [HA]      |
              |  [GND][HB]      |
              |       [HC]      |
              |                  |
              |  CONTROL         |
              |  [EL]  Speed PWM |
              |  [Z/F] Direction |
              |  [STOP] Enable   |
              |  [CT]  Brake     |
              |  [SC]  Speed out |
              |  [GND] Signal gnd|
              |                  |
              |  [J1] Start mode |
              +------------------+

  Power wires: thick (14AWG+)
  Signal wires: thin (22AWG)
  Hall connector: JST 5-pin
```

## Control Input Truth Table

All control inputs are active-low with internal pull-ups. They default to "run" when left floating.

| EL (Speed) | Z/F (Dir) | STOP | CT (Brake) | Motor Behavior |
|-----------|-----------|------|-----------|---------------|
| LOW (0%) | HIGH | HIGH/float | HIGH/float | **FULL SPEED, forward** |
| PWM | HIGH | HIGH/float | HIGH/float | Speed proportional to LOW time, forward |
| HIGH (100%) | HIGH | HIGH/float | HIGH/float | **STOPPED** (motor coasts) |
| PWM | LOW | HIGH/float | HIGH/float | Speed proportional to LOW time, **reverse** |
| X | X | **LOW** | X | **STOPPED** (motor disabled, coasts) |
| X | X | HIGH/float | **LOW** | **BRAKING** (motor phases shorted, active braking) |

### EL (Speed) — The Active-LOW Gotcha

This is the most important thing to understand about this controller. The EL input is **active LOW**:

| Arduino PWM | analogWrite() | EL Duty Cycle (LOW) | Motor Speed |
|-------------|--------------|-------------------|-------------|
| 0 | `analogWrite(pin, 0)` | 0% LOW time | **FULL SPEED** |
| 64 | `analogWrite(pin, 64)` | 25% LOW time | ~75% speed |
| 128 | `analogWrite(pin, 128)` | 50% LOW time | ~50% speed |
| 192 | `analogWrite(pin, 192)` | 75% LOW time | ~25% speed |
| 255 | `analogWrite(pin, 255)` | 100% LOW (held LOW) | Actually full speed again! |

**Wait, what?** Yes — `analogWrite(pin, 255)` outputs a constant LOW, which the controller reads as "always active" = full speed. And `analogWrite(pin, 0)` outputs a constant HIGH, which the controller reads as "never active" = stop.

**The correct mapping for Arduino:**
```
Motor speed = 255 - desiredSpeed;
analogWrite(EL_PIN, 255 - desiredSpeed);
```
Where `desiredSpeed` 0 = stop, 255 = full speed. This inverts the PWM so the controller gets what it expects.

**Or use direct register manipulation:**
```
// Invert PWM output on Timer 1 (pins 9, 10 on Uno/Mega)
// COM1A1=1, COM1A0=1 = Set on compare match, clear at BOTTOM (inverted)
TCCR1A |= (1 << COM1A0);  // Invert channel A
```

### Z/F (Direction)

| Z/F State | Direction |
|-----------|-----------|
| HIGH (or float) | Forward (CW, but depends on phase wiring) |
| LOW | Reverse (CCW) |

The actual rotation direction depends on how the motor phases are wired. If "forward" spins the wrong way, swap any two motor phase wires (MA/MB, MB/MC, or MA/MC) instead of changing the Z/F interpretation.

**Do NOT toggle Z/F while the motor is spinning at speed.** Bring the motor to a stop first (EL = HIGH or STOP = LOW), wait for the motor to actually stop, then change direction. Reversing under load stresses the MOSFETs and can cause current spikes that exceed the 20A peak rating.

### STOP (Enable)

| STOP State | Behavior |
|-----------|----------|
| HIGH (or float) | Controller enabled, motor responds to EL/Z/F |
| LOW | Controller disabled, motor coasts to stop |

This is your emergency stop. Pull LOW to disable the controller immediately. The motor coasts — it does NOT brake. For active braking, use CT instead.

### CT (Brake)

| CT State | Behavior |
|---------|----------|
| HIGH (or float) | Normal operation |
| LOW | Active braking — motor phases shorted through low-side MOSFETs |

When CT is pulled LOW, the controller shorts all three motor phases together through the low-side MOSFETs. This creates back-EMF braking — the motor's own rotation generates current that opposes motion. Braking force is proportional to speed (stronger at high RPM, weaker as the motor slows).

**Do NOT hold CT LOW continuously after the motor stops.** Shorting stationary motor phases draws continuous current through the MOSFETs with no back-EMF to oppose it. Brief braking pulses are fine; holding brake indefinitely can overheat the controller.

### SC (Speed Feedback)

The SC pin outputs a 5V pulse for every Hall sensor state change. With 3 Hall sensors and a typical 15-pole-pair hoverboard motor:

- 6 state changes per electrical revolution
- 15 electrical revolutions per mechanical revolution
- = **90 pulses per wheel revolution**

To calculate RPM from SC:
```
RPM = (pulse_frequency / 90) * 60
```

Or measure the period between pulses:
```
RPM = 60 / (pulse_period_seconds * 90)
```

Connect SC to an interrupt-capable pin on your Arduino for accurate speed measurement.

### Analog Speed Control Mode (0-5V)

Instead of PWM, you can control speed with a DC analog voltage on the EL pin:

| Analog Voltage | Motor Speed |
|---------------|-------------|
| 0V | Stopped |
| 2.5V | ~50% speed |
| 5V | Full speed |

The input impedance is approximately 10K ohm. Speed mapping is linear.

**PWM-to-Analog RC Filter:** If you want to use Arduino PWM but need the analog control mode (cleaner, less EMI), add an RC low-pass filter to convert PWM to a smooth DC voltage:

```
    Arduino PWM Pin ──── 1K resistor ──┬── To ZS-X11H EL pin
                                        │
                                    10uF electrolytic cap
                                        │
                                       GND
```

Cutoff frequency: 1 / (2 x pi x 1K x 10uF) = ~16 Hz. This smooths Arduino's ~490Hz or ~980Hz PWM into a DC voltage proportional to duty cycle.

**Note:** In analog mode, the EL pin behavior is NOT inverted — 0V = stop, 5V = full speed. This is the opposite of PWM mode where LOW = full speed.

### LED Status Indicators

| LED | Color | Meaning |
|-----|-------|---------|
| PWR | Red | Power applied — lights when controller receives voltage on V+/V- |
| Status | Green/Blue | Solid = normal operation, Blinking = possible fault (check Hall sensors, motor phases, or overcurrent), Off = no power or critical fault |

If both LEDs are dim, the power supply isn't delivering enough current — check your battery and wiring.

### J1 (Start Mode Jumper)

| J1 State | Behavior |
|---------|----------|
| OFF (open) | Motor starts from zero speed after a direction change or restart |
| ON (shorted) | Motor continues from its current speed after a direction change |

Leave OFF for most applications. The "continue from current speed" mode is for applications where the motor is being driven by external forces (e.g., a vehicle rolling downhill) and you want the controller to pick up at the current rotation rate.

## Hall Sensor Commutation

The controller reads the 3 Hall sensor inputs to determine rotor position, then drives the appropriate motor phases. The commutation table must match between the Hall sensors and motor phases:

| Hall State (A,B,C) | High-Side MOSFET | Low-Side MOSFET | Current Path |
|--------------------|-----------------|-----------------|-------------|
| 1,0,1 (5) | Phase A | Phase C | A → Motor → C |
| 0,0,1 (1) | Phase B | Phase C | B → Motor → C |
| 0,1,1 (3) | Phase B | Phase A | B → Motor → A |
| 0,1,0 (2) | Phase C | Phase A | C → Motor → A |
| 1,1,0 (6) | Phase C | Phase B | C → Motor → B |
| 1,0,0 (4) | Phase A | Phase B | A → Motor → B |

**If the motor vibrates instead of rotating**, the Hall-to-phase mapping is wrong. The fix is to swap motor phase wires until rotation is smooth. There are only 6 possible orderings of 3 wires — and only 2 of them produce smooth rotation (one for each direction).

## Wiring to Arduino

The control inputs are 5V TTL, so they connect directly to any 5V Arduino like the [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]].

| Controller Pin | Arduino Pin | Function | Notes |
|---------------|-------------|----------|-------|
| EL | PWM pin (e.g., D9) | Speed control | **Active LOW!** Use `analogWrite(pin, 255-speed)` |
| Z/F | Any digital (e.g., D8) | Direction | HIGH=forward, LOW=reverse |
| STOP | Any digital (e.g., D7) | Enable | Set HIGH to enable, LOW to emergency stop |
| CT | Any digital (e.g., D6) | Brake | Set LOW to brake, HIGH to coast |
| SC | Interrupt pin (e.g., D2) | Speed feedback | Attach interrupt, count pulses |
| GND | GND | **CRITICAL** | Controller V- and Arduino GND MUST be connected |

**Ground connection is mandatory.** The controller's V- terminal and the Arduino's GND must be the same ground. Without this common ground, the control signals float and the motor behaves erratically. Run a dedicated wire from the controller's signal GND to the Arduino GND — don't rely on the ground path through the power supply.

### Example Arduino Code

```cpp
#define EL_PIN    9   // PWM speed (active LOW!)
#define DIR_PIN   8   // Direction
#define STOP_PIN  7   // Enable (active LOW to stop)
#define BRAKE_PIN 6   // Brake (active LOW to brake)
#define SC_PIN    2   // Speed feedback (interrupt)

volatile unsigned long pulseCount = 0;

void countPulse() {
  pulseCount++;
}

void setup() {
  pinMode(EL_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(STOP_PIN, OUTPUT);
  pinMode(BRAKE_PIN, OUTPUT);
  pinMode(SC_PIN, INPUT);

  // Start in safe state: stopped
  analogWrite(EL_PIN, 255);    // 255 = constant HIGH = motor stopped
  digitalWrite(DIR_PIN, HIGH);  // Forward
  digitalWrite(STOP_PIN, HIGH); // Enabled
  digitalWrite(BRAKE_PIN, HIGH);// No brake

  attachInterrupt(digitalPinToInterrupt(SC_PIN), countPulse, RISING);
  Serial.begin(9600);
}

void setMotorSpeed(int speed) {
  // speed: 0 (stop) to 255 (full speed)
  // Invert for active-LOW controller
  analogWrite(EL_PIN, 255 - speed);
}

void loop() {
  // Ramp up slowly
  for (int i = 0; i <= 128; i++) {
    setMotorSpeed(i);
    delay(50);
  }

  // Read RPM every second
  unsigned long lastTime = millis();
  while (millis() - lastTime < 5000) {
    noInterrupts();
    unsigned long count = pulseCount;
    pulseCount = 0;
    interrupts();

    // 90 pulses per revolution for 15-pole-pair motor
    float rpm = (count / 90.0) * 60.0;
    Serial.print("RPM: ");
    Serial.println(rpm);
    delay(1000);
  }

  // Stop
  setMotorSpeed(0);
  delay(2000);
}
```

## Power Wiring

**This is where mistakes are expensive.**

| Connection | Wire Gauge | Notes |
|-----------|-----------|-------|
| Battery → Controller V+ | 14AWG minimum | Use spade terminals or solder. Add inline fuse (20A). |
| Battery → Controller V- | 14AWG minimum | COMMON GROUND with Arduino! |
| Controller MA/MB/MC → Motor | 14AWG minimum | Match motor phase wire gauge |
| Controller signal → Arduino | 22AWG | Short runs, low current |

**Fuse:** Always put a 20A fuse between the battery and V+. This controller has no reverse polarity protection, no overcurrent protection, and no thermal shutdown. A fuse is your only safety net.

**Capacitor:** Add a 470uF 63V electrolytic capacitor across V+/V- at the controller, as close to the terminals as possible. The motor's inductive load creates voltage spikes that can exceed the supply voltage. The cap absorbs these spikes.

## Troubleshooting

**Motor runs at full speed immediately on power-up:**
EL pin is floating or held LOW. The controller defaults to full speed when EL is LOW. Connect EL to your Arduino PWM pin and set it HIGH (255) before enabling the controller.

**Motor vibrates but doesn't rotate:**
Hall-to-phase mapping is wrong. Swap two motor phase wires (e.g., swap MA and MB connections). If still vibrating, try a different pair.

**Motor only spins one direction regardless of Z/F:**
Check that Z/F is actually switching between HIGH and LOW. Measure with a multimeter. Some controllers have a weak internal pull-up on Z/F — make sure your Arduino can sink enough current to pull it LOW.

**Erratic behavior, motor starts and stops randomly:**
Ground issue. The controller V- and Arduino GND are not connected, or the connection is intermittent. Run a dedicated ground wire.

**Controller gets very hot:**
Normal at high currents (>10A). Add a heatsink to the MOSFETs and ensure airflow. If it's getting hot at low current, check for a short in the motor windings.

**SC (speed) output shows no pulses:**
Hall sensors not connected or not powered. Check the 5V output from the controller's onboard 78L05. If the 78L05 has failed, the Hall sensors get no power and the controller gets no position feedback — the motor won't run.

**Controller instantly died:**
Reverse polarity. Check if V+/V- were swapped. The MOSFETs are dead. This controller has NO protection against this. Replace the controller.

## Warnings

- **NO REVERSE POLARITY PROTECTION** — this is listed first because it's the most common way to destroy this controller. V+ and V- are clearly marked on the board. Check twice. Then check again.
- **EL is ACTIVE LOW** — 0% duty cycle = FULL SPEED. If you forget the inversion, the motor hits full speed the instant you enable it. Start with EL held HIGH (stopped) and ramp down gradually.
- **Common ground is mandatory** — the controller V- and your MCU GND must be the same electrical node. Floating ground causes the control inputs to read random values.
- **16A at 36V = 576W** — this generates significant heat. The PCB-mount MOSFETs need airflow. In an enclosure, add a fan or heatsink.
- **Hall sensor order matters** — HA/HB/HC must correspond to the correct motor phases MA/MB/MC. Wrong pairing = vibration, not rotation. There's no magic "auto-detect" — you match them by testing.
- **Do not reverse direction at speed** — bring the motor to a stop first, then toggle Z/F. Reversing under load creates massive current spikes.
- **Add a fuse** — 20A inline between battery and V+. This is your only overcurrent protection.
- **Inductive voltage spikes** — add a 470uF 63V cap across V+/V-. Without it, flyback spikes from the motor can exceed 60V and damage the controller even on a 36V system.

---

Related Parts:
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] -- the motor this controller drives
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] -- the battery that powers this system
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] -- MCU for speed/direction control via PWM and digital pins
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] -- similar concept for DC motors, but lower voltage/current

Categories:
- [[actuators]]
- [[shields]]
