---
description: "The analog joystick module (KY-023) combines two potentiometers on a spring-return self-centering gimbal plus a center-press pushbutton — it consumes 2 analog pins (X/Y) and 1 digital pin (SW), making it the densest 2D proportional input for embedded systems"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[analog-joystick-module-xy-axes-plus-pushbutton]]"
---

# Joystick module is two potentiometers on a spring-return gimbal consuming two analog pins plus one digital pin

The analog joystick module is a composite device:

- **X axis**: Potentiometer (10K typical) — outputs proportional voltage based on horizontal displacement
- **Y axis**: Potentiometer (10K typical) — outputs proportional voltage based on vertical displacement
- **SW**: Momentary pushbutton activated by pressing the stick straight down — active-LOW

The spring-return mechanism distinguishes this from bare potentiometers: when released, the stick self-centers, returning both axes to approximately mid-range (~512 on 10-bit ADC). This makes it suitable for rate-control applications (tilt = speed/direction) rather than position-hold applications.

**Pin budget**: 2 analog + 1 digital = 3 pins total. On an Arduino Uno (6 analog, 14 digital), one joystick consumes 33% of the analog budget. On ESP32 (18 ADC channels), it's more modest.

**Electrical simplicity**: The module is entirely passive — two variable resistors and a switch contact. There's no onboard IC, no I2C address, no protocol. It operates at whatever VCC you supply (3.3V or 5V), with output range scaling proportionally.

This passivity is both a strength (no initialization, no bus conflicts, instant readings) and a limitation (no onboard filtering, no dead-zone correction, no debouncing on SW).

---

Topics:
- [[input-devices]]

Related:
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]]
- [[joystick-center-position-reads-approximately-512-but-varies-per-unit-requiring-per-unit-software-calibration]]
- [[joystick-sw-pin-has-no-onboard-pull-up-requiring-input-pullup-or-external-resistor-to-avoid-floating-input]]
- [[running-joystick-at-3v3-scales-analog-output-proportionally-so-code-expecting-0-1023-range-sees-0-675-maximum]]
