---
description: "Many mid-to-high-end motor drivers (Cytron MD25HV, VESC, ESCs) include an integrated BEC (Battery Eliminator Circuit) — a small buck converter that outputs 5V at 250mA-3A to power the controlling microcontroller — which eliminates a separate power supply for the MCU at the cost of shared ground noise"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[power-systems]]"
---

# Motor driver with integrated BEC can power the Arduino directly, eliminating a separate buck converter if the BEC current is sufficient

Many motor drivers include a Battery Eliminator Circuit (BEC) — a small onboard buck converter that takes the motor supply voltage (typically 7-60V) and produces a regulated 5V or 3.3V rail for the controlling microcontroller.

**Why "Battery Eliminator":**
The name comes from RC cars and planes — historically, the receiver ran on its own 4×AA pack while the motor ran on the main battery. A driver with a built-in BEC eliminates the separate receiver battery. Modern usage extends to any driver that powers its controller from the motor supply.

**Current ratings you'll see:**
- **Cytron MD25HV** — 5V at 250mA (enough for Arduino Uno + simple sensors)
- **Generic ESCs** — 5V at 1-3A (enough for Raspberry Pi Zero, sometimes Pi 3/4)
- **VESC** — 5V at 1A plus a 3.3V at 500mA rail
- **ODrive** — no BEC; expects external controller power

**When the integrated BEC works:**
- Controller current draw is well under BEC rating (2x margin is good practice)
- Controller shares ground with motor driver (most projects do)
- Motor braking/regen doesn't spike the supply above BEC input max

**When you need a separate supply:**
- **Raspberry Pi 4/5** with peripherals often draws 2-3A — 250mA BECs won't do it
- **Galvanically-isolated** designs (medical, high-voltage industrial) where the controller CANNOT share ground with the power stage
- **Multi-camera Pi systems**, screens, WiFi-heavy boards — current budget exceeds BEC
- **Brownout sensitivity** — if the BEC dips during motor startup surges, the MCU resets; a separate well-decoupled supply avoids this class of bug

**Diagnostic tell:**
"My Arduino resets when the motor starts" with a driver-powered Arduino → either the BEC is current-starved during motor inrush, or EMI is coupling through the shared ground. Fix: add a 100-470µF electrolytic across the Arduino's 5V rail, or power the Arduino from a separate supply.

---

Source: docs_and_data

Relevant Notes:
- [[cytron-md25hv-completes-the-brushed-dc-driver-voltage-ladder-tb6612-at-13v-l298n-at-46v-md25hv-at-58v-with-25a-continuous]] — the specific driver this is about
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — the fix for BEC-powered Arduinos with motor EMI issues
- [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]] — alternative architecture

Topics:
- [[power-systems]]
