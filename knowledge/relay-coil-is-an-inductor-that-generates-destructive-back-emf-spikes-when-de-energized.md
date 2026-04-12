---
description: "When a relay coil is switched off, its collapsing magnetic field generates a voltage spike (back-EMF) of 100-400V that will destroy the driver transistor without a flyback diode across the coil"
type: claim
source: "docs/parts/songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "songle-srd-05vdc-sl-c"
  - "1n4007"
---

# Relay coil is an inductor that generates destructive back-EMF spikes when de-energized

A relay coil is a wire wound around an iron core -- physically identical to any other inductor. When current flows through the coil, energy is stored in the magnetic field. When the driver transistor switches off, the magnetic field collapses and the inductor tries to maintain current flow (V = L * di/dt). With nowhere for the current to go, the voltage across the coil spikes to hundreds of volts -- easily 100-400V from a 5V relay coil -- in the opposite polarity to the supply.

This spike appears directly across the collector-emitter junction of the driver transistor (or drain-source of a MOSFET). A 2N2222 is rated for 40V Vceo. A 100V+ spike will punch through the junction and destroy the transistor instantly or degrade it over repeated cycles.

**The fix is a flyback diode:** A 1N4007 (or any general-purpose diode rated above the coil current) wired across the coil with cathode to the positive coil terminal and anode to the negative terminal. When the coil generates the reverse voltage spike, the diode conducts, clamping the spike to ~0.7V above the supply rail. The stored energy dissipates as heat in the coil resistance and diode forward drop.

**Why this is the same physics as motor flyback but with a different solution:**
- For motors, the inductive spikes occur during PWM switching at kHz rates, so fast-recovery diodes are needed (the 1N4007's 2us trr is too slow for PWM)
- For relays, the coil switches once per activation (sub-Hz), so the 1N4007's slow recovery time is irrelevant -- it only needs to clamp once per switch event
- This is why the 1N4007 is correct for relay flyback but wrong for motor flyback, even though both are inductive loads

**Relay module vs bare relay:** Pre-built relay modules include the flyback diode on the PCB. Bare relays (the standalone blue cube) do not. Every bare relay circuit requires an externally added diode, and omitting it is the second most common relay wiring error after direct GPIO drive.

---

Relevant Notes:
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] -- same physics (inductive kickback), different mitigation strategy (cap vs diode)
- [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]] -- motor drivers face the same back-EMF problem at PWM frequencies
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] -- the driver transistor that the flyback diode protects

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
