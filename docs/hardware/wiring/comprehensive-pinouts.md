---
# LLM Optimization Metadata
metadata:
  document_id: hardware-wiring-comprehensive-pinouts
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 29 minutes
  last_updated: '2025-11-05'
  version: 1.0.0
tags:
  - hardware
  - specifications
  - electronics
  - components
key_entities:
  - 'Arduino Mega 2560: Main microcontroller for motor control'
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
  - 'Pinout Diagram: GPIO and connection mapping'
  - 'Wiring Guide: Electrical connection instructions'
summary: Technical documentation for OmniTrek Nexus project.
depends_on:
  - README.md
---

================================================================================ COMPREHENSIVE
COMPONENT PINOUTS GUIDE OmniTrek Rover Project - Complete Pin Reference
================================================================================

REFERENCE: 03_COMPREHENSIVE_PINOUTS.txt Cross-reference: 02 (wiring), 04 (code), 05 (quick ref)

Contains 30+ components with detailed specifications, pinouts, and best practices

================================================================================ 1.0 MICROCONTROLLER
BOARDS ================================================================================

1.1 ARDUINO MEGA 2560 ────────────────────────────────────────────────────────────────────────────

Microcontroller: ATmega2560 Clock Speed: 16 MHz Memory: 256 KB Flash, 8 KB SRAM I/O: 54 Digital (15
PWM), 16 Analog Voltage: 5V Logic Main Role: Primary controller for OmniTrek rover

PINOUT DIAGRAM:

```
                         Arduino Mega 2560
                    ┌─────────────────────┐
                    │    POWER PINS       │
        5V (red) ───┤ 5V               GND ├─── GND (black)
        5V (red) ───┤ 5V               GND ├─── GND (black)
        3.3V ───────┤ 3V3              GND ├─── GND (black)
        (special) ──┤ VIN              RST ├─── RESET
                    │                     │
                    │  SERIAL PORTS       │
        RX0/RX ─────┤ RX0 (0)        22-53 ├─── Digital I/O
        TX0/TX ─────┤ TX0 (1)        22-53 ├─── Digital I/O
        RX1 ────────┤ RX1 (19)           53 ├─── PWM out
        TX1 ────────┤ TX1 (18)           52 ├─── PWM out
        RX2 ────────┤ RX2 (17)           13 ├─── PWM/LED (yellow)
        TX2 ────────┤ TX2 (16)           12 ├─── PWM out
        RX3 ────────┤ RX3 (15)           11 ├─── PWM out
        TX3 ────────┤ TX3 (14)           10 ├─── PWM out
                    │                      9 ├─── PWM out (MOTOR)
                    │  ANALOG INPUT        8 ├─── Digital
        A0 ─────────┤ A0 / D54            7 ├─── Digital (MOTOR DIR)
        A1 ─────────┤ A1 / D55            6 ├─── Digital (MOTOR DIR)
        A2 ─────────┤ A2 / D56            5 ├─── PWM out
        A3 ─────────┤ A3 / D57            4 ├─── Digital
        A4 ─────────┤ A4 / D58            3 ├─── PWM out
        A5 ─────────┤ A5 / D59            2 ├─── Digital (INTERRUPT)
        A6 ─────────┤ A6 / D60            1 ├─── TX (main serial)
        A7 ─────────┤ A7 / D61            0 ├─── RX (main serial)
        A8 ─────────┤ A8 / D62               │
        A9 ─────────┤ A9 / D63               │
        A10 ────────┤ A10 / D64              │
        A11 ────────┤ A11 / D65              │
        A12 ────────┤ A12 / D66              │
        A13 ────────┤ A13 / D67              │
        A14 ────────┤ A14 / D68              │
        A15 ────────┤ A15 / D69              │
                    └─────────────────────┘
```

POWER PINS: 5V → Regulated 5V output, up to 500mA available 3.3V → Regulated 3.3V output for
low-power devices GND (multiple) → Ground reference (CRITICAL - use multiple) VIN → Raw input
(7-12V), feeds 5V regulator RST → Reset pin (pull LOW to reset)

SAFE PINS (Green Light ✓): Digital 2-13 → General purpose I/O (except 0-1, 14-15) Digital 22-53 →
All safe general purpose Analog A0-A15 → Can read analog or use as digital PWM capable: 2, 3, 4, 5,
6, 7, 8, 9, 10, 11, 12, 13

SERIAL/COMMUNICATION PINS: RX0 (0) / TX0 (1) → Main serial (USB programming, avoid using) RX1 (19) /
TX1 (18) → Serial1 (RECOMMENDED for ESP8266) RX2 (17) / TX2 (16) → Serial2 RX3 (15) / TX3 (14) →
Serial3

SPECIAL PINS: D13 (LED_BUILTIN) → On-board yellow LED (good for status) D0-D1 → Used for main USB
serial, avoid for components

PINNING RECOMMENDATIONS FOR OmniTrek: Motor PWM: D9 → analogWrite(9, speed) for motor speed Motor
Dir1: D7 → digitalWrite(7, dir1) for direction Motor Dir2: D8 → digitalWrite(8, dir2) for direction
Sensor 1: A0 → analogRead(A0) or digitalRead(54) Sensor 2: A1 → analogRead(A1) or digitalRead(55)
Serial to ESP8266: RX1/TX1 (pins 19/18) Status LED: D13 → digitalWrite(13, status)

Common Mistakes: ❌ Using RX0/TX0 for components → Serial upload fails ❌ Forgetting GND connections
→ Circuit won't work ❌ Assuming all pins can PWM → Only specific pins support it ✓ Always establish
common ground first ✓ Use serial1 (RX1/TX1) for external communication ✓ Leave RX0/TX0 free for USB
programming

Voltage Ratings: I/O pins: 5V (do NOT exceed) Logic HIGH: 2.0V+ Logic LOW: 0.8V-

────────────────────────────────────────────────────────────────────────────

1.2 NODMCU ESP32-S (ESP-32S V1.1)
────────────────────────────────────────────────────────────────────────────

Processor: ESP32-S Dual-Core (240 MHz) Memory: 320 KB SRAM, 4 MB Flash Connectivity: Wi-Fi (802.11
b/g/n), Bluetooth 5.0 Voltage: 3.3V Logic (DO NOT CONNECT 5V DIRECTLY) Main Role: WiFi/Bluetooth
communication, secondary controller

PINOUT DIAGRAM:

