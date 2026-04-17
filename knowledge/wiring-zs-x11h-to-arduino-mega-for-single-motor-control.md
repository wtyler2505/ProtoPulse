---
description: "Single-motor BLDC control wiring from Arduino Mega to a ZS-X11H controller: EL/ZF/BK/STOP pin roles, STOP high-initialization-before-enable sequence, CT brake vs STOP kill, ramp-below-50-percent before braking, and common-ground discipline between MCU and controller."
type: moc
topics:
  - "[[wiring-integration]]"
  - "[[power-systems]]"
  - "[[index]]"
---

# ZS-X11H to Arduino Mega (single motor control)

Single-motor BLDC control wiring from Arduino Mega to a ZS-X11H controller: EL/ZF/BK/STOP pin roles, STOP high-initialization-before-enable sequence, CT brake vs STOP kill, ramp-below-50-percent before braking, and common-ground discipline between MCU and controller.

## Knowledge Notes

- [[bms-overcurrent-protection-tripping-on-acceleration-is-a-software-problem-solved-by-ramp-rate-limiting-not-a-hardware-fault]] — A motor that spins up briefly then cuts out is almost never a BMS fault or a failing controller — it is a firmware issue where the
- [[ct-brake-polarity-on-the-zs-x11h-is-active-low-contradicting-the-kjl-01-claim-that-brake-is-active-high-suggesting-the-polarity-is-vendor-specific-not-a-bldc-convention]] — The ZS-X11H datasheet and its Arduino wiring recipe both show CT brake as active-LOW (digitalWrite LOW engages brake), but the KJL-01
- [[el-pin-floating-at-mcu-boot-defaults-the-motor-to-full-speed-so-explicit-high-initialization-is-mandatory-before-stop-is-enabled]] — Because the ZS-X11H EL input is active-LOW, a floating GPIO during the MCU boot window reads as full speed — setup() must drive EL HIGH
- [[motor-power-wiring-below-14awg-overheats-at-15a-and-creates-fire-risk-so-gauge-is-chosen-by-steady-state-current-not-voltage]] — Wire gauge is set by the I2R heating the conductor dissipates, not by the voltage it carries — 22AWG bundles that safely carry a 36V logic
- [[motor-speed-must-be-ramped-below-50-percent-before-activating-the-brake-because-high-speed-regenerative-braking-stresses-the-controller]] — Engaging the ZS-X11H CT brake at full speed shorts the motor windings against their own back-EMF — the resulting current pulse flows
- [[powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets-because-motor-switching-noise-on-the-shared-rail-corrupts-the-logic-supply]] — The ZS-X11H's onboard 5V output is derived from the same 78L05 that powers its commutation logic and hall sensors, so motor switching
- [[safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state]] — Every safety-relevant BLDC control pin must be driven to its passive state before any pin is driven to an active state — the correct
- [[stop-is-the-correct-emergency-kill-and-ct-brake-is-for-controlled-deceleration-because-only-stop-removes-the-controller-power-path-entirely]] — STOP LOW disables the ZS-X11H's commutation logic and de-energizes all three motor phases, letting the rotor coast freely; CT LOW shorts

## Open Questions
(populated by /extract)

---

Topics:
- [[wiring-integration]]
- [[power-systems]]
- [[index]]
