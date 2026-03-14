---
# LLM Optimization Metadata
metadata:
  document_id: hardware-wiring-nodemcu-esp8266-wiring
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 23 minutes
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
  - 'WebSocket: Real-time bidirectional communication protocol'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
  - 'Telemetry System: Real-time data transmission from rover'
  - 'Wiring Guide: Electrical connection instructions'
summary:
  '**Comprehensive pinout diagrams, power system integration, and quick reference for NodeMCU
  ESP8266** ---'
depends_on:
  - README.md
---

# NodeMCU ESP8266 (Amica) - Complete Wiring Reference

**Comprehensive pinout diagrams, power system integration, and quick reference for NodeMCU ESP8266**

---

## Quick Reference Card (Printable)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃           NodeMCU ESP8266 (Amica) - QUICK REFERENCE CARD               ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  POWER:                                                                ┃
┃  • Operating Voltage: 3.3V                                             ┃
┃  • Input Voltage (VIN): 4.5-10V                                        ┃
┃  • Recommended Input: 5V (USB or from Arduino)                         ┃
┃  • Current Consumption (Active WiFi): 70-80mA                          ┃
┃  • Deep Sleep: 20µA (chip) / 8-20mA (board)                           ┃
┃  • 3.3V Output: Max 600mA (from onboard AMS1117)                      ┃
┃                                                                        ┃
┃  MICROCONTROLLER:                                                      ┃
┃  • Chip: Tensilica Xtensa LX106 32-bit RISC                           ┃
┃  • Clock: 80MHz / 160MHz (adjustable)                                 ┃
┃  • Flash: 4MB                                                          ┃
┃  • SRAM: 128KB (64KB instruction, 96KB data)                          ┃
┃                                                                        ┃
┃  GPIO PINS:                                                            ┃
┃  • Total GPIO: 17 pins (D0-D10, SD0-SD3)                              ┃
┃  • ADC: 1 pin (A0) - 10-bit, 0-1V range                              ┃
┃  • PWM: All GPIO pins support PWM                                      ┃
┃  • I2C: Any GPIO (software), typically D1(SCL), D2(SDA)               ┃
┃  • SPI: D5(SCK), D6(MISO), D7(MOSI), D8(CS)                          ┃
┃                                                                        ┃
┃  WIFI:                                                                 ┃
┃  • Standard: 802.11 b/g/n                                             ┃
┃  • Frequency: 2.4GHz only                                             ┃
┃  • Modes: Station, AP, Station+AP                                     ┃
┃  • Range: ~100m (open air)                                            ┃
┃                                                                        ┃
┃  UART (Serial):                                                        ┃
┃  • Hardware UART: TX (D10/GPIO1), RX (D9/GPIO3)                       ┃
┃  • Software Serial: Any GPIO pins                                      ┃
┃  • Default Baud: 115200 (adjustable)                                  ┃
┃                                                                        ┃
┃  CRITICAL WARNINGS:                                                    ┃
┃  ⚠️  ALL GPIO pins are 3.3V ONLY - NOT 5V tolerant!                   ┃
┃  ⚠️  Use voltage divider or level shifter for 5V devices              ┃
┃  ⚠️  A0 input range: 0-1V only (NOT 0-3.3V!)                         ┃
┃  ⚠️  GPIO6-GPIO11 reserved for flash - DO NOT USE                     ┃
┃  ⚠️  D0 (GPIO16) for deep sleep wake ONLY (no interrupts/PWM/I2C)    ┃
┃  ⚠️  Transmit spikes: Add 100-470µF capacitor near 3.3V pin          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Complete Pinout Diagram

### Top View - NodeMCU Amica V2

```
                    ┌─────────────────────┐
                    │   ┌───────────┐     │
                    │   │  ESP8266  │     │
                    │   │  ESP-12E  │     │
                    │   └───────────┘     │
                    │                     │
     ┌──────────────┴─────────────────────┴──────────────┐
     │                                                    │
     │  ┌──────┐                            ┌──────┐     │
     │  │ USB  │         NodeMCU Amica      │ RST  │     │
     │  │Micro │           ESP8266          │ BTN  │     │
     │  └──────┘                            └──────┘     │
     │                                                    │
     │  LEFT SIDE:                  RIGHT SIDE:          │
     │                                                    │
     │  ┌─ A0  ──────────────────────────── D0  ─┐      │
     │  │  Reserved ───────────────────── GND     │      │
     │  │  Reserved ───────────────────── D1      │      │
     │  │  SD3 ───────────────────────── D2      │      │
     │  │  SD2 ───────────────────────── D3      │      │
     │  │  SD1 ───────────────────────── D4      │      │
     │  │  CMD ───────────────────────── 3V3     │      │
     │  │  SD0 ───────────────────────── GND     │      │
     │  │  CLK ───────────────────────── D5      │      │
     │  │  GND ───────────────────────── D6      │      │
     │  │  3V3 ───────────────────────── D7      │      │
     │  │  EN  ───────────────────────── D8      │      │
     │  │  RST ───────────────────────── RX/D9   │      │
     │  │  GND ───────────────────────── TX/D10  │      │
     │  └─ VIN ───────────────────────── GND  ───┘      │
     │                                                    │
     └────────────────────────────────────────────────────┘
```

