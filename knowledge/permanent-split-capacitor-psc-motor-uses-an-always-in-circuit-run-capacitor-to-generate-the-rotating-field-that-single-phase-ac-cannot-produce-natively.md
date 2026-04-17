---
description: "A single-phase AC motor cannot start itself because one alternating sine wave produces an oscillating field not a rotating one — PSC motors solve this with a run capacitor permanently wired to an auxiliary winding, producing a 90-degree phase-shifted current that creates the rotating field needed for startup and continuous operation"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[actuators]]"
---

# Permanent Split Capacitor (PSC) motor uses an always-in-circuit run capacitor to generate the rotating field that single-phase AC cannot produce natively

A three-phase AC motor gets a rotating magnetic field for free — the three phases are 120° apart in time, and the coils are arranged 120° apart in space, so the field naturally rotates. Single-phase AC has only one alternating waveform, which by itself produces an oscillating (not rotating) field. The motor would hum in place and never spin up.

**The PSC trick:**
- Wind a second "auxiliary" winding at 90° spatial offset from the main winding
- Run the auxiliary winding through a capacitor (typically 5-50 µF) to the same AC supply
- The capacitor phase-shifts the auxiliary current by roughly 90° relative to the main winding's current
- Result: two currents 90° apart in time, flowing through coils 90° apart in space → approximation of a rotating field

**Key properties of PSC motors:**
- **Capacitor stays in circuit always** (hence "permanent") — unlike Capacitor Start/Induction Run motors that switch the cap out with a centrifugal switch after startup
- **Lower starting torque** than Capacitor Start designs — fine for fans, pumps, gearmotors driving friction loads; inadequate for heavy-inertia startup
- **Smoother, quieter operation** than start-only capacitor designs because the rotating field is maintained at all speeds
- **The run capacitor IS the most common failure point** — dried-out or shorted run cap = motor hums but won't spin

**Typical PSC applications:**
- HVAC blower motors, condenser fans
- Gearmotors (like the Von Weise V05748AN76)
- Pool pumps, shop ventilation
- Automatic door openers, conveyor drives

**Diagnostic pattern when a PSC motor fails:**
1. Motor hums but doesn't spin → check the run cap first (ESR meter or capacitance meter)
2. Motor overheats quickly → run cap may be slightly off spec, causing circulating currents in windings
3. Motor runs rough → run cap may be drifting; replace with same or higher µF rating, same or higher voltage rating

**Capacitor sizing rule:**
The cap rating is critical — too small and torque is weak; too large and the motor draws excessive current in the auxiliary winding and overheats. Always replace with the same µF value stated on the motor nameplate or original cap.

---

Source: docs_and_data

Relevant Notes:
- [[class-x2-capacitors-connect-across-live-and-neutral-where-short-circuit-failure-only-trips-a-fuse-not-shocks-a-user]] — different category of mains capacitor (filter vs run cap)
- [[ac-line-emi-filter-capacitors-degrade-silently-by-losing-capacitance-so-periodic-measurement-is-the-only-way-to-catch-a-worn-filter]] — same silent-capacitance-drift failure mechanism in a different role

Topics:
- [[actuators]]
