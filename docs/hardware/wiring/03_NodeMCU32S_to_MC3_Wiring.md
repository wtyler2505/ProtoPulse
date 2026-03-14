# OmniTrek Nexus Wiring Diagram: NodeMCU 32S to Motor Controller 3

## Document Overview

This document provides detailed wiring instructions for connecting the NodeMCU 32S microcontroller to Motor Controller 3 (RioRand 350W BLDC Controller) in the OmniTrek Nexus rover system. Motor Controller 3 manages the rear-left wheel motor.

## Component Specifications

### NodeMCU 32S GPIO Allocation for MC3

Motor Controller 3 uses the third set of dedicated GPIO pins, controlling the rear-left wheel motor in coordination with the front motors.

**Pin Assignment for Motor Controller 3:**
- GPIO 16: PWM output for speed control (dedicated MC3)
- GPIO 17: Direction control signal (HIGH=forward, LOW=reverse)
- GPIO 18: Brake control signal (HIGH=brake engaged)
- GPIO 19: Hall sensor A input (with internal pullup available)
- GPIO 21: Hall sensor B input (with internal pullup available)
- GPIO 22: Hall sensor C input (with internal pullup available)

**GPIO Selection Rationale:**
- GPIO 16, 17 are RTC pins - available during sleep mode for emergency functions
- GPIO 18, 19, 21, 22 support internal pullups - simplifies Hall sensor circuit
- These pins are not used by SPI or I2C defaults

### RioRand 350W BLDC Motor Controller (MC3)

Motor Controller 3 is identical in specification to MC1 and MC2, managing the rear-left hoverboard motor.

**Position in 4WD System:**
- Rear-left wheel position
- Works in tandem with MC1 (front-left) for left-side traction
- Coordinated with MC4 (rear-right) for rear axle control

## Wiring Connections

### Signal Wiring (Low Voltage Control)

**PWM Speed Control Connection:**
1. Connect NodeMCU GPIO 16 to MC3 PWM input terminal
2. Use 22 AWG stranded wire, maximum length 12 inches
3. Add 100 ohm series resistor at NodeMCU end
4. Run parallel to MC1 PWM wire for neat routing

**Direction Control Connection:**
1. Connect NodeMCU GPIO 17 to MC3 DIR input terminal
2. Use 22 AWG stranded wire
3. Direction logic matches MC1 (both left-side motors)
4. Add 10K pulldown resistor for boot state

**Brake Control Connection:**
1. Connect NodeMCU GPIO 18 to MC3 BRK input terminal
2. Use 22 AWG stranded wire
3. Consider parallel connection with MC1 brake for left-side coordination

**Ground Reference:**
1. Connect NodeMCU GND to MC3 GND terminal
2. Use existing common ground point (star topology)
3. MC3 ground joins MC1, MC2, and NodeMCU at single point

### Hall Sensor Wiring

**Hall Sensor Power:**
1. Connect MC3 5V OUT to rear-left motor Hall sensor VCC
2. Connect MC3 GND to motor Hall sensor GND
3. Rear Hall sensor wires will be longer - use shielded cable

**Hall Sensor Signal Connections:**
1. Connect motor Hall-A to both:
   - MC3 HALL-A input
   - NodeMCU GPIO 19
2. Connect motor Hall-B to both:
   - MC3 HALL-B input
   - NodeMCU GPIO 21
3. Connect motor Hall-C to both:
   - MC3 HALL-C input
   - NodeMCU GPIO 22

**Internal Pullup Configuration:**
- GPIO 19, 21, 22 support INPUT_PULLUP mode
- External pullups optional but recommended for long wire runs
- Enable internal pullups in firmware: pinMode(19, INPUT_PULLUP)

## Wiring Diagram ASCII Representation

```
NodeMCU 32S                          RioRand 350W MC3
+-----------+                        +---------------+
|           |                        |               |
| GPIO 16 ●-|---[100Ω]-------------->| PWM/Speed     |
|           |                        |               |
| GPIO 17 ●-|----------------------->| DIR           |
|       |   |        10K             |               |
|       +---|---[====]---GND         |               |
|           |                        |               |
| GPIO 18 ●-|----------------------->| BRK           |
|           |                        |               |
| GPIO 19 ●-|<--+                    |               |
|  (pullup) |   |                    |               |     Rear-Left
|           |   +--------------------| HALL-A        |<---●  Motor
| GPIO 21 ●-|<--+                    |               |
|  (pullup) |   |                    |               |
|           |   +--------------------| HALL-B        |<---●  Hall-B
| GPIO 22 ●-|<--+                    |               |
|  (pullup) |   |                    |               |
|           |   +--------------------| HALL-C        |<---●  Hall-C
|           |                        |               |
|   GND ●---|------------------------| GND           |
|           |                        |               |
+-----------+                        | 5V OUT ●----->| Hall VCC
                                     |               |
                                     +---------------+

Wire Routing (Side View):
                     
    FRONT                                         REAR
    ┌─────┐                                     ┌─────┐
    │ MC1 │◄────── NodeMCU ──────────────────►  │ MC3 │
    │(FL) │         (center)                    │(RL) │
    └─────┘                                     └─────┘
       │                                           │
       ▼                                           ▼
    [Motor]                                     [Motor]
```

## Wire Specifications Table