```
                        NodeMCU ESP32-S V1.1
                    ┌─────────────────────────┐
                    │                         │
        3V3 ────────┤ 3V3          D23 (23) ──┤─── GPIO 23 (safe)
        GND ────────┤ GND          D22 (22) ──┤─── GPIO 22 (safe)
        EN  ────────┤ EN (3.3V)    D21 (21) ──┤─── GPIO 21 (safe)
        TX  ────────┤ TX (1)       D19 (19) ──┤─── GPIO 19 (safe)
        RX  ────────┤ RX (3)       D18 (18) ──┤─── GPIO 18 (safe)
        D5  ────────┤ GPIO 5       GND ───────┤─── GND
        D17 ────────┤ GPIO 17      D17 (17) ──┤─── GPIO 17 (safe)
        D16 ────────┤ GPIO 16      D4  (4)  ──┤─── GPIO 4 (TRICKY)
        D4  ────────┤ GPIO 4       D0  (0)  ──┤─── GPIO 0 (TRICKY)
        D2  ────────┤ GPIO 2       D35 (35) ──┤─── GPIO 35 (input only)
        D15 ────────┤ GPIO 15      D34 (34) ──┤─── GPIO 34 (input only)
        D33 ────────┤ GPIO 33      D36 (36) ──┤─── GPIO 36 (input only)
        D32 ────────┤ GPIO 32      D39 (39) ──┤─── GPIO 39 (input only)
        D25 ────────┤ GPIO 25      GND ───────┤─── GND
        D26 ────────┤ GPIO 26      3V3 ───────┤─── 3V3
        D27 ────────┤ GPIO 27      D14 (14) ──┤─── GPIO 14 (PWM boot)
        D14 ────────┤ GPIO 14      D12 (12) ──┤─── GPIO 12 (TRICKY)
        D12 ────────┤ GPIO 12      D13 (13) ──┤─── GPIO 13 (safe)
        GND ────────┤ GND                     │
                    │  (Micro USB top)        │
                    └─────────────────────────┘
```

POWER PINS: 3V3 → 3.3V regulated output (CRITICAL: ESP32 is 3.3V only) GND → Ground (multiple
connections recommended) EN → Enable pin (normally HIGH, pull LOW to disable)

SAFE PINS (Green Light ✓): GPIO 13, 16-19, 21-23, 25-27, 32-33 These are reliable for any project,
no special behaviors

TRICKY PINS (Yellow Light ⚠️): GPIO 0, 2, 4, 5, 12, 15 (Strapping pins) → Determine boot behavior at
power-on → Can prevent code upload if pulled wrong → GPIO 0 HIGH = can't flash → GPIO 2 connected to
on-board LED → Best practice: avoid unless necessary

GPIO 34, 35, 36, 39 (Input-only pins) → Cannot be used as outputs → Perfect for ADC (analog) input →
No PWM capability

GPIO 1 (TX) / GPIO 3 (RX) → Used for programming and serial debug → Avoid connecting other
components

AVOID PINS (Red Light ✗): GPIO 6, 7, 8, 9, 10, 11 → Directly connected to internal flash memory →
Using them will crash the ESP32

SERIAL PORTS: Serial0 (GPIO 1/3) → USB/Programming (avoid for components) Serial1 (GPIO 9/10) →
FLASH memory conflict (avoid) Serial2 (GPIO 16/17) → Available (GPIO 17 RX, GPIO 16 TX)

SPI PINS (Fixed): MOSI: GPIO 23 MISO: GPIO 19 CLK: GPIO 18 CS: GPIO 5 (or any GPIO, user-defined)

I2C PINS (Default): SDA: GPIO 21 SCL: GPIO 22

PINNING RECOMMENDATIONS FOR OmniTrek: WiFi Primary: Built-in Bluetooth: Built-in Serial to Mega:
GPIO 17 (RX) / GPIO 16 (TX) Motor Control: GPIO 25, 26, 27, 32, 33 Sensors: GPIO 13, 21, 22, 23, 19,
18 Status LED: GPIO 2 (on-board LED)

Common Mistakes: ❌ Connecting 5V to any pin → Permanent damage ❌ Using GPIO 0 for sensor → Can't
upload code ❌ Forgetting GND connection → Won't work ❌ Trying to OUTPUT on GPIO 34-39 → Physically
impossible ✓ Always use logic level shifter for 5V communication ✓ Use GPIO 21/22 for I2C, they're
dedicated

Voltage Ratings: All I/O: 3.3V only (absolute maximum 3.6V) Logic HIGH: 2.1V+ Logic LOW: 0.7V-

────────────────────────────────────────────────────────────────────────────

1.3 NODEMCU AMICA (ESP8266)
────────────────────────────────────────────────────────────────────────────

Microcontroller: ESP8266 (80/160 MHz switchable) Memory: 160 KB SRAM, 4 MB Flash Connectivity: Wi-Fi
802.11 b/g/n, no Bluetooth Voltage: 3.3V Logic Main Role: WiFi communication node, secondary
controller

PINOUT DIAGRAM:

```
                       NodeMCU Amica (ESP8266)
                    ┌────────────────────────┐
                    │ Micro USB (bottom)     │
                    │                        │
        3V3 ────────┤ 3V3            D0 (16)┤─── GPIO 16 (wake from sleep)
        GND ────────┤ GND            D1 (5) ┤─── GPIO 5 (I2C SCL)
        GND ────────┤ GND            D2 (4) ┤─── GPIO 4 (I2C SDA)
        VIN ────────┤ VIN (5V input) D3 (0) ┤─── GPIO 0 (TRICKY - boot)
        RST ────────┤ RST            D4 (2) ┤─── GPIO 2 (on-board LED)
        FLASH ──────┤ FLASH (hold D0 GND)   ┤─── (for flashing)

        Pin Labels: D0-D8 are "user-friendly" labels
        Actual GPIO: 16, 5, 4, 0, 2, 14, 12, 13, 15
                    └────────────────────────┘

ACTUAL PIN MAPPING:
  D0 → GPIO 16
  D1 → GPIO 5 (SCL for I2C)
  D2 → GPIO 4 (SDA for I2C)
  D3 → GPIO 0 (TRICKY - strapping pin, avoid)
  D4 → GPIO 2 (on-board LED, LOW = LED on)
  D5 → GPIO 14 (SPI clock)
  D6 → GPIO 12 (SPI MOSI)
  D7 → GPIO 13 (SPI MISO)
  D8 → GPIO 15 (SPI chip select)

  **CRITICAL**: The 'D' labels are NOT GPIO numbers!
  You MUST use GPIO numbers in code: digitalWrite(5, HIGH) not digitalWrite(D1, HIGH)
```

