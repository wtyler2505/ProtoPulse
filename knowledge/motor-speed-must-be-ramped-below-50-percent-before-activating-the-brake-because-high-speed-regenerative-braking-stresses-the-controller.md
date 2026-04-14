---
description: "Engaging the ZS-X11H CT brake at full speed shorts the motor windings against their own back-EMF — the resulting current pulse flows through the low-side MOSFETs in reverse and can exceed their peak Id rating, so speed must be ramped below 50 percent before brake activation to keep the back-EMF current within safe limits"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "riorand-zs-x11h"
  - "hoverboard-bldc-hub-motor"
---

# Motor speed must be ramped below 50 percent before activating the brake because high-speed regenerative braking stresses the controller

A BLDC motor spinning at full speed is a voltage source — the rotor's permanent magnets moving past the stator windings generate a back-EMF roughly equal to the commanded supply voltage (that is why motors stop accelerating once they reach steady state: the back-EMF has cancelled the applied voltage). When the ZS-X11H's CT brake is engaged, the controller switches all three low-side MOSFETs ON simultaneously, shorting the three motor phases together. The back-EMF now drives current through that short, flowing backward through the low-side FETs relative to normal operation.

The current magnitude is set by the back-EMF divided by the motor's winding resistance. For a 250W hoverboard motor at 36V with ~0.2-0.3 ohm phase resistance, full-speed back-EMF is approximately 30V and the resulting short-circuit current is 30V / 0.2 ohm ≈ 150A — roughly an order of magnitude above the 16A continuous rating of the controller's MOSFETs and well above their pulsed-current peak Id. The FETs survive this only briefly; repeated full-speed braking events accumulate thermal damage and walk the controller toward early failure.

The 50 percent threshold exists because back-EMF scales linearly with speed. At half speed the back-EMF is ~15V, the short-circuit current is ~75A, and the duration the FETs spend near peak is short because the braking action itself is rapidly reducing the back-EMF. The controller tolerates 75A for tens of milliseconds as the motor slows; it does not tolerate 150A for the same duration. The practical rule is:

```cpp
void brakeToStop() {
  // Ramp down speed first to stay under the back-EMF limit
  for (int s = currentSpeed; s > 0; s -= 5) {
    setMotorSpeed(s);
    delay(20);
    if (s <= 128) break;  // hit the 50% threshold, safe to brake
  }
  digitalWrite(PIN_BRAKE, LOW);   // engage brake (active-LOW on CT)
  delay(200);                      // allow rotor to stop
  digitalWrite(PIN_BRAKE, HIGH);   // release — [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets|do not hold]]
}
```

This rule pairs with [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets|the pulsed-brake rule]] to define both ends of the braking operating window. At full speed the back-EMF is too high and the FETs are stressed by current magnitude. At zero speed the back-EMF is zero and the FETs are stressed by continuous conduction with no cooling relief. The safe zone sits in the middle: engage brake below 50 percent speed, release as soon as the rotor stops.

For firmware that cannot easily measure speed, two proxies work. Time-based: if the speed command has been below 128 for at least 200ms, the rotor has decelerated enough. Current-based: the ZS-X11H's speed-feedback pulses (SC pin) drop to a rate below 30Hz when the motor is under 50 percent. Either proxy is cheaper than true speed sensing and the rule tolerates significant inaccuracy — the 50 percent threshold is a recommendation with margin, not a cliff.

The [[stop-is-the-correct-emergency-kill-and-ct-brake-is-for-controlled-deceleration-because-only-stop-removes-the-controller-power-path-entirely|emergency-stop distinction]] is relevant here: if the goal is emergency stopping, use STOP LOW instead of the CT brake. STOP disables the controller entirely, letting the motor coast, which trades stopping distance for controller safety. The CT brake is for *controlled* deceleration within a planned speed profile, not for panic stops from full speed.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] — the zero-speed end of the braking operating window
- [[stop-is-the-correct-emergency-kill-and-ct-brake-is-for-controlled-deceleration-because-only-stop-removes-the-controller-power-path-entirely]] — when to use STOP instead of CT brake
- [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]] — the related rule that direction changes at speed also kill FETs
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] — why the controller has no internal protection to catch this misuse

Topics:
- [[actuators]]
- [[eda-fundamentals]]
