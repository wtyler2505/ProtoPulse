---
description: "A typical Arduino Bluetooth shield (HC-05, HC-06, OSEPP BTH-B1, etc.) wires its Bluetooth module to hardware UART pins 0 and 1 — the same pins the Arduino uses for USB-serial upload and Serial.print() — so with the shield connected you cannot upload sketches or use Serial Monitor, which is a major architectural gotcha on single-UART boards like the Uno"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[communication]]"
---

# Bluetooth shield consumes Arduino hardware UART RX/TX pins 0 and 1, creating a conflict with USB-serial upload and debug print

Almost every Arduino Bluetooth shield or breakout (HC-05, HC-06, OSEPP BTH-B1 with Bluegiga WT11, etc.) wires its Bluetooth module's serial port to Arduino pins 0 (RX) and 1 (TX). This is the ONLY hardware UART on an Arduino Uno. The USB-to-serial bridge chip on the Arduino also connects to those same pins.

**The conflict:**
- With the shield stacked, the Arduino's USB upload cannot drive TX/RX — the Bluetooth module is contending for the same pins
- `Serial.print()` output goes to the Bluetooth module instead of the USB host
- `Serial.read()` reads from whichever source physically pulls RX first
- Shield designs do NOT automatically disconnect during upload

**Standard workflow workarounds:**

1. **Remove the shield to upload, reattach to run** — tedious but universal
2. **Use a board with multiple UARTs** — Mega (4 UARTs), Leonardo (separate USB serial vs hardware UART on different pins), Due, Teensy
3. **Use SoftwareSerial on different pins** — wire the Bluetooth module's RX/TX to pins 2/3 (or any digital pins) and use `SoftwareSerial bluetooth(2, 3);` in sketch. This frees hardware UART for USB debug. **Requirement**: the shield must route the module's serial to headers you can reroute, which BTH-B1-class shields usually do not (they're hardwired to 0/1). For a HC-05 breakout on jumper wires, SoftwareSerial is easy.
4. **Use a shield with a selector switch** — some shields have a hardware switch that disconnects the BT module during upload; BTH-B1 does not.

**Why shields do this:**
Hardware UART is faster and more reliable than SoftwareSerial. BT modules typically run at 9600-115200 baud and don't tolerate dropped bits well. SoftwareSerial on a 16 MHz Arduino works up to ~38400 baud reliably but struggles at 115200. Hardware UART handles 115200 cleanly.

**Architectural implication for multi-shield projects:**
- Do not stack a Bluetooth shield with an Ethernet shield or SD card shield that also uses SPI — you'll run out of pins AND the BT will steal UART
- Prefer BLE modules (HC-08, HM-10) on SoftwareSerial for projects that need to keep USB debug working during development
- On the Leonardo, the hardware UART (pins 0/1) is SEPARATE from the USB serial (which the ATmega32u4 handles internally), so a shield on 0/1 doesn't block USB uploads — this is one of the practical reasons to use a Leonardo for BT projects

**Diagnostic tell:**
"Upload failed" with a Bluetooth shield attached → pop the shield, upload, reseat. If it uploads without the shield, the shield is the problem.

---

Source: [[docs_and_data]]

Relevant Notes:
- [[arduino-leonardo-atmega32u4-native-usb-enables-hid-keyboard-mouse-emulation-that-arduino-uno-cannot-do-without-hacking]] — the Leonardo's architectural advantage for this case
- [[rs-485-differential-signaling-survives-long-cable-runs-and-electrical-noise-where-single-ended-serial-would-fail]] — serial communication context

Topics:
- [[shields]]
- [[communication]]
