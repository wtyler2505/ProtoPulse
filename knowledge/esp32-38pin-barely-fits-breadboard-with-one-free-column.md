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

This constraint matters for the bench coach because it affects how ProtoPulse renders breadboard layouts. The standard "IC straddles center channel" placement heuristic does not apply — the ESP32 needs special handling with wider row spacing and explicit visual indication that usable tie points are scarce.

---

Relevant Notes:
- [[mega-2560-too-wide-for-any-breadboard]] -- the Mega doesn't fit at all
- [[esp32-six-flash-gpios-must-never-be-used]] -- pins are exposed but not usable

Topics:
- [[breadboard-intelligence]]
