---
description: "The ZS-X11H's onboard 5V output is derived from the same 78L05 that powers its commutation logic and hall sensors, so motor switching transients ride on top of that rail — powering an external MCU from it produces brownout resets and erratic analog readings that a separate LM2596 from the main battery eliminates"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[microcontrollers]]"
related_components:
  - "riorand-zs-x11h"
  - "arduino-mega-2560"
  - "lm2596"
---

# Powering the MCU from the ZS-X11H 5V output causes resets because motor switching noise on the shared rail corrupts the logic supply

The ZS-X11H exposes a 5V terminal that looks inviting for powering a small Arduino: one less wire, one less buck converter, one less part in the BOM. The terminal is not a clean auxiliary rail, though — it is the output of the 78L05 linear regulator that already feeds the controller's own commutation logic, its gate drivers, and its Hall sensor bus. Every PWM transition that the MOSFET bridge makes pulls current through the same ground return and the same local decoupling network that this 5V rail shares, so switching transients of 50-200mV ride continuously on the output. The regulator's 100mA current limit only makes things worse: any brief surge from an MCU WiFi burst or a sensor sample drives the rail close to its drop-out region, and the regulator sags before it clamps.

The consequence is two characteristic failure modes that show up together and confuse beginners who have not split the supplies. Brownout resets appear as the Arduino restarting every time the motor accelerates — the reset line crosses its threshold during the PWM-induced dip and the bootloader runs again. Erratic analog readings appear as ADC values that jitter by 10-30 counts on a stationary signal, because the ADC reference is tied to Vcc and Vcc is no longer a reference. Neither symptom points cleanly at the shared-rail root cause: both look like firmware bugs, wiring flakiness, or a defective board until someone scopes the 5V rail and sees the switching noise.

The fix is architectural, not a filter. An [[lm2596-adjustable-buck-converter-module-3a-step-down|LM2596 buck converter]] (or any isolated regulator) fed from the main 36V battery gives the MCU a rail whose only load is the MCU itself, with its own input and output capacitors and no coupling path to the motor PWM current. The two domains share one connection only — the [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float|common ground]] — and that connection is for signal reference, not current return. A 10uF ceramic at the MCU's Vin lives on top of this clean rail as a [[10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds|burst-response reservoir]] rather than a noise filter trying to clean up a compromised supply.

The ZS-X11H 5V terminal is still useful — for what it was designed for. The controller's [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed|78L05]] exists to power the motor's Hall sensor string, not external microcontrollers, and leaving that terminal free for its intended job avoids the failure mode where an over-drawn 78L05 kills the Hall bus and makes the motor appear dead.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed]] — the other failure mode on the same 78L05 regulator
- [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]] — the single connection that must exist between the two domains
- [[10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds]] — the Vin cap that rides on the clean LM2596 rail
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — the filter pattern that still does not substitute for supply separation

Topics:
- [[actuators]]
- [[power-systems]]
- [[microcontrollers]]