POWER PINS: 3V3 → 3.3V regulated output (small current limit ~150mA) VIN → 5V input (for USB or
external 5V) GND → Ground (multiple for good connection) RST → Reset pin (pull LOW to reset)

SAFE PINS (Green Light ✓): D1 (GPIO 5) & D2 (GPIO 4) → Reliable general purpose, default I2C D5
(GPIO 14), D6 (GPIO 12), D7 (GPIO 13) → Reliable, default SPI D8 (GPIO 15) → Reliable but pulls LOW
at boot

TRICKY PINS (Yellow Light ⚠️): D3 (GPIO 0) → Strapping pin: must be HIGH at boot to run code → Pull
to GND with external switch/component → Can't upload → Avoid unless you understand the implications

D4 (GPIO 2) → Connected to on-board LED → Pulls HIGH at boot (LED off by default) → Good for status
indicator → If pulled LOW at boot, can cause issues

D0 (GPIO 16) → Special wake-up pin for deep sleep → Limited functionality for normal I/O → Best used
for sleep-wake purposes only

AVOID PINS (Red Light ✗): None inherently dangerous, but GPIO 6-11 connected to flash memory Safer
to avoid GPIO 0, 2, 15 unless you know what you're doing

SPI PINS (Built-in): CLK: D5 (GPIO 14) MOSI: D6 (GPIO 12) MISO: D7 (GPIO 13) CS: D8 (GPIO 15)

I2C PINS (Built-in): SDA: D2 (GPIO 4) SCL: D1 (GPIO 5)

PINNING RECOMMENDATIONS FOR OmniTrek: WiFi: Built-in (always available) Serial to Arduino: RX (GPIO
3), TX (GPIO 1) I2C Sensors: D1 (GPIO 5 SCL) / D2 (GPIO 4 SDA) SPI Sensors: D5/D6/D7/D8
(CLK/MOSI/MISO/CS) Status LED: D4 (on-board LED) General I/O: D0, D5, D6, D7, D8

Common Mistakes: ❌ Using D3 (GPIO 0) for a sensor → Blocks code upload ❌ Assuming D numbers = GPIO
numbers in code → Code fails ❌ Connecting 5V directly → Damage (use logic level shifter) ❌
Forgetting common ground with Arduino → Won't communicate ✓ Always use logic level shifter (1k/2k
voltage divider or module) ✓ Remember: D1 in code is digitalWrite(5, ...) not digitalWrite(D1, ...)

Voltage Ratings: All I/O: 3.3V maximum (3.6V absolute max) Logic HIGH: 2.4V minimum Logic LOW: 0.8V
maximum

SPECIAL NOTES: The ESP8266 is more finicky than Arduino about pin states Multiple components pulling
on GPIO 0 can prevent upload Boot messages appear on RX/TX pins Built-in WiFi consumes power even
when not active

────────────────────────────────────────────────────────────────────────────

1.4 ARDUINO UNO R3 ────────────────────────────────────────────────────────────────────────────

Microcontroller: ATmega328P Clock Speed: 16 MHz Memory: 32 KB Flash, 2 KB SRAM I/O: 14 Digital (6
PWM), 6 Analog Voltage: 5V Logic Main Role: Small projects, sensors, secondary controller

PINOUT (simplified - similar to Mega but fewer pins):

```
POWER:              DIGITAL:              ANALOG:
5V                  D0-D13 (14 total)     A0-A5 (6 inputs)
3V3                 PWM: 3,5,6,9,10,11
GND
```

SAFE PINS: D2-D13 → All general purpose, safe A0-A5 → Analog input or digital PWM capable: D3, D5,
D6, D9, D10, D11

SPECIAL PINS: D0-D1 → RX/TX (main serial) D13 → On-board LED (yellow)

Common Mistakes: ❌ Using D0/D1 for components → Serial conflicts ❌ Forgetting to ground components
→ Won't work

────────────────────────────────────────────────────────────────────────────

1.5 RASPBERRY PI 3 MODEL B+
────────────────────────────────────────────────────────────────────────────

SoC: Broadcom BCM2837B0 (1.4GHz quad-core ARM) Memory: 1GB LPDDR2 Connectivity: Wi-Fi (2.4/5GHz),
Bluetooth 4.2, Gigabit Ethernet Voltage: 3.3V GPIO (same as ESP32/ESP8266) Main Role: High-level
processing, computer vision, advanced algorithms

PINOUT (GPIO header - 40 pins total):

```
        3V3 ┬─ 1          2 ─┬ 5V
        SDA ├─ 3          4 ─┤ 5V
        SCL ├─ 5          6 ─┤ GND
     GPIO4 ├─ 7          8 ─┤ TX (GPIO 14)
        GND ├─ 9         10 ─┤ RX (GPIO 15)
    GPIO17 ├─ 11         12 ─┤ GPIO 18 (PWM)
    GPIO27 ├─ 13         14 ─┤ GND
    GPIO22 ├─ 15         16 ─┤ GPIO 23
        3V3 ├─ 17         18 ─┤ GPIO 24
    GPIO10 ├─ 19         20 ─┤ GND
     GPIO9 ├─ 21         22 ─┤ GPIO 25
    GPIO11 ├─ 23         24 ─┤ GPIO 8
        GND ├─ 25         26 ─┤ GPIO 7
     GPIO0 ├─ 27         28 ─┤ GPIO 1
     GPIO5 ├─ 29         30 ─┤ GND
     GPIO6 ├─ 31         32 ─┤ GPIO 12
    GPIO13 ├─ 33         34 ─┤ GND
    GPIO19 ├─ 35         36 ─┤ GPIO 16
    GPIO26 ├─ 37         38 ─┤ GPIO 20
        GND ├─ 39         40 ─┤ GPIO 21
```

POWER PINS: 3V3 → 3.3V output 5V (pins 2,4) → 5V from power supply (not output) GND → Ground

I2C (Built-in): SDA: GPIO 2 SCL: GPIO 3

SPI (Built-in): CLK: GPIO 11 MOSI: GPIO 10 MISO: GPIO 9 CE0: GPIO 8 CE1: GPIO 7

