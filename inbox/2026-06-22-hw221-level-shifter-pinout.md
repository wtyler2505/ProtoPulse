---
summary: HW-221 (YF08E) 8-channel bidirectional logic level converter — diagram-verified 20-pin layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: components101 YF08E/TXS0108E pinout diagram (visually verified) + TI TXS0108E datasheet
verified: 2026-06-22
---

# HW-221 (YF08E) 8-channel level converter — verification note

Added `core:hw221-level-shifter` to `@protopulse/parts`. Tyler owns 2× ("HW-221
Bidirectional Logic Level Converter" in the component log). Pinout **diagram-verified** —
this was PARKED pending a visual pass because the row order + OE placement weren't
text-resolvable; the diagram resolved it.

## Part
- **MPN:** HW-221 (YF08E IC — a TXS0108E-equivalent 8-channel auto-direction shifter)
- **Class:** `ic`, refPrefix **U** (module). 20 pins (two 10-pin rows). Footprint deferred.

## Pinout — two 10-pin rows (diagram, top→bottom)
- **Low-voltage A side:** `VA, A1, A2, A3, A4, A5, A6, A7, A8, OE`
- **High-voltage B side:** `VB, B1, B2, B3, B4, B5, B6, B7, B8, GND`
- Channels pair straight across: **A1↔B1 … A8↔B8, OE↔GND**, VA↔VB.

## Correction vs the owner catalog
The catalog described the rows as `VA, A1–A8, GND ‖ VB, B1–B8, GND` (a GND on the low side,
no OE). The **viewed diagram** shows the real silk: the bottom A-side pin is **OE** (output
enable, active HIGH, internal pulldown → disabled/high-Z when floating), and the **single
GND is on the B side**. This is the TXS0108E/YF08E silicon — exactly why the part was parked
for a visual pass rather than modeled from the (wrong) catalog text.

## Behavior / ERC modeling
- **VA → power_in** (lower reference, 1.2–3.6 V). **VB → power_in** (higher reference,
  1.65–5.5 V; VA ≤ VB). **GND → power_in.**
- **OE → input** (host-driven enable, active HIGH).
- **A1–A8, B1–B8 → bidi** — auto-direction bidirectional channels (no DIR pin; the part
  senses drive direction per channel).
- The module carries **no manufacturer pin numbers**; the 1–20 numbering is our convention
  (A side 1–10, B side 11–20).

## Verification
- Visual: components101 YF08E/TXS0108E pinout diagram read as an image — the diagram itself
  shows the "YF08E" IC + "HW-221" silk, confirming the 8-channel target (NOT the 4-channel
  BSS138 board). Cross-checked against the TI TXS0108E datasheet architecture (VCCA/VCCB/OE).
- Vault (`qmd_search`): no prior HW-221 note.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-hw221-level-shifter.md`
(never author `knowledge/` directly).
