---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: 1 mil = 0.0254 mm exactly — the inch was redefined to exactly 25.4 mm in the 1959 international yard and pound agreement...
type: reference
confidence: proven
topics:
- moc-electronics-math
- eda-fundamentals
- eda-pcb-design
---
# mil vs mm pcb unit exact conversion

**[beginner]** A "mil" in PCB and mechanical engineering is one-thousandth of an inch (not a millimeter — the name is confusing). The conversion is **1 mil = 0.0254 mm** exactly. Calculator card example: a trace specified at 10 mil width is 0.254 mm; a 0.4 mm fine-pitch QFP package converts to 15.75 mil pitch. The most-used conversion in through-hole work: **100 mil = 2.54 mm**, which is the standard pitch of DIP headers, breadboard rows, and 0.1" prototyping board holes.

**[intermediate]** The conversion is not an approximation. In 1959 the United States, United Kingdom, Canada, Australia, New Zealand, and South Africa signed the **International Yard and Pound Agreement**, which redefined the inch as *exactly* 25.4 mm. Before 1959, the US inch was defined by a physical yard standard and differed from the UK inch by a tiny amount; after 1959, both converged to the same exact metric value. So 1 mil = 1/1000 inch = 0.0254 mm — a rational number, not a measured constant. No rounding.

This matters because PCB CAD tools do all their math in one unit system internally and convert at the UI layer. A KiCad or Altium project can be authored entirely in mils, entirely in mm, or mixed, and the round-trip through the file format loses zero precision as long as the internal representation has enough bits. Fab houses similarly accept Gerber files in either unit (specified in the file header); the fabrication tooling makes no distinction.

The practical friction point is **which unit to use for what**. US-origin parts (DIP ICs, most through-hole connectors, many US-designed boards) are natively mil — 100 mil DIP pitch, 50 mil fine-pitch SOIC, 31 mil standard PCB thickness (0.031"). European and Asian origins are natively mm — most metric connectors, IEC package codes, international component data. SMT passives are a hybrid: imperial codes (0603, 0805) name the size in mil (0.06" × 0.03" for 0603), but the metric code (1608 for 0603) names the same part in mm (1.6 × 0.8 mm) — the two codes mean the same physical part and both are correct, just in different unit systems. Misreading 0603 as "metric 0603" (which would be 0201 imperial) is a common and expensive mistake.

**[expert]** Three places the unit choice bites:

First, **PCB stackups and impedance control**. A 4-layer board with controlled 50 Ω traces has stackup thicknesses specified in mil by US fabs (5 mil prepreg, 7 mil core) and in mm or μm by European/Asian fabs. Impedance calculators take both but misread units silently if the tool defaults differ from the stackup sheet — a 5 mil value pasted into a field that expects mm produces an impedance answer off by a factor of 25. Always confirm the unit label next to the numeric input.

Second, **drill sizes**. Imperial drills use fractional inches or wire gauge numbers (#60 drill = 0.040"); metric drills use mm (1.0 mm). A through-hole pad spec'd at "0.040" drill, 0.065" pad" converts to 1.016 mm / 1.651 mm, which rounds to the closest available metric drill (1.0 mm) — that 0.016 mm rounding is a real tolerance hit if the part's leads are 0.64 mm (0.025") and need 0.20 mm of annular clearance. Metric-native fabs will use 1.0 mm; imperial-native fabs will use 0.040"; the finished hole is 16 μm different, sometimes enough to matter.

Third, **Gerber file unit headers**. The `%MOIN*%` (inches) vs `%MOMM*%` (millimeters) directive at the top of a Gerber file tells the fab which interpretation to use. Files occasionally arrive with the wrong header — the raw coordinates are the same, but a file meant to be interpreted in inches shipped with a mm header produces a board 25.4× larger than intended (or smaller if reversed). Modern fabs detect this via sanity-checking board outline size, but it still happens. The RS-274X spec makes unit declaration mandatory and unambiguous; older RS-274D files without format extensions are where the confusion lives.

The **confusing-name footgun:** a "mil" is not a millimeter. Millimeter is "mm." A milliradian (also "mil" in military/optics contexts) is 1/1000 radian, completely unrelated. PCB mils are always thousandths of an inch, but out of context the word is ambiguous; EDA tools label it "mil" or "mils" unambiguously, but informal communication ("the trace is 5 mil wide") sometimes gets misread by someone assuming millimeters.

---

Relevant Notes:
- [[component-package-type-imperial-0603-and-metric-1608-are-the-same-physical-part-with-different-naming-conventions]] — the passive-code version of this same unit trap
- [[moc-electronics-math]] — parent MOC

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[eda-pcb-design]]
