---
description: "Standard-size continuous rotation servo — full 360-degree rotation with PWM speed/direction control. Center pulse (1.5ms) = stop, shorter = one direction, longer = other direction"
topics: ["[[actuators]]"]
status: needs-test
quantity: 1
voltage: [4.8, 6]
interfaces: [PWM]
logic_level: "5V"
manufacturer: "OSEPP"
part_number: "LS-955CR"
pinout: |
  3-wire servo cable:
    Brown/Black → GND
    Red         → VCC (4.8-6V)
    Orange/White → PWM signal (from MCU)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["Do NOT power from Arduino 5V pin — servo draws too much current, use external 5V supply", "Center pulse width may need trimming via potentiometer on the servo body", "Not a position servo — no way to command a specific angle, only speed and direction"]
datasheet_url: ""
---

# OSEPP LS-955CR Continuous Rotation Servo 360 Degree

A standard-size servo modified for continuous rotation. Unlike a normal position servo that moves to a specific angle (0-180 degrees), this one spins continuously in either direction. The PWM signal controls speed and direction rather than position:

- **1.5ms pulse** (center) = stopped
- **< 1.5ms pulse** = spin one direction (speed increases as pulse gets shorter)
- **> 1.5ms pulse** = spin other direction (speed increases as pulse gets longer)

This makes it useful for wheeled robots, turntables, or anything that needs continuous rotation with simple speed control from a single PWM pin. The trade-off is you lose position control entirely — there's no way to tell the servo to go to a specific angle.

## Specifications

| Spec | Value |
|------|-------|
| Type | Continuous rotation servo |
| Rotation | 360 degrees, continuous |
| Operating Voltage | 4.8-6V |
| Control Signal | Standard servo PWM (50Hz, 1-2ms pulse) |
| Stall Torque | ~13 kg-cm at 6V (typical for this size) |
| Speed | ~60 RPM at 6V (no load, typical) |
| Size | Standard servo (~40 x 20 x 36mm) |
| Gear Type | Plastic or metal (check variant) |
| Dead Band | Adjustable via trim pot |

## Control with Arduino

```cpp
#include <Servo.h>

Servo contServo;

void setup() {
  contServo.attach(9);  // Any PWM pin
  contServo.writeMicroseconds(1500);  // Stop
}

void loop() {
  contServo.writeMicroseconds(1500);  // Stop
  delay(2000);
  contServo.writeMicroseconds(1300);  // Spin one direction
  delay(2000);
  contServo.writeMicroseconds(1700);  // Spin other direction
  delay(2000);
}
```

The `Servo.write(90)` also stops the motor (90 maps to 1.5ms). `write(0)` = full speed one way, `write(180)` = full speed the other.

## Trimming the Dead Band

Most continuous rotation servos have a small trim potentiometer accessible through a hole in the case. If the servo creeps when you send a 1500us pulse, adjust this pot until it stops. This calibrates the "center" (stop) position.

## Wiring Notes

- Power the servo from an external 5-6V supply, NOT from the Arduino's 5V pin. Servos draw 500mA+ under load and the Arduino's regulator can't handle it.
- Signal wire connects to any digital pin — the Servo library handles the PWM timing.
- Share GND between the servo power supply and the Arduino.

## Warnings

- Not a position servo — you cannot command specific angles
- Power from external supply only — will brownout Arduino if powered from its 5V pin
- Gear teeth can strip under high load — don't use for heavy lifting
- Speed is not precisely controllable — varies with load and voltage

---

Related Parts:
- [[osepp-analog-micro-servo-position-4p8-6v]] — position servo (not continuous rotation)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller

Categories:
- [[actuators]]
