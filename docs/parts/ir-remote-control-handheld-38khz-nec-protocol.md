---
description: "Handheld IR remote control — TV-style with ~20 buttons, NEC protocol at 38kHz, CR2025 battery, the standard kit remote for Arduino IR projects"
topics: ["[[communication]]", "[[input-devices]]"]
status: needs-test
quantity: 2
voltage: [3]
interfaces: [IR]
logic_level: "N/A"
manufacturer: "Generic"
part_number: "IR-REMOTE"
compatible_with: ["[[generic-ir-receiver-module-38khz-demodulator]]"]
used_in: []
warnings: ["Battery is CR2025 (3V coin cell) — check if installed and not dead", "Button codes vary between remote manufacturers — use IRremote to read actual codes from YOUR remote before hardcoding"]
datasheet_url: ""
---

# IR Remote Control — Handheld 38kHz NEC Protocol

The standard small IR remote that comes in Arduino starter kits. ~20 buttons (0-9, arrows, OK, *, #, etc.) transmitting NEC protocol at 38kHz. Pair it with any 38kHz IR receiver module to add wireless button input to your project. Cheap and reliable, but line-of-sight only.

## Specifications

| Spec | Value |
|------|-------|
| Protocol | NEC (32-bit) |
| Carrier | 38kHz |
| Battery | CR2025 (3V coin cell) |
| Range | ~5-8m |
| Buttons | ~20 (varies by model) |

## Usage

Point at an IR receiver module. Use the `IRremote` library to decode button presses. Each button sends a unique 32-bit code. Run the receiver example sketch first to map your remote's actual button codes — don't assume the codes match any published table, because they vary between manufacturers.

---

Related Parts:
- [[generic-ir-receiver-module-38khz-demodulator]] — the receiver that decodes this remote's signals

Categories:
- [[communication]]
- [[input-devices]]
