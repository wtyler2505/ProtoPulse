---
summary: KY-022 IR receiver module (38 kHz, VS1838B) — WEB-verified 3-pin pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: arduinomodules + thegeekpub + pinouts.net + espboards KY-022 + VS1838B/TL1838 IC (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# KY-022 IR receiver module — verification note

Added `core:ky022-ir-receiver` to `@protopulse/parts`. Pinout **web-verified** — NOT
taken from Tyler's shared `docs/parts-components-ect.md`. The receive half of the IR
pair (KY-005 transmitter is the companion).

## Part
- **MPN:** KY-022 (HW-490) — VS1838B / TL1838 1838 IR receiver IC
- **Reference:** https://arduinomodules.info/ky-022-infrared-receiver-module/
- **Function:** 38 kHz IR demodulator — decodes TV/AC remote bursts to a clean logic
  signal (range ~18 m, ±45° cone).
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | S | demodulated signal out (idle HIGH, LOW on burst) | output |
| 2 | VCC | middle pin — 2.7–5.5 V | power_in |
| 3 | GND | ground | power_in |

## Silk-order caveat (important)
The middle pin is **always VCC**, but the outer **S** and **–** order is **NOT
standardised** across clones — different boards print them in either order. Wire to the
S / middle / – silk labels, never a fixed left-to-right position. Modeled S/VCC/GND;
numbering is nominal, functions are fixed.

## Verification
- Web sources: arduinomodules KY-022, thegeekpub KY-022 wiki, pinouts.net KY-022,
  espboards KY-022 — agree on S/middle-VCC/GND and the 38 kHz demod behavior.
- Vault (`qmd_search`): no prior KY-022 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky022-ir-receiver.md`
(never author `knowledge/` directly).