### Detailed Pin Mapping

```
┌───────────────────────────────────────────────────────────────────────┐
│                      GPIO PIN MAPPING TABLE                           │
├──────────┬──────────┬────────────┬──────────────────────────────────┤
│ NodeMCU  │   GPIO   │  Special   │         Function / Notes         │
│   Pin    │  Number  │  Function  │                                   │
├──────────┼──────────┼────────────┼──────────────────────────────────┤
│   D0     │  GPIO16  │ Wake       │ Deep sleep wake, NO INT/PWM/I2C  │
│   D1     │  GPIO5   │ SCL        │ I2C Clock (typical)              │
│   D2     │  GPIO4   │ SDA        │ I2C Data (typical)               │
│   D3     │  GPIO0   │ FLASH      │ Boot mode, pulled HIGH at boot   │
│   D4     │  GPIO2   │ TX1/LED    │ Built-in LED, boot fails if LOW  │
│   D5     │  GPIO14  │ SCK        │ SPI Clock                        │
│   D6     │  GPIO12  │ MISO       │ SPI Master In Slave Out          │
│   D7     │  GPIO13  │ MOSI       │ SPI Master Out Slave In          │
│   D8     │  GPIO15  │ CS         │ SPI Chip Select, boot fails HIGH │
│   D9/RX  │  GPIO3   │ RX         │ Hardware Serial Receive          │
│   D10/TX │  GPIO1   │ TX         │ Hardware Serial Transmit         │
│   SD0    │  GPIO7   │ RESERVED   │ Flash memory - DO NOT USE        │
│   SD1    │  GPIO8   │ RESERVED   │ Flash memory - DO NOT USE        │
│   SD2    │  GPIO9   │ RESERVED   │ Flash memory - DO NOT USE        │
│   SD3    │  GPIO10  │ RESERVED   │ Flash memory - DO NOT USE        │
│   CMD    │  GPIO11  │ RESERVED   │ Flash memory - DO NOT USE        │
│   CLK    │  GPIO6   │ RESERVED   │ Flash memory - DO NOT USE        │
│   A0     │  ADC0    │ Analog In  │ 10-bit ADC, 0-1V range ONLY!    │
├──────────┴──────────┴────────────┴──────────────────────────────────┤
│  POWER PINS:                                                          │
│  • VIN:  4.5-10V input (powers AMS1117 regulator → 3.3V)            │
│  • 3V3:  3.3V output from regulator (max 600mA)                      │
│  • GND:  Ground (multiple pins available)                            │
│  • EN:   Enable pin (pulled HIGH, connect to GND to disable)         │
│  • RST:  Reset pin (pulled HIGH, connect to GND to reset)            │
└───────────────────────────────────────────────────────────────────────┘
```

### Boot Mode Pins (CRITICAL)

```
┌─────────────────────────────────────────────────────────────┐
│              ESP8266 BOOT MODE CONFIGURATION                │
├──────────┬──────────┬──────────┬──────────────────────────┤
│  GPIO0   │  GPIO2   │  GPIO15  │         Mode             │
│   (D3)   │   (D4)   │   (D8)   │                          │
├──────────┼──────────┼──────────┼──────────────────────────┤
│   HIGH   │   HIGH   │   LOW    │  Normal Boot (Flash)     │
│   LOW    │   HIGH   │   LOW    │  UART Download (Flash)   │
│   X      │   X      │   HIGH   │  SDIO Boot (DO NOT USE)  │
└──────────┴──────────┴──────────┴──────────────────────────┘

⚠️  IMPORTANT FOR WIRING:
   • D3 (GPIO0): MUST be HIGH during normal boot
     - Use 10kΩ pull-up resistor if external devices pull LOW

   • D4 (GPIO2): MUST be HIGH during boot
     - Built-in LED is connected here
     - Do NOT connect devices that pull this LOW at startup

   • D8 (GPIO15): MUST be LOW during boot
     - Use 10kΩ pull-down resistor for stability
     - Boot will FAIL if this pin is HIGH!
```

---

## Power System Integration (OmniTrek Nexus)

### Complete Power Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    OmniTrek POWER DISTRIBUTION                       │
└──────────────────────────────────────────────────────────────────────┘