UART/SERIAL: TX: GPIO 14 RX: GPIO 15

SAFE PINS: GPIO 4, 17, 18, 23, 24, 25, 27 → General purpose Most GPIO pins are safe (3.3V output
only)

Common Mistakes: ❌ Connecting 5V to GPIO → Permanent damage ❌ Forgetting GND connection → Won't
work ✓ Use logic level shifter for 5V components ✓ Use GPIO library or command line for control

Voltage Ratings: All GPIO: 3.3V only (absolute max 3.6V) Input from 5V circuits: REQUIRES level
shifter

================================================================================ 2.0 MOTOR DRIVERS &
CONTROLLERS ================================================================================

2.1 RIORAND ZS-X11H BLDC MOTOR CONTROLLER (PRIMARY)
────────────────────────────────────────────────────────────────────────────

Type: Brushless DC (BLDC) Motor Controller Voltage: 6-60V DC input Power Rating: 350W maximum (16A
rated continuous) Motor Type: 3-phase BLDC with Hall sensors REQUIRED Logic Voltage: 5V control
signals Main Role: Drive hoverboard hub motors

PINOUT:

```
              ZS-X11H Controller (viewed from connector side)

        ┌─────────────────────────────────────────┐
        │  POWER IN (XT30 or XT60 connector)      │
        │  Red:  Battery +                         │
        │  Black: Battery -/GND                    │
        │                                          │
        │  MOTOR OUT (3x pairs)                   │
        │  Motor A: Yellow, Green       (3-phase) │
        │  Motor B: Blue, Red           (3-phase) │
        │  Motor C: Black, White        (3-phase) │
        │                                          │
        │  HALL SENSORS (IN) - 3 wires            │
        │  Hall A, B, C (sensor feedback)         │
        │                                          │
        │  SIGNAL IN (6 wires to microcontroller) │
        │  Pin 1: GND (black)    ← CRITICAL       │
        │  Pin 2: PWM (white)    ← Speed control │
        │  Pin 3: DIR (red)      ← Direction     │
        │  Pin 4: EN (yellow)    ← Enable/brake │
        │  Pin 5: GND (black)    ← Secondary GND │
        │  Pin 6: BATT- (black)  ← Battery minus │
        │                                          │
        └─────────────────────────────────────────┘
```

SIGNAL PIN DESCRIPTIONS:

Pin 1 - GND (black) → Must connect to Arduino GND → CRITICAL: This is the reference voltage

Pin 2 - PWM (white) → Accepts 5V PWM signal from Arduino D9 (PWM pin) → Range: 0-255 maps to motor
speed 0-100% → Code: analogWrite(9, 128) for half speed → Rising edge triggers acceleration

Pin 3 - DIR (red) → Digital direction control → HIGH = Forward → LOW = Reverse → Code:
digitalWrite(7, HIGH) or digitalWrite(7, LOW)

Pin 4 - EN (yellow) → Enable / Brake control → HIGH = Motor enabled (coasting when PWM=0) → LOW =
Motor braked (sudden stop) → Code: digitalWrite(8, HIGH) to enable

Pin 5 - GND (black) → Redundant ground (can be left unconnected if Pin 1 connected)

Pin 6 - BATT- (black) → Battery negative from main battery → Can connect to controller GND if
battery is isolated

IMPORTANT REQUIREMENTS: → Requires Hall Effect sensors on motor (feedback) → MUST have common ground
with Arduino → PWM frequency should be 490Hz (Arduino default is fine) → Direction changing should
only occur at low PWM values → Braking is controlled via EN pin (active LOW)

OPERATIONAL LOGIC: Forward at 50% speed: DIR = HIGH, PWM = 128, EN = HIGH Backward at 25% speed: DIR
= LOW, PWM = 64, EN = HIGH Brake (hard stop): EN = LOW (overrides PWM/DIR) Coast to stop: EN = HIGH,
PWM = 0 Full reverse: DIR = LOW, PWM = 255, EN = HIGH

OmniTrek Pinning: GND → Arduino GND (pin 0, common line) PWM → Arduino D9 (analogWrite for speed)
DIR → Arduino D7 (digitalWrite for forward/back) EN → Arduino D8 (digitalWrite for enable/brake)

Common Mistakes: ❌ Not connecting GND → Controller won't respond ❌ Connecting 12V to signal pins →
Damage ❌ Changing direction at high PWM → Motor stall/damage ❌ PWM to wrong pin → Speed doesn't
change ✓ Always establish GND first ✓ Reduce PWM before changing direction ✓ Use enable pin for
safety

────────────────────────────────────────────────────────────────────────────

2.2 L298N DUAL H-BRIDGE DC MOTOR DRIVER
────────────────────────────────────────────────────────────────────────────

Type: Dual H-Bridge DC Motor Driver IC Voltage: 5-35V motor supply Current: 2A per channel (4A peak,
not sustained) Output: 2 independent DC motors or 1 stepper Logic Voltage: 5V control signals Main
Role: Drive small DC motors, alternative to main controller

PINOUT (8-pin DIP IC or common breakout board):

```
          L298N Motor Driver Pinout

    IN1 (1)  ┌──────────────┐  (8) OUT1 → Motor A+
    IN2 (2)  │              │  (7) OUT2 → Motor A-
    EN1 (3)  │   L298N      │  (6) GND
    GND (4)  │  H-Bridge   │  (5) EN2
             └──────────────┘
    IN3      └──────────────┐
    IN4                    │
    GND ────────────────────┴─→ Common GND

TYPICAL BREAKOUT BOARD LAYOUT:
    Power in: +5V to +35V
    Motor 1 (OUT1, OUT2)
    Motor 2 (OUT3, OUT4)
    Control: IN1-IN4
    Enable: ENA, ENB (for PWM speed control)
    GND: Multiple pins
```

MOTOR CONTROL LOGIC (Per Motor Channel):

Forward at full speed: IN1 = HIGH, IN2 = LOW, EN = HIGH

Backward at full speed: IN1 = LOW, IN2 = HIGH, EN = HIGH

Stop/Coast: IN1 = LOW, IN2 = LOW, EN = HIGH

Brake (stall): IN1 = HIGH, IN2 = HIGH, EN = HIGH (both high creates short circuit)

Variable speed: Use PWM on EN pin: analogWrite(enablePin, 0-255)

PINNING FOR TWO DC MOTORS (Arduino Mega):

