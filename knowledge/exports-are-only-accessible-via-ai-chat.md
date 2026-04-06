---
description: "All 12+ export formats require typing AI commands with no export panel or buttons"
type: need
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[maker-ux]]"]
related_components: ["server/export/"]
---

# Manufacturing exports were only accessible through AI chat commands with no direct UI

The UX evaluation found that all 12+ export formats (Gerber, KiCad, Eagle, SPICE, BOM CSV, pick-and-place, drill files, PDF, design report) required typing commands into the AI chat. There was no export panel, no export button, no menu item. A user who did not know the correct AI command could not export their design at all. The product analysis listed this in "Cross-Persona Critical Issues" because it affected every user type.

This represents a broader UX anti-pattern: features that only work if you already know the tool exists. For a maker who has just finished their first schematic and wants Gerber files for JLCPCB, the discovery path is invisible. The report recommended building a unified export panel (which has since been implemented as ExportPanel.tsx) and treating AI chat as one of multiple access paths rather than the only one.

---

Relevant Notes:
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- the UX must be accessible without AI
- [[dual-export-system-is-a-maintenance-trap]] -- the backend complexity compounded the UX gap

Topics:
- [[maker-ux]]
