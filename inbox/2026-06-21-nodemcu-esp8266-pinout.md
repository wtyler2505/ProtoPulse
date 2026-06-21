---
summary: NodeMCU ESP8266 (Amica) — WEB-verified 30-pin dev-board layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: components101 + lastminuteengineers + etechnophiles NodeMCU/ESP8266 references (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# NodeMCU ESP8266 (Amica) — verification note

Added `core:nodemcu-esp8266` to `@protopulse/parts`. Pinout **web-verified** — NOT
taken from Tyler's shared `docs/parts-components-ect.md`. Third Tier-3 board.

## Part
- **MPN:** NodeMCU ESP8266 (Amica, ESP-12E)
- **Reference:** https://components101.com/development-boards/nodemcu-esp8266-pinout-features-and-datasheet
- **Class:** modeled `class: 'ic'`, refPrefix **A** (board)

## Pinout — 30 pins (verified canonical Amica layout)
**Left (1–15):** A0, RSV, RSV, SD3, SD2, SD1, CMD, SD0, CLK, GND, 3V3, EN, RST, GND, VIN
**Right (16–30):** D0, D1, D2, D3, D4, 3V3, GND, D5, D6, D7, D8, RX, TX, GND, 3V3

## GPIO mapping (etechnophiles-confirmed)
D0=GPIO16, D1=5, D2=4, D3=0, D4=2, D5=14, D6=12, D7=13, D8=15, RX=3, TX=1. D5–D8 = HSPI
(SCK/MISO/MOSI/SS). D1/D2 are the usual I²C SCL/SDA. D3=GPIO0 (flash button), D4=GPIO2
(onboard LED).

## ERC modeling
- **A0** = 0–1 V ADC via onboard divider → input.
- GPIO (D0–D8, RX, TX) → **bidi**; EN/RST → input.
- **SD0–SD3/CMD/CLK** = SDIO flash bus (occupied by the onboard flash chip) → bidi.
- **RSV** (×2) = reserved → **nc**.
- **3V3** (×3) = onboard regulator out (≤600 mA) → power_out; **VIN**/**GND** (×4) →
  power_in.

## Verification
- Web sources: components101 NodeMCU, lastminuteengineers ESP8266 pinout, etechnophiles
  NodeMCU layout — agree on the 30-pin Amica column order + GPIO mapping (GPIO table
  text-confirmed at etechnophiles).
- Vault (`qmd_search`): no prior NodeMCU note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (board land pattern deferred).
- ESP-32S NodeMCU (38-pin, separate board) is a distinct future part.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-nodemcu-esp8266.md`
(never author `knowledge/` directly).