36V Battery (10S2P Li-ion, 4.4Ah)        25.2V Battery (7S2P Li-ion, 4Ah)
HY-SSY-1002ULS                           ELITOP-702US-HY
┌────────────────┐                       ┌────────────────┐
│ Nominal: 36V   │                       │ Nominal: 25.2V │
│ Full: 42V      │                       │ Full: 29.4V    │
│ Cutoff: 28-30V │                       │ Cutoff: 21V    │
│ Capacity: 4.4Ah│                       │ Capacity: 4Ah  │
│ BMS: Integrated│                       │ BMS: Integrated│
└───┬────────────┘                       └───┬────────────┘
    │                                        │
    │ High Current (30A peak)                │ Electronics Power
    │                                        │
    │         ┌──────────────────────────────┘
    │         │
    │         │    ┌─────────────────────────┐
    │         │    │  LM2596 Buck Converter  │
    │         │    │  IN: 25.2V → OUT: 9V    │
    │         │    │  Max: 3A continuous     │
    │         │    │  Efficiency: ~85%       │
    │         │    └────────┬────────────────┘
    │         │             │
    │         │             │ 9V regulated
    │         │             │
    │         │             ↓
    │         │      ┌──────────────────┐
    │         │      │  Arduino Mega    │
    │         │      │  VIN: 9V         │
    │         │      │  Onboard 5V reg  │
    │         │      └─────┬────────────┘
    │         │            │
    │         │            │ 5V from Arduino
    │         │            │
    │         │            ↓
    │         │      ┌──────────────────────┐
    │         │      │  NodeMCU ESP8266     │
    │         │      │  VIN: 5V             │
    │         │      │  Onboard AMS1117     │
    │         │      │  Output: 3.3V        │
    │         │      └──────────────────────┘
    │         │
    │         └──→ Optional: LM2596 #2 (direct 5V for accessories)
    │
    ↓
┌────────────────────────────┐
│  Motor Power Distribution  │
│  (2× ZS-X11H Controllers)  │
│  Each controller:          │
│  • VCC: 36V (from battery) │
│  • Peak: 20A per controller│
│  • 2 motors per controller │
└────────────────────────────┘

Common Ground: All GND points connected together!
```

### Power Supply Specifications

#### 36V Battery (Motor Power)

```
MODEL: HY-SSY-1002ULS
┌──────────────────────────────────────┐
│  SPECIFICATIONS                      │
├──────────────────────────────────────┤
│  Chemistry:      Lithium-Ion 18650   │
│  Configuration:  10S2P               │
│  Nominal:        36V DC              │
│  Full Charge:    42V DC              │
│  Cutoff:         28-30V DC           │
│  Capacity:       4400mAh (4.4Ah)     │
│  Power:          158Wh               │
│  Weight:         ~970g               │
│  Dimensions:     135×95×60mm         │
│                                      │
│  BMS Protection:                     │
│  ✓ Over-charge (>42V)               │
│  ✓ Over-discharge (<28V)            │
│  ✓ Over-current (>30A)              │
│  ✓ Short-circuit                    │
│  ✓ Over-temperature                 │
│                                      │
│  Current Ratings:                    │
│  • Continuous: 20A                   │
│  • Peak: 30A (short bursts)         │
│  • Charging: <5A                     │
└──────────────────────────────────────┘

Connector: XT60 (recommended)
Polarity: RED = Positive, BLACK = Negative

⚠️  DANGER: High current source!
   • ALWAYS install 30A fuse near positive terminal
   • Use 12-14 AWG wire minimum
   • Double-check polarity before connection
   • Short circuit risk = FIRE HAZARD
```

#### 25.2V Battery (Electronics Power)

```
MODEL: ELITOP-702US-HY
┌──────────────────────────────────────┐
│  SPECIFICATIONS                      │
├──────────────────────────────────────┤
│  Chemistry:      Lithium-Ion 18650   │
│  Configuration:  7S2P                │
│  Nominal:        25.2V DC            │
│  Full Charge:    29.4V DC            │
│  Cutoff:         21V DC              │
│  Capacity:       4000mAh (4Ah)       │
│  Power:          100.8Wh             │
│  Weight:         ~740g               │
│  Dimensions:     97×70×60mm          │
│                                      │
│  BMS Protection:                     │
│  ✓ Over-charge (>29.4V)             │
│  ✓ Over-discharge (<21V)            │
│  ✓ Over-current                     │
│  ✓ Short-circuit                    │
│  ✓ Over-temperature                 │
│                                      │
│  Current Ratings:                    │
│  • Continuous: 10A                   │
│  • Peak: 15A (short bursts)         │
│  • Charging: <3A                     │
└──────────────────────────────────────┘

Connector: XT60 or compatible
Polarity: RED = Positive, BLACK = Negative

⚠️  WARNING: Li-ion fire hazard!
   • NEVER reverse polarity
   • Install 15A fuse for protection
   • Use 16-18 AWG wire
   • Monitor voltage to prevent over-discharge
```

#### LM2596 Buck Converter (25.2V → 9V)

```
┌──────────────────────────────────────────────────────────┐
│              LM2596 DC-DC BUCK CONVERTER                 │
├──────────────────────────────────────────────────────────┤
│  IC: Texas Instruments LM2596 (or ON Semi equivalent)    │
│                                                           │
│  INPUT SPECIFICATIONS:                                    │
│  • Voltage Range: 4V - 40V DC                            │
│  • Operating Range (project): 21V - 29.4V (7S battery)   │
│  • Input Capacitor: 100µF electrolytic (recommended)     │
│                                                           │
│  OUTPUT SPECIFICATIONS:                                   │
│  • Voltage Range: 1.25V - 37V DC (adjustable)           │
│  • Set Voltage (project): 9.0V DC ± 0.1V                │
│  • Maximum Current: 3A (continuous)                      │
│  • Practical Limit: 2A for reliability                   │
│  • Output Capacitor: 220µF electrolytic (minimum)        │
│                                                           │
│  PERFORMANCE:                                             │
│  • Switching Frequency: 150 kHz                          │
│  • Efficiency: 85-92% (typical at 9V output)            │
│  • Standby Current: 80µA (ON/OFF pin LOW)               │
│  • Dropout Voltage: ~1.5V                                │
│                                                           │
│  THERMAL MANAGEMENT:                                      │
│  • Operating Temp: -40°C to +125°C (junction)           │
│  • For >1.5A continuous: HEATSINK REQUIRED               │
│  • For >2.5A continuous: HEATSINK + FAN REQUIRED         │
│                                                           │
│  MODULE PINOUT (4-pin typical):                          │
│  ┌────┬──────┬─────────────────────────────┐            │
│  │ IN+ │      │ Positive input from battery │            │
│  │ IN- │      │ Negative input (GND)        │            │
│  │OUT+ │      │ Positive output (9V)        │            │
│  │OUT- │      │ Negative output (GND)       │            │
│  └────┴──────┴─────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘

CRITICAL SETUP PROCEDURE:
1. DO NOT connect output to Arduino yet!
2. Connect input to 25.2V battery
3. Measure output voltage with multimeter
4. Adjust potentiometer until EXACTLY 9.0V
   (Clockwise = increase, counter-clockwise = decrease)
5. Verify voltage is stable
6. Disconnect battery
7. Connect output to Arduino VIN
8. Reconnect battery and verify operation

⚠️  VOLTAGE MUST BE 9.0V!
   • Too low (<7V): Arduino may malfunction
   • Too high (>12V): Arduino regulator overheats
   • Perfect range: 9.0V (optimal for Arduino efficiency)
```

---

## NodeMCU Power Connections

### Option 1: From Arduino 5V (Recommended for OmniTrek)

```
Arduino Mega 2560                NodeMCU ESP8266
┌────────────────┐              ┌──────────────────┐
│                │              │                  │
│  5V Pin ───────┼──────────────┤ VIN              │
│                │              │    │             │
│  GND Pin ──────┼──────────────┤ GND│             │
│                │              │    │             │
└────────────────┘              │    ↓             │
                                │ AMS1117          │
                                │ 5V→3.3V          │
                                │    │             │
                                │    ↓             │
                                │  3.3V (600mA)    │
                                └──────────────────┘

Current Requirements:
• NodeMCU idle: ~15mA
• NodeMCU WiFi active: 70-80mA
• NodeMCU WiFi transmit peak: 170-200mA (brief spikes)

Arduino 5V pin can supply: ~800mA
✅ SAFE: NodeMCU + sensors = <500mA typical

⚠️  Add 100-470µF capacitor between VIN and GND
   This smooths WiFi transmit current spikes!
```

### Option 2: Direct from 5V Buck Converter

```
LM2596 Buck Converter           NodeMCU ESP8266
(Set to 5.0V output)
┌────────────────┐              ┌──────────────────┐
│                │              │                  │
│  OUT+ (5V) ────┼──────────────┤ VIN              │
│                │              │                  │
│  OUT- (GND) ───┼──────────────┤ GND              │
│                │              │                  │
└────────────────┘              └──────────────────┘

Advantages:
✓ Dedicated power supply for NodeMCU
✓ More current available if needed
✓ Reduces load on Arduino regulator

Disadvantages:
✗ Requires second LM2596 module
✗ More complex wiring
✗ Additional cost

Use this if:
• Powering multiple ESP8266 modules
• Adding WiFi camera or other high-current devices
• Arduino 5V rail is already heavily loaded
```

### Option 3: USB Power (Development/Testing Only)

```
Computer USB Port               NodeMCU ESP8266
┌────────────────┐              ┌──────────────────┐
│                │  Micro USB   │                  │
│  USB Port ─────┼──────────────┤ USB Port         │
│                │              │                  │
└────────────────┘              └──────────────────┘

⚠️  DEVELOPMENT ONLY!
   • For programming and testing
   • DO NOT use for rover operation
   • Cannot power Arduino or motors
   • Limited to USB cable length
```

### Power Decoupling (CRITICAL)

```
Add capacitors near NodeMCU power pins:

VIN Pin ────┬────────── NodeMCU VIN
            │
           ═╪═ 100µF electrolytic (25V+)
            │  + Polarity matters!
            │
           ─┴─ 0.1µF ceramic (50V)
            │
GND ────────┴────────── NodeMCU GND

Purpose:
• Smooth WiFi transmit current spikes (100µF)
• Filter high-frequency noise (0.1µF)
• Prevent brownouts during WiFi activity
• Stabilize 3.3V regulator operation

Placement: As close to VIN/GND pins as possible!
```

---

## Level Shifting (5V ↔ 3.3V)

### Voltage Divider (5V → 3.3V) - Arduino TX to NodeMCU RX

```
Arduino Mega (5V)                NodeMCU ESP8266 (3.3V)
┌────────────────┐              ┌──────────────────┐
│                │              │                  │
│  TX1 (5V) ─────┼───┬─R1─┬────┤ RX (3.3V max)    │
│                │   │     │    │                  │
└────────────────┘   │    R2    └──────────────────┘
                   └─┴─GND