MOTOR 1: L298N IN1 → Arduino D2 L298N IN2 → Arduino D3 (or another digital pin) L298N ENA → Arduino
D5 (PWM pin) L298N OUT1 → Motor 1 (+) L298N OUT2 → Motor 1 (-)

MOTOR 2: L298N IN3 → Arduino D4 L298N IN4 → Arduino D6 (or another digital pin) L298N ENB → Arduino
D11 (PWM pin) L298N OUT3 → Motor 2 (+) L298N OUT4 → Motor 2 (-)

POWER: L298N +V → Battery+ (5-35V DC) L298N GND → Battery- AND Arduino GND (common reference)

Advantages: ✓ Cheap and widely available ✓ Drives 2 independent motors ✓ Can handle up to 2A
continuous per channel ✓ Simple H-bridge logic

Disadvantages: ❌ Only 2A per channel (overheating at full current) ❌ Requires current-limiting
resistors ❌ Can't handle BLDC motors (no Hall sensor support) ❌ Less efficient than dedicated BLDC
controllers

Common Mistakes: ❌ Connecting motor power to 5V regulator → Voltage drop/failure ❌ EN pin left
floating (unconnected) → Motor stuck at full speed ❌ No common GND with Arduino → No control ✓ Use
separate power supply for motors (not Arduino 5V) ✓ Always connect GND between Arduino and motor
power

────────────────────────────────────────────────────────────────────────────

2.3 L293D QUADRUPLE HALF-H DRIVER
────────────────────────────────────────────────────────────────────────────

Type: 4-channel motor driver (same as L298N but smaller current) Voltage: 4.5-36V Current: 600mA per
channel (1.2A peak) Output: 4 independent motors or 2 dual-motor systems Logic: 5V control signals

Similar to L298N but lower current rating Use when driving 4 separate small motors or 2 stepper
motors Pinout similar but in 16-pin DIP package

────────────────────────────────────────────────────────────────────────────

2.4 TB6612FNG MOTOR SHIELD / STANDALONE
────────────────────────────────────────────────────────────────────────────

Type: Dual Motor Driver Chip (higher performance than L298N) Voltage: 5-12V (same as Arduino)
Current: 1.2A per channel (3.2A peak) Features: Better efficiency, PWM support, direction control

PINOUT (similar to L298N): PWMA, PWMB → PWM pins (analogWrite for speed) AIN1, AIN2 → Motor A
direction control BIN1, BIN2 → Motor B direction control STBY → Standby pin (enable/disable both
motors) GND → Ground (multiple) VM → Motor voltage VCC → Logic voltage (5V)

Use case: Medium-power DC motor control More efficient than L298N, same general operation

# ================================================================================ 3.0 SENSORS

3.1 HC-SR501 PIR MOTION SENSOR
────────────────────────────────────────────────────────────────────────────

Type: Passive Infrared Motion Detector Voltage: 5V (also accepts 4.5-20V range) Output: Digital
(HIGH when motion detected, LOW when none) Main Role: Detect movement in rover vicinity

PINOUT (3 pins):

```
        Front view (with white dome lens):

        ┌─────────────────┐
        │   PIR Sensor    │
        │  (white dome)   │
        │                 │
        ├─────────────────┤
        │ VCC  OUT  GND   │
        │ (left-right)    │
        └─────────────────┘
```

PINS: VCC → 5V power (red wire) OUT → Signal output to digital pin (yellow wire) GND → Ground (black
wire)

CONNECTION: VCC → Arduino 5V OUT → Arduino D2 (or any digital pin) GND → Arduino GND

CODE: pinMode(2, INPUT); if (digitalRead(2) == HIGH) { // Motion detected }

ADJUSTMENTS: Sensitivity dial (rear of board) → Clockwise = more sensitive → Counter-clockwise =
less sensitive → Typical range: 3-7 meters

Delay time dial (rear of board) → Controls how long OUT stays HIGH after motion → Typical range: 3
seconds to 5 minutes

Mode jumper (rear) → Single trigger: One pulse per motion event → Retriggerable: Pulse extends while
motion continues

WARM-UP TIME: → Needs 30-60 seconds to calibrate after power-on → May give false triggers during
warm-up → Always wait for calibration before using

Common Mistakes: ❌ Using analog input instead of digital → Won't read correctly ❌ Not waiting for
warm-up → False readings ❌ No pull-up resistor on output → Floating readings ✓ Give 1 minute
warm-up time after power ✓ Use digital input pin and digitalRead() ✓ Adjust sensitivity to your
environment

────────────────────────────────────────────────────────────────────────────

3.2 HC-SR04 ULTRASONIC DISTANCE SENSOR
────────────────────────────────────────────────────────────────────────────

Type: Ultrasonic distance measurement Range: 2cm to 4 meters Accuracy: ±0.3cm typically Output: Time
pulse = distance Main Role: Obstacle detection, distance measurement

PINOUT (4 pins):

```
        Front view (two cylindrical transducers):

        ┌──────┬──────┐
        │  T1  │  T2  │ (transducers - send/receive)
        │      │      │
        └─┬────┴─┬────┤
          │      │    │
        ┌─┴──┬───┴─┬──┴─┐
        │    │     │    │
       GND  ECHO TRIG  VCC

PINS (left to right):
  VCC   → 5V power
  TRIG  → Trigger pulse (from Arduino)
  ECHO  → Echo pulse (returns to Arduino)
  GND   → Ground
```

OPERATION:

1. Send 10µs HIGH pulse to TRIG pin
2. Sensor sends ultrasonic burst
3. Waits for echo
4. ECHO pin goes HIGH for duration = 2 × distance / speed_of_sound
5. Measure ECHO pulse width to calculate distance

CONNECTION: VCC → Arduino 5V TRIG → Arduino D12 (any digital pin) ECHO → Arduino D11 (any digital
pin) GND → Arduino GND

CODE: digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN, LOW);

pulse_duration = pulseIn(ECHO_PIN, HIGH); distance_cm = pulse_duration \* 0.034 / 2;

DISTANCE CALCULATION: distance_cm = (pulse_time_microseconds × 0.0343) / 2 or distance_inches =
(pulse_time_microseconds × 0.0135) / 2

