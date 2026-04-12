---
description: "Red mushroom e-stop button (Schneider XB5AS, NC contact) that breaks a DC contactor coil circuit to kill all 36V power. Albright SW200 contactor handles 250A with magnetic blowout arc suppression. Pressing e-stop de-energizes contactor coil, opening main power contacts — fail-safe design"
topics: ["[[power]]"]
status: needs-test
quantity: 1
voltage: [12, 24, 36]
interfaces: [Terminal]
logic_level: "N/A (electromechanical safety system)"
manufacturer: "Schneider Electric (e-stop button), Albright (DC contactor)"
part_number: "XB5AS8442 (e-stop), SW200-92 (contactor)"
pinout: |
  E-Stop Button (Schneider XB5AS):
    Terminal 11 → +12/24V from buck converter (NC input)
    Terminal 12 → To DC contactor coil (+) (NC output)
    Terminal 21 → NO input (not used for safety function)
    Terminal 22 → NO output (not used for safety function)

  DC Contactor (Albright SW200):
    Main IN (+)  → From main power switch output (#4 AWG, M10 ring)
    Main OUT (+) → To power distribution board (#4 AWG, M10 ring)
    Coil (+)     → From e-stop button terminal 12 (6.3mm spade)
    Coil (-)     → GND return to buck converter (6.3mm spade)
compatible_with: ["[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]", "[[power-distribution-board-fused-terminal-block-for-36v-system]]", "[[main-power-switch-anl-fuse-100a-disconnect-for-36v]]"]
used_in: []
warnings: ["E-stop MUST use Normally Closed (NC) contacts — wire fails open = safe shutdown. NEVER use NO contacts for safety stop", "DC contactor MUST have arc suppression (magnetic blowout) — without it, contacts will weld under DC load and the e-stop won't work", "E-stop button is for CONTROL circuit only (12/24V, <2A) — it does NOT directly switch 36V/100A power", "Mount e-stop in accessible exterior location — you need to reach it in an emergency", "System must NOT restart when e-stop is released — twist-to-release requires deliberate action", "Test e-stop function monthly — press, verify all power cuts, verify no restart until released"]
datasheet_url: ""
---

# Emergency Stop — NC Button with DC Contactor for 36V

The e-stop system uses a two-stage design: a small control circuit (12/24V) operates a big power contactor (36V, 100A+). You press the red mushroom button, its Normally Closed contact opens, the contactor coil loses power, the main power contacts spring open, and ALL 36V power dies instantly.

This is fail-safe by design:
- **Button not pressed**: NC contact is closed, coil is energized, contactor is closed, power flows.
- **Button pressed**: NC contact opens, coil de-energizes, contactor opens, power is CUT.
- **Wire breaks**: Same as button pressed — power cuts. This is why you use NC, not NO.
- **Coil power lost**: Same as button pressed — contactor opens. Fail-safe.

The twist-to-release mechanism prevents accidental restart — you have to deliberately rotate the mushroom head 90 degrees to re-engage.

## E-Stop Button Specifications (Schneider XB5AS8442)

| Spec | Value |
|------|-------|
| Actuator | Red mushroom head, 40mm diameter |
| Background | Yellow (per IEC 60947-5-5) |
| Contact Type | 1 NC (Normally Closed) |
| Contact Rating | DC-13: 0.5A at 24V |
| Reset Method | Twist-to-release (90 degree clockwise) |
| Mechanical Life | 1,000,000 operations |
| Electrical Life | 100,000 operations at rated current |
| IP Rating | IP66 (dust tight, heavy water spray) |
| Mounting | Panel mount, 22mm cutout |
| Operating Temp | -25C to +70C |
| Standards | ISO 13850, IEC 60947-5-5, UL, CSA |

## DC Contactor Specifications (Albright SW200-92)

| Spec | Value |
|------|-------|
| Voltage Rating | 36V DC nominal |
| Current Rating | 250A continuous (exceeds 100A requirement) |
| Breaking Capacity | 250A at 36V DC |
| Arc Suppression | Magnetic blowout coils |
| Coil Voltage | 12V or 24V DC (model dependent) |
| Coil Current | 0.5-0.8A typical |
| Contact Type | SPST, double-breaking |
| Contact Material | Silver alloy (weld resistant) |
| Main Terminals | M10 studs |
| Coil Terminals | 6.3mm spade connectors |
| Mechanical Life | 1,000,000 operations |
| Electrical Life | 100,000 operations at rated current |
| Operating Temp | -40C to +85C |
| Dimensions | ~90 x 70 x 90mm |
| Weight | ~700g |

## Circuit Diagram

```
CONTROL CIRCUIT (12V or 24V DC):

Buck Converter (+12/24V) ──→ E-Stop Terminal 11
                                    |
                              [NC Contact]  ← CLOSED when not pressed
                                    |         OPENS when pressed
                              E-Stop Terminal 12
                                    |
                              Contactor Coil (+)
                                    |
                              [Coil Winding]
                                    |
                              Contactor Coil (-)
                                    |
                              Buck Converter GND


POWER CIRCUIT (36V DC, 100A+):

Main Switch Output (+36V) ──→ Contactor Main IN (M10)
                                    |
                              [Main Contacts]  ← CLOSED when coil energized
                                    |             OPEN when coil de-energized
                              Contactor Main OUT (M10)
                                    |
                              Power Distribution Board
```

## Control Circuit Wiring

| From | To | Wire | Notes |
|------|----|------|-------|
| Buck converter +12/24V | E-stop terminal 11 | #18 AWG red | Control power supply |
| E-stop terminal 12 | Contactor coil (+) | #18 AWG red | NC contact output |
| Contactor coil (-) | Buck converter GND | #18 AWG black | Coil return |

## Power Circuit Wiring

| From | To | Wire | Notes |
|------|----|------|-------|
| Main switch output | Contactor main IN | #4 AWG red, M10 ring | 36V positive |
| Contactor main OUT | Distribution board | #4 AWG red, M10 ring | Protected 36V |

---

Related Parts:
- [[main-power-switch-anl-fuse-100a-disconnect-for-36v]] — upstream in the power chain; fuse + disconnect switch between battery and contactor
- [[power-distribution-board-fused-terminal-block-for-36v-system]] — downstream; contactor output feeds the distribution board
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — the 36V source this system protects
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — buck converter supplies 12/24V for the contactor coil control circuit

Categories:
- [[power]]
