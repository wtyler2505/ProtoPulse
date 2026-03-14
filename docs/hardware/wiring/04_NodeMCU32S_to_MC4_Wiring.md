# OmniTrek Nexus Wiring Diagram: NodeMCU 32S to Motor Controller 4

## Document Overview

This document provides detailed wiring instructions for connecting the NodeMCU 32S microcontroller to Motor Controller 4 (RioRand 350W BLDC Controller) in the OmniTrek Nexus rover system. Motor Controller 4 manages the rear-right wheel motor, completing the 4WD system.

## Component Specifications

### NodeMCU 32S GPIO Allocation for MC4

Motor Controller 4 uses the final set of dedicated GPIO pins. With MC4 wired, all four motors are under independent microcontroller control.

**Pin Assignment for Motor Controller 4:**
- GPIO 23: PWM output for speed control (dedicated MC4)
- GPIO 4: Direction control signal (HIGH=forward, LOW=reverse)
- GPIO 5: Brake control signal (HIGH=brake engaged)
- GPIO 2: Hall sensor A input (has onboard LED - use with caution)
- GPIO 15: Hall sensor B input (strapping pin - external pulldown)
- GPIO 0: Hall sensor C input (strapping pin - boot mode sensitive)

**GPIO Selection Notes:**
- GPIO 23 is a reliable output pin with no boot restrictions
- GPIO 4, 5 are standard I/O with no special functions
- GPIO 0, 2, 15 are strapping pins - require special handling

### Strapping Pin Precautions

**GPIO 0 (Hall-C Input):**
- Must be HIGH during boot for normal operation
- If pulled LOW at boot, enters programming mode
- Use 10K pullup resistor and boot before connecting motor

**GPIO 2 (Hall-A Input):**
- Connected to onboard blue LED
- Must be floating or HIGH during boot
- LED may flicker during Hall sensor transitions

**GPIO 15 (Hall-B Input):**
- Must be LOW during boot
- Use 10K pulldown resistor
- External pullup for Hall sensor creates conflict - use buffer IC

### Recommended GPIO 15 Buffer Circuit

To resolve the GPIO 15 boot requirement with Hall sensor needs:

```
Motor Hall-B ──┬──► MC4 HALL-B Input (direct)
               │
               └──► [74HC14 Schmitt Trigger] ──► GPIO 15
                         │
                         └── 10K to GND (maintains boot LOW)
```

**Alternative: Use Different GPIO**

If available, substitute GPIO 15 with any unused general GPIO to avoid strapping issues entirely.

## Wiring Connections

### Signal Wiring (Low Voltage Control)

**PWM Speed Control Connection:**
1. Connect NodeMCU GPIO 23 to MC4 PWM input terminal
2. Use 22 AWG stranded wire, maximum length 18 inches
3. Add 100 ohm series resistor at NodeMCU end
4. Route parallel to MC2 PWM for right-side organization

**Direction Control Connection:**
1. Connect NodeMCU GPIO 4 to MC4 DIR input terminal
2. Use 22 AWG stranded wire
3. Direction logic matches MC2 (software inversion for right-side motors)
4. Add 10K pulldown resistor for defined boot state

**Brake Control Connection:**
1. Connect NodeMCU GPIO 5 to MC4 BRK input terminal
2. Use 22 AWG stranded wire
3. Consider parallel connection with MC2 brake for right-side coordination

**Ground Reference:**
1. Connect NodeMCU GND to MC4 GND terminal
2. Use existing common ground point (star topology)
3. MC4 is the fourth controller on the shared ground network

### Hall Sensor Wiring

**Hall Sensor Power:**
1. Connect MC4 5V OUT to rear-right motor Hall sensor VCC
2. Connect MC4 GND to motor Hall sensor GND
3. Use shielded cable for rear motor Hall sensors

**Hall Sensor Signal Connections (with strapping considerations):**

**Option A - Direct Connection (may cause boot issues):**
1. Hall-A to GPIO 2 (with 10K pullup)
2. Hall-B to GPIO 15 (boot conflict - not recommended)
3. Hall-C to GPIO 0 (with 10K pullup)

**Option B - Buffered Connection (Recommended):**
1. Hall-A direct to MC4 HALL-A; buffered to GPIO 2
2. Hall-B direct to MC4 HALL-B; buffered to GPIO 15
3. Hall-C direct to MC4 HALL-C; buffered to GPIO 0

**Option C - Alternative GPIO Assignment:**
Use any remaining unused GPIO pins for Hall feedback:
- If SPI not used: GPIO 38 for Hall-A
- If UART2 not used: GPIO 16/17 (but MC3 uses these)
- Best: Re-evaluate entire GPIO allocation if strapping pins cause issues