MEASUREMENT FREQUENCY: → Wait at least 60ms between measurements → Multiple sensors need sequencing
(can't all trigger simultaneously) → Best practice: measure once per 100ms cycle

RANGE CONSIDERATIONS: Minimum: ~2cm (too close, returns 0) Optimal: 5-200cm (very accurate) Maximum:
400cm (4 meters) Beyond 4 meters: Very unreliable

Common Mistakes: ❌ TRIG pulse longer than 10µs → Bad readings ❌ Measuring too frequently →
Interference between pulses ❌ No GND connection → Won't work ❌ Multiple sensors triggering at same
time → Crosstalk ✓ Use pulseIn() function to measure echo time ✓ Add 60ms delay between measurements
✓ If multiple sensors, trigger one at a time

────────────────────────────────────────────────────────────────────────────

3.3 DHT22 TEMPERATURE & HUMIDITY SENSOR
────────────────────────────────────────────────────────────────────────────

Type: Digital temperature and humidity sensor Range: -40 to +80°C temperature, 0-100% humidity
Accuracy: ±0.5°C, ±2% humidity Output: Digital serial protocol Main Role: Environmental monitoring

PINOUT (4 pins):

```
        ┌─────────────────┐
        │   DHT22/AM2302  │
        │  (blue or red)  │
        │                 │
        └───┬───┬───┬─────┘
            │   │   │
           VCC GND DATA (and sometimes NC)
            |   |   |
       (1st pin: VCC, 2nd: DATA, 3rd: GND, 4th: NC)
```

PINS: VCC (1) → 3.3-5V power (though 3.3V preferred for DHT22) DATA (2) → Digital signal pin (with
4.7kΩ pull-up resistor) NC (3) → No connection (or GND variant) GND (4) → Ground

CONNECTION: VCC → Arduino 5V DATA → Arduino D6 (any digital pin, needs pull-up) GND → Arduino GND
Add 4.7kΩ resistor between VCC and DATA pin

CODE (using DHT library): #include <DHT.h> DHT dht(6, DHT22); // pin 6, DHT22 sensor dht.begin();
float temp = dht.readTemperature(); float humidity = dht.readHumidity();

MEASUREMENT TIMING: → Max sample rate: 1 reading per 2 seconds → Too frequent readings will return
NaN → Wait at least 2 seconds between readings

PULL-UP RESISTOR: → Essential for proper operation → 4.7kΩ resistor between VCC and DATA pin → Or
use Arduino internal pull-up: pinMode(pin, INPUT_PULLUP)

Common Mistakes: ❌ No pull-up resistor → Garbage readings ❌ Reading too frequently → NaN values ❌
Using 3.3V only without level shifter on 5V Arduino → Marginal ❌ Sensor too close to hot components
→ Inaccurate ✓ Always include 4.7kΩ pull-up resistor ✓ Allow 2 seconds between readings minimum ✓
Keep sensor away from heat sources ✓ Use proper DHT library (Adafruit DHT)

────────────────────────────────────────────────────────────────────────────

3.4 RC522 RFID READER MODULE
────────────────────────────────────────────────────────────────────────────

Type: RFID reader (13.56 MHz) Protocol: SPI communication Range: ~5cm typical Main Role: Card/tag
identification, automatic docking

PINOUT (8 pins):

```
        ┌──────────────────┐
        │   RC522 RFID     │
        │                  │
        │ (rectangular     │
        │  antenna loop)   │
        │                  │
        └─┬─┬─┬─┬─┬─┬─┬─┬──┘
          │ │ │ │ │ │ │ │
         SDA SCL MOSI MISO CS GND 3.3V GND
         (1) (2) (3)  (4)  (5) (6) (7)  (8)
```

PINS: SDA (1) → I2C or SPI Slave Select (SPI mode: CS) SCL (2) → I2C Clock or SPI Clock MOSI (3) →
SPI Master Out Slave In MISO (4) → SPI Master In Slave Out CS (5) → SPI Chip Select (low active) GND
(6,8) → Ground 3.3V (7) → 3.3V power

SPI MODE (Typical on Arduino): MOSI (3) → Arduino D11 (or SPI MOSI) MISO (4) → Arduino D12 (or SPI
MISO) SCL (2) → Arduino D13 (or SPI SCK) CS (5) → Arduino D10 (any digital pin, user-selectable) VCC
(7) → Arduino 3.3V (NOT 5V directly) GND → Arduino GND

IMPORTANT: Use level shifter for SPI lines if connecting to 5V Arduino!

CODE: #include <SPI.h> #include <MFRC522.h>

MFRC522 mfrc522(10, 9); // CS, RST pins mfrc522.PCD_Init();

if (mfrc522.PICC_IsNewCardPresent()) { if (mfrc522.PICC_ReadCardSerial()) { // Read successful byte
uid = mfrc522.uid.uidByte[0]; } }

COMMUNICATION: → Communicates via SPI protocol → Max SPI speed: 10 MHz → Most Arduino use 1-4 MHz
for reliability

RANGE: → Typical: 5cm → Maximum: 10cm (with good alignment) → Can be extended with better antenna

Common Mistakes: ❌ Using 5V instead of 3.3V → Damage ❌ Wrong SPI pins → No communication ❌ No
level shifter on 5V Arduino → Data corruption or damage ❌ Card not aligned with antenna → No read ✓
Always use 3.3V power ✓ Use level shifter for SPI data lines ✓ Keep card flat to antenna while
reading

================================================================================ 4.0 COMMUNICATION
MODULES ================================================================================

4.1 HC-05 BLUETOOTH SERIAL MODULE
────────────────────────────────────────────────────────────────────────────

Type: Bluetooth 2.0/2.1 module (not BLE) Voltage: 3.3V input (3.6V max) Range: 10-100 meters (varies
by power class) Output: Serial UART (transparent serial link) Main Role: Wireless communication with
phone/computer

PINOUT (6 pins typical):

```
        ┌────────────┐
        │   HC-05    │
        │ Bluetooth  │
        │   Module   │
        │            │
        └─┬─┬─┬─┬─┬─┬┘
          │ │ │ │ │ │
         GND TX RX VCC CH PW
         (back connector, sometimes labeled differently)
```

PINS: GND → Ground TX → Transmit (3.3V output) → Arduino RX (with level shifter) RX → Receive (3.3V
input) → Arduino TX (with level shifter) VCC → 3.3V power (with decoupling capacitor) CH → Mode
select (usually left unconnected = slave mode) PW → Power switch / enable

CONNECTION: GND → Arduino GND TX → Through level shifter → Arduino RX1 (pin 19 on Mega) RX → Through
level shifter → Arduino TX1 (pin 18 on Mega) VCC → 3.3V (with 10µF capacitor to GND)

LEVEL SHIFTER FOR RX (Arduino to HC-05): Arduino TX1 (5V) → 1kΩ resistor → HC-05 RX From junction →
2kΩ resistor → GND Result at HC-05 RX: ~3.3V (safe)

BAUD RATE: Default: 9600 bps (sometimes 38400) Set on Arduino: Serial1.begin(9600); Verify with:
AT+UART_DEF=9600,0,0 (AT mode)

AT COMMANDS (Configuration mode): AT → Tests communication AT+ROLE=0 → Sets as slave (default)
AT+UART_DEF=9600,0,0 → Sets baud rate AT+NAME=rover_bt → Sets Bluetooth name

Common Mistakes: ❌ Direct 5V to HC-05 → Damage ❌ No level shifter on TX line → Data corruption ❌
Using pins 0/1 → Conflicts with USB serial ❌ Wrong baud rate → Gibberish in serial monitor ✓ Always
use level shifter ✓ Use RX1/TX1 (pins 19/18 on Mega) to avoid USB conflicts ✓ Verify baud rate: 9600
or 38400

PAIRING: → Default PIN: 1234 or 0000 → Appears as "HC-05" in Bluetooth devices → Once paired, acts
as serial port

────────────────────────────────────────────────────────────────────────────

4.2 ESP-01 / GENERIC ESP8266 WiFi MODULE
────────────────────────────────────────────────────────────────────────────

Type: Bare ESP8266 WiFi module Voltage: 3.3V (strictly) Communication: UART serial + built-in TCP/IP
Range: ~100 meters (depends on environment) Main Role: WiFi connectivity for remote monitoring

PINOUT (8 pins on typical modules):

```
        GND    TX
        ┌──────────┐
        │ ESP8266  │
        │ (ESP-01) │
        └──────────┘
        VCC    RX    CH_PD GPIO0 RST
        (varies by module variant)
```

PINS: GND → Ground VCC → 3.3V (needs large filtering capacitor - 10µF minimum) TX → Serial transmit
(3.3V output) RX → Serial receive (3.3V input only!) CH_PD → Chip enable (pull HIGH to 3.3V) GPIO0 →
Program/mode select (pull to GND for flash mode) RST → Reset (active LOW)

CONNECTION: GND → Arduino GND VCC → 3.3V regulated supply (NOT USB 5V) TX → Arduino RX1 (pin 19 on
Mega) RX → Through 1kΩ/2kΩ voltage divider → Arduino TX1 (pin 18) CH_PD → 3.3V (pull-up, keeps chip
enabled) RST → 3.3V (pull-up, keeps chip running) GPIO0 → Floating (or pull HIGH) for normal
operation

POWER SUPPLY: → CRITICAL: Needs stable 3.3V supply → Can draw 150-300mA spikes during transmission →
Use separate 1A 3.3V regulator from main supply → Add 10-47µF capacitor across VCC/GND → Add 100nF
ceramic capacitor near VCC pin

AT COMMANDS (Serial communication): AT+RST → Reset AT+CWMODE=1 → Station mode (client)
AT+CWSSID="WiFiName","passwd" → Connect to WiFi AT+CIFSR → Get IP address
AT+CIPSTART="TCP","IP",port → Connect to server

BAUD RATES: Default: 115200 bps Some modules: 9600 bps Check before connecting: try both rates

Common Mistakes: ❌ Using USB 5V directly → DESTROYED ❌ No capacitors on power → Random reboots ❌
Direct 5V on RX pin → Damage ❌ CH_PD left floating → Module won't work ❌ Wrong baud rate → Can't
communicate ✓ Use stable 1A 3.3V supply ✓ Add 10µF capacitor to power ✓ Use proper level shifter
(1k/2k voltage divider) ✓ Pull CH_PD to 3.3V (pull-up resistor)

PROGRAMMING/FLASHING: → To upload new firmware: GPIO0 to GND during reset → To run normally: GPIO0
floating (pull-up to 3.3V) → Use FTDI USB-to-serial adapter for programming

# ================================================================================ 5.0 DISPLAY MODULES

5.1 16x2 CHARACTER LCD (I2C INTERFACE)
────────────────────────────────────────────────────────────────────────────

Type: 16-character, 2-line alphanumeric LCD I2C Address: Usually 0x27 or 0x3F Voltage: 5V logic Main
Role: Display status, sensor values, debug info

PINOUT (4 pins with I2C):

```
        ┌──────────────────┐
        │  LCD Module      │
        │  (16x2)          │
        │                  │
        │ Display area:    │
        │ XXXXXXXXXXXXXXXX │
        │ XXXXXXXXXXXXXXXX │
        │                  │
        └─┬─┬─┬─┬──────────┘
          │ │ │ │
         GND VCC SDA SCL
```

PINS (I2C Mode): GND → Arduino GND VCC → Arduino 5V SDA → Arduino A4 (or pin 20 on Mega) SCL →
Arduino A5 (or pin 21 on Mega)

I2C ADDRESS: Default: 0x27 (most common) or 0x3F Verify with I2C scanner sketch if unsure

CODE: #include <LiquidCrystal_I2C.h> LiquidCrystal_I2C lcd(0x27, 16, 2); // Address, columns, rows

lcd.init(); lcd.backlight(); lcd.setCursor(0, 0); // Column, row lcd.print("Hello World");

POWER: → Includes on-board voltage regulator → Can power directly from 5V → Backlight brightness
adjustable via potentiometer on module

Common Mistakes: ❌ Wrong I2C address → Won't display anything ❌ SDA/SCL swapped → Communication
fails ❌ No pull-up resistors → May not work (usually on module) ✓ Check I2C address with scanner
first ✓ Use LiquidCrystal_I2C library ✓ Add delay after init(): delay(100);

────────────────────────────────────────────────────────────────────────────

5.2 OLED DISPLAY (128x64, I2C)
────────────────────────────────────────────────────────────────────────────

Type: Organic LED display, 128 pixels wide, 64 pixels tall I2C Address: 0x3C or 0x3D Voltage: 3.3V
logic (5V tolerant) Main Role: Graphics display, menu system, real-time data visualization

PINOUT (4 pins):

```
        ┌─────────────┐
        │ OLED Display│
        │ 128x64 px   │
        │             │
        │ Display     │
        │ area (black)│
        │             │
        └─┬─┬─┬─┬─────┘
          │ │ │ │
         GND VCC SDA SCL
```

PINS: GND → Arduino GND VCC → 3.3V (or Arduino 5V with tolerance) SDA → Arduino A4 (or I2C SDA) SCL
→ Arduino A5 (or I2C SCL)

I2C ADDRESS: Most common: 0x3C Verify with I2C scanner

CODE: #include <Adafruit_SSD1306.h> Adafruit_SSD1306 display(128, 64, &Wire, -1);

display.begin(SSD1306_SWITCHCAPVCC, 0x3C); display.setTextSize(1);
display.setTextColor(SSD1306_WHITE); display.setCursor(0, 0); display.println("OmniTrek Rover");
display.display();

ADVANTAGES: ✓ Crisp, clear graphics display ✓ Very low power consumption ✓ High contrast ✓ Supports
graphics and text

Common Mistakes: ❌ Wrong I2C address → No display ❌ Forgetting display.display() → Nothing shown
❌ Updating display too frequently → Flicker ✓ Use 0x3C address (verify with scanner) ✓ Call
display.display() after drawing ✓ Limit update rate to 10-30 Hz

================================================================================ 6.0 POWER &
INTERFACE COMPONENTS
================================================================================

6.1 LOGIC LEVEL SHIFTER (CRITICAL FOR 3.3V TO 5V)
────────────────────────────────────────────────────────────────────────────

Purpose: Safely convert 3.3V signals (ESP32/ESP8266) to 5V (Arduino) and vice versa

METHOD 1: RESISTOR VOLTAGE DIVIDER (For 5V → 3.3V only)

```
5V Signal (Arduino TX)
        │
        ├─[1kΩ]─┬─ To 3.3V device RX
        │       │
        │      [2kΩ]
        │       │
        └───────┴─ GND
```

Result: 5V drops to ~3.3V Use: Unidirectional (5V to 3.3V only) Pros: Simple, cheap, no ICs needed
Cons: Slow, only works one direction

METHOD 2: COMMERCIAL LEVEL SHIFTER MODULE (Bidirectional)

```
        ┌─────────────────┐
        │ Level Shifter   │
        │ Module          │
        │                 │
  HV ───┤ High Voltage    │─── HV out
  HV ───┤ (5V side)       │─── HV out
  HV ───┤ GND / VCC       │─── GND

  LV ───┤ Low Voltage     │─── LV out
  LV ───┤ (3.3V side)     │─── LV out
  LV ───┤ GND / VCC       │─── GND
        └─────────────────┘
```

CONNECTION (OmniTrek Example): Module HV_VCC → Arduino 5V Module LV_VCC → 3.3V supply Module GND →
Common GND

For TX line (Arduino to ESP8266): Arduino TX → Module HV1 Module LV1 → ESP8266 RX

For RX line (ESP8266 to Arduino): ESP8266 TX → Module LV2 Module HV2 → Arduino RX

Advantages: ✓ Bidirectional conversion ✓ Fast (supports high baud rates) ✓ Clean 3.3V or 5V output ✓
Typical cost: $1-3

Common Mistakes: ❌ Connecting 5V directly to 3.3V pin → Damage ❌ Forgetting to connect common GND
→ Won't work ❌ Using voltage divider for bidirectional → Fails ✓ Always use level shifter (not just
resistor) for data lines ✓ Connect GND before power ✓ Use bidirectional module for serial
communication

