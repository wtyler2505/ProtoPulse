---
description: "Small geared stepper for positioning projects — 2048 steps/rev in half-step mode, pairs with ULN2003 driver board. Cheap and accurate enough for most hobby projects"
topics: ["[[actuators]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [Digital]
logic_level: "5V"
manufacturer: "Generic"
pinout: |
  5-pin JST connector to ULN2003 driver
  Blue   → Coil 1 (IN1)
  Pink   → Coil 2 (IN2)
  Yellow → Coil 3 (IN3)
  Orange → Coil 4 (IN4)
  Red    → VCC (5V, center tap)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Draws ~240mA — do NOT power from Arduino 5V pin directly, use external supply", "Gear reduction makes it slow (~15 RPM max) but precise"]
datasheet_url: ""
---

# 28BYJ-48 5V Unipolar Stepper Motor with ULN2003 Driver

Small geared stepper for positioning projects — 2048 steps/rev in half-step mode, pairs with ULN2003 driver board. Cheap and accurate enough for most hobby projects, but don't expect speed out of it. The 1:64 gear reduction gives you precision at the cost of roughly 15 RPM max.

## Specifications

| Parameter | Value |
|-----------|-------|
| Motor Type | Unipolar stepper, 5-wire |
| Operating Voltage | 5V DC |
| Current Draw | ~240mA (all coils energized) |
| Step Angle | 5.625° per step (full step) |
| Steps per Revolution | 2048 (half-step mode), 4096 (with gear ratio) |
| Gear Ratio | 1:64 |
| Max Speed | ~15 RPM |
| Coil Resistance | ~50 ohm per coil |
| Weight | ~30g |
| Driver Board | ULN2003 Darlington array |

## Drive Modes

| Mode | Steps/Rev | Step Angle | Torque | Smoothness |
|------|-----------|-----------|--------|------------|
| Full step (wave drive) | 2048 | 5.625° | Lower | Choppy |
| Full step (two-phase) | 2048 | 5.625° | Higher | Moderate |
| Half step | 4096 | 2.8125° | Moderate | Smooth |

## ULN2003 Driver Board

The ULN2003 driver board is almost always sold bundled with this motor. It contains a ULN2003A Darlington transistor array that handles the current switching — the Arduino just sends logic-level signals to IN1-IN4.

| Driver Pin | Arduino Connection | Motor Wire |
|------------|-------------------|------------|
| IN1 | Any digital GPIO | Blue (Coil 1) |
| IN2 | Any digital GPIO | Pink (Coil 2) |
| IN3 | Any digital GPIO | Yellow (Coil 3) |
| IN4 | Any digital GPIO | Orange (Coil 4) |
| VCC | External 5V supply | Red (center tap) |
| GND | Common ground | — |

## Wiring Notes

- **Power the motor from an external 5V supply**, not the Arduino's 5V pin. The motor draws ~240mA which is fine for a dedicated supply but risky from the Arduino's onboard regulator, especially if other things are connected.
- **Share ground** between the external supply and the Arduino — signals won't work without a common ground reference.
- The ULN2003 board has 4 status LEDs that show which coils are active — useful for debugging step sequences.
- Uses 4 digital pins on the Arduino. If pins are scarce, consider a shift register or I2C-based motor driver instead.

## Arduino Library

The built-in `Stepper` library works but `AccelStepper` is strongly recommended — it supports acceleration/deceleration profiles and non-blocking operation.

```cpp
#include <AccelStepper.h>
#define HALFSTEP 8
AccelStepper stepper(HALFSTEP, 8, 10, 9, 11); // IN1, IN3, IN2, IN4
// Note: pin order is NOT sequential — AccelStepper expects this specific ordering
```

## Limitations

- **Slow**: ~15 RPM max. Not suitable for anything needing fast rotation.
- **Weak torque**: Fine for pointer dials, camera sliders, or small rotary mechanisms. Won't move anything heavy.
- **No position feedback**: Open loop only. If the motor stalls or skips steps, you won't know without an external encoder.
- **Power hungry for sleep**: Holding position draws continuous current. De-energize coils when not moving to save power.

---

## ULN2003 Driver Board — Tracked Separately

The ULN2003 driver board that ships with this motor is tracked as its own part record: [[uln2003apg-stepper-driver-board-for-28byj-48-at-5v]]. The motor and driver are functionally paired — you almost always use them together — but they're separate inventory items because the driver board can be used independently for other low-current switching tasks (relays, LEDs, solenoids).

## Related Parts

- [[uln2003apg-stepper-driver-board-for-28byj-48-at-5v]] — the driver board for this motor
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — Compatible controller (5V logic, plenty of digital pins)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — Compatible controller (5V logic, extra pins for multi-motor setups)

## Categories

- [[actuators]]