Resistor Calculation:
R1 = 2kΩ (2000 ohms)
R2 = 1kΩ (1000 ohms)

Output = 5V × (R2 / (R1 + R2))
       = 5V × (1000 / 3000)
       = 1.67V ❌ TOO LOW!

BETTER RATIO:
R1 = 1kΩ
R2 = 2kΩ

Output = 5V × (2000 / 3000)
       = 3.33V ✅ PERFECT!

⚠️  This is ONE-WAY ONLY (Arduino → NodeMCU)
```

### NodeMCU TX to Arduino RX (No Level Shift Needed!)

```
NodeMCU ESP8266 (3.3V)          Arduino Mega (5V)
┌────────────────┐              ┌──────────────────┐
│                │              │                  │
│  TX (3.3V) ────┼──────────────┤ RX1 (5V tolerant)│
│                │              │                  │
└────────────────┘              └──────────────────┘

✅ NO LEVEL SHIFTER NEEDED!

Why?
• 3.3V is above Arduino's logic HIGH threshold (~2.5V)
• Arduino inputs are 5V tolerant
• 3.3V signal is safely read as HIGH

⚠️  Only works NodeMCU → Arduino direction!
   Arduino → NodeMCU still needs voltage divider
```

### Bidirectional Level Shifter (Recommended)

```
Arduino Mega (5V)    Level Shifter    NodeMCU ESP8266 (3.3V)
┌────────────┐      ┌─────────────┐      ┌──────────────┐
│            │      │             │      │              │
│ 5V ────────┼──────┤ HV          │      │              │
│            │      │             │      │              │
│ TX1 (D18) ─┼──────┤ HV1 ↔ LV1 ─┼──────┤ RX           │
│ RX1 (D19) ─┼──────┤ HV2 ↔ LV2 ─┼──────┤ TX           │
│            │      │             │      │              │
│ GND ───────┼──────┤ GND     LV ─┼──────┤ 3.3V         │
│            │      │             │      │              │
└────────────┘      └─────────────┘      └──────────────┘

Recommended Module:
• SparkFun Logic Level Converter (BOB-12009)
• Adafruit 4-channel I2C-safe Bi-directional Logic Level Converter
• Any BSS138-based bidirectional shifter

Advantages:
✓ Bidirectional (works both ways)
✓ No resistor calculations needed
✓ Safe for both devices
✓ Can handle I2C, SPI, UART
✓ Supports up to 4 channels

Typical Cost: $2-5 per module
```

---

## Serial Communication Wiring

### Basic UART Connection (Arduino ↔ NodeMCU)

```
Arduino Mega                          NodeMCU ESP8266
┌────────────────┐                   ┌──────────────────┐
│                │   Voltage Divider │                  │
│  TX1 (D18) ────┼────1kΩ──┬─2kΩ────┤ RX (D9/GPIO3)    │
│                │         GND       │                  │
│  RX1 (D19) ────┼───────────────────┤ TX (D10/GPIO1)   │
│                │                   │                  │
│  GND ──────────┼───────────────────┤ GND              │
│                │                   │                  │
└────────────────┘                   └──────────────────┘

Code Example (Arduino):
void setup() {
    Serial1.begin(115200);  // TX1/RX1 to NodeMCU
}

void loop() {
    if (Serial1.available()) {
        String cmd = Serial1.readStringUntil('\n');
        processCommand(cmd);
    }

    // Send telemetry to NodeMCU
    sendTelemetry();
}

Code Example (NodeMCU):
void setup() {
    Serial.begin(115200);  // Hardware UART
}

void loop() {
    if (Serial.available()) {
        String data = Serial.readStringUntil('\n');
        processArduinoData(data);
    }

    // Send commands to Arduino
    Serial.println("{\"type\":\"motor\",\"speed\":50}");
}
```

### OmniTrek Protocol (JSON over Serial)

```
Arduino → NodeMCU (Telemetry):
┌─────────────────────────────────────────────────────────┐
│ {"type":"telemetry",                                    │
│  "motors":[                                             │
│    {"id":0,"speed":120,"current":8.5,"temp":45},       │
│    {"id":1,"speed":120,"current":8.3,"temp":44},       │
│    {"id":2,"speed":118,"current":8.7,"temp":46},       │
│    {"id":3,"speed":119,"current":8.4,"temp":45}        │
│  ],                                                     │
│  "battery":{"voltage":37.2,"current":34.5},            │
│  "timestamp":1234567890                                 │
│ }\n                                                     │
└─────────────────────────────────────────────────────────┘

NodeMCU → Arduino (Commands):
┌─────────────────────────────────────────────────────────┐
│ {"type":"motor_command",                                │
│  "motors":[100,100,100,100]                            │
│ }\n                                                     │
└─────────────────────────────────────────────────────────┘

Baud Rate: 115200 (standard for ESP8266)
Format: JSON with newline terminator
Frequency: 10-20 Hz (every 50-100ms)
```

---

## WiFi Configuration

### Access Point Mode (Recommended for OmniTrek)

```
NodeMCU creates WiFi hotspot for laptop to connect

Code Example:
#include <ESP8266WiFi.h>

