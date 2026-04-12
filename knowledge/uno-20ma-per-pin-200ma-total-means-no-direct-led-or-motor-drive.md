---
description: "ATmega328P absolute max is 40mA per pin but recommended is 20mA, with 200mA aggregate across all I/O -- exceeding either damages the MCU permanently"
type: claim
source: "docs/parts/arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Uno 20mA per pin and 200mA total I/O current means no direct LED or motor drive from GPIO

The ATmega328P specifies 20mA recommended maximum per I/O pin (40mA absolute max) with a total aggregate limit of 200mA across all active I/O pins combined. These are not soft limits -- exceeding them causes permanent silicon damage. A standard red LED draws 10-20mA, so a single LED per pin is fine, but connecting 14 LEDs to all digital pins at 20mA each would demand 280mA from the die, exceeding the aggregate limit.

Motors are completely out of bounds for direct GPIO drive. Even a small hobby DC motor draws 100-300mA at no-load, and a servo's stall current can reach 500mA-2.5A. Connecting a motor directly to an I/O pin will either damage the ATmega328P or produce barely perceptible movement. Motor drivers (L298N, TB6612, L293D) and MOSFET switches are mandatory.

This same 20mA/200mA constraint applies to the Mega (ATmega2560) and Nano (same ATmega328P), but the Uno is where beginners encounter it first because it's the beginner board. The aggregate limit is especially sneaky with the Mega's 54 I/O pins -- 200mA divided across 54 pins averages under 4mA each.

**ProtoPulse DRC rule:** Flag any schematic net that connects an Uno GPIO directly to a motor, relay coil, or high-power LED without an intervening driver IC or MOSFET.

---

Relevant Notes:
- [[mega-2560-too-wide-for-any-breadboard]] -- mentions the same 200mA aggregate on the Mega
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- motor drivers are mandatory, not optional, because of GPIO current limits
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- shield current ratings pick up where GPIO limits end

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
