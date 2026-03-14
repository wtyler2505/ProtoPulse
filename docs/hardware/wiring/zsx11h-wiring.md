---
# LLM Optimization Metadata
metadata:
  document_id: hardware-wiring-zsx11h-wiring
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 13 minutes
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
  - 'ZSX11H Motor Controllers: 36V, 350W brushless motor controllers'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
  - 'Wiring Guide: Electrical connection instructions'
summary: '**Quick Reference for RioRand ZS-X11H Brushless Motor Controller** ---'
depends_on:
  - README.md
---

# ZS-X11H Motor Controller - Wiring Reference Guide

**Quick Reference for RioRand ZS-X11H Brushless Motor Controller**

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│        RioRand ZS-X11H Motor Controller - Quick Reference       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SPECIFICATIONS:                                                │
│  • Input: 6-60V DC (9-60V recommended)                         │
│  • Power: 350W rated, 400W peak                                │
│  • Current: 16A continuous, 20A peak                            │
│  • Motor: 120° BLDC with Hall sensors                          │
│  • PWM: 2.5-5V, 1-10 kHz recommended                           │
│                                                                 │
│  POWER TERMINALS (Screw Terminals):                            │
│  ┌───┬───┬───┬───┬───┐                                        │
│  │VCC│GND│ U │ V │ W │                                        │
│  └───┴───┴───┴───┴───┘                                        │
│   │   │   └───┴───┴───→ Motor Phase Wires                     │
│   │   └───────────────→ Battery Negative                      │
│   └───────────────────→ Battery Positive                      │
│                                                                 │
│  CONTROL HEADER (10-Pin):                                      │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬───┐                           │
│  │1 │2 │3 │4 │5 │6 │7 │8 │9 │10 │                           │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴───┘                           │
│   G  F  R  B  P  +  H  H  H  G                                │
│   N  W  E  R  W  5  a  b  c  N                                │
│   D  D  V  K  M  V           D                                │
│                                                                 │
│  Pin 1:  GND    - Signal Ground                                │
│  Pin 2:  FWD    - Forward (active LOW - connect to GND)       │
│  Pin 3:  REV    - Reverse (active LOW - connect to GND)       │
│  Pin 4:  BRK    - Brake (active HIGH - connect to +5V)        │
│  Pin 5:  PWM    - Speed Control (2.5-5V PWM or 0-5V analog)   │
│  Pin 6:  +5V    - 5V Output (~100mA for signals/Hall)         │
│  Pin 7:  Ha     - Hall Sensor A Input (0-5V)                  │
│  Pin 8:  Hb     - Hall Sensor B Input (0-5V)                  │
│  Pin 9:  Hc     - Hall Sensor C Input (0-5V)                  │
│  Pin 10: GND    - Hall Sensor Ground                           │
│                                                                 │
│  DIRECTION LOGIC (Active LOW):                                 │
│  FWD=LOW,  REV=HIGH  →  Forward                               │
│  FWD=HIGH, REV=LOW   →  Reverse                               │
│  FWD=HIGH, REV=HIGH  →  Stop                                  │
│  FWD=LOW,  REV=LOW   →  Undefined (AVOID!)                   │
│                                                                 │
│  MOTOR HALL CONNECTOR (5 wires from motor):                    │
│  Red    → +5V  (Pin 6)  - Hall Power                          │
│  Black  → GND  (Pin 10) - Hall Ground                         │
│  Yellow → Ha   (Pin 7)  - Hall Sensor A                       │
│  Green  → Hb   (Pin 8)  - Hall Sensor B                       │
│  Blue   → Hc   (Pin 9)  - Hall Sensor C                       │
│                                                                 │
│  ⚠️  CRITICAL WARNINGS:                                         │
│  • ONLY 120° motors! NOT compatible with 60° motors           │
│  • Hall sensors MUST be 5V (not 3.3V!)                        │
│  • NEVER change direction above 50% speed                      │
│  • ALWAYS reduce speed before braking at high speed           │
│  • Use 1000μF+ capacitor at VCC/GND                           │
│  • Common ground REQUIRED between all components              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Print this card and keep near your workbench!
```

---

## Complete Wiring Diagram - Single Motor

```
═══════════════════════════════════════════════════════════════════
              COMPLETE ZS-X11H SINGLE MOTOR WIRING
