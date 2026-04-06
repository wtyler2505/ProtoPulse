---
description: "At 101.6mm x 53.34mm the Mega physically cannot straddle any standard breadboard"
type: claim
source: "shared/verified-boards/mega-2560-r3.ts"
confidence: proven
topics: ["[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/mega-2560-r3.ts"]
---

# Arduino Mega is too wide for any standard breadboard at 101.6mm x 53.34mm

The Arduino Mega 2560 R3 measures 101.6mm long by 53.34mm wide — roughly twice the width of a standard breadboard's usable area (the center channel plus five tie-point rows on each side totals about 22mm). The board uses female headers rather than through-hole pins, making the standard "straddle the center channel" placement physically impossible regardless of breadboard size. Even a full-size 830-point breadboard (165mm x 55mm) cannot accommodate the Mega as a plugged-in component.

The verified board definition marks this as `breadboardFit: 'not_breadboard_friendly'`. The practical approach is to place the Mega adjacent to the breadboard and run jumper wires from its female headers to the breadboard's tie points. This is fundamentally different from how DIP ICs or narrower boards (like the Nano) are placed, and ProtoPulse's breadboard layout engine must treat the Mega as an off-board component with wire-only connections rather than attempting to render it straddling the channel.

The Mega's maximum total I/O current is also worth noting in this context: 200mA across all pins combined. With 54 digital I/O pins, that averages under 4mA per pin if all are active — well below the 40mA per-pin max. Projects driving many LEDs or peripherals simultaneously need external drivers.

---

Relevant Notes:
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] -- the ESP32 at least physically fits, barely; the Mega cannot fit at all
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- another physical layout consideration for the same board
- [[mega-2560-four-hardware-uarts]] -- the 4 UARTs make the Mega a rover hub, but its size means all connections are off-board jumpers

Topics:
- [[breadboard-intelligence]]
