---
description: "When strapping pins drive motor controller inputs through a buffer, the first lines of setup() must pinMode(OUTPUT) and digitalWrite to the safe motor state — because until setup() runs, those pins are tri-state and the buffer output is undefined, meaning the motor could be commanded on during the boot window"
type: claim
source: "docs/parts/wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[actuators]]"
  - "[[breadboard-intelligence]]"
related_components: []
---

# boot-time setup() must set strapping pins to the safe motor state before any other initialization

The buffered strapping pin solves the boot-time electrical problem ([[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]]) but creates a firmware-level follow-up problem. Between the end of boot and the first line of setup(), the ESP32 GPIO is tri-state. The buffer's input floats. The buffer's output — which feeds the motor controller input — is undefined. On a 74HC14 with no internal pull, the output could latch to either rail. On a 74HCT245 with an enable pin, the output is high-impedance until OE is asserted, which is fine but still not commanded.

The consequence: the motor controller input could briefly see "enabled" during the post-boot pre-setup window. For a ZS-X11H whose STOP pin is active-low, a momentary HIGH at the input (the buffer's default output) means the controller is enabled. If the speed input is also undefined and happens to sit at a level the controller interprets as "go," the motor spins for a few milliseconds before setup() corrects it. At 4WD rover scale, four motors briefly pulsing on is a physical event — the robot lurches, or worse, starts rolling while the firmware is still initializing serial and Wi-Fi.

Therefore the first three to five lines of setup() must be, in order:

1. `pinMode(pin, OUTPUT)` for every strapping-pin-buffered control line
2. `digitalWrite(pin, safe_value)` where safe_value accounts for any buffer inversion — LOW through an inverter produces HIGH at the load, so [[signal-inversion-through-a-hex-inverting-buffer-requires-firmware-to-flip-every-driven-pins-logic-to-compensate]]
3. The safe state is: STOP asserted LOW (disabled), CT asserted LOW (brake engaged, no coast), speed output at its "stopped" PWM value

Only after these safe-state writes should Serial.begin, Wi-Fi init, PWM config, or anything else happen. The ordering matters because Serial.begin alone takes tens of milliseconds on the ESP32, and that is all time where the motors can drift if the pin states aren't already nailed down.

This discipline mirrors the general principle that init sequences must place the system in a known safe state before enabling any subsystem that can act on uninitialized state. [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] solves the same problem at the hardware layer for direct-drive MOSFETs — here the software does it explicitly because the buffer displaces the hardware solution.

---

Source: [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]

Relevant Notes:
- [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]] — the hardware this firmware discipline complements
- [[signal-inversion-through-a-hex-inverting-buffer-requires-firmware-to-flip-every-driven-pins-logic-to-compensate]] — the logic-flip every write must account for
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — hardware analog of this software pattern
- [[emergency-stop-via-stop-pin-low-disables-bldc-controllers-entirely-and-is-safer-than-regenerative-braking-for-fault-conditions]] — the safe state this setup() sequence targets

Topics:
- [[microcontrollers]]
- [[actuators]]
- [[breadboard-intelligence]]
