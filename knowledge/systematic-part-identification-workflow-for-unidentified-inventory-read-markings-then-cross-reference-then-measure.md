---
description: "Three-step methodology for identifying unknown components: read physical markings first, cross-reference part number fragments via Mouser/Digi-Key, fall back to instrument measurement (LCR meter, multimeter) when markings are unreadable"
type: methodology
source: "docs/parts/381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Systematic part identification workflow for unidentified inventory -- read markings then cross-reference then measure

When a component enters inventory without full identification (marked `status: unidentified` in ProtoPulse), follow this three-step procedure in order of reliability:

**Step 1: Read the physical markings**

Most passive components print key specifications directly on the body:
- **Electrolytics:** Capacitance (uF), voltage (V), temperature rating, polarity stripe
- **Ceramic caps:** 3-digit code (104 = 100nF), voltage marking
- **Film caps:** 3-digit code + tolerance letter + voltage
- **Resistors:** Color bands or printed value
- **Transistors:** Part number printed on flat face (PN2222A, S8050, etc.)

If markings are present and legible, this is the most reliable identification method because it comes directly from the manufacturer.

**Step 2: Cross-reference part number fragments**

When only a partial marking is readable (e.g., "381383" on a CDE capacitor), use distributor search tools:
- **Mouser** (mouser.com): parametric search with manufacturer and partial part number
- **Digi-Key** (digikey.com): cross-reference search
- **Octopart** (octopart.com): aggregated multi-distributor search
- **Manufacturer catalog:** CDE, Rubycon, etc. have online part number lookup tools

The goal is to map the fragment to a specific series and extract the encoded specifications (voltage, capacitance, tolerance) from the full part number structure.

**Step 3: Instrument measurement (fallback)**

When markings are unreadable or absent:
- **Capacitance:** Use an LCR meter or multimeter with capacitance mode. Most digital multimeters can measure up to a few hundred uF.
- **Resistance:** Standard multimeter ohms measurement.
- **Inductance:** Requires an LCR meter; most multimeters cannot measure inductance.
- **Voltage rating:** CANNOT be measured -- it is a design parameter, not an electrical characteristic. If the voltage rating cannot be determined from markings or cross-reference, derate conservatively or do not use in high-voltage applications.
- **Transistor pinout/type:** Use a component tester or multimeter diode mode to identify B/C/E and NPN vs PNP.

**Key limitation:** Instrument measurement can determine current electrical characteristics but cannot determine rated limits (maximum voltage, maximum current, temperature rating). These must come from markings or datasheets. A capacitor that measures 470uF tells you nothing about whether it is rated for 16V or 400V.

**ProtoPulse bench coach workflow:** When a user scans an unidentified part, guide them through Steps 1-3 in order. Update the part entry from `status: unidentified` to `status: needs-test` (if partially identified) or `status: identified` (if fully resolved).

---

Source: [[381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage]]

Relevant Notes:
- [[three-digit-ceramic-capacitor-codes-encode-picofarads-as-two-significant-digits-times-a-power-of-ten-multiplier]] -- Step 1 decoding for ceramic caps
- [[electrolytic-capacitor-part-numbers-encode-voltage-series-capacitance-tolerance-in-sequential-segments]] -- Step 2 decoding for electrolytic part numbers

Topics:
- [[passives]]
- [[eda-fundamentals]]