═══════════════════════════════════════════════════════════════════

┌────────────────┐
│ Battery Pack   │
│  (24V-48V)     │
└────┬───────┬───┘
     │       │
     │    [30A Fuse]
     │       │
     │  [1000μF Cap]  ← IMPORTANT: Add bulk capacitor!
     │       │
     └───────┴────┐
                  │
     ┌────────────▼───────────────────────────┐
     │  RioRand ZS-X11H Controller            │
     │                                        │
     │  Power Screw Terminals:                │
     │  ┌────┬────┬────┬────┬────┐          │
     │  │VCC │GND │ U  │ V  │ W  │          │
     │  └──┬─┴──┬─┴─┬──┴─┬──┴─┬──┘          │
     │     │    │   └────┼────┴──────┐       │
     │     │    │        │          │       │
     │     │    │        │          │       │
     │  Control Header (10-pin):            │
     │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬──┐            │
     │  │1│2│3│4│5│6│7│8│9│10│            │
     │  └┬┴┬┴┬┴┬┴┬┴┬┴┬┴┬┴┬┴┬─┘            │
     │   │ │ │ │ │ │ │ │ │ │               │
     └───┼─┼─┼─┼─┼─┼─┼─┼─┼─┼───────────────┘
         │ │ │ │ │ │ │ │ │ │
         │ │ │ │ │ │ └─┴─┴─┴──────┐
         │ │ │ │ │ │               │
    ┌────▼─▼─▼─▼─▼─▼────┐     ┌───▼──────────────┐
    │  Arduino Mega 2560 │     │ Hoverboard Motor │
    │                    │     │    Hub Motor     │
    │  Pin 9  (PWM) ─────┼─────┼→ Pin 5           │
    │  Pin 7  (FWD) ─────┼─────┼→ Pin 2           │
    │  Pin 8  (REV) ─────┼─────┼→ Pin 3           │
    │  Pin 6  (BRK) ─────┼─────┼→ Pin 4           │  ┌──────────┐
    │  GND ──────────────┼─────┼→ Pin 1, 10       │  │ 3 Phase  │
    │                    │     │                  │  │  Yellow  │─→ U
    └────────────────────┘     │  Pin 6 (+5V) ────┼──┼→ Blue    │─→ V
                               │  Pin 7 (Ha)  ────┼──┼→ Green   │─→ W
                               │  Pin 8 (Hb)  ────┼──┤          │
                               │  Pin 9 (Hc)  ────┼──┤ 5 Hall:  │
                               └──────────────────┘  │  Red     │─→ +5V
                                                     │  Black   │─→ GND
                                                     │  Yellow  │─→ Ha
                                                     │  Green   │─→ Hb
                                                     │  Blue    │─→ Hc
                                                     └──────────┘

WIRE GAUGES:
• Battery to Controller (VCC/GND): 14-16 AWG
• Motor Phase Wires (U, V, W): 16-18 AWG
• Hall Sensor Wires: 22-24 AWG
• Control Signals (Arduino): 24-26 AWG

CRITICAL: All grounds must be connected together!
          Battery GND ← → Arduino GND ← → Controller GND
```

---

## Dual Motor Wiring - Rover Configuration

```
═══════════════════════════════════════════════════════════════════
             DUAL ZS-X11H ROVER WIRING (Differential Drive)