| Connection | Wire Gauge | Wire Type | Max Length | Color Code |
|------------|------------|-----------|------------|------------|
| PWM Signal | 22 AWG | Stranded | 18 inches | Blue |
| DIR Signal | 22 AWG | Stranded | 18 inches | Purple |
| BRK Signal | 22 AWG | Stranded | 18 inches | Gray |
| Signal GND | 18 AWG | Stranded | 18 inches | Black |
| Hall-A | 22 AWG | Shielded | 30 inches | Yellow |
| Hall-B | 22 AWG | Shielded | 30 inches | Green |
| Hall-C | 22 AWG | Shielded | 30 inches | Blue |
| Hall VCC | 22 AWG | Stranded | 30 inches | Red |
| Hall GND | 22 AWG | Stranded | 30 inches | Black |

**Note:** Rear motor wiring requires longer cables - shielded cable essential for Hall sensors.

## 4WD Coordination: Left Side

### Tandem Control Philosophy

MC1 (front-left) and MC3 (rear-left) form the left side of the 4WD system and should generally operate in coordination.

**Synchronized Left-Side Operation:**
```
Straight Forward:
  MC1_PWM = MC3_PWM
  MC1_DIR = MC3_DIR = FORWARD

Straight Reverse:
  MC1_PWM = MC3_PWM
  MC1_DIR = MC3_DIR = REVERSE

Left Turn (wide):
  MC1_PWM = MC3_PWM = reduced (inner wheels slower)
  MC2_PWM = MC4_PWM = normal (outer wheels faster)

Right Turn (wide):
  MC1_PWM = MC3_PWM = normal (outer wheels faster)
  MC2_PWM = MC4_PWM = reduced (inner wheels slower)
```

### Independent Control Benefits

Despite coordination, independent GPIO control allows:
- Front/rear speed differential for weight distribution
- Individual brake control for stability
- Fault isolation if one controller fails
- Traction control on slippery surfaces

## Rear Motor Wiring Considerations

### Extended Wire Runs

Rear motors require longer cable runs from centrally-located NodeMCU:

**Signal Integrity for Long Runs:**
1. Use shielded cable for all Hall sensor connections
2. Add ferrite beads at controller input end
3. Consider signal boosters for PWM if run exceeds 24 inches
4. Twist signal and ground pairs to reduce interference

**EMI Mitigation:**
- Keep signal wires separate from motor phase wires
- Use conduit or cable management channels
- Ground shield at NodeMCU end only (single-point grounding)
- Add bypass capacitors at both ends of long runs

### Routing Path Recommendations

**Recommended Wire Path:**
1. Exit NodeMCU toward center of chassis
2. Run along chassis spine (center beam)
3. Branch off to left side near rear axle
4. Enter MC3 from inside of chassis

**Avoid:**
- Running parallel to motor phase wires
- Sharp bends that stress connections
- Heat sources (motor controllers, batteries)
- Moving parts or pinch points

## Firmware Configuration Notes

**NodeMCU PWM Setup for MC3:**
```
PWM Channel: 2 (MC1=0, MC2=1, MC3=2)
PWM Frequency: 20000 Hz (20kHz - synchronized with front)
PWM Resolution: 8-bit (0-255 duty cycle)
GPIO Assignment: 16

Direction Pin Mode: OUTPUT
Brake Pin Mode: OUTPUT
Hall Pins Mode: INPUT_PULLUP (internal pullups enabled)
```

**Left-Side Coordination Code Pattern:**
```
void setLeftSideSpeed(uint8_t speed, bool forward) {
    // Update both left-side motors atomically
    ledcWrite(PWM_CHANNEL_MC1, speed);
    ledcWrite(PWM_CHANNEL_MC3, speed);
    
    digitalWrite(DIR_MC1, forward);
    digitalWrite(DIR_MC3, forward);
}
```

## Left-Side Brake Coordination Option

For simplified left-side braking, MC1 and MC3 can share a brake signal:

```
Option A - Shared Brake (Recommended for basic use):
                     
    GPIO 27 ●────┬────► MC1 BRK (front-left)
                 │
                 └────► MC3 BRK (rear-left)

Option B - Independent Brakes (ABS-style control):

    GPIO 27 ●────────► MC1 BRK (front-left)
    GPIO 18 ●────────► MC3 BRK (rear-left)
```

**Independent brakes enable:**
- Anti-lock braking simulation
- Weight transfer compensation
- Diagnostic isolation
- Future traction control implementation

## Integration Checklist

### Verification Steps Before MC4

Before proceeding to Motor Controller 4 wiring:

- [ ] MC3 signal wires connected to correct GPIOs
- [ ] MC3 shares ground with MC1, MC2, and NodeMCU
- [ ] Rear-left motor Hall sensors powered and responding
- [ ] Internal pullups enabled on GPIO 19, 21, 22 in firmware
- [ ] Shielded cable used for Hall sensor runs
- [ ] Wire routing avoids motor phase cables
- [ ] MC1 and MC3 tested together - left side synchronized
- [ ] Ferrite beads installed on long signal runs
- [ ] All connections labeled with MC3 identifier
- [ ] Strain relief applied at both ends

### Three-Motor Test Procedure

With MC1, MC2, and MC3 wired:

1. Power all three controllers
2. Set all to minimum PWM (10%)
3. Command forward direction
4. Verify FL, FR, RL all spin correctly
5. Test left turn (reduce MC1 and MC3)
6. Test right turn (reduce MC2)
7. Test emergency brake on all three
8. Log RPM readings from all Hall sensors
