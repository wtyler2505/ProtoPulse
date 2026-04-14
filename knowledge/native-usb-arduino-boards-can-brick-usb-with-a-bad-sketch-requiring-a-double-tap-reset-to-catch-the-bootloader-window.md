---
description: "On native-USB Arduino boards (ATmega32u4, SAMD, RP2040), the sketch controls USB enumeration — so a sketch that misuses USB or crashes early can leave the USB port non-responsive to the host, and recovery requires a double-tap reset to force the bootloader to expose USB before the sketch runs"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
---

# Native-USB Arduino boards can brick USB with a bad sketch, requiring a double-tap reset to catch the bootloader window

On Arduino boards with native USB (Leonardo, Micro, Pro Micro, SAMD-based Zero, RP2040-based Pico), the USB peripheral is controlled by the user sketch — not by a separate always-on bridge chip. This means a broken sketch can break USB:

**Ways a sketch can brick USB:**
- Sketch crashes in `setup()` before USB enumeration completes
- Sketch runs a tight blocking loop without yielding to the USB task
- Sketch incorrectly calls `Keyboard.press()` in `setup()` causing uncontrolled typing that prevents any IDE interaction
- Sketch re-configures USB endpoints in a way the host driver rejects

**The recovery pattern: double-tap reset**
1. Press the reset button once → MCU resets, bootloader runs, USB enumerates as the bootloader's USB device (e.g., the yellow "Arduino Leonardo bootloader" COM port)
2. Press reset again within a short window (about 750ms on most boards) → bootloader extends its timeout, keeps USB alive longer
3. Upload a new sketch during this extended window before the bad sketch runs again

Some boards auto-detect repeated resets and stay in the bootloader indefinitely until a successful upload.

**Why the Uno doesn't have this problem:**
The Uno's USB bridge (ATmega16U2 or CH340) is a separate chip. No matter how badly the user sketch behaves, the bridge keeps USB alive and the host keeps seeing the COM port. Uploads always work because the bridge handles USB independently.

**Design implication for bench workflows:**
If you're developing on a Leonardo-class board and iterating quickly on code that touches USB HID, get comfortable with double-tap reset before you ever write `Keyboard.press()` in setup(). Running the sketch on hardware is not committing it to flash forever — but the recovery path is different from what Uno users expect.

---

Source: [[docs_and_data]]

Relevant Notes:
- [[arduino-leonardo-atmega32u4-native-usb-enables-hid-keyboard-mouse-emulation-that-arduino-uno-cannot-do-without-hacking]] — the architectural reason this failure mode exists

Topics:
- [[microcontrollers]]