═══════════════════════════════════════════════════════════════════

                    ┌──────────────┐
                    │ Battery Pack │
                    │  (36V 10Ah)  │
                    └─┬──────────┬─┘
                      │          │
                   [30A Fuse] [30A Fuse]
                      │          │
                 [1000μF]    [1000μF]
                      │          │
         ┌────────────┴──┐   ┌──┴───────────┐
         │ Controller 1  │   │ Controller 2 │
         │   (LEFT)      │   │   (RIGHT)    │
         └───┬───┬───┬───┘   └───┬───┬───┬──┘
             │   │   │           │   │   │
         [Left Motor]        [Right Motor]
         Hub Motor           Hub Motor
             │                   │

┌────────────▼───────────────────▼──────────────┐
│         Arduino Mega 2560                     │
│                                               │
│  LEFT MOTOR CONTROL:                          │
│    Pin 9  (PWM)  ──────→ Controller 1 PWM     │
│    Pin 7  (FWD)  ──────→ Controller 1 FWD     │
│    Pin 8  (REV)  ──────→ Controller 1 REV     │
│                                               │
│  RIGHT MOTOR CONTROL:                         │
│    Pin 10 (PWM)  ──────→ Controller 2 PWM     │
│    Pin 5  (FWD)  ──────→ Controller 2 FWD     │
│    Pin 6  (REV)  ──────→ Controller 2 REV     │
│                                               │
│  COMMON:                                      │
│    GND ──────────┬──────→ Controller 1 GND    │
│                  └──────→ Controller 2 GND    │
│                                               │
└───────────────────────────────────────────────┘

ROVER MOVEMENT PATTERNS:

Forward:   LEFT=+speed,  RIGHT=+speed
Backward:  LEFT=-speed,  RIGHT=-speed
Turn Left: LEFT=+speed/2, RIGHT=+speed
Turn Right:LEFT=+speed,  RIGHT=+speed/2
Spin Left: LEFT=-speed,  RIGHT=+speed
Spin Right:LEFT=+speed,  RIGHT=-speed
```

---

## Arduino Connection Detail

```
┌─────────────────────────────────────────────────────────────┐
│          ARDUINO MEGA 2560 TO ZS-X11H CONNECTION            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Arduino          Wire          Controller                 │
│  Pin 9  ────────[signal]──────→ PWM (Pin 5)                │
│  Pin 7  ────────[signal]──────→ FWD (Pin 2)                │
│  Pin 8  ────────[signal]──────→ REV (Pin 3)                │
│  Pin 6  ────────[signal]──────→ BRK (Pin 4) [Optional]     │
│  GND    ────────[ground]──────→ GND (Pin 1)                │
│                                                             │
│  NOTES:                                                     │
│  • Use solid core 22-26 AWG wire for signals               │
│  • Keep wires under 12 inches if possible                  │
│  • Twist signal wires with ground for noise immunity       │
│  • Common ground is CRITICAL - connect all GND together    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Motor Hall Sensor Wiring

