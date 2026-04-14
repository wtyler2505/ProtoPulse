---
description: "Braking a BLDC motor at full speed on a 36V bus forces the motor's back-EMF current through the low-side MOSFETs, and dissipation scales with RPM squared — at 15A per motor that is substantial instantaneous heat, so firmware must ramp PWM to zero before engaging brake rather than going straight from full throttle to brake"
type: claim
source: "docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# speed must be reduced before braking at high voltage because back-EMF dissipation in MOSFETs scales with RPM

Dynamic braking on a BLDC controller shorts the motor phases through the low-side MOSFETs. The motor's rotation generates back-EMF, that back-EMF drives current through the shorted phases, and the current loop dissipates the kinetic energy as heat in the MOSFETs and the motor windings. This works — it is the intended braking mechanism — but the power dissipation scales with motor speed.

The math: back-EMF voltage is proportional to RPM (V_bemf = Kv × omega). Braking current through phase resistance is roughly V_bemf / R_phase. Power dissipated in the MOSFETs' Rds(on) is I² × R. Power therefore scales as RPM². A motor at full speed absorbs four times the braking power of a motor at half speed.

On a 36V hoverboard system where each ZS-X11H passes up to 16A under normal operation, engaging brake from full throttle means the MOSFETs must absorb the kinetic energy of a 250W continuous motor decelerating from maximum RPM. The instantaneous power dissipation at the moment brake engages can exceed the MOSFETs' thermal envelope, especially since the ZS-X11H has no thermal protection (per [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]]).

**The safe deceleration sequence:**
1. Ramp EL PWM from target speed toward stop over several hundred milliseconds (the inverted active-LOW convention means ramping the register value UP toward 255, per [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]])
2. Wait for motor RPM to drop below a threshold (e.g., 20% of full speed), monitored via SC pulse counting
3. Only then engage brake (CT LOW) for final stop
4. Release brake promptly once motion stops, per the dynamic-brake thermal rule

**Why this is distinct from the "brake must be pulsed" rule:** [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] addresses what happens when brake is held after the motor stops (shorting the supply through stationary windings). This note addresses what happens when brake is engaged while the motor is still at high speed (back-EMF dissipation through MOSFETs). Both are thermal failures, but the mechanism and the mitigation differ. The former requires release after stop; this note requires ramp before engage.

**The anti-pattern:** Emergency stop handlers that go directly from "full throttle" to "brake engaged":
```cpp
void emergencyStop() {
  analogWrite(EL_PIN, 255);       // stop PWM
  digitalWrite(BRAKE_PIN, LOW);   // engage brake
}
```
This works reliably on the bench because bench tests rarely run the motor at full speed before stopping. It fails in the field when a rover moving at top speed hits an obstacle and the emergency stop dissipates all that kinetic energy through a single set of MOSFETs in milliseconds.

**The better emergency stop** is to engage STOP (which de-energizes phases, letting the motor coast) rather than BRAKE (which shorts the phases). STOP is safe at any speed because it creates no current path; the motor decelerates from friction and residual losses, not from dumped back-EMF. BRAKE is for controlled deceleration only, and only after speed has been reduced.

**ProtoPulse implication:** The bench coach should generate speed-aware deceleration helpers and flag direct `brake()` calls that are not preceded by a speed-reduction ramp. This is especially important for dual-motor systems where both motors braking from full speed simultaneously doubles the thermal load on the shared battery bus.

---

Source: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] — the thermal risk after brake engages at stop; this note covers the thermal risk when brake engages at speed
- [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] — the inverted PWM convention that makes "ramp to stop" mean "ramp up toward 255"
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] — no thermal safety net means the firmware ramp is the only protection
- [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]] — similar principle: never command a sudden state change while kinetic energy is in motion

Topics:
- [[actuators]]
- [[eda-fundamentals]]
