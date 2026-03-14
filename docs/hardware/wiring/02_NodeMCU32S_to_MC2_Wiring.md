# OmniTrek Nexus Wiring Diagram: NodeMCU 32S to Motor Controller 2

## Document Overview

This document provides detailed wiring instructions for connecting the NodeMCU 32S microcontroller to Motor Controller 2 (RioRand 350W BLDC Controller) in the OmniTrek Nexus rover system. Motor Controller 2 manages the front-right wheel motor.

## Component Specifications

### NodeMCU 32S GPIO Allocation for MC2

The NodeMCU 32S has sufficient GPIO pins to independently control all four motor controllers. Motor Controller 2 uses a dedicated set of pins separate from Motor Controller 1.

**Pin Assignment for Motor Controller 2:**
- GPIO 14: PWM output for speed control (dedicated MC2)
- GPIO 12: Direction control signal (HIGH=forward, LOW=reverse)
- GPIO 13: Brake control signal (HIGH=brake engaged)
- GPIO 35: Hall sensor A input (input only, ADC capable)
- GPIO 36: Hall sensor B input (input only, VP)
- GPIO 39: Hall sensor C input (input only, VN)

**Important GPIO Notes:**
- GPIO 35, 36, 39 are input-only pins on ESP32
- These pins do not have internal pullups - external pullups required
- Located on separate ADC2 unit - not affected by WiFi operation

### RioRand 350W BLDC Motor Controller (MC2)

Motor Controller 2 is identical in specification to MC1, managing the front-right hoverboard motor.

**Functional Differences from MC1:**
- Controls front-right wheel (mirrored from front-left)
- Direction logic may need software inversion for coordinated turning
- Independent PWM allows differential steering

## Wiring Connections

### Signal Wiring (Low Voltage Control)

**PWM Speed Control Connection:**
1. Connect NodeMCU GPIO 14 to MC2 PWM input terminal
2. Use 22 AWG stranded wire, maximum length 12 inches
3. Add 100 ohm series resistor at NodeMCU end for protection
4. Label wire clearly to distinguish from MC1 PWM

**Direction Control Connection:**
1. Connect NodeMCU GPIO 12 to MC2 DIR input terminal
2. Use 22 AWG stranded wire
3. Note: Direction may be logically inverted in software for right-side motors
4. Add 10K pulldown resistor to ensure defined state at boot

**Brake Control Connection:**
1. Connect NodeMCU GPIO 13 to MC2 BRK input terminal
2. Use 22 AWG stranded wire
3. Brake signals typically synchronized across all motors
4. Consider wiring brake lines in parallel from single GPIO for coordinated braking

**Ground Reference:**
1. Connect NodeMCU GND to MC2 GND terminal
2. Use same ground reference point as MC1 (star topology)
3. All motor controllers share common ground with NodeMCU
4. Critical for signal integrity across all controllers

### Hall Sensor Wiring

**Hall Sensor Power:**
1. Connect MC2 5V OUT to front-right motor Hall sensor VCC
2. Connect MC2 GND to motor Hall sensor GND
3. Each motor controller powers its own motor's Hall sensors

**Hall Sensor Signal Connections:**
1. Connect motor Hall-A (typically yellow) to both:
   - MC2 HALL-A input (for motor commutation)
   - NodeMCU GPIO 35 (for RPM feedback)
2. Connect motor Hall-B (typically green) to both:
   - MC2 HALL-B input
   - NodeMCU GPIO 36
3. Connect motor Hall-C (typically blue) to both:
   - MC2 HALL-C input
   - NodeMCU GPIO 39

**External Pullup Requirements (GPIO 35, 36, 39):**
- These pins lack internal pullups - external 4.7K to 3.3V required
- Install pullups physically close to NodeMCU pins
- Add 100pF bypass capacitors for noise immunity

## Wiring Diagram ASCII Representation

```
NodeMCU 32S                          RioRand 350W MC2
+-----------+                        +---------------+
|           |                        |               |
| GPIO 14 ●-|---[100Ω]-------------->| PWM/Speed     |
|           |                        |               |
| GPIO 12 ●-|----------------------->| DIR           |
|       |   |        10K             |               |
|       +---|---[====]---GND         |               |
|           |                        |               |
| GPIO 13 ●-|----------------------->| BRK           |
|           |                        |               |
| GPIO 35 ●-|<--+                    |               |
|       |   |   |   [4.7K to 3.3V]   |               |     Front-Right
|       +---+   |   [100pF to GND]   |               |       Motor
|           |   +--------------------| HALL-A        |<---●  Hall-A
| GPIO 36 ●-|<--+                    |               |
|       |   |   |   [4.7K to 3.3V]   |               |
|       +---+   |   [100pF to GND]   |               |
|           |   +--------------------| HALL-B        |<---●  Hall-B
| GPIO 39 ●-|<--+                    |               |
|       |   |   |   [4.7K to 3.3V]   |               |
|       +---+   |   [100pF to GND]   |               |
|           |   +--------------------| HALL-C        |<---●  Hall-C
|           |                        |               |
|   GND ●---|------------------------| GND           |
|           |                        |               |
+-----------+                        | 5V OUT ●----->| Hall VCC
                                     |               |
                                     +---------------+
```

