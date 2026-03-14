---
# LLM Optimization Metadata
metadata:
  document_id: hardware-wiring-arduino-mega-wiring
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 28 minutes
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
  - 'Wiring Guide: Electrical connection instructions'
summary:
  '**Comprehensive pinout diagrams, connection guides, and quick reference for Arduino Mega 2560**
  ---'
depends_on:
  - README.md
---

# Arduino Mega 2560 - Complete Wiring Reference

**Comprehensive pinout diagrams, connection guides, and quick reference for Arduino Mega 2560**

---

## Quick Reference Card (Printable)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃              ARDUINO MEGA 2560 - QUICK REFERENCE CARD                  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  POWER:                                                                ┃
┃  • Operating Voltage: 5V                                               ┃
┃  • Input Voltage (recommended): 7-12V                                  ┃
┃  • Input Voltage (limit): 6-20V                                        ┃
┃  • DC Current per I/O: 20 mA (40 mA max)                              ┃
┃  • DC Current for 3.3V: 50 mA                                         ┃
┃                                                                        ┃
┃  DIGITAL I/O:                                                          ┃
┃  • Total Pins: 54 (pins 0-53)                                         ┃
┃  • PWM Pins: 15 (pins 2-13, 44-46)                                    ┃
┃  • External Interrupts: 6 (pins 2, 3, 18, 19, 20, 21)                ┃
┃                                                                        ┃
┃  ANALOG INPUT:                                                         ┃
┃  • Analog Pins: 16 (A0-A15)                                           ┃
┃  • Resolution: 10-bit (0-1023)                                        ┃
┃  • Reference Voltage: 5V (can use AREF)                               ┃
┃                                                                        ┃
┃  SERIAL PORTS (UART):                                                  ┃
┃  • Serial (USB): TX0 (pin 1), RX0 (pin 0)                            ┃
┃  • Serial1: TX1 (pin 18), RX1 (pin 19)                               ┃
┃  • Serial2: TX2 (pin 16), RX2 (pin 17)                               ┃
┃  • Serial3: TX3 (pin 14), RX3 (pin 15)                               ┃
┃  • Baud Rates: 300 - 2000000                                          ┃
┃                                                                        ┃
┃  COMMUNICATION:                                                        ┃
┃  • I2C (TWI): SDA (pin 20), SCL (pin 21)                             ┃
┃  • SPI: MOSI (pin 51), MISO (pin 50), SCK (pin 52), SS (pin 53)     ┃
┃                                                                        ┃
┃  MICROCONTROLLER: ATmega2560                                          ┃
┃  • Clock Speed: 16 MHz                                                ┃
┃  • Flash Memory: 256 KB (8 KB bootloader)                             ┃
┃  • SRAM: 8 KB                                                         ┃
┃  • EEPROM: 4 KB                                                       ┃
┃                                                                        ┃
┃  CRITICAL WARNINGS:                                                    ┃
┃  ⚠️  DO NOT exceed 5V on any digital pin                              ┃
┃  ⚠️  DO NOT exceed 20 mA per I/O pin                                  ┃
┃  ⚠️  DO NOT reverse polarity on power connector                       ┃
┃  ⚠️  USE voltage divider for 5V → 3.3V level shifting               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Complete Pinout Diagram

### Digital Pins (0-53)

```
             TOP VIEW - Arduino Mega 2560

    ┌─────────────────────────────────────────────────┐
    │                                                 │
    │  ┌─────────────────────────────────────────┐   │
    │  │          ATmega16U2 (USB)               │   │
    │  └─────────────────────────────────────────┘   │
    │                                                 │
    │          ┌──────────────────────┐              │
    │          │    ATmega2560        │              │
    │          │   (Main Controller)   │              │
    │          └──────────────────────┘              │
    │                                                 │
    │  DIGITAL PINS (0-53):                          │
    │                                                 │
    │  LEFT SIDE (Power & Special):                  │
    │  ┌────────────────────────┐                    │
    │  │ RESET  ────────────────┤ Reset Button       │
    │  │ 3.3V   ────────────────┤ +3.3V (50mA max)  │
    │  │ 5V     ────────────────┤ +5V Output         │
    │  │ GND    ────────────────┤ Ground             │
    │  │ GND    ────────────────┤ Ground             │
    │  │ Vin    ────────────────┤ Power Input 7-12V  │
    │  │                        │                     │
    │  │ A0     ────────────────┤ Analog In 0        │
    │  │ A1     ────────────────┤ Analog In 1        │
    │  │ A2     ────────────────┤ Analog In 2        │
    │  │ A3     ────────────────┤ Analog In 3        │
    │  │ A4     ────────────────┤ Analog In 4        │
    │  │ A5     ────────────────┤ Analog In 5        │
    │  │ A6     ────────────────┤ Analog In 6        │
    │  │ A7     ────────────────┤ Analog In 7        │
    │  │ A8     ────────────────┤ Analog In 8        │
    │  │ A9     ────────────────┤ Analog In 9        │
    │  │ A10    ────────────────┤ Analog In 10       │
    │  │ A11    ────────────────┤ Analog In 11       │
    │  │ A12    ────────────────┤ Analog In 12       │
    │  │ A13    ────────────────┤ Analog In 13       │
    │  │ A14    ────────────────┤ Analog In 14       │
    │  │ A15    ────────────────┤ Analog In 15       │
    │  └────────────────────────┘                    │
    │                                                 │
    │  RIGHT SIDE (Digital I/O):                     │
    │  ┌────────────────────────┐                    │
    │  │ AREF   ────────────────┤ Analog Reference   │
    │  │ GND    ────────────────┤ Ground             │
    │  │ D13    ────────────────┤ Digital 13 (PWM+LED)│
    │  │ D12    ────────────────┤ Digital 12 (PWM)   │
    │  │ D11    ────────────────┤ Digital 11 (PWM)   │
    │  │ D10    ────────────────┤ Digital 10 (PWM)   │
    │  │ D9     ────────────────┤ Digital 9  (PWM)   │
    │  │ D8     ────────────────┤ Digital 8  (PWM)   │
    │  │                        │                     │
    │  │ D7     ────────────────┤ Digital 7  (PWM)   │
    │  │ D6     ────────────────┤ Digital 6  (PWM)   │
    │  │ D5     ────────────────┤ Digital 5  (PWM)   │
    │  │ D4     ────────────────┤ Digital 4  (PWM)   │
    │  │ D3     ────────────────┤ Digital 3  (PWM+INT1)│
    │  │ D2     ────────────────┤ Digital 2  (PWM+INT0)│
    │  │ D1/TX0 ────────────────┤ Serial TX (to USB) │
    │  │ D0/RX0 ────────────────┤ Serial RX (to USB) │
    │  └────────────────────────┘                    │
    │                                                 │
    │  BACK ROW (Digital 22-53):                     │
    │  ┌────────────────────────────────────────┐   │
    │  │ D22-D53 (Additional Digital I/O)       │   │
    │  │ Includes: Serial1, Serial2, Serial3     │   │
    │  │          SPI, I2C, PWM pins            │   │
    │  └────────────────────────────────────────┘   │
    │                                                 │
    └─────────────────────────────────────────────────┘
```