────────────────────────────────────────────────────────────────────────────

6.2 VOLTAGE COMPATIBILITY REFERENCE CHART
────────────────────────────────────────────────────────────────────────────

```
COMPONENT       → ACCEPTS        ← OUTPUTS    NOTES
────────────────────────────────────────────────────────────
Arduino Mega    5V logic input   5V output    Can damage if >5V
ESP32/ESP8266   3.3V input ONLY  3.3V output  Will die at 5V!
HC-05 Bluetooth 3.3V ONLY        3.3V output  Use level shifter
HC-SR04 Ultrasonic 5V            5V output    Often works at 3.3V
DHT22 Sensor    3.3-5V           3.3V output  Prefers 3.3V
RC522 RFID      3.3V ONLY        3.3V output  Use level shifter
Raspberry Pi    3.3V GPIO        3.3V output  Damaged by 5V
Motors          6-60V variable   N/A          (via controller)
────────────────────────────────────────────────────────────

DANGER ZONES:
  5V → ESP32/ESP8266 directly = DESTROYED
  5V → RC522 RFID directly = DESTROYED
  5V → Raspberry Pi GPIO = DESTROYED

SAFE CONVERSIONS:
  5V → 3.3V: Use 1kΩ/2kΩ divider or level shifter ✓
  3.3V → 5V: Not recommended (marginal), use level shifter ✓
```