const char* ssid = "OmniTrek-Rover";
const char* password = "rover2025";

void setup() {
    WiFi.softAP(ssid, password);

    IPAddress IP = WiFi.softAPIP();
    Serial.print("AP IP: ");
    Serial.println(IP);  // Usually 192.168.4.1
}

Connection from Laptop:
1. Connect to WiFi network "OmniTrek-Rover"
2. Enter password: "rover2025"
3. NodeMCU IP: 192.168.4.1
4. WebSocket: ws://192.168.4.1:81
5. Web Interface: http://192.168.4.1
```

### Station Mode (Connect to Existing Network)

```
NodeMCU connects to your home WiFi

Code Example:
#include <ESP8266WiFi.h>

const char* ssid = "YourHomeWiFi";
const char* password = "yourpassword";

void setup() {
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nConnected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
}

Advantages:
✓ Rover accessible from anywhere on network
✓ Can access internet (OTA updates, NTP time)

Disadvantages:
✗ Requires existing WiFi network
✗ Range limited by router
✗ May not work outdoors
```

### Station + AP Mode (Hybrid)

```
NodeMCU creates AP AND connects to WiFi

Code Example:
void setup() {
    // Create access point
    WiFi.softAP("OmniTrek-Rover", "rover2025");

    // Also connect to home network
    WiFi.begin("YourHomeWiFi", "yourpassword");
}

Use Case:
• Development: Connect via home WiFi
• Operation: Use rover's own AP when outdoors
• Best of both worlds
```

---

## I2C Sensor Wiring (NodeMCU as Master)

### Basic I2C Connection

```
NodeMCU ESP8266              I2C Sensor (e.g., BMP280)
┌────────────────┐          ┌──────────────┐
│                │          │              │
│  D1 (GPIO5) ───┼──────────┤ SCL          │
│  SCL           │          │              │
│                │          │              │
│  D2 (GPIO4) ───┼──────────┤ SDA          │
│  SDA           │          │              │
│                │          │              │
│  3V3 ──────────┼──────────┤ VCC (3.3V)   │
│                │          │              │
│  GND ──────────┼──────────┤ GND          │
│                │          │              │
└────────────────┘          └──────────────┘

Pull-up Resistors:
┌────────────┐
│ 3.3V       │
│   ├─4.7kΩ─┴──→ SCL
│   └─4.7kΩ─┴──→ SDA
│            │
└────────────┘

Code Example:
#include <Wire.h>

void setup() {
    Wire.begin(D2, D1);  // SDA, SCL
    // Or use defaults: Wire.begin();
}

void scanI2C() {
    for (byte addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            Serial.print("Found device at 0x");
            Serial.println(addr, HEX);
        }
    }
}
```

---

## GPIO Usage Examples

### Digital Output (LED Control)

```
NodeMCU ESP8266              LED Circuit
┌────────────────┐          ┌──────────────┐
│                │          │              │
│  D4 (GPIO2) ───┼──220Ω────┤ LED (+)      │
│  Built-in LED  │          │   │          │
│                │          │ LED (-)      │
│  GND ──────────┼──────────┤              │
└────────────────┘          └──────────────┘

Code Example:
const int LED_PIN = D4;  // GPIO2, built-in LED

void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_PIN, LOW);   // LED ON (inverted)
    delay(1000);
    digitalWrite(LED_PIN, HIGH);  // LED OFF
    delay(1000);
}

⚠️  Built-in LED is INVERTED!
   LOW = ON, HIGH = OFF
```

### Digital Input (Button)

```
NodeMCU ESP8266              Button Circuit
┌────────────────┐          ┌──────────────┐
│                │          │              │
│  D5 (GPIO14) ──┼──────────┤ Button       │
│                │          │   │          │
│                │         GND ─┘          │
│                │                         │
└────────────────┘                         │
       │                                   │
       └─10kΩ (pull-up to 3.3V)           │

Code Example:
const int BUTTON_PIN = D5;

void setup() {
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
    if (digitalRead(BUTTON_PIN) == LOW) {
        Serial.println("Button pressed!");
        delay(50);  // Debounce
    }
}
```

### Analog Input (Battery Monitor)

```
NodeMCU ESP8266              Voltage Divider
┌────────────────┐          ┌──────────────┐
│                │          │              │
│  A0 (ADC0) ────┼────┬─────┤ Battery +    │
│                │    │     │              │
│                │   R2     │              │
│  GND ──────────┼────┴─────┤ Battery -    │
└────────────────┘          └──────────────┘

⚠️  A0 accepts 0-1V ONLY!

For 25.2V battery monitoring:
R1 = 100kΩ (top resistor)
R2 = 3.9kΩ (bottom resistor)

Voltage at A0 = Battery_V × (R2 / (R1 + R2))
              = 25.2V × (3900 / 103900)
              = 0.95V ✅ Safe!

Code Example:
float readBatteryVoltage() {
    int raw = analogRead(A0);  // 0-1023
    float voltage = (raw / 1023.0) * 1.0;  // 0-1V
    float batteryV = voltage * (103.9 / 3.9);
    return batteryV;
}

