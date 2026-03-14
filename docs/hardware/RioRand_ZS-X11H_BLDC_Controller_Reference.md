# RioRand 6-60V Brushless DC Motor Controller (ZS-X11H)

## Comprehensive Hardware Reference

**Amazon ASIN:** B087M2378D **Board Designation:** ZS-X11H (printed on PCB as ZS-Z11H) **Also sold
as:** Generic 400W BLDC 3-Phase Controller on AliExpress, diymore, eBay **Research Date:**
2026-02-15

---

## Table of Contents

1. [Overview & Specifications](#1-overview--specifications)
2. [Physical Layout & Dimensions](#2-physical-layout--dimensions)
3. [Complete Pinout / Terminal Map](#3-complete-pinout--terminal-map)
4. [Power Input](#4-power-input)
5. [Motor Phase Outputs (MA, MB, MC)](#5-motor-phase-outputs-ma-mb-mc)
6. [Hall Sensor Inputs (Ha, Hb, Hc)](#6-hall-sensor-inputs-ha-hb-hc)
7. [Speed Control (VR / PWM)](#7-speed-control-vr--pwm)
8. [Direction Control (DIR)](#8-direction-control-dir)
9. [Brake Control (BRAKE)](#9-brake-control-brake)
10. [Stop / Enable (STOP)](#10-stop--enable-stop)
11. [Speed Pulse Output (SC)](#11-speed-pulse-output-sc)
12. [LED Connections (LED+, LED-)](#12-led-connections-led-led-)
13. [Onboard 5V Regulator](#13-onboard-5v-regulator)
14. [Signal Voltage Levels](#14-signal-voltage-levels)
15. [J1 Jumper Modification (REQUIRED for PWM)](#15-j1-jumper-modification-required-for-pwm)
16. [Arduino Interface Guide](#16-arduino-interface-guide)
17. [ESP32 Considerations](#17-esp32-considerations)
18. [RPM Measurement from SC Pin](#18-rpm-measurement-from-sc-pin)
19. [Common Issues & Troubleshooting](#19-common-issues--troubleshooting)
20. [Safety Warnings](#20-safety-warnings)
21. [Source Reliability Notes](#21-source-reliability-notes)

---

## 1. Overview & Specifications

| Parameter                   | Value                                                                        | Confidence                                                        |
| --------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Input Voltage Range         | 6V - 60V DC                                                                  | CONFIRMED (product listing)                                       |
| Rated Current               | 16A continuous                                                               | CONFIRMED (product listing)                                       |
| Peak Current                | 20A                                                                          | CONFIRMED (product listing)                                       |
| Rated Power                 | 200-300W                                                                     | CONFIRMED (product listing)                                       |
| Peak Power                  | 350-400W                                                                     | CONFIRMED (varies by listing: 350W on Amazon, 400W on AliExpress) |
| Motor Compatibility         | 3-phase BLDC with Hall sensors, 120-degree electrical angle ONLY             | CONFIRMED                                                         |
| Control Modes               | Onboard potentiometer, external 0-5V analog, external PWM (2.5-5V amplitude) | CONFIRMED                                                         |
| PWM Frequency Range         | 50Hz - 20kHz                                                                 | CONFIRMED (product documentation)                                 |
| Protections                 | Overcurrent, under-voltage                                                   | CONFIRMED                                                         |
| Reverse Polarity Protection | **NONE** - will destroy the board instantly                                  | CONFIRMED                                                         |
| Onboard Fuse                | **NONE** - external fuse required                                            | CONFIRMED                                                         |
| Board Dimensions            | 63mm x 45mm x 31mm (L x W x H including heatsink)                            | CONFIRMED (electropeak listing)                                   |
| Weight                      | ~77g                                                                         | CONFIRMED (product listing)                                       |
| Onboard Voltage Regulator   | 78L05 (5V, max ~50mA)                                                        | CONFIRMED                                                         |

### What This Board IS:

- A sensorless FOC? **NO.** This is a simple trapezoidal (6-step) commutation controller.
- It requires Hall sensors on the motor. It does NOT support sensorless operation.
- It is designed for 120-degree electrical angle BLDC motors only. 60-degree motors will NOT work.

### What This Board is NOT:

- NOT a servo controller (no position control)
- NOT a FOC controller (no sinusoidal commutation)
- NOT compatible with sensorless/hall-less motors (use ZS-X11F for that)
- NOT a regenerative braking controller (brake is resistive/short-circuit type)

---

## 2. Physical Layout & Dimensions

```
Board Size: 63mm x 45mm x 31mm (with heatsink)

+-------------------------------------------------------------+
|                    HEATSINK (TOP)                            |
|                                                              |
|  +----------------------------------------------------------+
|  |                                                          |
|  |   [VCC] [GND] [MA] [MB] [MC]     <- LEFT: Power +       |
|  |   (screw terminals)                 Motor Phase Out      |
|  |                                                          |
|  |   [Blue POT]  <- Speed potentiometer (turn CCW for       |
|  |                  external PWM control)                    |
|  |                                                          |
|  |   [J1] <- 2-pin jumper pads (UNPOPULATED from factory)   |
|  |          Must solder header + install jumper for PWM      |
|  |                                                          |
|  |   +------------------------+                             |
|  |   | AUXILIARY CONTROL      |  <- RIGHT SIDE              |
|  |   | (5-pin or 6-pin       |     Control header           |
|  |   |  header/pads)         |                              |
|  |   |                       |                              |
|  |   | +5V                   |                              |
|  |   | SC  (Speed pulse)     |                              |
|  |   | DIR (Direction)       |                              |
|  |   | VR  (Analog speed)    |                              |
|  |   | GND                   |                              |
|  |   +------------------------+                             |
|  |                                                          |
|  |   +------------------------+                             |
|  |   | HALL SENSOR INPUT      |  <- 5-pin JST connector     |
|  |   | Ha  Hb  Hc  +5V GND   |    or solder pads           |
|  |   +------------------------+                             |
|  |                                                          |
|  |   [LED+] [LED-]  <- External indicator LED pads          |
|  |                                                          |
|  |   [STOP] [BRAKE] [DIR]  <- Additional control pads      |
|  |   (may be unpopulated solder pads on some versions)      |
|  |                                                          |
|  +----------------------------------------------------------+
+-------------------------------------------------------------+
```

**IMPORTANT NOTE:** The physical layout can vary between board revisions (V1 vs V2) and between
sellers. The general arrangement is consistent, but exact pad/header placement may shift. Always
visually confirm your specific board against this diagram.

---

## 3. Complete Pinout / Terminal Map

### Power + Motor Phase Terminals (Left Side - Screw Terminals)

| Terminal | Function                        | Wire Gauge                     | Notes                    |
| -------- | ------------------------------- | ------------------------------ | ------------------------ |
| **VCC**  | Positive power input (6-60V DC) | 14-16 AWG recommended for >10A | Main battery positive    |
| **GND**  | Power ground / negative         | 14-16 AWG recommended for >10A | Main battery negative    |
| **MA**   | Motor Phase A output            | 16-18 AWG (matches motor wire) | Connect to motor phase U |
| **MB**   | Motor Phase B output            | 16-18 AWG (matches motor wire) | Connect to motor phase V |
| **MC**   | Motor Phase C output            | 16-18 AWG (matches motor wire) | Connect to motor phase W |

### Hall Sensor Input Header (5-pin)

| Pin     | Function             | Wire Color (typical) | Notes                     |
| ------- | -------------------- | -------------------- | ------------------------- |
| **Ha**  | Hall sensor A signal | White                | Motor Hall A output       |
| **Hb**  | Hall sensor B signal | Green                | Motor Hall B output       |
| **Hc**  | Hall sensor C signal | Yellow               | Motor Hall C output       |
| **+5V** | Hall sensor power    | Red                  | 5V from onboard regulator |
| **GND** | Hall sensor ground   | Black                | Common ground             |

**Wire gauge for Hall wires:** 22 AWG (thin wires - signal only, no power)

### Auxiliary Control Header (CN1 - Right Side)

| Pin     | Function             | Signal Type | Active Level   | Notes                                           |
| ------- | -------------------- | ----------- | -------------- | ----------------------------------------------- |
| **+5V** | 5V output from 78L05 | Power       | N/A            | Max ~50mA output, powers pot + control switches |
| **SC**  | Speed pulse output   | Digital out | Pulse train    | Frequency proportional to motor speed           |
| **DIR** | Direction control    | Digital in  | **Active LOW** | LOW = reverse, HIGH/float = forward             |
| **VR**  | Analog speed input   | Analog in   | 0-5V           | Alternative to PWM; 0V = stop, 5V = max speed   |
| **GND** | Signal ground        | Ground      | N/A            | MUST connect to Arduino GND                     |

### Additional Control Pads (may be unpopulated solder pads)

| Pad       | Function             | Signal Type | Active Level     | Notes                                               |
| --------- | -------------------- | ----------- | ---------------- | --------------------------------------------------- |
| **STOP**  | Motor enable/disable | Digital in  | **Active LOW**   | LOW = motor disabled (coasts), HIGH/float = enabled |
| **BRAKE** | Brake activation     | Digital in  | **Active HIGH**  | HIGH (5V) = brake ON, LOW/float = brake OFF         |
| **PWM/P** | External PWM input   | PWM in      | 2.5-5V amplitude | Requires J1 jumper to be shorted                    |
| **LED+**  | External LED anode   | Power out   | N/A              | Connect LED+ here                                   |
| **LED-**  | External LED cathode | Power out   | N/A              | Connect LED- here                                   |

### J1 Jumper Pads

| Pad    | Function                  | Notes                                                                                                       |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **J1** | PWM signal routing jumper | 2 solder pads, UNPOPULATED from factory. Must solder 2-pin header and install jumper to enable external PWM |

---

## 4. Power Input

| Parameter                   | Value                                  |
| --------------------------- | -------------------------------------- |
| Voltage Range               | 6V - 60V DC                            |
| Recommended Operating Range | 12V - 48V (leave margin below 60V max) |
| Input Current (continuous)  | 16A rated                              |
| Input Current (peak)        | 20A                                    |
| Reverse Polarity Protection | **NONE**                               |
| Onboard Fuse                | **NONE**                               |

### Wiring Recommendations

- **Wire gauge:** 14 AWG minimum for runs under 3 feet at full current. 12 AWG for longer runs or
  sustained high current.
- **External fuse:** MANDATORY. Use a 20A automotive blade fuse or equivalent inline on the VCC
  line.
- **Capacitor:** A large electrolytic capacitor (1000uF 63V+) across VCC/GND at the board helps with
  voltage spikes during braking.
- **Battery:** For 36V hoverboard motors, use a 10S lithium-ion pack (36-42V). The controller
  handles the full charge voltage of a 10S pack (42V) within spec.

### CRITICAL WARNING

**Reversing VCC and GND polarity WILL INSTANTLY AND PERMANENTLY DESTROY the board.** There is no
reverse polarity protection. Double-check polarity before EVERY power connection. Use a multimeter.

---

## 5. Motor Phase Outputs (MA, MB, MC)

The three screw terminals MA, MB, MC carry the three-phase AC power to the BLDC motor. These are the
"thick wires" (typically 20 AWG from the board, but you should use heavier gauge for the run to the
motor).

### Connection to Motor

| Controller | Motor          | Notes                               |
| ---------- | -------------- | ----------------------------------- |
| MA         | Phase U (or A) | Order matters - see troubleshooting |
| MB         | Phase V (or B) | Order matters - see troubleshooting |
| MC         | Phase W (or C) | Order matters - see troubleshooting |

### Phase Sequence

The phase wire order determines motor direction and smooth operation. If the motor:

- **Won't start / jitters / vibrates:** The phase sequence is wrong
- **Runs but in wrong direction:** Swap any two phase wires
- **Makes loud noise with weak power:** Phase-to-Hall mismatch

There are 6 possible permutations of 3 phase wires. Only 1-2 will produce correct smooth operation.
If your motor documentation doesn't specify which wire is U/V/W, you must try combinations.

### Quick Phase Troubleshooting Method

1. Pick any initial connection (MA->wire1, MB->wire2, MC->wire3)
2. Power on, apply low speed
3. If motor runs smoothly: done
4. If motor jitters/vibrates: swap two phase wires at the controller
5. Repeat until smooth operation achieved (max 6 attempts)

---

## 6. Hall Sensor Inputs (Ha, Hb, Hc)

### Connection

The motor's Hall sensor cable typically has 5 wires:

| Wire Color (common) | Function      | Board Connection   |
| ------------------- | ------------- | ------------------ |
| Red                 | +5V power     | +5V on Hall header |
| Black               | Ground        | GND on Hall header |
| White               | Hall A signal | Ha                 |
| Green               | Hall B signal | Hb                 |
| Yellow              | Hall C signal | Hc                 |

**WARNING:** Wire colors are NOT standardized across motor manufacturers. Some motors use completely
different color schemes. The only reliable method is to identify power (usually thicker red/black)
vs signal (usually thinner colored) wires, then test signal assignments.

### Hall Signal Characteristics

- **Signal type:** Open-collector or push-pull digital output from motor's Hall effect sensors
- **Voltage levels:** 0V (low) to 5V (high), powered by the board's 5V supply
- **Electrical angle:** 120 degrees between phases (this controller ONLY supports 120-degree motors)

### Hall Sequence Troubleshooting

If the motor runs roughly or in the wrong direction with correct phase wiring, the Hall sensor
assignment may be wrong. Try swapping Ha/Hb/Hc connections. There are 6 permutations; only specific
ones will work correctly for a given phase wire arrangement.

**Relationship between phase wires and Hall sensors:** The Hall sensor sequence MUST match the phase
wire sequence. If you swap two phase wires, you may also need to swap the corresponding two Hall
wires. When troubleshooting, it is often easier to fix the phase wires first for smooth rotation,
then fix Hall wires if direction is wrong.

---

## 7. Speed Control (VR / PWM)

The ZS-X11H supports THREE speed control methods:

### Method 1: Onboard Potentiometer (Default)

- Blue potentiometer on the board
- Turn clockwise to increase speed, counterclockwise to decrease
- No external components needed
- Good for testing, not for microcontroller integration

### Method 2: External Analog Voltage (VR Pin)

- Apply 0-5V DC to the VR pin on the auxiliary header
- 0V = motor stopped
- 5V = maximum speed
- Linear relationship
- Can use an external potentiometer (center wiper to VR, ends to +5V and GND)

### Method 3: External PWM (P/PWM Pad) -- REQUIRES J1 JUMPER

| Parameter                              | Value                                         |
| -------------------------------------- | --------------------------------------------- |
| PWM Frequency Range                    | 50Hz - 20kHz                                  |
| PWM Amplitude                          | 2.5V - 5V (must be at least 2.5V to register) |
| Duty Cycle                             | 0% = stopped, 100% = max speed                |
| Arduino Default PWM (~490Hz or ~980Hz) | Works fine, within spec                       |

**CRITICAL:** When using external PWM:

1. The J1 jumper MUST be soldered and shorted (see Section 15)
2. The onboard potentiometer MUST be turned fully counterclockwise (minimum) or it will limit max
   speed
3. The PWM signal connects to the P/PWM pad, NOT the VR pin

---

## 8. Direction Control (DIR)

| Parameter              | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| Signal Type            | Digital input                                          |
| Logic                  | **Active LOW**                                         |
| HIGH / Floating        | Forward rotation (default)                             |
| LOW (connected to GND) | Reverse rotation                                       |
| Pull-up                | Internal pull-up to 5V (floats HIGH when disconnected) |

### Arduino Control

```cpp
#define PIN_DIR 2

// Forward
digitalWrite(PIN_DIR, HIGH);

// Reverse
digitalWrite(PIN_DIR, LOW);
```

### Manual Switch Control

Connect a SPST switch between the DIR terminal and GND. Switch open = forward, switch closed =
reverse.

### CRITICAL SAFETY WARNING

**Do NOT change direction at high speed under high voltage.** The controller uses non-delayed hard
commutation for direction reversal. Reversing at full speed causes massive current spikes that can:

- Damage the power MOSFETs
- Damage the controller IC
- Cause mechanical shock to the drivetrain

**Always reduce speed to below 50% before reversing direction.**

---

## 9. Brake Control (BRAKE)

| Parameter              | Value                                             |
| ---------------------- | ------------------------------------------------- |
| Signal Type            | Digital input                                     |
| Logic                  | **Active HIGH**                                   |
| HIGH (connected to 5V) | Brake ENGAGED (motor stops and holds)             |
| LOW / Floating         | Brake RELEASED (motor free to spin)               |
| Pull-down              | Internal pull-down (floats LOW when disconnected) |

### Arduino Control

```cpp
#define PIN_BRAKE 3

// Engage brake
digitalWrite(PIN_BRAKE, HIGH);

// Release brake
digitalWrite(PIN_BRAKE, LOW);
```

### Manual Switch Control

Connect a SPST switch between the BRAKE terminal and the +5V terminal on the auxiliary header.
Switch open = brake off, switch closed = brake on.

### Brake Behavior

- The brake works by short-circuiting the motor phases, causing electromagnetic braking
- It provides a "holding" force that resists rotation
- It is NOT regenerative (does not charge the battery)
- Braking at high speed generates heat in the controller -- use with appropriate thermal management

---

## 10. Stop / Enable (STOP)

| Parameter              | Value                                             |
| ---------------------- | ------------------------------------------------- |
| Signal Type            | Digital input                                     |
| Logic                  | **Active LOW**                                    |
| LOW (connected to GND) | Motor DISABLED (coasts to stop, no drive signals) |
| HIGH / Floating        | Motor ENABLED (responds to speed commands)        |
| Pull-up                | Internal pull-up (floats HIGH when disconnected)  |

### Arduino Control

```cpp
#define PIN_STOP 4

// Enable motor
digitalWrite(PIN_STOP, HIGH);

// Disable motor (coast to stop)
digitalWrite(PIN_STOP, LOW);
```

### Difference Between STOP and BRAKE

- **STOP (LOW):** Removes all drive signals. Motor coasts freely and decelerates due to friction
  only. No holding torque.
- **BRAKE (HIGH):** Actively short-circuits motor phases. Motor decelerates rapidly with
  electromagnetic braking. Provides holding torque.

---

## 11. Speed Pulse Output (SC)

| Parameter             | Value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| Signal Type           | Digital output (open-collector or push-pull)                             |
| Output Voltage        | 0-5V                                                                     |
| Frequency             | Proportional to motor speed                                              |
| Pulses per Revolution | ~90 (for typical hoverboard motor with 3 Hall sensors and 15 pole pairs) |

### How It Works

The SC pin outputs a pulse every time any Hall sensor detects a magnet pole transition. For a motor
with **P** magnetic pole pairs and **3** Hall sensors:

- Pulses per revolution = P x 3 x 2 (rising + falling edges)
- For a typical 15-pole-pair hoverboard motor: 15 x 3 x 2 = 90 pulses/rev

### Arduino RPM Calculation

```cpp
#define PIN_SPEED 12  // SC pin connected here
#define PULSES_PER_REV 90  // Adjust for your motor

void setup() {
  pinMode(PIN_SPEED, INPUT);
  Serial.begin(115200);
}

void loop() {
  unsigned long pulseDuration = pulseIn(PIN_SPEED, HIGH, 100000); // timeout 100ms

  if (pulseDuration > 0) {
    float frequency = 1000000.0 / (pulseDuration * 2.0); // full period = 2x half
    float rpm = (frequency / PULSES_PER_REV) * 60.0;
    Serial.print("RPM: ");
    Serial.println(rpm);
  } else {
    Serial.println("Motor stopped or too slow");
  }

  delay(100);
}
```

**NOTE:** `pulseIn()` is a blocking function. For real-time applications, use interrupt-based pulse
counting instead:

```cpp
volatile unsigned long pulseCount = 0;
volatile unsigned long lastPulseTime = 0;

void speedISR() {
  pulseCount++;
  lastPulseTime = micros();
}

void setup() {
  attachInterrupt(digitalPinToInterrupt(PIN_SPEED), speedISR, RISING);
}
```

---

## 12. LED Connections (LED+, LED-)

The board provides **LED+** and **LED-** pads for connecting an external indicator LED.

| Parameter         | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| LED+              | Anode connection (positive)                                |
| LED-              | Cathode connection (negative)                              |
| Purpose           | Power/status indicator                                     |
| Built-in resistor | UNCONFIRMED -- may need external current-limiting resistor |

**What is confirmed:** The LED pads exist for connecting an external indicator. The board does not
have a detailed published spec for what state the LED indicates (power on, fault, running, etc.).

**What is NOT confirmed:** Whether a current-limiting resistor is needed, what the LED behavior
means, or whether there are additional onboard LEDs on all board revisions. Some board photos show a
small SMD LED on the PCB that illuminates when powered, but this varies by revision.

**Recommendation:** If you connect an external LED, add a 330-ohm resistor in series to be safe. The
LED likely just indicates "power on" based on community reports.

---

## 13. Onboard 5V Regulator

| Parameter          | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Regulator IC       | 78L05                                                   |
| Output Voltage     | 5.0V                                                    |
| Max Output Current | ~50mA (78L05 absolute max is 100mA, derate for thermal) |
| Purpose            | Powers Hall sensors, potentiometer, control logic       |
| Available on       | +5V pins on Hall header and auxiliary header            |

### What You Can Power From It

- Hall sensors in the motor (~10-20mA total)
- The onboard potentiometer
- Pull-up/pull-down resistors on control lines
- A single indicator LED

### What You CANNOT Power From It

- An Arduino (draws 50-200mA depending on model)
- Multiple LEDs
- Any external logic circuits with significant current draw
- Servos, relays, or any actuators

**The 5V output is NOT a power supply for your microcontroller.** Power your Arduino separately.

---

## 14. Signal Voltage Levels

### Input Pins (DIR, BRAKE, STOP, PWM, VR)

| Parameter            | Value         | Confidence                        |
| -------------------- | ------------- | --------------------------------- |
| Logic HIGH threshold | ~2.5V minimum | CONFIRMED (PWM spec says 2.5-5V)  |
| Logic HIGH nominal   | 5V            | CONFIRMED (designed for 5V logic) |
| Logic LOW            | 0V (GND)      | CONFIRMED                         |
| 3.3V compatibility   | **UNCERTAIN** | See notes below                   |

### Critical Note on 3.3V Logic (ESP32, Raspberry Pi, etc.)

The board is designed for 5V logic levels. The PWM input explicitly requires 2.5V-5V amplitude. This
means:

- **Arduino Uno/Nano/Mega (5V logic):** Direct connection works perfectly. No level shifting needed.
- **ESP32 (3.3V logic):** The 3.3V output is ABOVE the 2.5V minimum threshold specified for PWM, so
  it _should_ work for PWM speed control. However, the DIR/BRAKE/STOP pins may have different
  thresholds that are undocumented. Community reports of ESP32 usage exist but with mixed results.
- **Recommendation for 3.3V MCUs:** Use a logic level shifter (3.3V to 5V) for reliable operation. A
  simple MOSFET-based bidirectional level shifter works. Cost: ~$1.

### Output Pins (SC, +5V)

| Pin | Output Voltage      |
| --- | ------------------- |
| SC  | 0-5V digital pulses |
| +5V | 5.0V from 78L05     |

**For ESP32:** The SC output at 5V needs a voltage divider (e.g., 10K + 20K) to bring it down to
3.3V safe for ESP32 inputs.

---

## 15. J1 Jumper Modification (REQUIRED for PWM)

### The Problem

The board ships with the J1 jumper pads UNPOPULATED. Without this jumper installed and shorted,
external PWM signals on the P/PWM pad are completely ignored by the controller.

### What You Need To Do

**Tools required:**

- Soldering iron
- 2-pin male header (2.54mm pitch) OR just a blob of solder
- Jumper cap (if using header)

**Steps:**

1. Locate the J1 pads on the board (near the potentiometer area)
2. **Option A (Permanent):** Bridge the two J1 pads with a solder blob
3. **Option B (Removable):** Solder a 2-pin male header onto the J1 pads, then install a jumper cap
4. Option B is recommended so you can switch between potentiometer and PWM control

### Additional PWM Setup

After installing the J1 jumper:

1. Connect your PWM signal wire to the P/PWM pad
2. Connect your MCU ground to the board's GND
3. Turn the onboard potentiometer fully counterclockwise (minimum position)
4. The potentiometer acts as a speed LIMITER even with PWM -- if it's at 50%, your PWM can only
   reach 50% speed

**Some users also need to solder a JST male header** to the auxiliary PWM control header if it's
unpopulated on their board revision. Check your specific board.

---

## 16. Arduino Interface Guide

### Wiring Diagram (Single Motor)

```
Arduino Uno                    ZS-X11H Controller
-----------------              ------------------
Pin 9  (PWM)  ----------------> P/PWM pad (with J1 jumper installed)
Pin 2  (Digital) --------------> DIR pad/terminal
Pin 3  (Digital) --------------> BRAKE pad/terminal
Pin 4  (Digital) --------------> STOP pad/terminal (optional)
Pin 12 (Digital) <-------------- SC (speed pulse output)
GND -----------------------------> GND (on auxiliary header)

                               VCC <-- Battery + (6-60V)
                               GND <-- Battery -
                               MA  --> Motor Phase U
                               MB  --> Motor Phase V
                               MC  --> Motor Phase W

                               Ha  <-- Motor Hall A (white)
                               Hb  <-- Motor Hall B (green)
                               Hc  <-- Motor Hall C (yellow)
                               +5V --> Motor Hall +5V (red)
                               GND --> Motor Hall GND (black)
```

### CRITICAL: Common Ground

**The Arduino GND and the controller GND MUST be connected.** Without a common ground reference, all
control signals are meaningless. This is the #1 cause of "it doesn't work" reports on forums.

### Dual Motor Wiring (Hoverboard Robot)

```
Arduino Uno          Right ZS-X11H        Left ZS-X11H
-----------          --------------        -------------
Pin 9  (PWM) ------> PWM
Pin 10 (PWM) -----------------------------> PWM
Pin 2  ------------> DIR
Pin 4  ------------------------------------> DIR
Pin 3  ------------> BRAKE
Pin 5  ------------------------------------> BRAKE
Pin 12 <------------ SC
Pin 11 <------------------------------------ SC
GND ----------------> GND -----------------> GND
```

### Complete Arduino Example Code

```cpp
// ==============================================
// ZS-X11H BLDC Motor Controller - Arduino Driver
// Single motor control with serial commands
// ==============================================

// Pin Definitions
const int PIN_DIR   = 2;   // Direction: HIGH=forward, LOW=reverse
const int PIN_BRAKE = 3;   // Brake: HIGH=brake ON, LOW=brake OFF
const int PIN_STOP  = 4;   // Stop/Enable: HIGH=enabled, LOW=disabled
const int PIN_PWM   = 9;   // PWM speed: 0-255 (0=stop, 255=max)
const int PIN_SPEED = 12;  // SC speed pulse input

// Motor state
int motorSpeed = 0;
bool motorForward = true;
bool brakeEngaged = false;
bool motorEnabled = true;

void setup() {
  Serial.begin(115200);

  // Configure pins
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_BRAKE, OUTPUT);
  pinMode(PIN_STOP, OUTPUT);
  pinMode(PIN_PWM, OUTPUT);
  pinMode(PIN_SPEED, INPUT);

  // Initialize safe state
  analogWrite(PIN_PWM, 0);        // Speed = 0
  digitalWrite(PIN_DIR, HIGH);     // Forward
  digitalWrite(PIN_BRAKE, LOW);    // Brake off
  digitalWrite(PIN_STOP, HIGH);    // Motor enabled

  Serial.println("ZS-X11H Motor Controller Ready");
  Serial.println("Commands: PWM,<0-255> | DIR,<0|1> | BRAKE,<0|1> | STOP,<0|1> | RPM");
}

void loop() {
  // Handle serial commands
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    handleCommand(cmd);
  }
}

void handleCommand(String cmd) {
  int commaIndex = cmd.indexOf(',');
  String command = (commaIndex > 0) ? cmd.substring(0, commaIndex) : cmd;
  String value = (commaIndex > 0) ? cmd.substring(commaIndex + 1) : "";

  command.toUpperCase();

  if (command == "PWM") {
    int speed = constrain(value.toInt(), 0, 255);
    analogWrite(PIN_PWM, speed);
    motorSpeed = speed;
    Serial.print("Speed set to: ");
    Serial.println(speed);

  } else if (command == "DIR") {
    // SAFETY: Reduce speed before direction change
    if (motorSpeed > 127) {
      Serial.println("WARNING: Reduce speed below 50% before reversing!");
      return;
    }
    bool forward = (value.toInt() == 1);
    digitalWrite(PIN_DIR, forward ? HIGH : LOW);
    motorForward = forward;
    Serial.print("Direction: ");
    Serial.println(forward ? "FORWARD" : "REVERSE");

  } else if (command == "BRAKE") {
    bool brake = (value.toInt() == 1);
    if (brake) {
      analogWrite(PIN_PWM, 0);  // Cut speed before braking
      delay(10);
    }
    digitalWrite(PIN_BRAKE, brake ? HIGH : LOW);
    brakeEngaged = brake;
    Serial.print("Brake: ");
    Serial.println(brake ? "ENGAGED" : "RELEASED");

  } else if (command == "STOP") {
    bool enable = (value.toInt() == 1);
    digitalWrite(PIN_STOP, enable ? HIGH : LOW);
    motorEnabled = enable;
    if (!enable) analogWrite(PIN_PWM, 0);
    Serial.print("Motor: ");
    Serial.println(enable ? "ENABLED" : "DISABLED");

  } else if (command == "RPM") {
    readRPM();

  } else {
    Serial.println("Unknown command. Use: PWM,<0-255> | DIR,<0|1> | BRAKE,<0|1> | STOP,<0|1> | RPM");
  }
}

void readRPM() {
  unsigned long pulseDuration = pulseIn(PIN_SPEED, HIGH, 100000);
  if (pulseDuration > 0) {
    float frequency = 1000000.0 / (pulseDuration * 2.0);
    // 90 pulses per revolution for typical hoverboard motor
    // ADJUST THIS VALUE for your specific motor
    float rpm = (frequency / 90.0) * 60.0;
    Serial.print("RPM: ");
    Serial.println(rpm, 1);
  } else {
    Serial.println("RPM: 0 (stopped or too slow)");
  }
}
```

### PWM Frequency Notes

- Arduino Uno pins 5,6 default PWM: ~980 Hz
- Arduino Uno pins 3,9,10,11 default PWM: ~490 Hz
- Both are within the ZS-X11H's 50Hz-20kHz range
- Higher frequencies (via Timer register modification) give smoother motor operation but are not
  required
- For most applications, the default Arduino PWM frequency works fine

---

## 17. ESP32 Considerations

The ESP32 uses 3.3V logic, which creates compatibility concerns:

### PWM Output (ESP32 -> Controller)

- ESP32 PWM output is 3.3V
- Controller specifies 2.5V minimum for PWM amplitude
- 3.3V > 2.5V, so it **should work** in theory
- Community reports are mixed -- some users report success, others report unreliable behavior
- **Recommendation:** Use a level shifter for reliability

### Digital Outputs (DIR, BRAKE, STOP)

- ESP32 HIGH = 3.3V
- Controller expects 5V logic (designed around 5V)
- May work unreliably or not at all
- **Recommendation:** Level shifter required

### SC Input (Controller -> ESP32)

- SC output is 5V
- ESP32 GPIO pins are NOT 5V tolerant (max 3.6V)
- **You WILL damage the ESP32** if you connect SC directly
- **Required:** Voltage divider (10K + 20K resistor divider) or level shifter

### Level Shifter Recommendation

Use a bidirectional MOSFET level shifter module (commonly available 4-channel or 8-channel for
~$1-2). Connect the low-voltage side to 3.3V reference, high-voltage side to 5V from the board's +5V
pin.

---

## 18. RPM Measurement from SC Pin

### Detailed Calculation

For a BLDC motor with **P** magnetic pole pairs and **3** Hall sensors:

```
Pulses per revolution = P x 3 x 2 (if counting both edges)
                     OR P x 3     (if counting single edge)

Typical hoverboard motor: P = 15 pole pairs
  -> Pulses/rev = 15 x 3 x 2 = 90 (both edges)
  -> Pulses/rev = 15 x 3     = 45 (single edge)
```

### Determining Your Motor's Pulses Per Revolution

1. Mark a reference point on the motor shaft/wheel
2. Slowly rotate exactly one full revolution by hand (or use very low PWM)
3. Count pulses on SC pin using Arduino `pulseIn()` or an oscilloscope
4. That count = your pulses_per_revolution value

### PID Speed Control

For closed-loop speed control, use the SC feedback with a PID controller:

- Reference:
  [oracid/PID-for-Hoverboard-motor-with-ZS-X11H-controller](https://github.com/oracid/PID-for-Hoverboard-motor-with-ZS-X11H-controller)
  on GitHub
- Start with Kp=1.0, Ki=0.1, Kd=0.01 and tune from there
- The SC feedback + PID loop lets you maintain constant RPM under varying load

---

## 19. Common Issues & Troubleshooting

### Issue 1: Motor Won't Start / Jitters / Vibrates

**Cause:** Incorrect phase wire (MA/MB/MC) to motor wire sequence **Fix:** Swap two phase wires at
the controller. Try all 6 permutations until smooth.

### Issue 2: Motor Runs But In Wrong Direction

**Cause:** Phase sequence is reversed **Fix:** Swap any two phase wires (e.g., swap MA and MB
connections)

### Issue 3: Motor Makes Loud Noise, Weak Power, Overheats

**Cause:** Phase wires don't match Hall sensor sequence **Fix:** After fixing phase wires for smooth
rotation, swap Hall sensor wires (Ha/Hb/Hc) to match

### Issue 4: External PWM Has No Effect

**Cause:** J1 jumper not installed or not shorted **Fix:** Solder 2-pin header to J1 pads and
install jumper (see Section 15)

### Issue 5: Motor Speed Limited Even at 100% PWM

**Cause:** Onboard potentiometer not at minimum **Fix:** Turn the blue potentiometer fully
counterclockwise

### Issue 6: Erratic Behavior / Random Direction Changes

**Cause:** No common ground between Arduino and controller **Fix:** Connect Arduino GND to
controller GND on auxiliary header

### Issue 7: Controller Dies Immediately On Power-Up

**Cause:** Reverse polarity on VCC/GND **Fix:** Board is destroyed. Replace it. There is no reverse
polarity protection. Use a fuse + diode next time.

### Issue 8: Motor Runs But Speed Measurement (SC) Reads Zero

**Cause:** SC pin not properly connected, or motor pole count assumption is wrong **Fix:** Verify SC
wiring. Try reading raw pulseIn() values without RPM calculation first.

### Issue 9: ESP32 PWM Not Working

**Cause:** 3.3V logic may be marginal for the controller's input thresholds **Fix:** Use a
3.3V-to-5V logic level shifter

### Issue 10: Motor Runs At Full Speed Regardless of PWM

**Cause:** VR (analog input) may have a voltage present, or potentiometer is turned up **Fix:**
Ensure potentiometer is at minimum. If using PWM mode, ensure VR pin is not connected to anything
providing voltage.

### Issue 11: Board Overheats

**Cause:** Motor draws more current than the controller can handle, or insufficient ventilation
**Fix:** Ensure motor is within 350W rating. Add heatsink compound between board heatsink and
enclosure. Provide airflow.

---

## 20. Safety Warnings

1. **NO REVERSE POLARITY PROTECTION.** Reversing power DESTROYS the board instantly. Always verify
   polarity.
2. **NO ONBOARD FUSE.** Install an external 20A fuse on the VCC line. Mandatory.
3. **Do NOT reverse direction at full speed.** Reduce to <50% speed first. Hard commutation reversal
   at high speed can destroy MOSFETs.
4. **Do NOT exceed 60V input.** The capacitors and MOSFETs are rated for this maximum. Exceeding it
   causes failure.
5. **Do NOT exceed 350W sustained.** The 400W rating is peak/momentary only. Sustained high power
   requires active cooling.
6. **Motor wires carry HIGH CURRENT.** 16-20A through phase wires. Use appropriate gauge. Loose
   connections are a fire risk.
7. **Hall sensor wires are FRAGILE.** 22 AWG signal wires. Don't pull on them. Secure with strain
   relief.
8. **The board has exposed high-voltage traces.** Mount in an enclosure. Do not touch the board
   while powered.
9. **Disconnect battery before ANY wiring changes.** Always. No exceptions.
10. **Braking generates heat.** Repeated hard braking from high speed can overheat the controller.
    Allow cooling between brake cycles.

---

## 21. Source Reliability Notes

This document was compiled from multiple community sources since RioRand does not provide
comprehensive official documentation. Here is the confidence assessment for each major claim:

### HIGH CONFIDENCE (Multiple independent sources confirm)

- Voltage range 6-60V, current ratings, power ratings
- Board designation ZS-X11H
- Pin names and basic functions (MA/MB/MC, Ha/Hb/Hc, DIR, BRAKE, VR, SC)
- J1 jumper requirement for PWM control
- Direction is active-low, Brake is active-high
- PWM frequency range 50Hz-20kHz
- PWM amplitude 2.5-5V
- Board dimensions 63x45x31mm
- 120-degree electrical angle motor compatibility only
- No reverse polarity protection
- No onboard fuse
- Onboard 78L05 regulator

### MEDIUM CONFIDENCE (Fewer sources or minor contradictions)

- Exact current limit of 78L05 output (50mA is conservative estimate from 78L05 datasheet)
- SC pin pulses per revolution = 90 (depends on motor, 90 is typical for hoverboard motors)
- STOP pin logic level (active-low) -- less documented than DIR and BRAKE
- Wire color assignments for Hall sensors (varies by motor manufacturer)
- 3.3V logic compatibility (limited testing data)

### LOW CONFIDENCE (Inferred or single-source)

- LED pin behavior (power indicator vs. fault indicator)
- Whether a current-limiting resistor is built in for LED pins
- Exact MOSFET part numbers used on the board
- Whether all board revisions have identical pinout layout
- Exact under-voltage protection threshold
- Whether the SC output is push-pull or open-collector

### Key Sources

- [MAD-EE: Easy Inexpensive Hoverboard Motor Driver](https://mad-ee.com/easy-inexpensive-hoverboard-motor-controller/)
  -- Most detailed single source
- [MAD-EE: Controlling Hoverboard Motor with Arduino](https://mad-ee.com/controlling-a-hoverboard-motor-with-a-simple-arduino/)
  -- Arduino integration details
- [RoboFoundry: Cheaper Way to Control Hoverboard Motors](https://robofoundry.medium.com/cheaper-way-to-control-hoverboard-motors-79b02dd8a521)
  -- Dual motor setup
- [Cirkit Designer: ZS-X11H v2 Component Page](https://docs.cirkitdesigner.com/component/4cf35777-c70f-44c9-9828-838f50915cea/zs-x11h-v2-350w-motor-controller)
  -- Pinout tables
- [Arduino Forum: ZS-X11H threads](https://forum.arduino.cc/t/zs-x11h-bldc-motor-controller-connection/1248600)
  -- Community troubleshooting
- [GitHub: aeoank/ZS-X11H-BLDC-motor-driver-arduino](https://github.com/aeoank/ZS-X11H-BLDC-motor-driver-arduino)
  -- Arduino code examples
- [GitHub: oracid/PID-for-Hoverboard-motor-with-ZS-X11H-controller](https://github.com/oracid/PID-for-Hoverboard-motor-with-ZS-X11H-controller)
  -- PID control implementation
- [Electropeak: ZS-X11H Product Page](https://electropeak.com/zs-x11h-dc-brushless-motor-drive-module-400w-9-60v)
  -- Specifications
- [Amazon: RioRand B087M2378D](https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D)
  -- Product listing specs
- [diymore.cc: 400W BLDC Controller](https://www.diymore.cc/products/400w-6v-60v-bldc-3-phase-dc-brushless-motor-controller-pwm-hall-motor-control)
  -- Alternative listing specs
- [Arduino Forum: ZS-X11H GND Connection](https://forum.arduino.cc/t/zs-x11h-bldc-motor-driver-arduino-gnd-connection/1097421)
  -- Common ground issue
- [Arduino Forum: ZS-X11H RPM Control](https://forum.arduino.cc/t/zs-x11h-control-exact-rpm-with-pwm-using-an-arduino/1062746)
  -- Speed measurement
- [Arduino Forum: ESP32 + ZS-X11H Issues](https://forum.arduino.cc/t/issues-with-zs-x11h-and-motor-speed-control-with-esp32/1284863)
  -- ESP32 compatibility

---

## Quick Reference Card

```
+============================================================+
|          ZS-X11H / RioRand BLDC Controller                 |
|                  QUICK REFERENCE                            |
+============================================================+
|                                                             |
|  POWER:  VCC = 6-60V DC    GND = Battery negative          |
|          16A cont / 20A peak    NO REVERSE PROTECTION      |
|                                                             |
|  MOTOR:  MA->U  MB->V  MC->W  (swap if motor jitters)     |
|                                                             |
|  HALL:   Ha=White  Hb=Green  Hc=Yellow                     |
|          +5V=Red   GND=Black  (colors may vary!)           |
|                                                             |
|  CONTROL LOGIC:                                            |
|  +----------+--------------+--------------+                |
|  | PIN      | HIGH (5V)    | LOW (GND)    |                |
|  +----------+--------------+--------------+                |
|  | DIR      | Forward      | Reverse      |                |
|  | BRAKE    | Brake ON     | Brake OFF    |                |
|  | STOP     | Enabled      | Disabled     |                |
|  | PWM      | Full speed   | Stopped      |                |
|  +----------+--------------+--------------+                |
|                                                             |
|  PWM: 50Hz-20kHz, 2.5-5V amplitude, J1 jumper required    |
|  Arduino pins 9/10 (~490Hz, 5V) = works perfectly          |
|  Turn blue pot to MIN when using external PWM!             |
|                                                             |
|  SC OUTPUT: Speed pulse -> count for RPM                   |
|  RPM = (frequency / pulses_per_rev) * 60                   |
|                                                             |
|  ESP32: NEEDS LEVEL SHIFTER (3.3V -> 5V)                  |
|  5V REGULATOR: 78L05, max ~50mA (don't power Arduino)     |
|                                                             |
+============================================================+
```
