---
description: "The ZS-X11H datasheet and its Arduino wiring recipe both show CT brake as active-LOW (digitalWrite LOW engages brake), but the KJL-01 controller from the same vendor family is documented as active-HIGH — these two data points collapse the assumption that brake polarity is a stable BLDC-class convention, and the practical implication is that per-controller verification is mandatory before trusting any generic brake rule"
type: tension
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: open
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "riorand-zs-x11h"
  - "riorand-kjl01"
---

# CT brake polarity on the ZS-X11H is active-low contradicting the KJL-01 claim that brake is active-high suggesting the polarity is vendor-specific not a BLDC convention

Two documented data points from the same vendor family disagree on brake polarity in a way that has direct safety implications for anyone treating BLDC brake rules as portable across controllers:

- **ZS-X11H** (docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md): "CT (brake): LOW = brake engaged, HIGH = free run" and `digitalWrite(7, LOW) = Brake engaged (motor actively resists rotation)`. Brake is **active-LOW**.
- **KJL-01** ([[bldc-stop-active-low-brake-active-high]]): "BRAKE is active-high (connect to 5V to engage dynamic braking, leave floating for no brake)." Brake is **active-HIGH**.

The STOP polarity agrees between the two (both active-LOW, both defaulting to "motor allowed to run" when the pin floats). Only the brake polarity inverts. Because both controllers come from the same vendor ecosystem (RioRand) and both are specified for driving 3-phase BLDC hub motors of the hoverboard class, the naive reading is that this is a BLDC-industry convention and whichever rule you learned first applies to any controller you meet. The two controllers together disprove that reading.

The consequences of misapplying the KJL-01 rule to a ZS-X11H (or vice versa) are asymmetric and both bad:

- **KJL-01 rule on ZS-X11H hardware:** The firmware drives CT HIGH to engage brake. On the ZS-X11H, CT HIGH is the free-run state. The brake never engages. Commanded deceleration calls do nothing and the motor coasts well past the intended stopping point. A panic-stop routine that relies on brake never stops the motor; only STOP does.
- **ZS-X11H rule on KJL-01 hardware:** The firmware drives CT LOW to engage brake. On the KJL-01, CT LOW is the free-run state. Same symptom: brake never engages. The safer variant of the failure — but equally broken.
- **Either rule applied with both pins LOW by default on boot:** On a ZS-X11H this engages both STOP (disabled) and CT (brake engaged). On boot the motor is double-protected. On a KJL-01 this engages STOP but leaves brake released — motor simply disabled. The ZS-X11H is *more* forgiving at boot, but silently — the difference only matters if the firmware later tries to use the brake.

The resolution options for the existing knowledge note:

1. **Split the note by controller.** Create two notes: one for the ZS-X11H (STOP active-LOW, CT active-LOW), one for the KJL-01 (STOP active-LOW, BRAKE active-HIGH). Leave the existing generic-titled note as a topic map that links to both. This is the right move if both claims survive datasheet verification.
2. **Demote the existing note to one-controller scope.** Edit the KJL-01 note to be explicit about its source and pin naming (BRAKE, not CT), and leave the ZS-X11H to a separate note. This is the right move if the KJL-01 claim is confirmed but the existing note is wrongly generalized.
3. **Flag the existing note as contested.** If datasheet verification cannot resolve the contradiction (both datasheets are ambiguous, or contradict their own wiring diagrams), tag the existing note with a `tension_note` reference pointing to this one. This is the right move if the polarity turns out to be genuinely firmware-configurable or depends on a jumper that neither source mentions.

Until the tension is resolved, the operational rule for ProtoPulse's DRC and bench-coach is: **brake polarity is vendor-specific and must be verified per-controller before any automated check trusts it.** Treat brake as untrusted input to any rule that claims "brake engaged" means a specific pin state, and warn users to continuity-check the controller's documented pin behavior against its actual response during bench-up.

This also generalizes: the [[ct-brake-polarity-on-the-zs-x11h-is-active-low-contradicting-the-kjl-01-claim-that-brake-is-active-high-suggesting-the-polarity-is-vendor-specific-not-a-bldc-convention|vendor-specific polarity]] pattern likely extends to other "BLDC convention" rules — direction pins, enable pins, Hall sense-wire order. The tension here is one data point in a larger claim that BLDC controllers have less standardization than their family-resembling pinouts imply.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[bldc-stop-active-low-brake-active-high]] — the existing note this claim contests on the brake-polarity row
- [[stop-is-the-correct-emergency-kill-and-ct-brake-is-for-controlled-deceleration-because-only-stop-removes-the-controller-power-path-entirely]] — the role hierarchy that assumes correct polarity identification
- [[safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state]] — the sequence that will silently fail if brake polarity is wrong
- [[multi-pole-switch-pinout-must-be-mapped-by-continuity-testing-because-pin-assignments-are-not-standardized]] — the general "continuity-verify before trusting vendor diagrams" pattern this tension instantiates

Topics:
- [[actuators]]
- [[eda-fundamentals]]
