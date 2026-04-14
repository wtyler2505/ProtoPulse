---
description: "When high-current motor switching (15-30A through BLDC controllers) couples EMI onto a physically close Arduino 5V rail, the MCU may reset or behave erratically — a 100uF electrolytic capacitor across the Arduino's 5V and GND pins provides local bulk reservoir to absorb the fast transients that buck regulators cannot react to in time"
type: claim
source: "docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md"
confidence: high
topics:
  - "[[power-systems]]"
  - "[[wiring-integration]]"
  - "[[eda-fundamentals]]"
---

# 100uF capacitor on Arduino 5V input absorbs motor-switching EMI that causes MCU resets

The ZS-X11H switches 15A+ through motor phases at frequencies high enough to radiate significant EMI into nearby conductors. When the Arduino runs from its own LM2596 buck converter on the same chassis — exactly the architecture recommended for isolating the MCU from the motor bus — the 5V rail from the buck converter is still exposed to two coupling paths: capacitive pickup through chassis wiring and ground-bounce transients through the shared common ground. Both deliver fast voltage transients to the Arduino's 5V pin. The LM2596's control loop reacts in microseconds but not nanoseconds; fast transients pass through before the regulator can compensate.

The symptom is an Arduino that resets when motors start, stumbles during heavy acceleration, or loses I2C communication during motor duty-cycle changes. The diagnostic tell is that the same sketch runs reliably on a bench supply but misbehaves when motors are under load.

**The fix: a 100uF electrolytic capacitor across the Arduino's 5V input and GND.** The capacitor acts as a local bulk reservoir close enough to the Arduino that the fast transients are absorbed before they reach the MCU's internal supply. 100uF is large enough to buffer milliampere-scale current draws for microseconds — exactly the timescale the LM2596 cannot cover.

**Why 100uF specifically:** Smaller caps (10uF) handle only nanosecond-scale transients; those are usually handled by ceramic bypass caps already on the Arduino board. Larger caps (470uF, 1000uF) work but are overkill for the EMI problem and slow the Arduino's power-on sequence. 100uF hits the sweet spot for motor-switching EMI on 5V rails. A 16V or higher voltage rating is typical for 5V applications.

**Placement matters.** The cap should be across the 5V and GND pins as physically close to the Arduino as possible — ideally plugged directly into the Arduino's header pins or soldered to the DC jack input. A capacitor six inches away via jumper wires has already lost most of its effectiveness because the inductance of the wiring breaks its high-frequency response.

**Related but distinct from [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]]:** that note is about a capacitor across the motor supply to clamp back-EMF spikes on the motor side. This note is about a capacitor across the MCU supply to absorb EMI that coupled from the motor side to the MCU side. Same mechanism (capacitance as energy buffer), different location, different failure mode.

**And distinct from [[10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds]]:** that note addresses the opposite polarity — the load (WiFi TX) pulls more current than the regulator can supply fast enough. This note addresses the source (motor switching) injecting more energy than the regulator can bleed off fast enough. Symmetric problems, same mitigation (bulk capacitance), different direction of energy flow.

**ProtoPulse implication:** Any schematic pairing a BLDC motor controller with an Arduino should trigger a bench coach suggestion: "add 100uF across Arduino 5V." The suggestion is cheap to implement (a single through-hole cap), has no downside, and prevents a class of EMI-induced failures that are painful to diagnose later.

---

Source: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] — capacitance on the motor side clamps back-EMF; this note is capacitance on the MCU side absorbing coupled EMI
- [[10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds]] — same mitigation principle (bulk cap near the load to cover regulator response time) applied to a load-induced rather than source-induced transient
- [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]] — architectural isolation that this capacitor supplements but does not replace
- [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]] — the ground connection that creates the coupling path this capacitor mitigates

Topics:
- [[power-systems]]
- [[wiring-integration]]
- [[eda-fundamentals]]
