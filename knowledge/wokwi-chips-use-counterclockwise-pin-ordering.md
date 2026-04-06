---
description: "Wokwi defines custom chip pins as JSON arrays ordered counterclockwise starting from pin 1 (bottom-left)"
type: concept
source: "Web research (Wokwi chip API documentation, wokwi-elements GitHub)"
confidence: proven
topics: ["[[eda-fundamentals]]"]
related_components: ["shared/verified-boards/types.ts"]
---

# Wokwi chip definitions use counterclockwise pin ordering in JSON arrays

Wokwi's custom chip format defines pins as a flat JSON array where the ordering follows the standard IC DIP convention: counterclockwise starting from pin 1 at the bottom-left (notch at top). The first element in the array is pin 1, and numbering proceeds down the left side, across the bottom, up the right side. This matches the physical DIP package convention used universally in electronics (JEDEC standard), but expressed as an array index rather than a visual grid.

The JSON chip definition includes fields like `name`, `author`, `pins` (the ordered array of pin name strings), and `display` properties. Each pin is referenced by its array index in the simulation logic, not by a separate ID field. This means reordering the array changes which physical pin a signal is assigned to — a subtle bug source when editing chip definitions by hand.

This is relevant to ProtoPulse because any future Wokwi import/export or simulation compatibility layer needs to convert between ProtoPulse's explicit pin ID system (where each pin has a unique `id` field and a `headerPosition`) and Wokwi's implicit array-index system. The conversion must account for the counterclockwise ordering assumption, especially for non-DIP packages (QFP, BGA) where Wokwi flattens a 2D pin grid into the same linear array.

---

Relevant Notes:
- [[fritzing-parts-use-svg-layers-with-xml-connector-defs]] -- Fritzing's approach to the same interop problem

Topics:
- [[eda-fundamentals]]