================================================================================ QUICK REFERENCE
SUMMARY ================================================================================

MOST COMMON OmniTrek PINNING:

```
ARDUINO MEGA 2560:
  D9  → Motor PWM speed control
  D7  → Motor direction 1
  D8  → Motor direction 2
  D13 → Status LED (on-board yellow)
  RX1 (pin 19) ← ESP8266 TX (through level shifter)
  TX1 (pin 18) → ESP8266 RX (through level shifter)
  A0-A5 → Analog sensors
  D2-D6, D10-D12 → Digital I/O (sensors, etc)

ESP8266:
  GPIO 17 (RX) ← Arduino TX1 (through level shifter)
  GPIO 16 (TX) → Arduino RX1 (through level shifter)
  GPIO 4, 5 → I2C (SDA, SCL)
  GPIO 2 → Status LED (on-board)
  GPIO 0, 15, etc → General I/O

ALWAYS:
  ✓ Connect common ground first
  ✓ Use level shifter between 5V and 3.3V domains
  ✓ Add power supply filtering (capacitors)
  ✓ Verify voltage ratings before connecting
  ✓ Leave GPIO 0, 2, 15 free on ESP8266 if possible
  ✓ Avoid RX0/TX0 on Arduino (reserved for USB)
```

================================================================================ END OF
COMPREHENSIVE PINOUTS GUIDE
================================================================================

Cross-reference: 02_COMPLETE_WIRING_GUIDE.txt for circuit examples 04_CODE_SNIPPETS_LIBRARY.txt for
code examples 05_QUICK_REFERENCE_CARDS.txt for quick lookup 07_SAFETY_AND_TROUBLESHOOTING.txt for
safety info