## Wire Specifications Table

| Connection | Wire Gauge | Wire Type | Max Length | Color Code |
|------------|------------|-----------|------------|------------|
| PWM Signal | 22 AWG | Stranded | 12 inches | Yellow w/stripe |
| DIR Signal | 22 AWG | Stranded | 12 inches | Orange w/stripe |
| BRK Signal | 22 AWG | Stranded | 12 inches | White w/stripe |
| Signal GND | 18 AWG | Stranded | 12 inches | Black |
| Hall-A | 22 AWG | Shielded | 24 inches | Yellow |
| Hall-B | 22 AWG | Shielded | 24 inches | Green |
| Hall-C | 22 AWG | Shielded | 24 inches | Blue |
| Hall VCC | 22 AWG | Stranded | 24 inches | Red |
| Hall GND | 22 AWG | Stranded | 24 inches | Black |

**Color Coding Note:** MC2 signal wires use striped variants to distinguish from MC1 solid colors.

## Differential Steering Considerations

### Software Direction Inversion

The front-right motor (MC2) spins in the opposite physical direction from front-left (MC1) when both receive the same direction signal, due to mirror mounting.

**Implementation Options:**

**Option A - Hardware Swap:**
Swap any two of the three motor phase wires at MC2 to reverse rotation direction.

**Option B - Software Inversion:**
Invert the direction signal in firmware for MC2:
```
MC2_DIR = !MC1_DIR (for straight-line travel)
MC2_DIR = MC1_DIR (for spin-in-place turning)
```

**Option C - Hall Sensor Reordering:**
Swap Hall-A and Hall-C at the controller to reverse commutation sequence.

**Recommended:** Option B (software inversion) provides maximum flexibility for steering algorithms.

### Coordinated PWM for Turning

**Straight Line Travel:**
- MC1 PWM = MC2 PWM (equal speeds)
- MC1 DIR = forward, MC2 DIR = forward (with software inversion)

**Gradual Turn Right:**
- MC1 PWM = 100% (outer wheel faster)
- MC2 PWM = 50-80% (inner wheel slower)

**Gradual Turn Left:**
- MC1 PWM = 50-80% (inner wheel slower)
- MC2 PWM = 100% (outer wheel faster)

**Spin in Place (Pivot Turn):**
- MC1 DIR = forward, MC2 DIR = reverse
- MC1 PWM = MC2 PWM (equal speeds, opposite directions)

## Firmware Configuration Notes

**NodeMCU PWM Setup for MC2:**
```
PWM Channel: 1 (different from MC1 channel 0)
PWM Frequency: 20000 Hz (20kHz - match MC1)
PWM Resolution: 8-bit (0-255 duty cycle)
GPIO Assignment: 14

Direction Pin Mode: OUTPUT
Brake Pin Mode: OUTPUT (can share with MC1 for coordinated braking)
Hall Pins Mode: INPUT (external pullups required)
```

**Hall Sensor Interrupt Configuration:**
- GPIO 35, 36, 39 require external pull-ups
- Configure interrupts on CHANGE
- Separate RPM counter variable for MC2
- Compare MC1 and MC2 RPM for slip detection

## Parallel Brake Wiring Option

For simplified braking control, MC1 and MC2 brake inputs can share a single GPIO:

```
                     GPIO 27 ●---+----> MC1 BRK
                                 |
                                 +----> MC2 BRK

Or with GPIO 13 for MC2 independent control:
                     GPIO 27 ●-------> MC1 BRK
                     GPIO 13 ●-------> MC2 BRK
```

**Recommendation:** Keep independent brake control (separate GPIOs) initially for testing, then optionally consolidate for production.

## Integration with MC1

### Shared Resources

**Common Ground:**
MC1 GND and MC2 GND must connect to same NodeMCU GND pin using star topology.

**Power Supply:**
Both controllers draw from same 36V battery bank - ensure adequate wire gauge.

**Communication Timing:**
Update both PWM channels in same timer interrupt for synchronized motor control.

### Verification Checklist Before MC3

Before proceeding to Motor Controller 3 wiring:

- [ ] MC2 signal wires connected and verified
- [ ] MC2 ground connected to common ground point
- [ ] MC2 Hall sensors receiving 5V and responding
- [ ] External pullups installed on GPIO 35, 36, 39
- [ ] Filtering capacitors installed on MC2 Hall lines
- [ ] Direction inversion method chosen and documented
- [ ] MC1 and MC2 tested together - straight line achieved
- [ ] Differential steering tested - rover turns correctly
- [ ] Both controllers share common ground verified
- [ ] Wire routing complete with labels on all connections