### Detailed Back Row Pinout (22-53)

```
BACK ROW - LEFT TO RIGHT:

Row 1 (Digital 22-37):
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│22 │23 │24 │25 │26 │27 │28 │29 │30 │31 │32 │33 │34 │35 │36 │37 │
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

Row 2 (Digital 38-53 + Power):
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│38 │39 │40 │41 │42 │43 │44 │45 │46 │47 │48 │49 │50 │51 │52 │53 │GND│5V │
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
     PWM PWM PWM                     MISO MOSI SCK SS

Special Functions (Back Row):
• D14 (TX3) / D15 (RX3) - Serial3
• D16 (TX2) / D17 (RX2) - Serial2
• D18 (TX1) / D19 (RX1) - Serial1
• D20 (SDA)  / D21 (SCL) - I2C
• D44-D46 - PWM capable
• D50-D53 - SPI (MISO, MOSI, SCK, SS)
```

---

## Power System Integration (OmniTrek Nexus)

### Complete Power Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│              OmniTrek ROVER POWER DISTRIBUTION SYSTEM                │
└──────────────────────────────────────────────────────────────────────┘

36V Battery (Motor Power)        25.2V Battery (Electronics Power)
HY-SSY-1002ULS                   ELITOP-702US-HY
┌────────────────┐               ┌────────────────┐
│ Type: 10S2P    │               │ Type: 7S2P     │
│ Nominal: 36V   │               │ Nominal: 25.2V │
│ Full: 42V      │               │ Full: 29.4V    │
│ Cutoff: 28-30V │               │ Cutoff: 21V    │
│ Capacity: 4.4Ah│               │ Capacity: 4Ah  │
│ Peak: 30A      │               │ Peak: 15A      │
└───┬────────────┘               └───┬────────────┘
    │                                │
    │ High Current                   │
    │ (Motor Controllers)            │
    │                                ↓
    │                         ┌──────────────────┐
    │                         │ LM2596 Buck      │
    │                         │ Converter        │
    │                         │ IN: 25.2V        │
    │                         │ OUT: 9.0V        │
    │                         │ Max: 3A          │
    │                         └────────┬─────────┘
    │                                  │
    │                                  │ 9V Regulated
    │                                  ↓
    │                         ┌──────────────────────┐
    │                         │  ARDUINO MEGA 2560   │
    │                         │  VIN: 9V             │
    │                         │  Onboard Regulator:  │
    │                         │    • 5V @ 800mA      │
    │                         │    • 3.3V @ 50mA     │
    │                         └──────┬───────────────┘
    │                                │
    │                          ┌─────┼────────┐
    │                          │     │        │
    │                    ┌─────▼──┐  │  ┌─────▼────┐
    │                    │NodeMCU │  │  │ Sensors  │
    │                    │ESP8266 │  │  │ & Peri-  │
    │                    │(5V→3.3V│  │  │ pherals  │
    │                    └────────┘  │  └──────────┘
    │                                │
    ↓                                │
┌──────────────────────┐            │
│ Motor Controllers    │            │
│ (2× ZS-X11H)        │            │
│ • VCC: 36V          │            │
│ • Control: 5V ◄─────┼────────────┘
│ • 4 motors total    │  (PWM + Direction signals)
└─────────────────────┘

⚠️  CRITICAL: All GND points MUST be connected together!
```

### Battery Specifications

#### 36V Battery (High Current / Motor Power)

```
┌──────────────────────────────────────────────────────────┐
│  MODEL: HY-SSY-1002ULS (Hoverboard Battery)             │
├──────────────────────────────────────────────────────────┤
│  Chemistry:        Lithium-Ion 18650                     │
│  Configuration:    10S2P (10 series, 2 parallel)        │
│  Nominal Voltage:  36V DC                                │
│  Full Charge:      42V DC                                │
│  Cutoff Voltage:   28-30V DC                             │
│  Capacity:         4400mAh (4.4Ah)                       │
│  Energy:           158Wh                                 │
│  Weight:           ~970g                                 │
│  Dimensions:       135×95×60mm                           │
│                                                           │
│  Current Ratings:                                         │
│  • Continuous:     20A                                   │
│  • Peak:           30A (short bursts <10 seconds)       │
│  • Charging:       <5A (use 42V charger)                │
│                                                           │
│  BMS Protection (Built-in):                              │
│  ✓ Over-charge (>42V)                                   │
│  ✓ Over-discharge (<28V)                                │
│  ✓ Over-current (>30A)                                  │
│  ✓ Short-circuit                                        │
│  ✓ Over-temperature                                     │
│                                                           │
│  Connector: XT60 or similar high-current connector       │
│  Polarity: RED = Positive (+), BLACK = Negative (-)     │
└──────────────────────────────────────────────────────────┘

⚠️  LITHIUM-ION FIRE HAZARD!
   • ALWAYS install 30A fuse at positive terminal
   • Use minimum 12-14 AWG wire (high current!)
   • NEVER reverse polarity - instant destruction
   • NEVER short circuit - fire/explosion risk
   • NEVER puncture or crush battery pack
   • Use ONLY 42V Li-ion charger (10S specific)
   • Monitor voltage to prevent over-discharge
   • Keep away from flammable materials
```

#### 25.2V Battery (Low Current / Electronics Power)

```
┌──────────────────────────────────────────────────────────┐
│  MODEL: ELITOP-702US-HY (Hoverboard Battery)            │
├──────────────────────────────────────────────────────────┤
│  Chemistry:        Lithium-Ion 18650                     │
│  Configuration:    7S2P (7 series, 2 parallel)          │
│  Nominal Voltage:  25.2V DC                              │
│  Full Charge:      29.4V DC                              │
│  Cutoff Voltage:   21V DC                                │
│  Capacity:         4000mAh (4.0Ah)                       │
│  Energy:           100.8Wh                               │
│  Weight:           ~740g                                 │
│  Dimensions:       97×70×60mm                            │
│                                                           │
│  Current Ratings:                                         │
│  • Continuous:     10A                                   │
│  • Peak:           15A (short bursts <10 seconds)       │
│  • Charging:       <3A (use 29.4V charger)              │
│                                                           │
│  BMS Protection (Built-in):                              │
│  ✓ Over-charge (>29.4V)                                 │
│  ✓ Over-discharge (<21V)                                │
│  ✓ Over-current                                         │
│  ✓ Short-circuit                                        │
│  ✓ Over-temperature                                     │
│                                                           │
│  Connector: XT60 or compatible                           │
│  Polarity: RED = Positive (+), BLACK = Negative (-)     │
└──────────────────────────────────────────────────────────┘

⚠️  LITHIUM-ION SAFETY WARNINGS!
   • Install 15A fuse at positive terminal
   • Use minimum 16-18 AWG wire
   • NEVER reverse polarity
   • Use ONLY 29.4V Li-ion charger (7S specific)
   • Never charge below 0°C or above 45°C
   • Store at 3.7V per cell (~25V) for long-term
```

### LM2596 Buck Converter Setup

```
┌──────────────────────────────────────────────────────────────────┐
│           LM2596 DC-DC BUCK CONVERTER (25.2V → 9V)               │
├──────────────────────────────────────────────────────────────────┤
│  Input Voltage:    4V - 40V DC (actual: 21V - 29.4V)            │
│  Output Voltage:   1.25V - 37V DC (set to 9.0V for Arduino)    │
│  Max Current:      3A continuous (2A recommended)                │
│  Efficiency:       85-92% @ 9V output from 25.2V input          │
│  Switching Freq:   150 kHz                                       │
│  Dropout Voltage:  ~1.5V                                         │
│  Standby Current:  80µA (shutdown mode)                          │
│                                                                  │
│  Module Pinout (typical 4-pin):                                  │
│  ┌─────┬────────────────────────────────────────────┐          │
│  │ IN+ │ Connect to 25.2V battery positive          │          │
│  │ IN- │ Connect to 25.2V battery negative (GND)    │          │
│  │OUT+ │ Connect to Arduino VIN pin                 │          │
│  │OUT- │ Connect to Arduino GND pin                 │          │
│  └─────┴────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘

CRITICAL CALIBRATION PROCEDURE:
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️  FAILURE TO CALIBRATE = DESTROYED ARDUINO!                   │
│                                                                  │
│  STEP 1: DO NOT connect output to Arduino yet!                  │
│  STEP 2: Connect INPUT to 25.2V battery                         │
│  STEP 3: Measure OUTPUT voltage with multimeter                 │
│  STEP 4: Adjust blue potentiometer:                             │
│          • Clockwise = INCREASE voltage                         │
│          • Counter-clockwise = DECREASE voltage                 │
│          • Target: EXACTLY 9.0V ± 0.1V                          │
│  STEP 5: Verify voltage is stable for 30 seconds                │
│  STEP 6: Disconnect battery input                               │
│  STEP 7: Connect output to Arduino VIN                          │
│  STEP 8: Connect GND between converter and Arduino              │
│  STEP 9: Reconnect battery and verify operation                 │
│                                                                  │
│  WHY 9.0V?                                                       │
│  • Too low (<7V): Arduino malfunction, unstable 5V rail         │
│  • Just right (9V): Optimal efficiency, minimal heat            │
│  • Too high (>12V): Arduino regulator overheats/fails           │
└──────────────────────────────────────────────────────────────────┘
```

### Wiring Diagram: LM2596 to Arduino

```
25.2V Battery          LM2596 Converter         Arduino Mega 2560
┌─────────────┐       ┌──────────────┐        ┌─────────────────┐
│  [Fuse 15A] │       │              │        │                 │
│      │      │       │    ┌──┐      │        │                 │
│  (+) ┴──────┼───────┤IN+ │  │      │        │                 │
│      RED    │       │    │LM│      │        │                 │
│             │       │    │25│      │        │                 │
│  (-) ───────┼───────┤IN- │96│ OUT+ │────────┤ VIN (7-12V)     │
│      BLACK  │       │    │  │      │        │                 │
└─────────────┘       │    │  │ OUT- │────┬───┤ GND             │
                      │    └──┘      │    │   │                 │
                      │    [POT]     │    │   │  Onboard 5V reg │
                      │   Adjust to  │    │   │  ↓              │
                      │   9.0V here! │    │   │  5V Pin ────────┤→ NodeMCU
                      └──────────────┘    │   │  3.3V Pin ──────┤→ Sensors
                                          │   │  GND ───────────┤→ All GND
                                          │   └─────────────────┘
                                          │
                            ┌─────────────┴──────────────┐
                            │  Common Ground Point       │
                            │  (CRITICAL CONNECTION!)    │
                            └────────────────────────────┘
```

### Power Budget Calculation

```
┌──────────────────────────────────────────────────────────┐
│                 POWER CONSUMPTION ANALYSIS               │
├──────────────────────────────────────────────────────────┤
│  25.2V Battery → LM2596 → Arduino (9V input):           │
│                                                           │
│  ARDUINO MEGA 2560:                                      │
│  • Board idle: ~45mA @ 16MHz                            │
│  • Board active: ~80mA (typical)                         │
│  • USB chips: ~15mA                                      │
│  ────────────────────────────────                        │
│  Arduino subtotal: ~100mA @ 9V = 0.9W                   │
│                                                           │
│  POWERED FROM ARDUINO 5V PIN:                            │
│  • NodeMCU ESP8266: 70-80mA @ 5V = 0.4W                 │
│  • I2C Sensors (typical): 10-20mA = 0.1W                │
│  • Status LEDs (3×): 60mA = 0.3W                        │
│  ────────────────────────────────                        │
│  5V peripherals subtotal: ~150mA @ 5V = 0.75W           │
│                                                           │
│  TOTAL 25.2V BATTERY DRAW:                               │
│  Input power: (0.9W + 0.75W) / 0.88 efficiency = 1.88W  │
│  Current from 25.2V battery: 1.88W / 25.2V = 75mA       │
│                                                           │
│  Runtime estimate:                                        │
│  4000mAh / 75mA = 53 hours (electronics only!)          │
│  ────────────────────────────────                        │
│                                                           │
│  36V BATTERY → MOTOR CONTROLLERS:                        │
│  • 4 motors @ 50% speed: ~15A total                     │
│  • Motor runtime: 4400mAh / 15A = ~17 minutes            │
│  ────────────────────────────────                        │
│                                                           │
│  ⚠️  Motor battery is the limiting factor!               │
│     Electronics battery can last days.                   │
│     Motor battery: ~15-20 minutes continuous drive       │
└──────────────────────────────────────────────────────────┘
```

## Power Supply Wiring

### Option 1: LM2596 Buck Converter (Recommended for OmniTrek)

See complete wiring diagram in "Power System Integration" section above.

**Advantages:**

```
✅ Efficient (85-92% efficiency vs 30-50% for linear regulators)
✅ Low heat generation
✅ Wide input voltage range (handles battery voltage variation)
✅ High current capability (3A max)
✅ Stable output voltage regardless of input
✅ Battery-powered operation
```

**Disadvantages:**

```
✗ Requires calibration before use
✗ Switching noise (use capacitors for filtering)
✗ Additional component to mount
```

### Option 2: Barrel Jack (Development/Testing)

```
Wall Adapter (7-12V)
      │
      │ 2.1mm Barrel Jack
      │ (Center Positive)
      ↓
┌─────────────────┐
│  Arduino Mega   │
│  Barrel Jack    │──→ Built-in voltage regulator
│                 │    Outputs 5V and 3.3V
└─────────────────┘
      │
      ├──→ 5V Pin (powers shields/sensors)
      └──→ 3.3V Pin (50mA max!)
```

**Specifications:**

- Input: 7-12V DC (9V recommended)
- Polarity: Center Positive ⊕
- Current: 500mA minimum, 1A+ recommended
- Jack: 2.1mm x 5.5mm barrel connector

**Common Power Adapters:**

```
✅ RECOMMENDED:
   9V 1A Wall Adapter (Center Positive)

✅ ACCEPTABLE:
   7.5V to 12V, 500mA+ (Center Positive)

❌ DO NOT USE:
   • Center Negative adapters
   • Below 7V or above 12V
   • Below 500mA current rating
```

### Option 2: Vin Pin

```
External Power Source
(7-12V Battery)
      │
      ├──(+)──→ Arduino Vin Pin
      │
      └──(-)──→ Arduino GND Pin

Example Battery Connections:
┌────────────────┐
│  9V Battery    │
│  or            │──(+)──→ Vin
│  2S LiPo       │
│  (7.4V)        │──(-)──→ GND
└────────────────┘
```

### Option 3: USB Power (Development Only)

```
Computer USB Port
      │
      │ USB-B Cable
      ↓
┌─────────────────┐
│  Arduino Mega   │
│  USB Port       │──→ Provides 5V
│                 │    Limited to ~500mA
└─────────────────┘

⚠️  WARNING: USB power is insufficient for:
   • Motors
   • High-power servos
   • Multiple sensors
   • External devices drawing >100mA
```

### Power Distribution Diagram

```
                    Arduino Mega 2560
                    ┌─────────────────┐
External Power      │                 │
(7-12V) ──→ Vin ────┤ Voltage         │
                    │ Regulator       │
            GND ────┤                 │
                    │   ↓         ↓   │
                    │  5V        3.3V │
                    └───┬─────────┬───┘
                        │         │
          ┌─────────────┼─────────┼─────────────┐
          │             │         │             │
        Shields     Digital I/O  3.3V       Sensors
        (5V)        Logic (5V)   Devices    (5V/3.3V)
                                 (50mA max)
```

---

## Serial Port Wiring (All 4 UARTs)

### Serial (USB) - Serial0

```
Arduino Mega              Computer
┌────────────┐          ┌──────────┐
│            │   USB-B  │          │
│  USB Port  │◄─────────┤  USB     │
│            │          │  Port    │
└────────────┘          └──────────┘

Pin Connections (if using TX/RX directly):
Arduino         USB-Serial Adapter
D0 (RX0) ──────→ TX
D1 (TX0) ──────→ RX
GND ────────────→ GND

⚠️  WARNING: Do NOT connect devices to D0/D1 when using USB!
```

### Serial1 - Hardware UART 1

```
Arduino Mega              Device (NodeMCU ESP8266)
┌────────────┐          ┌──────────────┐
│ D19 (RX1)  │◄─────────┤ TX           │
│            │          │              │
│ D18 (TX1)  │─────────►┤ RX           │
│            │          │              │
│ GND        │──────────┤ GND          │
└────────────┘          └──────────────┘

Code Example:
void setup() {
    Serial1.begin(115200);  // Initialize Serial1
}

void loop() {
    if (Serial1.available()) {
        char c = Serial1.read();
        Serial1.print("Echo: ");
        Serial1.println(c);
    }
}
```

### Serial2 - Hardware UART 2

```
Arduino Mega              GPS Module
┌────────────┐          ┌──────────────┐
│ D17 (RX2)  │◄─────────┤ TX           │
│            │          │              │
│ D16 (TX2)  │─────────►┤ RX           │
│            │          │              │
│ 5V         │─────────►┤ VCC          │
│ GND        │──────────┤ GND          │
└────────────┘          └──────────────┘

Code Example:
void setup() {
    Serial2.begin(9600);  // GPS modules typically 9600 baud
}

void loop() {
    if (Serial2.available()) {
        String gpsData = Serial2.readStringUntil('\n');
        Serial.println(gpsData);
    }
}
```

### Serial3 - Hardware UART 3

```
Arduino Mega              Bluetooth Module (HC-05)
┌────────────┐          ┌──────────────┐
│ D15 (RX3)  │◄─────────┤ TX           │
│            │          │              │
│ D14 (TX3)  │─────────►┤ RX           │
│            │          │              │
│ 5V         │─────────►┤ VCC          │
│ GND        │──────────┤ GND          │
└────────────┘          └──────────────┘

Code Example:
void setup() {
    Serial3.begin(9600);  // Bluetooth typically 9600
}

void loop() {
    if (Serial3.available()) {
        String cmd = Serial3.readStringUntil('\n');
        processCommand(cmd);
    }
}
```

### Multi-Serial Example (All 4 Ports)

```
┌─────────────────────────────────────┐
│       Arduino Mega 2560             │
│                                     │
│  Serial (USB) ──→ Computer Debug    │
│  Serial1 ─────→ NodeMCU/ESP8266    │
│  Serial2 ─────→ GPS Module          │
│  Serial3 ─────→ Bluetooth Module    │
│                                     │
└─────────────────────────────────────┘

Code Example:
void setup() {
    Serial.begin(115200);   // USB debug
    Serial1.begin(115200);  // NodeMCU
    Serial2.begin(9600);    // GPS
    Serial3.begin(9600);    // Bluetooth
}

void loop() {
    // Read from NodeMCU
    if (Serial1.available()) {
        String cmd = Serial1.readStringUntil('\n');
        processCommand(cmd);
    }

    // Read GPS data
    if (Serial2.available()) {
        parseGPS();
    }

    // Read Bluetooth commands
    if (Serial3.available()) {
        handleBluetoothCmd();
    }
}
```

---

## Level Shifter Circuits (5V ↔ 3.3V)

### Voltage Divider (5V → 3.3V) - Simple

```
Arduino Mega (5V)         NodeMCU ESP8266 (3.3V)
┌────────────┐           ┌──────────────┐
│            │           │              │
│ TX (5V)    │──┬─R1─┬──►┤ RX (3.3V)    │
│            │  │     │   │              │
└────────────┘  │    R2   └──────────────┘
              └─┴─GND

Resistor Values:
R1 = 2kΩ  (2000 ohms)
R2 = 1kΩ  (1000 ohms)

Output Voltage = 5V × (R2 / (R1 + R2))
               = 5V × (1000 / 3000)
               = 3.33V ✅

⚠️  This is ONE-WAY only (5V → 3.3V)
   For bidirectional, see bidirectional shifter below
```

### Bidirectional Level Shifter (Recommended)

```
Arduino Mega (5V)         Level Shifter         NodeMCU ESP8266 (3.3V)
┌────────────┐           ┌─────────────┐        ┌──────────────┐
│            │           │             │        │              │
│ 5V         │──────────►┤ HV          │        │              │
│            │           │             │        │              │
│ TX1 (D18)  │◄─────────►┤ HV1 ↔ LV1  │◄──────►┤ RX           │
│ RX1 (D19)  │◄─────────►┤ HV2 ↔ LV2  │◄──────►┤ TX           │
│            │           │             │        │              │
│ GND        │──────────►┤ GND     LV  │◄───────┤ 3.3V         │
│            │           │             │        │              │
└────────────┘           └─────────────┘        └──────────────┘

Recommended Module: SparkFun Logic Level Converter (BOB-12009)
                   or any 4-channel bidirectional shifter

Features:
✅ Bidirectional (5V ↔ 3.3V)
✅ Up to 4 channels
✅ Safe for both devices
✅ Simple to use
```

### MOSFET-Based Bidirectional Shifter (DIY)

```
Arduino Mega (5V)                         NodeMCU (3.3V)
      │                                         │
      │           ┌──── 10kΩ ────┤ 3.3V        │
      │           │                             │
      ├───────────┤                             │
      │           │   BSS138                    │
      │    5V ────┤───────────────────────────┬─┤
      │           │     MOSFET                 │
      │           │   (N-Channel)              │
      │           │                            │
      │           └──── 10kΩ ────┤ 5V         │
      │                                        │
      └────────────────────────────────────────┘
                      GND

Components per channel:
• 1× BSS138 N-Channel MOSFET
• 2× 10kΩ resistors (pull-up)
• Breadboard or PCB

⚠️  For beginners, use pre-made level shifter modules!
```

---

## I2C Wiring (Two-Wire Interface)

### Basic I2C Connection

```
Arduino Mega              I2C Device (e.g., OLED Display)
┌────────────┐           ┌──────────────┐
│            │           │              │
│ D20 (SDA)  │◄─────────►┤ SDA          │
│ D21 (SCL)  │──────────►┤ SCL          │
│            │           │              │
│ 5V         │─────────►┤ VCC          │
│ GND        │──────────┤ GND          │
└────────────┘           └──────────────┘

Pull-up Resistors (if not on module):
┌────────────┐
│ 5V         │
│   ├─4.7kΩ─┴──→ SDA
│   └─4.7kΩ─┴──→ SCL
│            │
└────────────┘
```

### Multiple I2C Devices (Bus)

```
                Arduino Mega
                ┌────────────┐
                │ D20 (SDA)  │────────┬─────────┬─────────┐
                │ D21 (SCL)  │────┐   │         │         │
                │ 5V         │─┐  │   │         │         │
                │ GND        │─┤  │   │         │         │
                └────────────┘ │  │   │         │         │
                               │  │   │         │         │
                    ┌──────────┤  └───┼────┬────┼────┬────┤
                    │          │      │    │    │    │    │
              ┌─────┴─────┐  ┌─┴────┐  ┌──┴──┐  ┌──┴──┐  ┌──┴──┐
              │ OLED      │  │ RTC  │  │Sensor│  │Sensor│  │Sensor│
              │ (0x3C)    │  │(0x68)│  │(0x77)│  │(0x48)│  │(0x44)│
              └───────────┘  └──────┘  └──────┘  └──────┘  └──────┘

Note: Each device must have unique I2C address

Code Example:
#include <Wire.h>

void setup() {
    Wire.begin();  // Initialize I2C as master
    Serial.begin(115200);
}

void scanI2C() {
    Serial.println("Scanning I2C bus...");
    for (byte addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            Serial.print("Device found at 0x");
            Serial.println(addr, HEX);
        }
    }
}
```

### I2C with 3.3V Devices

```
Arduino Mega (5V)         Level Shifter         I2C Device (3.3V)
┌────────────┐           ┌─────────────┐        ┌──────────────┐
│            │           │             │        │              │
│ D20 (SDA)  │◄─────────►┤ HV1 ↔ LV1  │◄──────►┤ SDA          │
│ D21 (SCL)  │──────────►┤ HV2 ↔ LV2  │───────►┤ SCL          │
│            │           │             │        │              │
│ 5V         │──────────►┤ HV      LV  │◄───────┤ 3.3V         │
│ GND        │──────────►┤ GND     GND │───────►┤ GND          │
└────────────┘           └─────────────┘        └──────────────┘