## Wiring Diagram ASCII Representation

```
NodeMCU 32S                          RioRand 350W MC4
+-----------+                        +---------------+
|           |                        |               |
| GPIO 23 ●-|---[100Ω]-------------->| PWM/Speed     |
|           |                        |               |
| GPIO 4  ●-|----------------------->| DIR           |
|       |   |        10K             |               |
|       +---|---[====]---GND         |               |
|           |                        |               |
| GPIO 5  ●-|----------------------->| BRK           |
|           |                        |               |
| GPIO 2  ●-|<--[Buffer]<--+---------| HALL-A        |<---●  Rear-Right
|           |              |         |               |       Motor
|           |              |         |               |
| GPIO 15 ●-|<--[Buffer]<--+---------| HALL-B        |<---●  Hall-B
|           |       ▼      |         |               |
|           |    [10K GND] |         |               |
|           |              |         |               |
| GPIO 0  ●-|<--[Buffer]<--+---------| HALL-C        |<---●  Hall-C
|       |   |              |         |               |
|       +---|---[10K]---3.3V         |               |
|           |                        |               |
|   GND ●---|------------------------| GND           |
|           |                        |               |
+-----------+                        | 5V OUT ●----->| Hall VCC
                                     |               |
                                     +---------------+

Buffer IC (74HC14):
                  ┌─────────────┐
Hall-A ──────────►│ 1A      1Y  │──────────► GPIO 2
Hall-B ──────────►│ 2A      2Y  │──────────► GPIO 15
Hall-C ──────────►│ 3A      3Y  │──────────► GPIO 0
                  │     VCC     │◄── 3.3V
                  │     GND     │◄── GND
                  └─────────────┘
```

## Wire Specifications Table

| Connection | Wire Gauge | Wire Type | Max Length | Color Code |
|------------|------------|-----------|------------|------------|
| PWM Signal | 22 AWG | Stranded | 18 inches | Blue w/stripe |
| DIR Signal | 22 AWG | Stranded | 18 inches | Purple w/stripe |
| BRK Signal | 22 AWG | Stranded | 18 inches | Gray w/stripe |
| Signal GND | 18 AWG | Stranded | 18 inches | Black |
| Hall-A | 22 AWG | Shielded | 30 inches | Yellow |
| Hall-B | 22 AWG | Shielded | 30 inches | Green |
| Hall-C | 22 AWG | Shielded | 30 inches | Blue |
| Hall VCC | 22 AWG | Stranded | 30 inches | Red |
| Hall GND | 22 AWG | Stranded | 30 inches | Black |

**Color Coding:** MC4 signal wires use striped blue/purple/gray variants to distinguish from MC3 solid rear wiring.

## 4WD Coordination: Right Side

### Tandem Control Philosophy

MC2 (front-right) and MC4 (rear-right) form the right side of the 4WD system.

**Synchronized Right-Side Operation:**
```
Straight Forward:
  MC2_PWM = MC4_PWM
  MC2_DIR = MC4_DIR = FORWARD (software inverted from left)

Straight Reverse:
  MC2_PWM = MC4_PWM
  MC2_DIR = MC4_DIR = REVERSE (software inverted from left)

Right Side as Outer Wheels (left turn):
  MC2_PWM = MC4_PWM = 100% (full speed)
  MC1_PWM = MC3_PWM = reduced (inner wheels)

Right Side as Inner Wheels (right turn):
  MC2_PWM = MC4_PWM = reduced (inner wheels)
  MC1_PWM = MC3_PWM = 100% (outer wheels)
```

### Complete 4WD GPIO Map

With all four motor controllers connected:

```
Motor Controller GPIO Assignment Summary:
─────────────────────────────────────────
Controller │ PWM    │ DIR    │ BRK    │ Hall-A │ Hall-B │ Hall-C
───────────┼────────┼────────┼────────┼────────┼────────┼────────
MC1 (FL)   │ GPIO25 │ GPIO26 │ GPIO27 │ GPIO32 │ GPIO33 │ GPIO34
MC2 (FR)   │ GPIO14 │ GPIO12 │ GPIO13 │ GPIO35 │ GPIO36 │ GPIO39
MC3 (RL)   │ GPIO16 │ GPIO17 │ GPIO18 │ GPIO19 │ GPIO21 │ GPIO22
MC4 (RR)   │ GPIO23 │ GPIO4  │ GPIO5  │ GPIO2* │ GPIO15*│ GPIO0*
───────────┴────────┴────────┴────────┴────────┴────────┴────────
* Strapping pins - require buffer IC or special boot sequence
```

## Firmware Configuration Notes

