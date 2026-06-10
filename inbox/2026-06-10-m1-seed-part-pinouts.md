# M1 seed-part pinout verification (greenfield packages/parts)

Captured during Milestone 1 of the ground-up redesign: pin maps web-verified
before authoring seed parts in `packages/parts/src/seed/`, per the Hardware
& Component Verification Protocol (knowledge/ had no notes on these parts).

## NE555 (DIP-8 / SOIC-8, TI)

Pin 1 GND · Pin 2 TRIG · Pin 3 OUT · Pin 4 RESET (active low) · Pin 5 CONT ·
Pin 6 THRES · Pin 7 DISCH · Pin 8 VCC.

Source: TI NE555 datasheet, https://www.ti.com/lit/ds/symlink/ne555.pdf
(also product page https://www.ti.com/product/NE555). Verified 2026-06-10.

## BAT54S (SOT-23, series dual Schottky)

Pin 1 = anode of D1 · Pin 2 = cathode of D2 · Pin 3 = common midpoint
(cathode of D1 + anode of D2). The series chain runs pin1 → D1 → pin3 → D2
→ pin2, which is why rail-clamp usage wires pin1→GND, pin2→VCC,
pin3→signal.

Sources: Vishay BAT54/A/C/S datasheet
https://www.vishay.com/docs/86410/bat54_bat54a_bat54c_bat54s.pdf, onsemi
BAT54SLT1 https://www.onsemi.com/pdf/datasheet/bat54slt1-d.pdf. Verified
2026-06-10.

## Deliberately NOT verified / stubbed

- USB-C connector: seeded as a power-only functional stub (VBUS/GND/CC1/CC2/
  SHIELD pins, no physical pin letters) — `provenance: unverified` until a
  receptacle MPN is chosen.
- ESP32-S3-WROOM-1: excluded from M1 seeds entirely (40+ pins; nothing in
  Track 1 or the Probe input-protection stage needs it). First post-M1 part,
  to be verified against the Espressif datasheet.
- Generic parts (R, C, LED, 1N4148, 1N5819, 2N3904, AO3400-class NMOS,
  tactile switch, 2×10 header, battery): seeded with conventional 2/3-pin
  symbols; diode/transistor pin NAMES are functional (A/K, E/B/C, G/D/S),
  not package pin numbers — package-level pin numbering deferred to footprint
  work (post-M1), where each MPN gets datasheet verification.
