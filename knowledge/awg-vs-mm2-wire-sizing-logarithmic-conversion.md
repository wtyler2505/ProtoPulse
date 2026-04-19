---
_schema:
  entity_type: "knowledge-note"
  applies_to: "knowledge/*.md"
description: "AWG is a logarithmic 39-step scale between two fixed anchors (36 AWG = 0.005 in, 0000 AWG = 0.46 in, ratio 92), so area in mm² = 0.012668 · 92^((36-AWG)/19.5); every 3-gauge step halves or doubles cross-sectional area, which is the only number most people need to remember"
type: concept
confidence: proven
topics:
  - "[[moc-electronics-math]]"
  - "[[eda-fundamentals]]"
---

# awg vs mm2 wire sizing logarithmic conversion

**[beginner]** American Wire Gauge (AWG) is the US system for wire thickness. Lower number = thicker wire: 10 AWG is thick (power wiring), 30 AWG is thin (wire-wrap prototyping). The exact conversion to cross-sectional area in mm² is **area = 0.012668 × 92^((36 − AWG) / 19.5) mm²**, which is the formula the Calculator card uses. The number everyone should memorize instead is the shortcut: **every 3 AWG steps doubles the area** (and every 6 steps doubles the diameter). So 12 AWG is twice the area of 15 AWG, four times 18 AWG, eight times 21 AWG. Going the other way, 20 AWG is half of 17 AWG, a quarter of 14 AWG. Typical maker-scale numbers: 22 AWG ≈ 0.33 mm² (breadboard jumper), 18 AWG ≈ 0.82 mm² (screw terminals), 14 AWG ≈ 2.08 mm² (motor phase wiring), 10 AWG ≈ 5.26 mm² (high-current battery leads).

**[intermediate]** The formula looks arbitrary but is defined by the ASTM B258-02 standard in a very specific way. Two anchor points were chosen: **36 AWG is exactly 0.005 inches in diameter** and **0000 AWG (also written 4/0) is exactly 0.46 inches**. That is 39 gauge steps between them (from 36 down through 0, then 00, 000, 0000 — yes, negative numbers via the multiple-zero notation). The ratio of diameters is 0.46 / 0.005 = 92. Dividing 92 over 39 equal logarithmic steps gives a per-step diameter ratio of 92^(1/39) ≈ 1.1229 — each AWG step makes the wire about 12.3% thicker in diameter.

Since area goes as diameter squared, the per-step area ratio is 92^(2/39) = 92^(1/19.5) ≈ 1.2610 — each step multiplies area by about 26%. The formula **area = 0.012668 · 92^((36 − AWG)/19.5)** drops out: start from the 36 AWG area (0.012668 mm², which is π/4 × (0.005 in)² converted to mm²), and step up by 92^(1/19.5) for each decrement in AWG number. The 0.012668 constant is a unit-conversion residue; the 92^(1/19.5) is the geometric ratio that makes AWG a log scale.

The "every 3 AWG doubles area" heuristic comes from 92^(3/19.5) = 92^(1/6.5) ≈ 1.99 — extraordinarily close to 2, not by coincidence but because the system was designed that way. The standard picks ratios where 3 gauge steps ≈ ×2 in area and 6 steps ≈ ×2 in diameter, because those are the ratios that matter for current-carrying capacity (which scales with area) and bend-radius/flexibility (which scales with diameter).

**[expert]** Three practical issues:

First, **AWG defines copper wire only**. Aluminum wiring uses a separate AWG-style scale but is specified with different ampacity tables — a given AWG of aluminum carries roughly 80% of copper's ampacity, and aluminum-copper junctions cold-flow over time, which is why NEC (National Electric Code) requires specific connector types (AL/CU rated) and antioxidant compound when mixing. Automotive and high-current DC applications occasionally see aluminum to save weight; signal-level wiring is always copper.

Second, **stranded vs solid** have the same AWG for the same total copper area, but stranded wire has higher effective resistance at high frequency due to skin effect in individual strands not being able to share current cleanly across strand boundaries. Litz wire (many isolated strands individually enameled) mitigates this for audio and RF. For DC and low-frequency AC, stranded and solid of the same AWG are interchangeable electrically.

Third, **ampacity tables are not a simple function of AWG**. NEC Table 310.16 gives different ampacity for the same AWG depending on insulation type (THHN vs THWN-2 vs XHHW), bundle count (more wires in a conduit → derate), ambient temperature (higher ambient → derate), and number of current-carrying conductors. The calculator card showing "14 AWG = 15 A" is using the residential-wiring lookup for THHN at 60°C ambient with 3 or fewer current-carrying conductors — a real power-electronics design (motor phase wiring at 80°C ambient, four conductors in a bundle) would derate that to 10 A or less. [[motor-power-wiring-below-14awg-overheats-at-15a-and-creates-fire-risk-so-gauge-is-chosen-by-steady-state-current-not-voltage]] and [[high-current-motor-phase-wires-require-14awg-minimum-and-undersized-wiring-is-a-fire-hazard]] are worked cases of this ampacity trap.

Outside North America, **IEC 60228** and the equivalent metric system specifies wires directly by cross-sectional area in mm² (0.75 mm², 1.5 mm², 2.5 mm² are common residential sizes). The metric system is linear in area, not logarithmic — it is arithmetically simpler but loses the "every 3 steps doubles" symmetry that makes AWG calculations fast in the head. Inter-standard conversion is why the Calculator card exists.

**SWG (Standard Wire Gauge)**, formerly the British system, is a third scale that is *not* the same as AWG — 20 SWG ≠ 20 AWG. Modern UK practice uses metric mm² almost exclusively; SWG appears only in legacy documentation and a few specialty areas like guitar strings and needle sizing.

---

Relevant Notes:
- [[motor-power-wiring-below-14awg-overheats-at-15a-and-creates-fire-risk-so-gauge-is-chosen-by-steady-state-current-not-voltage]] — ampacity-driven sizing for motor wiring
- [[high-current-motor-phase-wires-require-14awg-minimum-and-undersized-wiring-is-a-fire-hazard]] — minimum-AWG rule for phase wiring
- [[moc-electronics-math]] — parent MOC

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
