---
description: "8 of 11 communication modules in the inventory use 3.3V logic -- any 5V MCU project with wireless peripherals should assume level shifting as the default wiring concern, not an edge case"
type: claim
source: "docs/parts/communication.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[shields]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
  - "osepp-bluetooth-bth-01"
  - "osepp-bluetooth-btm-01"
  - "rc522-mfrc522-rfid-reader"
  - "neo-6m-gps-module"
  - "txs0108e-level-shifter"
  - "hw-221-level-shifter"
---

# wireless modules are overwhelmingly 3.3V making level shifting the default

Of the 11 parts in the communication category, 8 involve 3.3V logic: ESP8266, HC-05, HC-06, RC522 RFID, NEO-6M GPS, and the IR modules (which accept dual voltage but are native 3.3V). Only the Ethernet shield (W5100) and the Allen-Bradley terminal base are natively 5V.

This means any project using a 5V MCU (Arduino Mega, Uno, Nano) with wireless peripherals should treat level shifting as the default wiring step, not an exception. The inventory already includes two level shifter solutions (TXS0108E auto-direction, HW-221 BSS138-based) specifically to address this mismatch.

**Design rule:** When a 5V MCU appears in the BOM alongside any wireless communication module, the system should flag "level shifting required" as a DRC warning unless a level shifter or 3.3V-tolerant MCU is also present.

**Pattern parallel:** This mirrors the display voltage landscape -- most maker displays accept 3.3-5V, but the communication modules are more uniformly 3.3V-only, making the mismatch more predictable and the mitigation more standardized.

---

Relevant Notes:
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] -- Level shifters add another layer to wiring complexity
- [[esp32-six-flash-gpios-must-never-be-used]] -- ESP32 is native 3.3V, avoiding the level shift problem entirely

Topics:
- [[communication]]
- [[shields]]
- [[eda-fundamentals]]
