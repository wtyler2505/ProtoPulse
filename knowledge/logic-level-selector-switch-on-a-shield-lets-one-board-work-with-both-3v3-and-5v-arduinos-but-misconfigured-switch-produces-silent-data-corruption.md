---
description: "Shields with a 3.3V/5V logic-level selector switch (like the OSEPP BTH-B1) can work with both Uno (5V) and Due/Zero (3.3V) boards, but if the switch position does not match the host board's voltage the shield will appear to work while producing corrupt or mirrored serial data, blown I/O on the shield, or silently damaged host GPIO"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[microcontrollers]]"
---

# Logic-level selector switch on a shield lets one board work with both 3.3V and 5V Arduinos, but misconfigured switch produces silent data corruption

Modern Arduino-compatible shields increasingly include a logic-level selector switch (often labeled S1 or S2) that configures the shield's output drivers and input thresholds for either 3.3V or 5V operation. This is a deliberate architectural choice so one SKU works with:

- **5V position** — Arduino Uno, Mega, Leonardo, Nano
- **3.3V position** — Arduino Due, Zero, MKR, ESP32/ESP8266 boards

**The failure modes when the switch is wrong:**

**Shield set to 5V, host is 3.3V:**
- Shield outputs drive the host's 3.3V GPIO with 5V — possibly damaging the host immediately (most modern 3.3V MCU pins are NOT 5V-tolerant)
- Host outputs drive the shield's 5V-threshold inputs with 3.3V — data may be misread as "low" if it falls below the 5V logic threshold (~2.0V min for logic high on 5V CMOS)
- Symptom: erratic data or dead host board

**Shield set to 3.3V, host is 5V:**
- Shield outputs drive the host's 5V inputs with 3.3V — may register as valid logic high (3.3V > 2.0V threshold on 5V inputs) so this direction usually works
- Host outputs drive the shield's 3.3V-threshold inputs with 5V — SHIELD GETS DAMAGED (unless the shield has level translators on inputs, which many don't)
- Symptom: shield stops responding over time, often after minutes of use

**Why the switch rather than a single level-translator chip:**
- Cost — a switch is cheaper than a bidirectional level translator
- Power efficiency — no quiescent current through translator
- Signal integrity — direct connection has better edges at high baud rates
- Simplicity — one position works, the other is wrong, no mystery

**Recognition habit before stacking any shield:**
1. **Look for a voltage selector switch** — typically near the power pins, labeled 3V3/5V
2. **Check the host board's operating voltage** — Uno is 5V, Due is 3.3V, ESP32 is 3.3V
3. **Set the switch to match the host** BEFORE stacking
4. **Verify with a multimeter** on the Vcc rail of the shield after power-on — you should see the host's rail voltage there, not the other one

**Gotcha: if the shield has NO switch**, it's locked to one voltage. A 5V-only shield on a 3.3V host will fry the host. Check the shield's product page — some hobby shields use 74HC logic that is unsafe on 3.3V hosts without level translation.

---

Source: docs_and_data

Relevant Notes:
- [[74hc-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — level shifting mechanism
- [[bluetooth-shield-consumes-arduino-hardware-uart-rx-tx-pins-0-and-1-creating-a-conflict-with-usb-serial-upload-and-debug-print]] — related shield architecture note

Topics:
- [[shields]]
- [[microcontrollers]]
