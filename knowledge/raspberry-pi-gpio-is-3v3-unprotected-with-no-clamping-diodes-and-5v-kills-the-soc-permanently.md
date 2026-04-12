---
description: "BCM2837B0 GPIO has NO buffering, NO clamping diodes, NO 5V tolerance -- a 5V signal on any GPIO pin permanently destroys the SoC with no recovery"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# Raspberry Pi GPIO is 3.3V unprotected with no clamping diodes and 5V kills the SoC permanently

The Raspberry Pi 3B+ GPIO pins connect directly to the BCM2837B0 SoC with no buffering, no series resistors, no clamping diodes, and no ESD protection beyond what the silicon itself provides. The absolute maximum voltage on any GPIO pin is 3.3V. Applying 5V -- even briefly, even through a pullup resistor -- can permanently destroy the SoC.

This is more severe than any other maker board in the inventory:
- **Arduino Uno/Mega (5V logic):** Applying 5V to a 5V board is obviously fine. Overvoltage to about 5.5V is tolerated by the ATmega's internal clamping diodes.
- **ESP32 (3.3V logic):** Has some overvoltage tolerance on certain pins due to internal ESD protection structures, though 5V is still out of spec.
- **Pi Pico (3.3V logic):** Also 3.3V-only GPIO, but the Pico costs $4 -- a dead Pico is a $4 lesson. A dead RPi 3B+ is a $35 lesson plus a corrupted SD card plus lost time reflashing the OS.

The practical danger: beginners who prototype with an Arduino Uno first (5V ecosystem) and then add a Raspberry Pi to the project will instinctively connect the two boards' GPIOs together. Uno digital pins output 5V HIGH. That 5V signal on an RPi GPIO pin fries the BCM2837 instantly. No error message, no warning LED, no graceful degradation -- just permanent silicon damage.

**Level shifting is mandatory** when connecting any 5V board to RPi GPIO. A bidirectional level shifter (BSS138-based or TXS0108E) between Arduino and RPi is a non-negotiable circuit requirement.

**ProtoPulse DRC implication:** When a schematic shows a Raspberry Pi GPIO pin connected to any 5V signal source (Arduino output, motor driver logic, 5V sensor) without a level shifter in the path, the DRC engine should emit a CRITICAL error -- not a warning. The parts file's `level_shifter_needed` metadata already identifies which boards require shifting. This should be surfaced as a red "DESTRUCTIVE" marker in the schematic editor.

---

Relevant Notes:
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] -- 3.3V ecosystem context; RPi fits naturally with 3.3V modules but needs shifters for 5V Arduino ecosystem
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] -- voltage level mismatch between Arduino and 3.3V peripherals, same problem in reverse

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
