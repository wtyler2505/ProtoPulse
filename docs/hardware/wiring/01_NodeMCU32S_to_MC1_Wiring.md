# OmniTrek Nexus Wiring Diagram: NodeMCU 32S to Motor Controller 1

## Document Overview

This document provides detailed wiring instructions for connecting the NodeMCU 32S microcontroller to Motor Controller 1 (RioRand 350W BLDC Controller) in the OmniTrek Nexus rover system. Motor Controller 1 manages the front-left wheel motor.

## Component Specifications

### NodeMCU 32S (ESP32-WROOM-32)

The NodeMCU 32S serves as the primary wireless control interface, featuring dual-core processing and built-in WiFi/Bluetooth connectivity.

**Key Electrical Characteristics:**
- Operating voltage: 3.3V logic level
- GPIO pins: 25 available for general use
- PWM capable pins: All GPIO pins support PWM
- ADC pins: 18 channels with 12-bit resolution
- Maximum current per GPIO: 40mA (12mA recommended)
- Operating temperature: -40°C to 85°C

**Pin Assignment for Motor Controller 1:**
- GPIO 25: PWM output for speed control (dedicated MC1)
- GPIO 26: Direction control signal (HIGH=forward, LOW=reverse)
- GPIO 27: Brake control signal (HIGH=brake engaged)
- GPIO 32: Hall sensor A input (interrupt capable)
- GPIO 33: Hall sensor B input (interrupt capable)
- GPIO 34: Hall sensor C input (input only, no pullup)

### RioRand 350W BLDC Motor Controller

The RioRand 350W controller is a brushless DC motor controller designed for electric vehicle applications, commonly used with hoverboard motors.

**Key Electrical Characteristics:**
- Operating voltage: 24V-36V DC
- Maximum continuous current: 20A
- Peak current: 30A (short duration)
- PWM input frequency: 15kHz-25kHz optimal
- Logic input voltage: 3.3V-5V compatible
- Built-in regenerative braking
- Hall sensor compatible

**Controller Input Terminals:**
- PWM/Speed: Analog 0-5V or PWM signal input
- DIR: Direction control (HIGH/LOW logic)
- BRK: Brake enable (active HIGH)
- GND: Common ground reference
- HALL-A, HALL-B, HALL-C: Hall sensor inputs from motor
- 5V OUT: 5V reference output for Hall sensors

## Wiring Connections

### Signal Wiring (Low Voltage Control)

**PWM Speed Control Connection:**
1. Connect NodeMCU GPIO 25 to MC1 PWM input terminal
2. Use 22 AWG stranded wire, maximum length 12 inches
3. Add 100 ohm series resistor at NodeMCU end for protection
4. Route away from high-current motor phase wires

**Direction Control Connection:**
1. Connect NodeMCU GPIO 26 to MC1 DIR input terminal
2. Use 22 AWG stranded wire
3. HIGH signal = forward rotation, LOW signal = reverse rotation
4. Add 10K pulldown resistor to ensure defined state at boot

**Brake Control Connection:**
1. Connect NodeMCU GPIO 27 to MC1 BRK input terminal
2. Use 22 AWG stranded wire
3. HIGH signal = brake engaged (motor coasting disabled)
4. Critical safety connection - verify functionality before operation

**Ground Reference:**
1. Connect NodeMCU GND to MC1 GND terminal
2. Use 18 AWG wire for robust ground connection
3. Star ground topology recommended - single point ground reference
4. This ground connection is critical for signal integrity

### Hall Sensor Wiring

**Hall Sensor Power:**
1. Connect MC1 5V OUT to motor Hall sensor VCC (red wire)
2. Connect MC1 GND to motor Hall sensor GND (black wire)
3. Do not power Hall sensors from NodeMCU 3.3V rail

**Hall Sensor Signal Connections:**
1. Connect motor Hall-A (typically yellow) to both:
   - MC1 HALL-A input (for motor commutation)
   - NodeMCU GPIO 32 (for RPM feedback to control system)
2. Connect motor Hall-B (typically green) to both:
   - MC1 HALL-B input
   - NodeMCU GPIO 33
3. Connect motor Hall-C (typically blue) to both:
   - MC1 HALL-C input
   - NodeMCU GPIO 34

**Hall Sensor Signal Conditioning:**
- Add 4.7K pullup resistors to 3.3V on NodeMCU Hall inputs
- Add 100pF ceramic capacitors to GND for noise filtering
- Use shielded cable if motor is more than 18 inches from controller

## Wiring Diagram ASCII Representation

