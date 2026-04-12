---
description: "Clones ship with pre-Optiboot bootloader; IDE default 'ATmega328P' setting sends wrong handshake, producing avrdude sync error that mimics hardware failure"
type: claim
source: "docs/parts/arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "arduino-nano-v3"
  - "dccduino-nano"
  - "elegoo-mega-2560-r3"
  - "osepp-uno-r3-plus"
---

# Arduino clone bootloader mismatch causes upload failure that looks like a hardware fault

Arduino clones (DCCduino Nano, Elegoo Mega, OSEPP Uno, generic "Nano V3.0" boards) frequently ship with the pre-Optiboot bootloader -- the older, larger (2KB vs 0.5KB) bootloader that uses a different serial handshake protocol. **Important:** the bootloader varies by batch and manufacturer -- some clones ship with Optiboot (new), some with the old bootloader, and there is no way to determine which without testing. The correct advice is "try both processor settings" rather than "always switch to old bootloader." The Arduino IDE's default processor setting ("ATmega328P") assumes Optiboot and sends the newer handshake. When the board has the old bootloader, avrdude gets no valid response:

```
avrdude: stk500_getsync(): not in sync: resp=0x00
```

This error message is catastrophically misleading for beginners. It looks like:
- A defective board
- A driver installation failure
- A wrong COM port selection
- A USB cable problem (data vs charge-only)

The actual fix is purely software: change the Processor dropdown from "ATmega328P" to "ATmega328P (Old Bootloader)" in the Arduino IDE. No hardware change, no driver install, no cable swap needed.

This is the single most common first-experience failure for anyone buying a clone Arduino, which is most beginners -- clones outsell official boards by a wide margin. The fix takes 3 seconds once you know it, but the diagnosis can take hours if you're searching for a hardware problem.

**Cross-platform note:** This bootloader mismatch applies to all ATmega328P-based clones regardless of form factor (Nano, Uno, Pro Mini). Mega 2560 clones have a different but related issue: the ATmega16U2 vs CH340 USB-serial chip difference, which is a driver problem rather than a bootloader problem.

**Distinguishing bootloader mismatch from driver absence:** If the board's COM port appears in the OS but upload fails with "not in sync," it's a bootloader mismatch (fix: change Processor setting). If no COM port appears at all, it's a CH340 driver issue (fix: install driver). See [[ch340-usb-serial-driver-support-varies-by-os-and-most-modern-systems-include-it-natively]] for the driver platform matrix. These are the two most common first-experience failures with clones, and they require different fixes despite both presenting as "upload failed."

**ProtoPulse implication:** The Arduino IDE integration should detect clone boards (via CH340 USB VID 0x1A86 / PID 0x7523) and automatically suggest the "Old Bootloader" processor setting, or at minimum surface this as the first troubleshooting step when upload fails with a sync error.

---

Relevant Notes:
- [[pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers]] -- Pico's UF2 bootloader sidesteps this entire class of problem
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] -- clone identification pattern: looks identical, behaves differently

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
