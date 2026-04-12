---
description: "The 22.86mm row spacing leaves only 1 usable column per side on a standard 830-point breadboard"
type: claim
source: "shared/verified-boards/nodemcu-esp32s.ts"
confidence: proven
topics: ["[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/nodemcu-esp32s.ts"]
---

# ESP32 38-pin dev board barely fits on standard breadboard with only 1 free column per side

The NodeMCU ESP32-S has 2x19 headers at 22.86mm row spacing — wider than a standard DIP IC but narrower than the full breadboard width. On a standard 830-point breadboard (63 columns, 5 rows per side of the center channel), the ESP32 physically fits, but each header row occupies 4 of the 5 available tie points in its column, leaving only a single free hole per side for jumper wires. This makes it nearly impossible to connect more than one wire per pin without daisy-chaining.

The verified board definition marks this as `breadboardFit: 'requires_jumpers'` — the board physically sits in the breadboard but is not practically usable without workarounds. Common maker solutions include using two breadboards side-by-side (one leg of the ESP32 on each board's edge), a dedicated ESP32 breakout expansion board, or female-to-male jumper wires from the headers directly to the breadboard bypassing the straddle entirely.

**Board variant matters:** The unit in Tyler's inventory is the **DOIT DevKit v1**, a 30-pin variant (15 per side) with a CP2102 USB-serial chip. This variant fits a standard breadboard with both rows accessible -- significantly better than the 38-pin WROOM DevKit which covers both power rails. The 38-pin version adds extra GND and power pins but exposes the same 25 usable GPIOs. The CP2102 driver may need manual installation on some systems (download from Silicon Labs).

This constraint matters for the bench coach because it affects how ProtoPulse renders breadboard layouts. The standard "IC straddles center channel" placement heuristic does not apply to the 38-pin variant — it needs special handling with wider row spacing and explicit visual indication that usable tie points are scarce. The 30-pin variant fits normally but should still be flagged as wider than standard DIP ICs.

---

Relevant Notes:
- [[mega-2560-too-wide-for-any-breadboard]] -- the Mega doesn't fit at all; the ESP32 at least physically fits
- [[esp32-six-flash-gpios-must-never-be-used]] -- pins are exposed but not usable, compounding the "barely fits" problem
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- GPIO12 on a barely-fitting board compounds the deceptive complexity for beginners
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- ProtoPulse's bench coach can visually show the fit constraint that TinkerCAD ignores
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- physical breadboard constraints are invisible to beginners without AI coaching
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- the ESP32's tight fit is why AI-assisted breadboard layout is essential for the maker bundle

Topics:
- [[breadboard-intelligence]]
