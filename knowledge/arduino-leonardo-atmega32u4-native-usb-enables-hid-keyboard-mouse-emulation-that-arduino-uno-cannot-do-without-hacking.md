---
description: "The Arduino Leonardo's ATmega32u4 MCU has native USB hardware, which lets it enumerate to a host as a Human Interface Device (keyboard, mouse, gamepad) — a capability the Arduino Uno structurally cannot match because the Uno uses a separate FTDI/CH340 USB-to-serial chip that only exposes a virtual COM port"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
---

# Arduino Leonardo ATmega32u4 native USB enables HID keyboard/mouse emulation that Arduino Uno cannot do without hacking

The architectural distinction between the Arduino Leonardo and the Arduino Uno is NOT clock speed, RAM, or flash size — it's the USB topology. This one difference changes what the board can do.

**Uno architecture:**
- ATmega328P MCU (no native USB)
- Separate USB-to-serial chip (FTDI FT232RL on older boards, ATmega16U2 on R3, CH340 on clones)
- The USB chip only exposes a virtual COM port to the host
- The MCU only sees a UART — it has no knowledge that USB exists
- **Cannot act as a USB HID device without firmware-flashing the USB chip itself (e.g., HoodLoader2, LUFA on the 16U2), which is a destructive re-use of the USB bridge**

**Leonardo architecture:**
- ATmega32u4 MCU with integrated USB 2.0 peripheral
- No separate USB chip — the ATmega32u4 IS the USB endpoint
- Sketch code can configure USB to enumerate as CDC (virtual COM port), HID (keyboard/mouse/gamepad), MIDI, or composite
- The `Keyboard.h` and `Mouse.h` libraries work out of the box

**Why this matters for project selection:**
- Building a custom USB gamepad, keyboard macro pad, or hardware keyboard emulator → Leonardo class (Leonardo, Micro, Pro Micro, any ATmega32u4 board)
- Building a standard serial-based sensor/actuator project → Uno class is simpler, more examples, more shield compatibility
- Building a composite device (serial + HID) → Leonardo class only

**Trade-offs of the Leonardo approach:**
- USB enumeration is sketch-controlled, which means a bad sketch can brick USB and require a double-tap reset trick to recover the bootloader window
- Shields designed for the Uno pin map may have conflicts (I2C on Leonardo is pins D2/D3 rather than the Uno's A4/A5; SPI is on a 6-pin ICSP header, not D11-D13)
- Upload timing is more fragile — a USB disconnect during upload needs the reset button press at the right moment

**Boards in the Leonardo family (all ATmega32u4):**
- Arduino Leonardo (standard pinout)
- Arduino Micro (breadboard-friendly)
- Sparkfun Pro Micro (common in DIY keyboard builds)
- Adafruit ItsyBitsy 32u4

Any project claim of "Arduino keyboard" or "Arduino mouse" is implicitly a Leonardo-class project, not an Uno project.

---

Source: [[docs_and_data]]

Relevant Notes:
- [[arduino-uno-ch340-clone-boards-require-different-driver-install-than-original-ftdi-boards]] — the Uno's USB bridge is the architectural thing missing from the Leonardo
- [[esp32-native-usb-only-on-s2-s3-variants-and-classic-esp32-uses-ch340-or-cp2102-bridge]] — parallel architectural distinction in the ESP32 family

Topics:
- [[microcontrollers]]
