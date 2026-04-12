---
description: "ARM MCUs (SAMD21, SAMD51, RP2040, nRF52840) have built-in USB peripherals -- no FTDI/CH340 bridge chip needed. The MCU itself appears as any USB device class: HID keyboard, MIDI controller, mass storage, or serial port"
type: claim
source: "docs/parts/adafruit-pygamer-samd51-handheld-gaming-board-with-tft.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Native USB on ARM MCUs eliminates the serial bridge enabling direct HID and MIDI device emulation

ARM-based maker MCUs (SAMD21, SAMD51, RP2040, nRF52840, STM32) include a built-in USB peripheral in the silicon. This is architecturally different from AVR boards that need an external USB-serial bridge chip (FTDI, CH340, CP2102, or ATmega16U2).

**What native USB enables:**
- **HID keyboard/mouse**: The board appears as a USB keyboard or mouse. No drivers needed on the host. Type keystrokes, move the cursor, click.
- **MIDI device**: The board appears as a USB MIDI instrument. Send notes, CC messages, pitch bend directly to a DAW.
- **Mass storage**: The board appears as a USB drive (this is how UF2 bootloaders and CircuitPython work).
- **CDC serial**: The board appears as a serial port -- same as a CH340 provides, but without the extra chip.
- **Composite devices**: The board can be HID + serial + MIDI simultaneously.

**Comparison with bridged USB:**

| Feature | Native USB (SAMD51, RP2040) | Bridge chip (CH340, FTDI) |
|---------|---------------------------|--------------------------|
| Serial port | Yes (CDC) | Yes (only this) |
| HID keyboard/mouse | Yes | No |
| MIDI device | Yes | No |
| Mass storage | Yes | No |
| Driver install needed | No (standard USB classes) | Sometimes (CH340 on older OS) |
| Extra silicon cost | $0 (built into MCU) | $0.50-2.00 per board |

**The ATmega16U2 edge case:** The Arduino Uno R3 and Mega use an ATmega16U2 as the USB-serial bridge, which CAN be reprogrammed for HID/MIDI (it's a USB-capable AVR). But this requires flashing custom firmware onto the bridge chip -- it's a hack, not a first-class capability. On ARM boards with native USB, HID/MIDI is just a library include.

**ProtoPulse implications:** When detecting USB device class in the circuit editor or firmware scaffold, native-USB boards should offer HID/MIDI/mass-storage templates. Bridged boards should only offer serial communication templates.

---

Relevant Notes:
- [[ch340-usb-serial-driver-support-varies-by-os-and-most-modern-systems-include-it-natively]] -- the bridge chip that native USB makes unnecessary
- [[arduino-ide-board-selection-targets-the-mcu-not-the-usb-serial-chip-so-clones-use-same-menu-entry]] -- board selection still matters because native USB boards need different core libraries
- [[pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers]] -- UF2 mass storage mode is a specific application of native USB

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
