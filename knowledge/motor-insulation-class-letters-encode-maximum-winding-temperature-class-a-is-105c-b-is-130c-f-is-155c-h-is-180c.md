---
description: "The single-letter insulation class on a motor nameplate (A, B, F, H) encodes the maximum allowable winding temperature — A is 105°C, B is 130°C, F is 155°C, H is 180°C — and determines how much thermal margin the motor has between ambient and failure"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[actuators]]"
---

# Motor insulation class letters encode maximum winding temperature: Class A is 105°C, B is 130°C, F is 155°C, H is 180°C

Every AC and larger DC motor carries an insulation class letter on its nameplate. This letter specifies the maximum safe operating temperature for the winding insulation itself — not the frame, not the shaft, the copper-and-varnish windings inside.

| Class | Max winding temp | Typical applications |
|-------|------------------|---------------------|
| A | 105°C | Old / obsolete, cheap toys |
| E | 120°C | European equivalent to Class A+ |
| **B** | **130°C** | Standard motors (Von Weise gearmotor falls here) |
| F | 155°C | Most industrial motors today |
| H | 180°C | High-temp industrial, aerospace |
| N | 200°C | Specialty high-temp |
| R | 220°C | Specialty high-temp |

**How the temperature math works:**
The class temperature is the MAXIMUM allowed winding temperature. You do NOT design for winding temp = class temp; you design for a margin.

Typical design budget:
- **Ambient temperature**: 40°C (standard for industrial spec)
- **Winding rise above ambient**: 75-100°C at full load
- **Hot-spot margin**: 10-15°C above average winding temp
- Total: 125-155°C for Class B, 150-185°C for Class F

This is why motors are de-rated for higher ambient temperatures. A Class B motor rated for 40°C ambient will overheat if run in a 50°C enclosure — the 10°C ambient increase eats directly into the hot-spot margin.

**Arrhenius lifetime rule:**
Every 10°C above the class temperature roughly halves the insulation life. A Class B motor run continuously at 140°C (10°C over) will last half as long as one run at 130°C. This is the same physics as the electrolytic capacitor aging rule.

**Replacement/upgrade logic:**
- You CAN replace a Class B motor with a Class F in the same mount — higher class is always safe
- You CANNOT replace a Class F with Class B — the new motor will overheat at the same load the old one handled fine
- Higher class costs more (different varnish, different wire enamel)

**Diagnostic pattern:**
A motor running hot but not tripping thermal protection may be operating within its class limits while still degrading insulation. Periodic IR temperature measurement on the motor case is the only reliable way to catch slow insulation cooking.

---

Source: docs_and_data

Relevant Notes:
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] — same Arrhenius aging math in a different component
- [[permanent-split-capacitor-psc-motor-uses-an-always-in-circuit-run-capacitor-to-generate-the-rotating-field-that-single-phase-ac-cannot-produce-natively]] — motor architecture this applies to

Topics:
- [[actuators]]
