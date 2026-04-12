---
description: "The Amica variant has 23mm row spacing designed for standard 830-point breadboards -- unlike the wider LoLin V3 (~25mm) which covers one outer rail entirely"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# NodeMCU Amica 23mm pin spacing fits standard breadboard with both rails accessible unlike the wider LoLin V3

The NodeMCU Amica variant was specifically designed with a 23mm row spacing between its two pin headers — matching the standard breadboard center channel width (5 rows at 2.54mm pitch = 12.7mm per side, center gap included). This means the Amica straddles the center channel cleanly, leaving both outer breadboard rails (power and ground) fully accessible for jumper wires.

**The LoLin/V3 problem:** The NodeMCU V3 variant (also called LoLin) uses a wider PCB (~25mm between headers) for easier soldering during manufacturing. This 2mm difference means it does not fit across the standard center channel — its pins occupy one additional row on one side, covering an outer power rail entirely. Working with the V3 on a single breadboard requires creative workarounds: angled pin insertion, flying wires, or using the board at the very end of the breadboard where rail access doesn't matter.

**Comparison with other boards:**
- **Arduino Nano:** Perfect fit — narrow DIP form factor, both rails accessible
- **ESP32 38-pin:** Barely fits, 1 free column per side, no rail access
- **Arduino Mega:** Does not fit any breadboard — too wide entirely
- **NodeMCU Amica (ESP8266):** Good fit, both rails accessible

This breadboard compatibility is one of the Amica's practical advantages over other WiFi-capable dev boards. For beginners building their first IoT project on a breadboard, the Amica is physically the most accommodating WiFi MCU available.

**ProtoPulse implication:** The breadboard renderer should model the Amica as a "standard fit" component (like Nano) rather than a "tight fit" (like ESP32 38-pin). The board profile should specify `breadboardFit: 'standard'` with both power rails available for routing.

---

Relevant Notes:
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] — the ESP32's problematic breadboard fit contrasts with the Amica's clean fit
- [[mega-2560-too-wide-for-any-breadboard]] — the other extreme: a board that cannot use a breadboard at all

Topics:
- [[microcontrollers]]
- [[breadboard-intelligence]]