```
┌──────────────────────────────────────────────────────────────┐
│              HALL SENSOR CONNECTOR WIRING                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  FROM MOTOR (5-wire harness):                               │
│                                                              │
│       Motor               Controller                        │
│  ┌────────────┐        ┌──────────────┐                    │
│  │ Red  ──────┼────────┼→ Pin 6 (+5V) │                    │
│  │ Black ─────┼────────┼→ Pin 10 (GND)│                    │
│  │ Yellow ────┼────────┼→ Pin 7 (Ha)  │                    │
│  │ Green ─────┼────────┼→ Pin 8 (Hb)  │                    │
│  │ Blue ──────┼────────┼→ Pin 9 (Hc)  │                    │
│  └────────────┘        └──────────────┘                    │
│                                                              │
│  TESTING HALL SENSORS:                                      │
│  1. Disconnect from controller                              │
│  2. Connect +5V and GND from bench supply                   │
│  3. Use multimeter on Ha wire                               │
│  4. Slowly rotate motor by hand                             │
│  5. Voltage should toggle between 0V and 5V                 │
│  6. Repeat for Hb and Hc                                    │
│                                                              │
│  If any sensor is stuck HIGH or LOW, it needs replacement   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Power Distribution (OmniTrek Nexus System)

### Complete Power Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│              OmniTrek ROVER POWER DISTRIBUTION SYSTEM                │
└──────────────────────────────────────────────────────────────────────┘

36V Battery                          25.2V Battery
HY-SSY-1002ULS                       ELITOP-702US-HY
(Motor Power)                        (Electronics)
┌────────────────┐                   ┌────────────────┐
│ 10S2P Li-ion   │                   │ 7S2P Li-ion    │
│ Nominal: 36V   │                   │ Nominal: 25.2V │
│ Full: 42V      │                   │ Full: 29.4V    │
│ Capacity: 4.4Ah│                   │ Capacity: 4.0Ah│
│ Peak: 30A      │                   │ Peak: 15A      │
└───┬────────────┘                   └───┬────────────┘
    │                                    │
    │ [Main Fuse 30A]                    │ [Fuse 15A]
    │                                    │
    │                                    ↓
    │                             ┌──────────────────┐
    │                             │ LM2596 Buck      │
    │                             │ 25.2V → 9V       │
    │                             │ (for Arduino)    │
    │                             └────────┬─────────┘
    │                                      │
    │                                      ↓
    │                             ┌──────────────────┐
    │                             │  Arduino Mega    │
    │                             │  VIN: 9V         │
    │                             │  Outputs:        │
    │                             │  • 5V @ 800mA    │
    │                             │  • 3.3V @ 50mA   │
    │                             └─────┬────────────┘
    │                                   │
    │                                   │ 5V for:
    │                                   ├─→ NodeMCU ESP8266
    │                                   ├─→ Control signals
    │                                   └─→ Sensors
    │
    ├──────────────┬──────────────┐
    │              │              │
    ↓              ↓              │
┌───────────┐  ┌───────────┐    │
│ ZS-X11H #1│  │ ZS-X11H #2│    │
│ VCC: 36V  │  │ VCC: 36V  │    │
│ Peak: 20A │  │ Peak: 20A │    │
│           │  │           │    │
│ Motors:   │  │ Motors:   │    │
│ • Front L │  │ • Rear L  │    │
│ • Front R │  │ • Rear R  │    │
└─────┬─────┘  └─────┬─────┘    │
      │              │          │
      │              │          │
   (control)     (control)      │
      ↑              ↑          │
      │              │          │
      └──────┬───────┘          │
             │ PWM + Direction   │
             │ signals from      │
             │ Arduino (5V)      │
             └───────────────────┘

⚠️  CRITICAL: Common ground between ALL components!
```

### Battery Specifications

#### 36V Battery (Motor Power Only)

```
┌──────────────────────────────────────────────────────────┐
│  MODEL: HY-SSY-1002ULS                                   │
│  PURPOSE: High-current motor power ONLY                  │
├──────────────────────────────────────────────────────────┤
│  Chemistry:        Lithium-Ion 18650                     │
│  Configuration:    10S2P                                 │
│  Nominal Voltage:  36V DC                                │
│  Full Charge:      42V DC                                │
│  Cutoff Voltage:   28-30V DC (BMS protection)            │
│  Capacity:         4400mAh (4.4Ah)                       │
│  Energy:           158Wh                                 │
│  Current Ratings:                                         │
│  • Continuous:     20A                                   │
│  • Peak:           30A (<10 sec bursts)                 │
│  • Charging:       <5A (42V charger ONLY)               │
│                                                           │
│  Wire Gauge:       12-14 AWG minimum                     │
│  Fuse:             30A automotive/ANL                    │
│  Connector:        XT60 recommended (60A rating)         │
└──────────────────────────────────────────────────────────┘

WIRING:
Battery (+) → [30A Fuse] → Split to both ZS-X11H VCC terminals
Battery (-) → Common ground bus → Both ZS-X11H GND terminals
```

#### 25.2V Battery (Electronics Only)

