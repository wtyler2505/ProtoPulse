---
description: "The IDE toolchain targets the MCU via avrdude -- the USB-serial chip (ATmega16U2 vs CH340 vs CP2102) is invisible to compilation and upload, only matters for driver/COM port enumeration"
type: claim
source: "docs/parts/elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "elegoo-mega-2560-r3"
  - "dccduino-nano"
  - "osepp-uno-r3-plus"
---

# Arduino IDE board selection targets the MCU not the USB-serial chip so clones use the same menu entry

When you select "Arduino Mega or Mega 2560" in the Arduino IDE, the toolchain does two things:
1. **Compile** -- uses avr-gcc with ATmega2560-specific flags (flash size, memory layout, fuse settings)
2. **Upload** -- uses avrdude with the STK500v2 protocol to flash the compiled binary via serial

Neither step cares about the USB-to-serial bridge chip. The CH340 (Elegoo, generic clones), CP2102 (some ESP-based boards), FTDI FT232RL (some official boards), and ATmega16U2 (Arduino Mega/Uno official) all do the same job: present a virtual COM port to the host OS. The IDE sends the avrdude upload stream over that COM port. The bridge chip is a dumb pipe -- it does not participate in the programming protocol.

This means:
- **Elegoo Mega** -- select "Arduino Mega or Mega 2560" (same as official)
- **DCCduino Nano** -- select "Arduino Nano" (same as official)
- **OSEPP Uno** -- select "Arduino Uno" (same as official)
- **Any ATmega328P clone** -- select the matching board, adjust Processor only if bootloader differs

The one exception is the **Processor submenu** for ATmega328P boards: "ATmega328P" (Optiboot) vs "ATmega328P (Old Bootloader)" changes the upload protocol handshake. This is a bootloader difference, not a USB chip difference. See [[arduino-clone-bootloader-mismatch-causes-upload-failure-that-looks-like-hardware-fault]].

The distinction matters because beginners who see a different physical chip on their clone board (the CH340 is visibly different from the ATmega16U2 -- small SOP-16 package vs large TQFP-32) often assume they need to select a different board in the IDE. They don't. The board selection is about the target MCU, not the transport layer.

**One difference that DOES matter:** The ATmega16U2 on official boards can be reprogrammed to act as a USB HID device (keyboard, mouse, MIDI controller). The CH340 cannot -- it is a fixed-function USB-serial bridge. Projects that use the Arduino as a USB HID device (keyboard emulator, game controller) require the ATmega16U2, not a CH340 clone.

---

Relevant Notes:
- [[arduino-clone-bootloader-mismatch-causes-upload-failure-that-looks-like-hardware-fault]] -- the one IDE setting that DOES change for clones
- [[ch340-usb-serial-driver-support-varies-by-os-and-most-modern-systems-include-it-natively]] -- the transport layer that the IDE doesn't see

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
