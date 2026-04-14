---
description: "BLDC motors are inductive loads that generate flyback voltage spikes exceeding the supply voltage during commutation transitions -- a 470uF 63V electrolytic cap across V+/V- at the controller absorbs these spikes and prevents damage"
type: claim
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# inductive motor loads require bypass capacitor to absorb voltage spikes above supply rail

Every motor is an inductive load. When the controller switches phase currents during commutation, the motor's inductance resists the change in current (V = L * di/dt). This generates voltage spikes on the supply rail that can significantly exceed the nominal supply voltage. On a 36V system with a BLDC motor drawing 15A, these transient spikes can reach 60V or more -- right at the ZS-X11H's absolute maximum input voltage.

The mitigation is a large electrolytic capacitor (470uF, rated at least 63V for a 60V-max system) placed physically as close as possible to the controller's V+/V- power terminals. The capacitor acts as a local energy reservoir that absorbs the voltage spikes, clamping them to a safe level. The ESR (equivalent series resistance) of the capacitor matters -- aluminum electrolytics have low enough ESR for this application, but ceramic bypass caps (0.1uF-1uF) in parallel further suppress high-frequency components.

**Why this applies broadly:** This is not specific to the ZS-X11H or BLDC motors. Every motor driver circuit benefits from bypass capacitors:
- L298N datasheets specify 100nF ceramic + 100uF electrolytic
- ESCs for RC applications include onboard capacitors
- The TB6612FNG evaluation board includes decoupling capacitors in the reference design

The ZS-X11H is notable because it has NO onboard capacitance adequate for the voltage/current levels it handles. The 200-400W power range at 6-60V input demands external capacitance that the PCB doesn't provide.

**Wire gauge matters too:** The capacitor must be connected with wires at least as heavy as the power supply wires (14AWG minimum at 16A). Thin wires to the cap add inductance that defeats its purpose. Short, fat connections directly to the power terminals are ideal.

---

Source: [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]

Relevant Notes:
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- the cap is part of the same "protection the board doesn't provide" category
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- the high-power tier requires external protection components that lower tiers often include onboard
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] -- four motors produce four times the inductive transients, compounding the need for adequate capacitance

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