```
┌──────────────────────────────────────────────────────────┐
│  MODEL: ELITOP-702US-HY                                  │
│  PURPOSE: Arduino, NodeMCU, sensors (NOT motors!)        │
├──────────────────────────────────────────────────────────┤
│  Chemistry:        Lithium-Ion 18650                     │
│  Configuration:    7S2P                                  │
│  Nominal Voltage:  25.2V DC                              │
│  Full Charge:      29.4V DC                              │
│  Cutoff Voltage:   21V DC (BMS protection)               │
│  Capacity:         4000mAh (4.0Ah)                       │
│  Energy:           100.8Wh                               │
│  Current Ratings:                                         │
│  • Continuous:     10A                                   │
│  • Peak:           15A (<10 sec bursts)                 │
│  • Charging:       <3A (29.4V charger ONLY)             │
│                                                           │
│  Wire Gauge:       16-18 AWG                             │
│  Fuse:             15A automotive                        │
│  Connector:        XT60 or compatible                    │
└──────────────────────────────────────────────────────────┘

WIRING:
Battery (+) → [15A Fuse] → LM2596 IN+
Battery (-) → LM2596 IN- → Common ground
LM2596 OUT+ (9V) → Arduino VIN
LM2596 OUT- → Arduino GND
```

### Power Budget & Runtime

```
┌──────────────────────────────────────────────────────────┐
│               36V BATTERY (MOTOR POWER)                  │
├──────────────────────────────────────────────────────────┤
│  Load: 4× 350W motors @ 50% power                       │
│  Current draw: ~15A average, 30A peak                    │
│  Runtime: 4400mAh / 15A = 17-20 minutes                 │
│  ────────────────────────────────────────────────        │
│  ⚠️  This is the LIMITING FACTOR for rover operation!    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│            25.2V BATTERY (ELECTRONICS)                   │
├──────────────────────────────────────────────────────────┤
│  Arduino: ~100mA @ 9V = 0.9W                            │
│  NodeMCU: ~80mA @ 5V = 0.4W                             │
│  Sensors: ~20mA @ 5V = 0.1W                             │
│  Control signals: ~50mA @ 5V = 0.25W                    │
│  ────────────────────────────────────────────────        │
│  Total: ~1.65W / 0.88 efficiency = 1.88W input          │
│  Current from battery: 75mA @ 25.2V                      │
│  Runtime: 4000mAh / 75mA = 53 hours!                    │
│  ────────────────────────────────────────────────        │
│  ✅ Electronics can run for DAYS on single charge        │
└──────────────────────────────────────────────────────────┘

PRACTICAL OPERATION:
• Replace/recharge 36V battery every 15-20 minutes
• 25.2V battery lasts entire day of operation
• Keep spare 36V batteries charged for quick swaps
• Monitor 36V voltage closely (stops ~30V)
• 25.2V rarely needs attention during operation
```

### Safety - Lithium-Ion Battery Warnings

```
⚠️  CRITICAL LITHIUM-ION SAFETY WARNINGS ⚠️

FIRE/EXPLOSION HAZARD:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ NEVER reverse polarity - instant fire risk
✗ NEVER short circuit - explosion/fire
✗ NEVER puncture or crush battery
✗ NEVER charge unattended
✗ NEVER use wrong charger voltage
✗ NEVER charge below 0°C (32°F)
✗ NEVER charge above 45°C (113°F)
✗ NEVER discharge below BMS cutoff
✗ NEVER bypass BMS protection
✗ NEVER use damaged/swollen batteries

✓ ALWAYS use correct charger (42V for 10S, 29.4V for 7S)
✓ ALWAYS install fuses (30A for 36V, 15A for 25.2V)
✓ ALWAYS use proper wire gauge (see specs above)
✓ ALWAYS check polarity before connecting
✓ ALWAYS charge on fireproof surface
✓ ALWAYS monitor voltage to prevent over-discharge
✓ ALWAYS store at storage voltage (~3.7V/cell)
✓ ALWAYS keep away from flammable materials
✓ ALWAYS have fire extinguisher nearby
✓ ALWAYS disconnect when not in use
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIRE PLAN:
1. Class D fire extinguisher or sand (water makes it worse!)
2. If battery catches fire, evacuate immediately
3. Li-ion fires burn extremely hot (>500°C)
4. Call emergency services
5. Do NOT attempt to save equipment
```