```
NodeMCU 32S                          RioRand 350W MC1
+-----------+                        +---------------+
|           |                        |               |
| GPIO 25 ●-|---[100Ω]-------------->| PWM/Speed     |
|           |                        |               |
| GPIO 26 ●-|----------------------->| DIR           |
|       |   |        10K             |               |
|       +---|---[====]---GND         |               |
|           |                        |               |
| GPIO 27 ●-|----------------------->| BRK           |
|           |                        |               |
| GPIO 32 ●-|<--+                    |               |
|       |   |   |   [4.7K to 3.3V]   |               |
|       +---+   |                    |               |
|           |   +--------------------| HALL-A        |<---Motor Hall-A
| GPIO 33 ●-|<--+                    |               |
|       |   |   |   [4.7K to 3.3V]   |               |
|       +---+   |                    |               |
|           |   +--------------------| HALL-B        |<---Motor Hall-B
| GPIO 34 ●-|<--+                    |               |
|       |   |   |   [4.7K to 3.3V]   |               |
|       +---+   |                    |               |
|           |   +--------------------| HALL-C        |<---Motor Hall-C
|           |                        |               |
|   GND ●---|------------------------| GND           |
|           |                        |               |
+-----------+                        | 5V OUT ●----->| Hall Sensor VCC
                                     |               |
                                     +---------------+
```

## Wire Specifications Table

| Connection | Wire Gauge | Wire Type | Max Length | Color Code |
|------------|------------|-----------|------------|------------|
| PWM Signal | 22 AWG | Stranded | 12 inches | Yellow |
| DIR Signal | 22 AWG | Stranded | 12 inches | Orange |
| BRK Signal | 22 AWG | Stranded | 12 inches | White |
| Signal GND | 18 AWG | Stranded | 12 inches | Black |
| Hall-A | 22 AWG | Shielded | 24 inches | Yellow |
| Hall-B | 22 AWG | Shielded | 24 inches | Green |
| Hall-C | 22 AWG | Shielded | 24 inches | Blue |
| Hall VCC | 22 AWG | Stranded | 24 inches | Red |
| Hall GND | 22 AWG | Stranded | 24 inches | Black |

## Safety Considerations

**Before Powering System:**
1. Verify all connections with multimeter in continuity mode
2. Check for short circuits between power and ground
3. Confirm polarity of all connections
4. Ensure motor is secured and cannot move unexpectedly
5. Have emergency stop readily accessible

**During Initial Testing:**
1. Power controller first, then NodeMCU
2. Start with minimum PWM duty cycle (10%)
3. Test brake function before increasing speed
4. Monitor controller temperature
5. Listen for unusual motor sounds

**Critical Warnings:**
- Never disconnect Hall sensors while motor is spinning
- Never reverse direction at high speed without stopping first
- Controller can regenerate voltage - ensure battery can absorb
- Keep hands and clothing away from rotating motor shaft

## Troubleshooting Guide

**Motor Does Not Spin:**
- Verify PWM signal with oscilloscope or logic analyzer
- Check Hall sensor connections and 5V power
- Confirm direction signal is at valid logic level
- Ensure brake signal is LOW (brake disengaged)

**Motor Spins Erratically:**
- Hall sensor order may be incorrect - try swapping pairs
- Add filtering capacitors to Hall sensor lines
- Check for loose connections causing intermittent contact
- Verify PWM frequency is within 15-25kHz range

**Motor Only Spins One Direction:**
- Verify direction pin is properly connected
- Check for stuck logic level on DIR input
- Confirm NodeMCU GPIO is configured as output

**Controller Overheating:**
- Reduce PWM frequency if above 25kHz
- Check for phase wire short circuits
- Ensure adequate airflow to controller
- Reduce load or current limit settings

## Firmware Configuration Notes

**NodeMCU PWM Setup for MC1:**
```
PWM Channel: 0
PWM Frequency: 20000 Hz (20kHz)
PWM Resolution: 8-bit (0-255 duty cycle)
GPIO Assignment: 25

Direction Pin Mode: OUTPUT
Brake Pin Mode: OUTPUT
Hall Pins Mode: INPUT_PULLUP with interrupts
```

**Hall Sensor Interrupt Configuration:**
- Configure GPIO 32, 33, 34 as interrupt pins
- Trigger on CHANGE (both rising and falling edges)
- Use ISR for RPM calculation
- Debounce in software: 1-2ms minimum between transitions

## Integration Checklist

Before proceeding to Motor Controller 2 wiring:

- [ ] All signal wires connected and verified
- [ ] Ground connection established
- [ ] Hall sensors receiving 5V power
- [ ] All pullup/pulldown resistors installed
- [ ] Filtering capacitors installed on Hall lines
- [ ] Connections tested with multimeter
- [ ] No visible damage or frayed wires
- [ ] Wire routing avoids pinch points
- [ ] Strain relief applied to all connections
- [ ] Documentation updated with actual wire colors used