⚠️  IMPORTANT: Use level shifter for 3.3V I2C devices!
   Direct connection may damage 3.3V devices.
```

---

## SPI Wiring (Serial Peripheral Interface)

### Single SPI Device

```
Arduino Mega              SPI Device (e.g., SD Card Module)
┌────────────┐           ┌──────────────┐
│            │           │              │
│ D52 (SCK)  │──────────►┤ SCK          │
│ D51 (MOSI) │──────────►┤ MOSI (DI)    │
│ D50 (MISO) │◄──────────┤ MISO (DO)    │
│ D53 (SS)   │──────────►┤ CS (SS)      │
│            │           │              │
│ 5V         │─────────►┤ VCC          │
│ GND        │──────────┤ GND          │
└────────────┘           └──────────────┘

Code Example:
#include <SPI.h>

void setup() {
    SPI.begin();
    pinMode(53, OUTPUT);
    digitalWrite(53, HIGH);  // Deselect device
}

void loop() {
    digitalWrite(53, LOW);   // Select device
    SPI.transfer(0x42);      // Send data
    digitalWrite(53, HIGH);  // Deselect device
}
```

### Multiple SPI Devices (Different CS Pins)

```
                Arduino Mega
                ┌────────────┐
                │ D52 (SCK)  │────────┬─────────┬─────────┐
                │ D51 (MOSI) │────────┼─────────┼─────────┤
                │ D50 (MISO) │────────┼─────────┼─────────┤
                │ D53 (SS)   │────┐   │         │         │
                │ D48        │────┤   │         │         │
                │ D49        │────┤   │         │         │
                └────────────┘    │   │         │         │
                                  │   │         │         │
                         ┌────────┼───┼────┬────┼────┬────┤
                         │        │   │    │    │    │    │
                    ┌────┴───┐  ┌─┴──┐  ┌──┴──┐  ┌──┴──┐  │
                    │SD Card │  │RFID│  │ LCD │  │Flash│  │
                    │ (D53)  │  │(D48)│  │(D49)│  │(D47)│  │
                    └────────┘  └────┘  └─────┘  └─────┘  │
                                                            │
                                Common: SCK, MOSI, MISO ◄──┘