---

## Common Wiring Mistakes

| ❌ WRONG             | ✅ CORRECT                | Issue                                    |
| -------------------- | ------------------------- | ---------------------------------------- |
| Connect Hall to 3.3V | Connect Hall to 5V        | Hall sensors require exactly 5V          |
| No common ground     | All GNDs connected        | Erratic behavior without common ground   |
| Thin wire for power  | 14-16 AWG for power       | Voltage drop, overheating                |
| No capacitor         | 1000μF at controller      | Electrical noise, unstable operation     |
| Both FWD & REV LOW   | One LOW, one HIGH         | Undefined state, possible damage         |
| Swap phases randomly | Yellow→U, Blue→V, Green→W | Motor may not start or reverse direction |

---

## Soldering Tips

### Permanent Installation Checklist

1. **Tin all wires before soldering**
   - Strip 1/4 inch insulation
   - Apply solder to stranded wire
   - Improves connection strength

2. **Heat shrink tubing**
   - Slide on BEFORE soldering
   - Use 2:1 or 3:1 ratio
   - Heat evenly for tight seal

3. **Strain relief**
   - Add hot glue at connector
   - Prevents wire from pulling loose
   - Especially important for motor wires

4. **Wire labeling**
   - Use label maker or tape
   - Mark both ends of wire
   - Critical for troubleshooting

---

## Quick Troubleshooting

```
┌──────────────────────────────────────────────────────────┐
│            QUICK TROUBLESHOOTING FLOWCHART               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Motor won't start?                                      │
│    ├─ Power LED OFF? → Check battery, fuse, VCC/GND     │
│    ├─ Power LED ON?  → Check connections below          │
│    └─ Hall Sensors:  → Measure +5V on Pin 6             │
│        └─ No 5V?     → Controller fault                  │
│        └─ Has 5V?    → Check motor Hall wires            │
│                                                          │
│  Motor jerks/stutters?                                   │
│    ├─ Hall sensor issue → Test each Ha, Hb, Hc          │
│    ├─ Loose connection → Check phase wires U, V, W      │
│    └─ Wrong motor     → Must be 120° type!              │
│                                                          │
│  No direction control?                                   │
│    ├─ Check FWD/REV pins connected                      │
│    ├─ Verify common ground                              │
│    └─ Test with multimeter (should see 0V when active)  │
│                                                          │
│  Speed control not working?                              │
│    ├─ Check PWM signal on Pin 5                         │
│    ├─ Verify jumper removed (if using external PWM)     │
│    └─ Test with oscilloscope if available               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Pin Quick Reference Table

| Pin # | Label | Function        | Arduino | Direction | Notes                     |
| ----- | ----- | --------------- | ------- | --------- | ------------------------- |
| 1     | GND   | Signal Ground   | GND     | Input     | Common with Pin 10        |
| 2     | FWD   | Forward Control | Pin 7   | Input     | Active LOW                |
| 3     | REV   | Reverse Control | Pin 8   | Input     | Active LOW                |
| 4     | BRK   | Brake           | Pin 6   | Input     | Active HIGH (optional)    |
| 5     | PWM   | Speed Control   | Pin 9   | Input     | 2.5-5V PWM or 0-5V analog |
| 6     | +5V   | 5V Output       | -       | Output    | Max ~100mA for signals    |
| 7     | Ha    | Hall Sensor A   | Motor   | Input     | 0-5V digital              |
| 8     | Hb    | Hall Sensor B   | Motor   | Input     | 0-5V digital              |
| 9     | Hc    | Hall Sensor C   | Motor   | Input     | 0-5V digital              |
| 10    | GND   | Hall Ground     | Motor   | -         | Common with Pin 1         |

---

**Print this document and keep it in your project binder!**

_For complete technical specifications, see `HARDWARE_SPECIFICATIONS.md`_
