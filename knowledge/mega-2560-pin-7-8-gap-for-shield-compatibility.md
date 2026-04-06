---
description: "A non-standard 160mil gap between digital pins 7 and 8 preserves mechanical compatibility with Uno shields"
type: claim
source: "shared/verified-boards/mega-2560-r3.ts"
confidence: proven
topics: ["[[eda-fundamentals]]", "[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/mega-2560-r3.ts"]
---

# Arduino Mega pins 7 and 8 have a 160mil gap for Uno shield compatibility

The Arduino Mega 2560 has a deliberate 160mil (4.064mm) spacing between digital pins 7 and 8 in the digital-low header, breaking the otherwise uniform 100mil (2.54mm) pin pitch. This non-standard gap is an intentional design decision inherited from the original Arduino Uno board layout, where an early PCB routing mistake became a permanent fixture because thousands of shields had already been manufactured to fit it.

The gap ensures that shields designed for the Uno can physically plug into the Mega's matching header positions (the Mega's first 14 digital pins mirror the Uno's layout exactly). Without this compatibility, the Mega would have been useless with the existing shield ecosystem — a dealbreaker for the Arduino community.

For ProtoPulse's breadboard and schematic rendering, this matters because naive pin-spacing code that assumes uniform 100mil pitch will misalign everything after pin 7. The verified board definition encodes this as a position offset in the `digital-low` header group: pin 7 is at position 5 and pin 8 at position 6, but the physical rendering must inject the extra 60mil gap. Any layout engine that generates Arduino Mega footprints needs to handle this explicitly.

---

Relevant Notes:
- [[mega-2560-four-hardware-uarts]] -- another Mega-specific architecture detail the layout engine must handle
- [[mega-2560-too-wide-for-any-breadboard]] -- physical dimensions also affect layout; the gap compounds the off-board problem
- [[fritzing-parts-use-svg-layers-with-xml-connector-defs]] -- the 160mil gap must be encoded in any Fritzing-compatible part definition
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] -- another board with non-standard physical constraints for the layout engine

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
