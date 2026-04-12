---
description: "Cheap brushed DC hobby motor for basic spinning projects — 3-5V, 130 can size, bidirectional with H-bridge. No position feedback, no speed control without external driver"
topics: ["[[actuators]]"]
status: needs-test
quantity: 3
voltage: [3, 5]
interfaces: [DC]
logic_level: "N/A"
manufacturer: "Generic"
part_number: "F130S"
dimensions_mm: "27.5 x 20 x 15 (130 can size)"
pinout: |
  2 solder tabs on rear:
    (+) → Positive terminal
    (-) → Negative terminal
  Swap polarity to reverse direction
compatible_with: ["[[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]", "[[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]", "[[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]]", "[[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]", "[[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]]"]
used_in: []
warnings: ["No built-in current limiting — stall current can reach 1A+ at 5V", "Do NOT drive directly from Arduino GPIO pins — use an H-bridge or MOSFET driver", "Brushes wear out over time — these are disposable motors, not precision equipment"]
datasheet_url: ""
---

# F130S Small DC Motor 3-5V 130 Can Size

The classic hobby motor you find in every Arduino starter kit. A small brushed DC motor in the standard 130 can size (~27.5mm long, 20mm diameter). Apply 3-5V and it spins. Reverse the polarity and it spins the other way. No Hall sensors, no encoder, no feedback of any kind — just raw rotary motion.

These are useful for learning motor control basics, powering small fans, vibration motors, or any project where you need something to spin and don't care about precision. For anything requiring speed control or position feedback, use a servo or stepper instead.

## Specifications

| Spec | Value |
|------|-------|
| Type | Brushed DC motor |
| Voltage Range | 3-5V DC (some tolerate up to 6V briefly) |
| No-Load Speed | ~6000-16000 RPM (voltage dependent) |
| No-Load Current | ~70-100mA |
| Stall Current | ~800mA-1.2A at 5V |
| Shaft Diameter | 2mm (D-shaped on some variants) |
| Can Size | 130 (27.5 x 20 x 15mm) |
| Weight | ~18g |
| Mounting | 2x M2 threaded holes on front face |

## Wiring Notes

**Never drive directly from a microcontroller GPIO pin.** These motors draw far more current than the 20mA an Arduino pin can provide. Even at no-load, 70-100mA will damage the pin. At stall, over 1A will definitely kill it.

**How to drive:**
1. **H-bridge driver** (like [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]) — gives you forward, reverse, brake, and PWM speed control from 2-3 Arduino pins
2. **Single MOSFET** — for on/off in one direction only. Gate to Arduino pin (with gate resistor), drain to motor, source to GND, flyback diode across motor terminals
3. **NPN transistor** (TIP120 or similar) — same as MOSFET approach but lower efficiency

**Always add a flyback diode** across the motor terminals (cathode to +, anode to -). Motors are inductive loads — when you switch them off, the collapsing magnetic field generates a voltage spike that can damage your driver circuit. A 1N4001 or 1N4148 across the terminals catches this spike.

## Warnings

- Stall current exceeds 800mA — size your driver and wiring accordingly
- No speed feedback — open loop only. Speed varies with load and battery voltage
- Brushes generate electrical noise — add a 100nF ceramic cap across the motor terminals to suppress EMI
- Shaft is press-fit — if it gets bent, the motor is done

---

Related Parts:
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] — H-bridge driver for bidirectional control (2A per channel, overkill but works)
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] — bare IC driver; 600mA limit is tight if motor stalls at 800mA+
- [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] — L293D shield; convenient but same 600mA limit risk at stall
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] — best shield choice for this motor; 1.2A handles stall current, MOSFET driver runs cool
- [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]] — L298N shield; 2A per channel with servo headers, but less efficient

Categories:
- [[actuators]]
