---
description: "Each Fritzing part is an FZPZ archive containing per-view SVG files and an FZP XML manifest with connector IDs at 0.1 inch spacing"
type: concept
source: "Web research (Fritzing documentation, FZPZ format specification)"
confidence: proven
topics: ["[[eda-fundamentals]]"]
related_components: ["server/component-export.ts", "server/export/fzz-handler.ts"]
---

# Fritzing parts use SVG layers per view with XML connector definitions at 0.1 inch pin spacing

A Fritzing part (FZPZ file) is a ZIP archive containing one FZP metadata file and multiple SVG graphics files — typically one SVG per view (breadboard, schematic, PCB, icon). The FZP file is an XML manifest that declares the part's properties, connector IDs, and which SVG layers map to which connectors. Each connector element in the FZP has an `id` attribute (like `connector0pin`, `connector1pin`) that references a corresponding SVG element ID in the view files.

Pin spacing in Fritzing's breadboard view follows a strict 0.1 inch (2.54mm) grid. Connector positions in the SVG files must align to this grid or the part will not snap correctly when placed on the virtual breadboard. The SVG coordinate system uses 1px = 1/90 inch by Fritzing convention (90 DPI), so 0.1 inch = 9px between pin centers.

This matters for ProtoPulse's FZPZ import/export pipeline (`server/component-export.ts`). When generating Fritzing-compatible parts from ProtoPulse's component library, the SVG generator must place connector graphics at exact 9px multiples, and the FZP XML must enumerate every connector with matching IDs. Mismatched IDs between the FZP and SVG files result in "ghost pins" that appear in one view but are not wirable in another — a common source of broken community-contributed parts.

---

Relevant Notes:
- [[wokwi-chips-use-counterclockwise-pin-ordering]] -- different simulator, different format, same interop challenge
- [[dual-export-system-is-a-maintenance-trap]] -- FZPZ import/export is part of the export system that was duplicated
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- Fritzing interop strengthens the breadboard leg of the maker bundle by enabling part migration
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] -- the ESP32's non-standard row spacing must be encoded correctly in Fritzing SVG at 9px multiples

Topics:
- [[eda-fundamentals]]
