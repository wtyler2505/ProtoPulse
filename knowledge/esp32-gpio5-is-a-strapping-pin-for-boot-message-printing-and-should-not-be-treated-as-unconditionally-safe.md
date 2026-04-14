---
description: "GPIO5 has a 10K internal pull-up at boot and samples at reset to control whether boot messages print — pulling it LOW externally suppresses serial output, and connecting it to a load with a strong pull direction affects boot behavior even though it is usually categorized as a 'safe' GPIO"
type: claim
source: "docs/parts/wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
  - "[[breadboard-intelligence]]"
related_components: []
---

# ESP32 GPIO5 is a strapping pin for boot message printing and should not be treated as unconditionally safe

Many ESP32 pin reference tables — including beginner-oriented "safe GPIO" lists — group GPIO5 with the 14 unrestricted pins alongside GPIO 16, 17, 18, 19, etc. This is a simplification that works for most hobby projects because GPIO5's strapping function has a mild failure mode (suppressed boot messages, not boot failure). But at the boundary conditions of a demanding system — like a 4-motor ESP32 rover where GPIO5 gets used as a direction control for the fourth motor controller — the strapping behavior reappears as a real constraint.

The hardware reality: GPIO5 has an internal 10K pull-up at reset. The ESP32 boot ROM samples GPIO5 at power-on to decide whether to print the boot banner on UART0. GPIO5 HIGH at boot means "print messages" (the default). GPIO5 LOW at boot means "silent boot." If an external load — like a ZS-X11H Z/F input with its own 10K pull-up to 5V through a level shifter — is wired directly to GPIO5, the boot sampling still works most of the time because HIGH + HIGH = HIGH, but any fault in the external circuit that pulls GPIO5 LOW during the boot window silently disables your serial debugging, which looks like "my board is dead" in a field debugging session.

The contradiction with [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] is real but resolvable: that note's "safe" categorization is accurate for typical hobby loads where external pulls rarely exceed the internal 10K pull-up. Once the external load is specifically designed to pull LOW during boot — or once the designer loses serial output to an unexplained condition — GPIO5 needs the same treatment as GPIO2 or GPIO15: buffer it with [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]] or move the signal to a truly unrestricted pin.

Therefore the accurate taxonomy is a three-tier gradient, not a binary:

- **Unconditionally safe** (GPIO 4, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33): no boot sampling, no flash conflict
- **Soft strapping** (GPIO5): boot samples but default pull-up is strong enough to tolerate normal loads
- **Hard strapping** (GPIO 0, 2, 12, 15): boot failure if external load disagrees with expected level

The "14 safe pins" framing overcounts by one. In practice designers who exhaust the unconditionally-safe set should reach for input-only pins (GPIO 34-39 per [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]]) as input-only feedback lines BEFORE reaching for GPIO5 as an output, because the soft-strapping behavior will bite in exactly the high-pin-count designs that need to reach past the unconditionally-safe set in the first place.

---

Source: [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]

Relevant Notes:
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] — the list this note qualifies
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] — a hard-strapping-pin example for contrast
- [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]] — the fix when GPIO5 must be used as an output to an external load
- [[esp32-4wd-rover-consumes-20-of-34-gpios-for-motor-control-forcing-use-of-strapping-and-input-only-pins]] — the pin-budget pressure that forces GPIO5 into service

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