Code Example:
const int SD_CS = 53;
const int RFID_CS = 48;
const int LCD_CS = 49;

void setup() {
    SPI.begin();
    pinMode(SD_CS, OUTPUT);
    pinMode(RFID_CS, OUTPUT);
    pinMode(LCD_CS, OUTPUT);

    digitalWrite(SD_CS, HIGH);    // Deselect all
    digitalWrite(RFID_CS, HIGH);
    digitalWrite(LCD_CS, HIGH);
}

void writeLCD(byte data) {
    digitalWrite(LCD_CS, LOW);
    SPI.transfer(data);
    digitalWrite(LCD_CS, HIGH);
}
```

---

## PWM Pin Wiring

### Motor Controller via PWM

```
Arduino Mega              Motor Controller (e.g., L298N)
┌────────────┐           ┌──────────────┐
│            │           │              │
│ D9 (PWM)   │──────────►┤ ENA (Speed)  │───→ Motor A
│ D7         │──────────►┤ IN1 (Dir)    │
│ D8         │──────────►┤ IN2 (Dir)    │
│            │           │              │
│ D10 (PWM)  │──────────►┤ ENB (Speed)  │───→ Motor B
│ D5         │──────────►┤ IN3 (Dir)    │
│ D6         │──────────►┤ IN4 (Dir)    │
│            │           │              │
│ GND        │──────────►┤ GND          │
└────────────┘           └──────────────┘
                         │              │
                Battery ─┤ 12V          │
                GND ─────┤ GND          │
                         └──────────────┘

