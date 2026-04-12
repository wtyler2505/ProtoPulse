---
description: "HC-05 uses 38400 baud with EN pin + power cycle to enter AT mode and '=' sign syntax; HC-06 uses 9600 baud, enters AT mode when unpaired, and uses concatenated syntax — mixing them up causes silent failures"
type: claim
source: "docs/parts/osepp-bluetooth-bth-01-hc05-compatible-uart-bt-module.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "osepp-bth-01"
  - "osepp-btm-01"
---

# HC-05 and HC-06 AT command interfaces are incompatible despite sharing the same Bluetooth silicon family

The HC-05 and HC-06 look almost identical, use the same Bluetooth 2.0+EDR silicon family, and serve the same purpose (UART-to-Bluetooth bridge). But their AT command interfaces are completely different:

| Aspect | HC-05 (BTH-01) | HC-06 (BTM-01) |
|--------|-----------------|-----------------|
| Enter AT mode | Hold EN/KEY pin HIGH, then power cycle | Just send AT commands when unpaired |
| AT mode baud | 38400 | 9600 |
| Line ending | CR+LF (NL+CR) | No line ending needed |
| Name command | `AT+NAME=MyDevice` (with `=`) | `AT+NAMEMyDevice` (concatenated) |
| PIN command | `AT+PSWD=1234` | `AT+PIN1234` |
| Baud command | `AT+UART=9600,0,0` | `AT+BAUD4` (numeric code: 1=1200...8=115200) |
| Response format | `OK` with CR+LF | `OKsetname` (concatenated) |
| LED in AT mode | Slow blink (~2s) | Fast blink (unchanged from normal) |

**The debugging trap:** A beginner finds an "HC-05 AT command tutorial" and applies it to their HC-06 (or vice versa). The wrong baud rate means the serial monitor shows garbage or nothing. The wrong syntax means commands are silently ignored. The wrong AT mode entry procedure means the module never enters AT mode at all. All three failures produce the same symptom: "the module doesn't respond to AT commands."

**The diagnostic checklist:**
1. Identify your module (HC-05 has EN/KEY pin and 6 pins; HC-06 has 4 pins)
2. Set the correct baud rate (38400 for HC-05 in AT mode, 9600 for HC-06)
3. Use the correct line ending (CR+LF for HC-05, none for HC-06)
4. Use the correct syntax (`=` for HC-05, concatenated for HC-06)
5. Verify AT mode entry (HC-05: EN HIGH + power cycle; HC-06: just be unpaired)

**ProtoPulse implications:**
- The bench coach should detect which module is in the project and provide the CORRECT AT command reference, not a generic one
- Code generation for Bluetooth configuration should use the right syntax based on the BOM entry
- DRC could flag: "Your code uses HC-05 AT syntax but your BOM lists an HC-06 — the commands won't work"

---

Relevant Notes:
- [[hc-05-master-slave-capability-is-the-selection-criterion-over-hc-06-for-device-to-device-bluetooth]] — the other key difference between HC-05 and HC-06
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — wrong AT syntax = wasted debugging hours

Topics:
- [[communication]]
- [[breadboard-intelligence]]