void loop() {
    float vBatt = readBatteryVoltage();
    Serial.print("Battery: ");
    Serial.print(vBatt);
    Serial.println("V");
    delay(1000);
}
```

---

## Deep Sleep Configuration

### Deep Sleep Wiring

```
NodeMCU ESP8266
┌────────────────┐
│                │
│  D0 (GPIO16) ──┼─┐
│                │ │  Wire connection
│  RST ──────────┼─┘  required for wake!
│                │
└────────────────┘

⚠️  MUST connect D0 to RST for deep sleep wake!

Code Example:
void setup() {
    Serial.begin(115200);
    Serial.println("Going to sleep for 10 seconds");

    ESP.deepSleep(10e6);  // 10 seconds in microseconds
    // Device will reset after waking
}

void loop() {
    // Never reached - device resets on wake
}

Sleep Duration:
ESP.deepSleep(10e6);        // 10 seconds
ESP.deepSleep(60e6);        // 1 minute
ESP.deepSleep(3600e6);      // 1 hour
ESP.deepSleep(0);           // Sleep forever (manual wake only)

Current Draw:
• Active WiFi: 70-80mA
• Deep Sleep: 20µA (chip alone)
• Deep Sleep: 8-20mA (full board with regulator)
```

---

## Common Wiring Mistakes

| ❌ MISTAKE                              | ✅ CORRECT                           | WHY IT MATTERS                                  |
| --------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| Connecting 5V to GPIO pins              | Use level shifter or voltage divider | **Will DESTROY ESP8266!** All GPIO are 3.3V max |
| TX to TX, RX to RX                      | TX to RX, RX to TX (crossed)         | Serial won't work without crossover             |
| No common ground                        | Always connect GND together          | No voltage reference = no communication         |
| Forgetting level shifter for Arduino    | Use voltage divider or level shifter | 5V Arduino signals will damage ESP8266          |
| Using A0 with >1V                       | Voltage divider to scale down        | **Will damage ADC!** Max input is 1.0V          |
| Pulling GPIO0/GPIO2 LOW at boot         | Add pull-up resistors                | Boot will FAIL!                                 |
| Pulling GPIO15 HIGH at boot             | Add pull-down resistor               | Boot will FAIL!                                 |
| No decoupling capacitor                 | Add 100µF near VIN pin               | WiFi brownouts and resets                       |
| Using GPIO6-GPIO11                      | Avoid these pins entirely            | **Reserved for flash memory!**                  |
| Not connecting D0 to RST for deep sleep | Wire D0 to RST                       | Can't wake from deep sleep                      |
| Powering motors from 3.3V pin           | Use separate power supply            | 3.3V pin limited to 600mA max                   |

---

## Troubleshooting Guide

### Problem: NodeMCU won't boot / constantly resets

**Symptoms:** Rapid boot loop, garbled serial output, won't run code

**Checks:**

```
1. Boot mode pins:
   • GPIO0 (D3): Should be HIGH at boot
   • GPIO2 (D4): Should be HIGH at boot
   • GPIO15 (D8): Should be LOW at boot

2. Check with multimeter:
   • Power on NodeMCU
   • Measure voltage at each pin during boot
   • Add pull-up/pull-down resistors if needed

3. Serial monitor at 74880 baud:
   • ESP8266 boot messages appear at 74880 baud
   • Look for error messages
   • Check for "boot mode:(3,7)" = normal boot
```

### Problem: WiFi not working / won't connect

**Symptoms:** WiFi.begin() fails, can't create AP, weak signal

**Checks:**

```
1. Check power supply:
   • WiFi needs stable voltage
   • Add 100-470µF capacitor near VIN
   • Use 500mA+ power supply

2. Check antenna:
   • PCB trace antenna on board
   • Keep away from metal objects
   • Don't cover with hand during testing

3. Check code:
   WiFi.begin(ssid, password);
   while (WiFi.status() != WL_CONNECTED) {
       delay(500);
       Serial.print(".");
   }

4. WiFi channel:
   • ESP8266 supports channels 1-13
   • Some routers use channel 14 (not supported!)
   • Try changing router to channel 1-11
```

### Problem: Serial communication not working

**Symptoms:** No data received, garbled characters

**Checks:**

```
1. Verify wiring:
   Arduino TX1 → (voltage divider) → NodeMCU RX
   Arduino RX1 ← NodeMCU TX (direct)
   GND connected

2. Check baud rate:
   Both devices MUST use same baud:
   Arduino: Serial1.begin(115200);
   NodeMCU: Serial.begin(115200);

3. Test with loopback:
   • Connect NodeMCU TX to RX
   • Send data, should receive same data back

4. Check voltage divider:
   • Measure voltage at NodeMCU RX pin
   • Should be ~3.3V when Arduino TX is HIGH
   • Should be ~0V when Arduino TX is LOW
```

### Problem: GPIO pins not responding

**Symptoms:** digitalWrite/digitalRead doesn't work

**Checks:**

```
1. Reserved pins:
   • GPIO6-GPIO11 are RESERVED - don't use!
   • GPIO16 (D0) doesn't support interrupts/PWM/I2C