Code Example:
const int ENA = 9;   // PWM
const int IN1 = 7;
const int IN2 = 8;

void setup() {
    pinMode(ENA, OUTPUT);
    pinMode(IN1, OUTPUT);
    pinMode(IN2, OUTPUT);
}

void motorForward(int speed) {
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, speed);  // 0-255
}
```

### LED Dimming via PWM

```
Arduino Mega              LED Circuit
┌────────────┐           ┌──────────────┐
│            │           │              │
│ D9 (PWM)   │─────220Ω──┤ LED (+)      │
│            │           │   │          │
│ GND        │───────────┤ LED (-)      │
└────────────┘           └──────────────┘

Code Example:
const int ledPin = 9;

void setup() {
    pinMode(ledPin, OUTPUT);
}

void loop() {
    for (int brightness = 0; brightness <= 255; brightness++) {
        analogWrite(ledPin, brightness);
        delay(10);
    }
}
```

### Servo Control (PWM)

```
Arduino Mega              Servo Motor
┌────────────┐           ┌──────────────┐
│            │           │              │
│ D9 (PWM)   │──────────►┤ Signal       │
│ 5V         │─────────►┤ VCC (Red)    │
│ GND        │──────────┤ GND (Brown)  │
└────────────┘           └──────────────┘

⚠️  For multiple servos, use external power supply!

