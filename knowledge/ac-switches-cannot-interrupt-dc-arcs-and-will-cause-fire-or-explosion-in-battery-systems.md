---
description: "AC-rated switches rely on zero-crossing arc extinction that does not exist in DC -- using one for DC battery disconnect creates sustained arcs that weld contacts, melt housings, and start fires"
type: claim
source: "docs/parts/main-power-switch-anl-fuse-100a-disconnect-for-36v.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "battery-disconnect-switch"
---

# AC switches cannot interrupt DC arcs and will cause fire or explosion in battery systems

When a switch opens under load, an electrical arc forms across the separating contacts. In AC circuits, the alternating current passes through zero 100-120 times per second, briefly extinguishing the arc. Even cheap AC switches can safely interrupt high currents because physics does most of the work.

DC has no zero crossing. The arc burns continuously once established, sustained by the constant voltage of the battery. The energy deposited in the arc grows linearly with time, limited only by the battery's ability to deliver current (which for lithium packs can be hundreds of amps).

**What happens when you use an AC switch for DC battery disconnect:**
1. Switch opens under 80A load
2. Arc forms between contacts (36V is well above the ~12V minimum arc voltage for most gaps)
3. Arc burns continuously -- no zero crossing to help
4. Contact material vaporizes into conductive plasma
5. Plastic housing near the arc starts melting
6. Contacts either weld shut (switch cannot be turned off) or the housing fails catastrophically

A switch rated "250V AC / 30A" might safely switch 30A AC but fail dangerously at 10A DC because the DC interrupt capability is fundamentally different from the AC rating.

**Selection criteria for DC battery disconnect:**
- Must have explicit DC voltage and current interrupt rating (not just AC)
- DC interrupt rating must exceed battery short-circuit current (>500A for lithium packs)
- Contact material must be arc-resistant (silver cadmium oxide, not plain copper)
- Must have arc suppression (magnetic blowout, arc chute, or hermetic gas-filled contacts)

**ProtoPulse implication:** The DRC should verify that any switch in a DC power path has a DC-specific rating. The AI should flag AC-only rated switches as unsafe for battery circuits and suggest DC-rated alternatives.

---

Relevant Notes:
- [[dc-contactor-must-have-magnetic-blowout-arc-suppression-or-contacts-will-weld-under-dc-load]] -- same DC arc physics, applied to the e-stop contactor
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- the fuse upstream of this switch
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- the voltage range the switch must handle

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