2. Boot strapping pins:
   • GPIO0, GPIO2, GPIO15 affect boot
   • May need pull-up/pull-down resistors

3. Check pin mapping:
   • D1 = GPIO5 (not GPIO1!)
   • Use correct mapping table above

4. Test with simple code:
   pinMode(D5, OUTPUT);
   digitalWrite(D5, HIGH);
   delay(1000);
   digitalWrite(D5, LOW);
```

### Problem: Random resets / brownouts

**Symptoms:** NodeMCU resets during WiFi activity, unstable operation

**Solution:**

```
1. Add bulk capacitor:
   • 470µF electrolytic between VIN and GND
   • As close to NodeMCU as possible
   • Positive lead to VIN, negative to GND

2. Check power supply current:
   • Minimum 500mA required
   • 1A recommended for stability
   • Arduino 5V pin can supply ~800mA total

3. Reduce WiFi power:
   WiFi.setOutputPower(15);  // Reduce from 20.5dBm default

4. Add delays in code:
   • Don't flood WiFi with data
   • Add delay(1) in tight loops
   • Use yield() in long operations
```

---

## Safety Checklist

Before powering NodeMCU:

```
□ Verify all GPIO voltages ≤ 3.3V
  • Use multimeter to check signal levels
  • Add level shifters for 5V devices
  • Double-check voltage divider ratios

□ Check A0 input voltage ≤ 1.0V
  • Measure with multimeter
  • Verify voltage divider calculation
  • Test without NodeMCU connected first

□ Confirm boot mode pins
  • GPIO0 (D3): HIGH or floating (10kΩ pull-up)
  • GPIO2 (D4): HIGH or floating (10kΩ pull-up)
  • GPIO15 (D8): LOW (10kΩ pull-down)

□ Verify power supply
  • Input voltage: 4.5-10V (5V recommended)
  • Current capacity: >500mA
  • Stable under load (no voltage sag)

□ Add decoupling capacitors
  • 100µF electrolytic near VIN/GND
  • 0.1µF ceramic near 3.3V/GND
  • Correct polarity on electrolytics

□ Check common ground
  • All GND pins connected
  • No floating grounds
  • Multimeter continuity test

□ Inspect for shorts
  • Visual inspection of all connections
  • Multimeter resistance check
  • No bridges between adjacent pins

□ Battery monitoring (if applicable)
  • Voltage divider properly calculated
  • Test with multimeter before connecting
  • A0 input stays below 1.0V at max battery voltage

□ First power-on procedure
  1. Power NodeMCU alone (USB or external 5V)
  2. Check 3.3V output (should be 3.2-3.4V)
  3. Upload simple blink sketch
  4. Verify WiFi works
  5. Add peripheral connections one-by-one
  6. Test each addition before proceeding
```

---

## Appendix: ESP8266 Deep Dive

### ESP8266EX Chip Specifications

- **CPU:** Tensilica L106 32-bit RISC @ 80/160 MHz
- **Architecture:** Harvard architecture with separate instruction and data buses
- **Instruction Cache:** 32 KB
- **Data RAM:** 96 KB
- **Instruction RAM:** 64 KB
- **Flash:** 4MB external SPI flash (on NodeMCU)
- **Operating Voltage:** 2.5V - 3.6V (3.3V nominal)
- **Operating Current:** 80mA average, 170mA peak (WiFi TX)
- **Operating Temperature:** -40°C to +125°C

### WiFi Specifications

- **Standard:** IEEE 802.11 b/g/n
- **Frequency:** 2.4 GHz only (channels 1-13)
- **Modes:** Station, SoftAP, Station+SoftAP
- **Security:** WPA/WPA2/WPA3
- **Max Power:** +19.5 dBm (802.11b), +16 dBm (802.11n)
- **Antenna:** PCB trace antenna, ~2 dBi gain
- **Range:** ~100m open air, ~30m through walls

### Power Consumption Details

| Mode                      | Current   | Notes                           |
| ------------------------- | --------- | ------------------------------- |
| **Active (no WiFi)**      | ~15mA     | CPU running, no WiFi            |
| **WiFi connected (idle)** | 15-20mA   | Associated but not transmitting |
| **WiFi active**           | 70-80mA   | Active communication            |
| **WiFi TX peak**          | 170-200mA | Brief spikes during transmit    |
| **Modem sleep**           | ~15mA     | CPU on, WiFi off periodically   |
| **Light sleep**           | 0.5-1mA   | CPU suspended, WiFi off         |
| **Deep sleep**            | 20µA      | Everything off except RTC       |
| **Deep sleep (NodeMCU)**  | 8-20mA    | Board components add overhead   |

---

## Additional Resources

- **ESP8266 Arduino Core:** https://github.com/esp8266/Arduino
- **ESP8266 Datasheet:**
  https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf
- **NodeMCU Documentation:** https://nodemcu.readthedocs.io/
- **ESP8266 Community Forum:** https://www.esp8266.com/
- **OmniTrek Nexus Project:** See `HARDWARE_SPECIFICATIONS.md` for complete system details

---

**Document Version:** 1.0.0 **Last Updated:** 2025-11-05 **Applies to:** NodeMCU Amica V2 (ESP-12E
module)