Code Example:
#include <Servo.h>

Servo myServo;

void setup() {
    myServo.attach(9);
}

void loop() {
    myServo.write(90);  // Center position
    delay(1000);
    myServo.write(0);   // Minimum
    delay(1000);
    myServo.write(180); // Maximum
    delay(1000);
}
```

---

## Common Connection Mistakes

| ❌ MISTAKE                                    | ✅ CORRECT                                   | WHY IT MATTERS                          |
| --------------------------------------------- | -------------------------------------------- | --------------------------------------- |
| Connecting 3.3V device directly to 5V Arduino | Use level shifter or voltage divider         | **Will damage 3.3V device!**            |
| TX to TX, RX to RX                            | TX to RX, RX to TX (crossed)                 | Serial communication won't work         |
| Forgetting common ground                      | Always connect GND pins together             | No voltage reference = no communication |
| Using D0/D1 while USB is connected            | Use Serial1, Serial2, or Serial3             | Conflicts with USB serial adapter       |
| Powering servos from Arduino 5V pin           | Use external 5-6V supply                     | Arduino can't supply enough current     |
| Exceeding 20mA per pin                        | Use transistor/MOSFET for high current       | **Will damage Arduino!**                |
| Reverse polarity on power                     | Check polarity carefully                     | **Will destroy Arduino!**               |
| No current-limiting resistor on LEDs          | Always use 220-330Ω resistor                 | **Will burn out LED!**                  |
| Pull-up resistors on I2C but also on module   | Remove one set (usually keep module's)       | Can cause communication issues          |
| Long wires without shielding for I2C/SPI      | Keep wires < 12 inches or use shielded cable | Signal degradation / noise              |

---

## Troubleshooting Guide

### Problem: Arduino won't power on

**Symptoms:** No LEDs, completely dead

**Checks:**

```
1. Verify power source:
   • Barrel jack: 7-12V DC, center positive
   • USB: Check cable and computer USB port
   • Vin: Correct voltage and polarity?

