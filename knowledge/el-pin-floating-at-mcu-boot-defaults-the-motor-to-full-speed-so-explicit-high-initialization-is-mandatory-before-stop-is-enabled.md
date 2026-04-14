---
description: "Because the ZS-X11H EL input is active-LOW, a floating GPIO during the MCU boot window reads as full speed — setup() must drive EL HIGH before the STOP pin is ever asserted HIGH or the motor spins up uncommanded during the first hundred milliseconds of firmware life"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[microcontrollers]]"
related_components:
  - "riorand-zs-x11h"
  - "arduino-mega-2560"
---

# EL pin floating at MCU boot defaults the motor to full speed so explicit HIGH initialization is mandatory before STOP is enabled

Between MCU reset and the first `pinMode()` call, every GPIO sits as a high-impedance input with whatever weak pull state the silicon happened to come up with. On the Arduino Mega that window is roughly 50-200ms — long enough for the bootloader, the USB-serial detect delay, and the first instructions of `setup()` to execute. On ESP32 it can reach 1-2 seconds because of flash-boot and WiFi-stack init. A floating GPIO downstream of a ZS-X11H's EL (speed) input reads as logic LOW to the controller, and because [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes|EL is active-LOW]], logic LOW means full speed.

The consequence is unambiguous: if the motor is powered before the MCU boots, and the STOP pin is held HIGH by any mechanism (previous firmware, external pull-up, a shorted connector), the motor runs at full speed during every reset until the firmware reaches its first `analogWrite(EL_PIN, 255)` call. This is the exact failure mode the source's Common Wiring Mistakes table identifies as "Motor runs at full speed immediately on power-up."

The correct initialization ordering in `setup()` is non-negotiable:

```cpp
void setup() {
  pinMode(PIN_ENABLE, OUTPUT);
  digitalWrite(PIN_ENABLE, LOW);      // STOP LOW first — motor disabled
  pinMode(PIN_SPEED, OUTPUT);
  analogWrite(PIN_SPEED, 255);        // EL HIGH = stopped (active-LOW)
  pinMode(PIN_BRAKE, OUTPUT);
  digitalWrite(PIN_BRAKE, LOW);       // Brake engaged
  pinMode(PIN_DIR, OUTPUT);
  digitalWrite(PIN_DIR, LOW);         // Forward
  // only NOW is it safe to lift STOP to HIGH on a subsequent command
}
```

Two rules fall out of this sequencing. First: drive EL to the stopped state before any `pinMode(..., OUTPUT)` call on the STOP pin that could drive STOP HIGH. Second: never command STOP HIGH in `setup()` — leave that for a deliberate `enableMotor()` call triggered by user input or a controlled startup sequence. The [[safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state|safe BLDC startup sequence]] generalizes this to a four-step recipe.

The hardware-side mitigation is an external pull-up on the EL line to 5V (through a 10K resistor at the ZS-X11H end), which forces EL HIGH even while the MCU pin is floating. This makes the boot-time window safe regardless of firmware initialization order. The pull-up is cheap insurance against firmware regressions that accidentally swap the ordering — a single line change that moves the `digitalWrite(PIN_ENABLE, LOW)` below the speed init can otherwise re-introduce the hazard silently.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] — the polarity rule this claim's sequencing depends on
- [[safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state]] — the generalized startup recipe
- [[bldc-stop-active-low-brake-active-high]] — the STOP-pin polarity that completes the safe-state picture
- [[esp32-six-flash-gpios-must-never-be-used]] — a related MCU-boot-window hazard that motivates treating boot timing as a design constraint

Topics:
- [[actuators]]
- [[microcontrollers]]
