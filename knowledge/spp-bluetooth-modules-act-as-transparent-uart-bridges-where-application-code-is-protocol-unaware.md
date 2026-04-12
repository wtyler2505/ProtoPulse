---
description: "Once paired, HC-05/HC-06 SPP modules are invisible UART bridges — Serial.print() works identically whether bytes go over USB or Bluetooth, making wireless a drop-in replacement for wired serial"
type: claim
source: "docs/parts/osepp-bluetooth-btm-01-hc06-compatible-uart-bt-slave.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "osepp-bth-01"
  - "osepp-btm-01"
  - "arduino-mega-2560"
---

# SPP Bluetooth modules act as transparent UART bridges where application code is completely protocol-unaware

Once an HC-05 or HC-06 module establishes a Bluetooth SPP connection, the Bluetooth protocol becomes entirely invisible to the application layer. Bytes written to the UART TX pin emerge from the remote Bluetooth endpoint, and bytes received from the remote endpoint appear on the UART RX pin. The Arduino code is identical to wired serial communication:

```cpp
// This code works identically over USB serial or Bluetooth serial
Serial1.println("Hello from Arduino");
if (Serial1.available()) {
  char c = Serial1.read();
}
```

**Why this matters for beginners:**

1. **Zero protocol knowledge required:** The beginner doesn't need to understand Bluetooth pairing, SPP frames, or wireless protocols. They already know `Serial.print()` from their first LED tutorials. Bluetooth becomes "wireless Serial" with no new API to learn.

2. **Incremental development:** Build and debug the project with wired USB serial first. When everything works, swap the USB cable for a Bluetooth module. The code doesn't change. This is a powerful pedagogical strategy: get it working wired, then go wireless.

3. **Drop-in replacement:** This transparency is WHY UART Bluetooth modules dominate the maker ecosystem despite being technically inferior to BLE in power efficiency. The switching cost from wired to wireless serial is near-zero.

**Limitations of the transparency:**
- Latency is higher than wired serial (~10-50ms per packet vs. ~1ms)
- Baud rate must match on both sides (module defaults to 9600)
- Connection drops are invisible to the Arduino unless the STATE pin is monitored
- Packet boundaries are not preserved (UART is a byte stream, not a message protocol)

**ProtoPulse implications:**
- The bench coach should frame Bluetooth as "wireless Serial" for beginners, not as a separate protocol to learn
- The firmware scaffold for Bluetooth projects should start with a wired serial version and then document the one-line change (swap Serial0 for Serial1 + Bluetooth module)
- DRC should validate that the baud rate configured in AT commands matches the baud rate in `Serial1.begin()`

---

Relevant Notes:
- [[hc-05-master-slave-capability-is-the-selection-criterion-over-hc-06-for-device-to-device-bluetooth]] — module selection happens BEFORE the transparent bridge takes over
- [[uart-dominates-wireless-modules-consuming-dedicated-serial-ports]] — the bridge transparency is WHY UART dominance persists

Topics:
- [[communication]]
- [[breadboard-intelligence]]