2. Check for shorts:
   • Remove all connections
   • Power on Arduino alone
   • If works, add connections one-by-one

3. Check power LED:
   • Green LED should light up
   • If no LED, power issue or damaged board
```

### Problem: Serial communication not working

**Symptoms:** No data received/sent

**Checks:**

```
1. Verify wiring:
   Arduino TX → Device RX (crossed!)
   Arduino RX → Device TX (crossed!)
   Arduino GND → Device GND

2. Check baud rate:
   Serial.begin(115200);  // Must match device

3. Voltage levels:
   • 5V Arduino → 3.3V Device: USE LEVEL SHIFTER!
   • 3.3V Device → 5V Arduino: Usually safe

4. Test with loopback:
   • Connect TX to RX on same Arduino
   • Send data - should receive it back
```

### Problem: I2C device not responding

**Symptoms:** Wire.endTransmission() returns error

**Checks:**

```
1. Run I2C scanner:
   #include <Wire.h>
   void setup() {
       Wire.begin();
       Serial.begin(115200);
   }
   void loop() {
       for (byte addr = 1; addr < 127; addr++) {
           Wire.beginTransmission(addr);
           if (Wire.endTransmission() == 0) {
               Serial.print("Found: 0x");
               Serial.println(addr, HEX);
           }
       }
       delay(5000);
   }

2. Check pull-up resistors:
   • SDA and SCL need 4.7kΩ to +5V
   • Most modules have them built-in

3. Verify connections:
   • D20 (SDA) and D21 (SCL) correct?
   • Common ground connected?

4. Check device address:
   • Some devices have configurable addresses
   • Check datasheet
```

### Problem: PWM not working

**Symptoms:** Motor/LED not responding to analogWrite()

**Checks:**

```
1. Verify PWM-capable pin:
   • Pins 2-13, 44-46 only
   • Check Quick Reference Card above

2. Check code:
   pinMode(pin, OUTPUT);       // Must set as OUTPUT
   analogWrite(pin, 128);      // 0-255 range

3. Test with simple LED:
   • Connect LED + 220Ω resistor
   • Should see brightness change

4. Check frequency:
   • Default ~490 Hz (pins 4,13 ~980 Hz)
   • Some devices need specific frequency
```

### Problem: Digital pin reading wrong value

**Symptoms:** digitalRead() returns unexpected HIGH/LOW

**Checks:**

```
1. Floating input:
   pinMode(pin, INPUT_PULLUP);  // Enable internal pull-up

2. Check wiring:
   • Ensure connection is secure
   • Check for shorts to adjacent pins

3. Test with simple button:
   Button between pin and GND
   Internal pull-up enabled
   Should read HIGH when open, LOW when pressed

4. Electrical noise:
   • Add 0.1µF capacitor across button
   • Keep wires short
```

### Problem: Not enough power for peripherals

**Symptoms:** Arduino resets, brownouts, erratic behavior

**Solution:**

```
Current Limits:
• 5V pin: 900mA total (shared with USB)
• 3.3V pin: 50mA only!
• USB power: 500mA total

Fix:
1. Use external power supply:
   • 7-12V to barrel jack or Vin
   • Powers Arduino + provides more current

2. For high-current devices (motors, servos):
   • MUST use separate power supply
   • Connect grounds together (common ground)

   Example:
   Battery (+) ──→ Motor Controller VCC
   Battery (-) ──→ Motor Controller GND + Arduino GND
   Arduino Pin ──→ Motor Controller Signal
```

---

## Advanced Wiring Tips

### Proper Grounding

```
❌ WRONG: Star ground from multiple sources
   Battery(+) ──→ Motor Controller
   Battery(-) ──→ Motor Controller GND

   USB(+) ──→ Arduino
   USB(-) ──→ Arduino GND

   Result: Ground loop, noise, potential damage

✅ CORRECT: Common ground point

             Common Ground Point
                     │
         ┌───────────┼───────────┬───────────┐
         │           │           │           │
     Battery(-)  Arduino GND  Motor GND  Sensor GND
```

### Shielding and Noise Reduction

```
For long wire runs:
┌────────────┐        Twisted Pair        ┌──────────┐
│ Arduino    │        or Shielded Cable   │  Sensor  │
│ Signal ────┼────────────────────────────┤ Signal   │
│ GND ───────┼────────────────────────────┤ GND      │
└────────────┘                            └──────────┘
                Shield connected to GND
                at ONE end only

Add capacitors near chips:
              Arduino
         ┌──────────────┐
    5V ──┤    0.1µF     │── GND (close to chip)
         │  (ceramic)   │
         └──────────────┘
```

### Current Sensing

```
Measure current draw:
                 ┌─── Load
                 │