**NodeMCU PWM Setup for MC4:**
```
PWM Channel: 3 (MC1=0, MC2=1, MC3=2, MC4=3)
PWM Frequency: 20000 Hz (20kHz - synchronized across all)
PWM Resolution: 8-bit (0-255 duty cycle)
GPIO Assignment: 23

Direction Pin Mode: OUTPUT
Brake Pin Mode: OUTPUT
Hall Pins Mode: INPUT (after boot sequence)
```

**Boot Sequence for Strapping Pins:**
```
void setup() {
    // 1. Do NOT configure GPIO 0, 2, 15 immediately
    
    // 2. Initialize all other GPIOs first
    pinMode(23, OUTPUT);  // MC4 PWM
    pinMode(4, OUTPUT);   // MC4 DIR
    pinMode(5, OUTPUT);   // MC4 BRK
    
    // 3. Small delay to ensure boot mode locked
    delay(100);
    
    // 4. Now safe to configure strapping pins
    pinMode(2, INPUT);   // Hall-A (LED may flicker)
    pinMode(15, INPUT);  // Hall-B
    pinMode(0, INPUT);   // Hall-C
}
```

**Right-Side Coordination Code Pattern:**
```
void setRightSideSpeed(uint8_t speed, bool forward) {
    // Update both right-side motors atomically
    ledcWrite(PWM_CHANNEL_MC2, speed);
    ledcWrite(PWM_CHANNEL_MC4, speed);
    
    // Invert direction for right-side motors
    digitalWrite(DIR_MC2, !forward);
    digitalWrite(DIR_MC4, !forward);
}
```

## Right-Side Brake Coordination Option

For simplified right-side braking:

```
Option A - Shared Brake (matches left side):
                     
    GPIO 13 ●────┬────► MC2 BRK (front-right)
                 │
                 └────► MC4 BRK (rear-right)

Option B - All-Vehicle Brake (single GPIO):

    GPIO 27 ●────┬────► MC1 BRK
                 ├────► MC2 BRK
                 ├────► MC3 BRK
                 └────► MC4 BRK
```

**Full Independent Control (Maximum Flexibility):**
```
GPIO 27 ●────► MC1 BRK (FL)
GPIO 13 ●────► MC2 BRK (FR)
GPIO 18 ●────► MC3 BRK (RL)
GPIO 5  ●────► MC4 BRK (RR)
```

## Integration Checklist

### Final Verification Steps

With all four motor controllers wired:

**Electrical Verification:**
- [ ] MC4 signal wires connected to correct GPIOs
- [ ] MC4 shares ground with all other controllers and NodeMCU
- [ ] Rear-right motor Hall sensors powered and responding
- [ ] Buffer IC installed for strapping pin protection
- [ ] All four controllers show proper ground continuity
- [ ] No short circuits between any signal and power lines

**Functional Verification:**
- [ ] All four motors spin when commanded
- [ ] Forward direction consistent across all motors
- [ ] Reverse direction consistent across all motors
- [ ] Left turn reduces left-side motor speeds
- [ ] Right turn reduces right-side motor speeds
- [ ] Emergency brake stops all four motors
- [ ] Hall sensors reporting valid RPM on all channels

**Documentation:**
- [ ] All wires labeled at both ends
- [ ] GPIO assignment table updated with actual connections
- [ ] Any deviations from specification noted
- [ ] Strapping pin handling documented
- [ ] Buffer IC wiring diagram attached

## Complete 4WD Test Procedure

### System Integration Test

With all four motors connected and wired:

**Test 1: Individual Motor Control**
1. Command each motor individually at 10% PWM
2. Verify correct rotation direction
3. Record Hall sensor readings
4. Confirm brake function

**Test 2: Side-Pair Coordination**
1. Command left side (MC1 + MC3) forward
2. Verify synchronized rotation
3. Repeat for right side (MC2 + MC4)

**Test 3: Full 4WD Forward/Reverse**
1. Command all four motors forward
2. Verify all spin in coordinated direction
3. Command reverse and verify

**Test 4: Differential Steering**
1. Left turn: Reduce MC1/MC3, maintain MC2/MC4
2. Right turn: Reduce MC2/MC4, maintain MC1/MC3
3. Spin left: MC1/MC3 reverse, MC2/MC4 forward
4. Spin right: MC1/MC3 forward, MC2/MC4 reverse

**Test 5: Emergency Scenarios**
1. Full speed forward, then emergency brake
2. Verify all motors stop simultaneously
3. Test individual brake control if independently wired
4. Simulate single motor failure (disconnect Hall)

### Pass Criteria

- All motors respond within 50ms of command
- RPM difference between paired motors < 5%
- Brake stops all motors within 0.5 seconds
- No unexpected behavior on any input combination
- Controller temperatures stable under load
