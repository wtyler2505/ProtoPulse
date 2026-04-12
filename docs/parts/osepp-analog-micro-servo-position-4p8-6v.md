---
description: "Micro-size position servo for lightweight pointing and pivoting — approximately 180-degree range, PWM angle control from a single pin. Ideal for pan/tilt, sensor aiming, small linkages"
topics: ["[[actuators]]"]
status: needs-test
quantity: 1
voltage: [4.8, 6]
interfaces: [PWM]
logic_level: "5V"
manufacturer: "OSEPP"
pinout: |
  3-wire servo cable:
    Brown/Black → GND
    Red         → VCC (4.8-6V)
    Orange/White → PWM signal (from MCU)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["Do NOT power from Arduino 5V pin under load — use external supply for reliable operation", "Do NOT force the horn past mechanical stops — strips the gears instantly", "Micro servos have limited torque — not for heavy loads"]
datasheet_url: ""
---

# OSEPP Analog Micro Servo Position 4.8-6V

A micro-size analog position servo — the kind you use for pan/tilt mechanisms, sensor aiming, lightweight linkages, and anything that needs to point at a specific angle. Send a PWM pulse width and the servo moves to the corresponding position (typically 0-180 degrees). The internal feedback potentiometer holds position against external forces.

Micro servos are small and light (~9g) but correspondingly weak. They're perfect for moving sensors, cameras, or small mechanisms. Don't ask them to lift anything heavy — that's what standard or high-torque servos are for.

## Probable Rebranded SG90

This OSEPP servo is almost certainly a rebranded **TowerPro SG90** (or compatible clone). The dimensions, weight, specs, and connector are identical to the SG90 — OSEPP just puts their label on it. This means all SG90-compatible brackets, horns, 3D-printed mounts, and code examples work directly.

**SG90-equivalent specs for reference:**

| Spec | Value |
|------|-------|
| Torque | 1.8 kg-cm (at 4.8V) |
| Weight | 9g |
| Speed | 0.12 sec/60 degrees (at 4.8V) |
| Gear material | Nylon (plastic) |
| Spline | 21-tooth, fits standard micro servo horns |
| Pulse range | 500-2400us (broader than spec'd 1000-2000us on some) |

If you need metal gears for durability, the **MG90S** is the drop-in upgrade — same footprint and connector, metal gears, slightly heavier (13.4g) and more torque (2.2 kg-cm).

## Specifications

| Spec | Value |
|------|-------|
| Type | Analog position servo (micro size) |
| Rotation Range | ~180 degrees |
| Operating Voltage | 4.8-6V |
| Control Signal | Standard servo PWM (50Hz, 1-2ms pulse) |
| Stall Torque | ~1.5 kg-cm at 4.8V, ~1.8 kg-cm at 6V |
| Transit Speed | ~0.10 sec/60 degrees at 4.8V |
| Dimensions | ~23 x 12 x 29mm |
| Weight | ~9g |
| Gear Type | Nylon/plastic |
| Connector | 3-pin JR/Futaba compatible |

## Control with Arduino

```cpp
#include <Servo.h>

Servo microServo;

void setup() {
  microServo.attach(9);  // Any digital pin
}

void loop() {
  microServo.write(0);    // Move to 0 degrees
  delay(1000);
  microServo.write(90);   // Move to 90 degrees (center)
  delay(1000);
  microServo.write(180);  // Move to 180 degrees
  delay(1000);
}
```

For finer control, use `writeMicroseconds()` — most micro servos respond to 544-2400us, giving you ~1 degree resolution.

## Wiring Notes

- Signal to any digital pin on the Arduino (the Servo library bit-bangs the PWM timing)
- Power from external 5V supply for reliability, especially if driving multiple servos
- A single micro servo drawing < 200mA idle might work from Arduino 5V pin, but don't rely on it under load
- Share GND between servo supply and Arduino

## Warnings

- Plastic gears strip easily — never force past mechanical stops
- Limited torque — micro servos are for lightweight applications only
- Analog servo — holds position but buzzes/hunts slightly around the target angle (normal)
- If the servo jitters at rest, it may need a cleaner power supply (add 100uF cap near servo)

---

Related Parts:
- [[osepp-ls-955cr-continuous-rotation-servo-360-degree]] — continuous rotation servo (same manufacturer)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller

Categories:
- [[actuators]]