Battery(+) ──┬───┴── ACS712 Current Sensor ──┬─── Load GND
             │                                │
             └────────────────────────────────┴─── Battery(-)
                                              │
                                         Analog Out
                                              │
                                     Arduino A0 (Analog)

Code:
int sensorValue = analogRead(A0);
float voltage = sensorValue * (5.0 / 1023.0);
float current = (voltage - 2.5) / 0.185;  // For 5A module
```

---

## Pin Assignment Reference Table

### Recommended Pin Assignments (OmniTrek Nexus)

| Pin                | Function        | Device             | Notes                         |
| ------------------ | --------------- | ------------------ | ----------------------------- |
| **Serial Ports**   |                 |                    |                               |
| 0 (RX0)            | USB Serial RX   | Computer           | DO NOT use when USB connected |
| 1 (TX0)            | USB Serial TX   | Computer           | DO NOT use when USB connected |
| 18 (TX1)           | Serial1 TX      | NodeMCU ESP8266 RX | Use level shifter!            |
| 19 (RX1)           | Serial1 RX      | NodeMCU ESP8266 TX | Use level shifter!            |
| 16 (TX2)           | Serial2 TX      | GPS Module         | Optional                      |
| 17 (RX2)           | Serial2 RX      | GPS Module         | Optional                      |
| 14 (TX3)           | Serial3 TX      | Reserved           | Future expansion              |
| 15 (RX3)           | Serial3 RX      | Reserved           | Future expansion              |
| **I2C**            |                 |                    |                               |
| 20 (SDA)           | I2C Data        | Sensors            | Pull-ups required             |
| 21 (SCL)           | I2C Clock       | Sensors            | Pull-ups required             |
| **SPI**            |                 |                    |                               |
| 50 (MISO)          | SPI Input       | SD Card            | Optional                      |
| 51 (MOSI)          | SPI Output      | SD Card            | Optional                      |
| 52 (SCK)           | SPI Clock       | SD Card            | Optional                      |
| 53 (SS)            | SPI Chip Select | SD Card            | Can use other pins for CS     |
| **Motor Control**  |                 |                    |                               |
| 9 (PWM)            | PWM Output      | Left Motor Speed   | ZS-X11H Pin 5                 |
| 7                  | Digital Out     | Left Motor FWD     | ZS-X11H Pin 2                 |
| 8                  | Digital Out     | Left Motor REV     | ZS-X11H Pin 3                 |
| 10 (PWM)           | PWM Output      | Right Motor Speed  | ZS-X11H Pin 5                 |
| 5                  | Digital Out     | Right Motor FWD    | ZS-X11H Pin 2                 |
| 6                  | Digital Out     | Right Motor REV    | ZS-X11H Pin 3                 |
| **Sensors**        |                 |                    |                               |
| A0                 | Analog In       | Battery Voltage    | Via voltage divider           |
| A1                 | Analog In       | Current Sensor     | ACS712 output                 |
| A2-A15             | Analog In       | Reserved           | Future sensors                |
| **Status LEDs**    |                 |                    |                               |
| 13                 | Digital Out     | Status LED         | Built-in LED                  |
| 12                 | Digital Out     | Status LED         | External green LED            |
| 11                 | Digital Out     | Status LED         | External red LED              |
| **Emergency Stop** |                 |                    |                               |
| 2 (INT0)           | Digital In      | E-Stop Button      | Interrupt-driven              |

---

## Safety Checklist

Before powering on:

```
□ Check polarity on all power connections
  • Battery positive to correct terminal
  • No reversed connections

□ Verify voltage levels
  • Arduino input: 7-12V (9V recommended)
  • All 3.3V devices use level shifters
  • No direct 5V to 3.3V connections

□ Check current ratings
  • Total 5V draw < 900mA
  • Total 3.3V draw < 50mA
  • Motors on separate power supply

□ Verify all grounds connected
  • Common ground between all devices
  • No floating grounds

□ Inspect for shorts
  • No loose wires touching
  • No solder bridges on boards
  • Check with multimeter if unsure

□ Test continuity
  • Verify critical connections with multimeter
  • Check for broken wires

□ Fuse protection
  • Fuses on battery power lines
  • Appropriate current rating

□ Emergency stop accessible
  • Physical button wired and tested
  • Can quickly disconnect power

□ First power-on procedure
  1. Remove all connections except power
  2. Power on Arduino alone
  3. Check LEDs and voltages
  4. Add peripherals one-by-one
  5. Test each addition before proceeding
```

---

## Appendix: ATmega2560 Specifications

### Core Specifications

- **CPU:** 8-bit AVR RISC architecture
- **Clock Speed:** 16 MHz
- **Operating Voltage:** 5V
- **Flash Memory:** 256 KB (8 KB bootloader)
- **SRAM:** 8 KB
- **EEPROM:** 4 KB

### I/O Specifications

- **Digital I/O Pins:** 54
- **Analog Input Pins:** 16 (10-bit ADC)
- **PWM Pins:** 15
- **External Interrupts:** 6
- **DC Current per I/O:** 20 mA (40 mA absolute max)
- **DC Current for 3.3V:** 50 mA

### Communication Interfaces

- **UART:** 4 hardware serial ports
- **I2C (TWI):** 1 port
- **SPI:** 1 port

### Timers

- **8-bit Timers:** 2
- **16-bit Timers:** 4

### Power Consumption

- **Active (running):** ~45 mA at 16 MHz
- **Idle:** ~15 mA
- **Power-down:** < 1 mA

---

## Additional Resources

- **Arduino Mega 2560 Official Documentation:** https://docs.arduino.cc/hardware/mega-2560
- **ATmega2560 Datasheet:**
  https://ww1.microchip.com/downloads/en/devicedoc/atmel-2549-8-bit-avr-microcontroller-atmega640-1280-1281-2560-2561_datasheet.pdf
- **Arduino Language Reference:** https://www.arduino.cc/reference/en/
- **OmniTrek Nexus Project:** See `HARDWARE_SPECIFICATIONS.md` for complete system details

---

**Document Version:** 1.0.0 **Last Updated:** 2025-11-05 **Applies to:** Arduino Mega 2560 Rev3 and
compatible boards
