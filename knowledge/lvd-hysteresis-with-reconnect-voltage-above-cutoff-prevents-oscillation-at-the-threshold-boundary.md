---
description: "A low-voltage disconnect that reconnects at the same voltage it cut off at will oscillate on/off rapidly as the load drops, battery rebounds, load restarts, and battery sags again -- separating cutoff (30V) from reconnect (33V) creates the hysteresis band that breaks this cycle"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hoverboard-10s-battery-pack"
---

# LVD hysteresis with reconnect voltage above cutoff prevents oscillation at the threshold boundary

A low-voltage disconnect (LVD) without hysteresis has a classic failure mode. When the battery sags to the cutoff voltage under load, the LVD disconnects. The load goes away, the battery's internal resistance no longer drops terminal voltage, and the battery voltage rebounds above the cutoff threshold. The LVD reconnects. The load resumes, the battery sags again, the LVD cuts off. This cycle repeats at frequencies ranging from hertz to kilohertz depending on battery chemistry and load dynamics, stressing relay contacts, corrupting MCU state, and rapidly draining what little battery capacity remains.

The fix is a two-threshold design: cut off at 30V (3.0V per cell for Li-Ion) but only reconnect at 33V. The 3V gap is the hysteresis band. Once the LVD disconnects, the battery must recover past 33V before power returns -- which requires either extended rest time or actual charging. The mid-range 30-33V window is a one-way trip: you can enter it from above (discharging) but must exit from below (charging above 33V).

The same hysteresis pattern appears in every threshold-controlled system: [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot|Schmitt triggers in logic circuits]] clean up slow edges by the same mechanism, thermostats with heat/cool deadbands avoid relay chatter, mechanical relays have pull-in/drop-out differentials built in, and WiFi access-point roaming uses signal-strength hysteresis to prevent hand-off ping-pong. The universal principle is that a single threshold creates bistable chatter; a threshold with a hysteresis band creates clean state transitions. The voltage scale changes (millivolts for logic, volts for batteries, dB for radio) but the mechanism is identical.

For Li-Ion specifically, the 3V hysteresis serves a second purpose beyond stopping oscillation. The battery's recovery from load is a chemistry-limited process that takes time -- seconds to minutes for full recovery. A LVD that reconnects as soon as voltage rebounds (within milliseconds) reconnects to a battery whose internal state hasn't actually improved. Forcing a 3V recovery effectively forces a wait for real chemical recovery, preventing repeated deep-discharge cycles that would shorten pack life.

For lead-acid packs (no BMS) the hysteresis is even more important because the recovery curves are slower and sulfation damage from repeated deep-discharge is severe. An external LVD module with programmable thresholds lets you tune the band for the specific chemistry in use.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- the voltage range where LVD thresholds are set
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] -- the BMS is the first-line LVD; external LVD is a secondary layer or a lead-acid replacement
- [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]] -- same hysteresis pattern in a different domain: a logic-level threshold with asymmetric rising/falling trip points prevents output chatter on slow-edged inputs, identical mechanism to LVD cutoff/reconnect separation

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
