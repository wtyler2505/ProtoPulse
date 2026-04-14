---
description: "The TB6612 can accept PWM up to 100kHz while the L298N caps at ~25kHz and the L293D at ~5kHz — MOSFETs have no minority-carrier storage time so they switch cleanly at radio frequencies, while Darlington BJTs require microseconds to clear their bases, setting a hard frequency ceiling below the audible range"
type: claim
source: "docs/parts/osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "osepp-tb6612-motor-shield"
  - "l293d-dual-h-bridge-ic"
  - "l298n-dual-h-bridge-motor-driver"
---

# TB6612 PWM ceiling of 100kHz is 4x the L298N and 20x the L293D because MOSFET switching has no storage time

PWM frequency on a motor driver is limited by how fast the output transistors can change state cleanly. The TB6612 accepts PWM up to 100kHz, the L298N is specified at roughly 25kHz, and the L293D degrades above about 5kHz. This is not a design choice — it is dictated by the underlying transistor physics.

MOSFETs switch by charging and discharging gate capacitance. Once the gate voltage crosses threshold, the channel forms or collapses almost instantly (nanoseconds). The only delay is RC time driving the gate, which for the TB6612's internal gate drivers is engineered to handle 100kHz cleanly. Bipolar Darlingtons must also deal with minority-carrier storage: after the base drive is removed, carriers remain in the base region and the transistor stays ON for microseconds until they recombine or are swept out. For a Darlington (two BJTs in cascade), this storage time compounds, producing hard frequency ceilings in the kHz range.

**Why this matters for motor audibility:** PWM below 20kHz produces audible whine because the motor itself acts as a loudspeaker — the coil vibrates at the PWM frequency. The L293D's 5kHz ceiling lands squarely in the most-annoying mid-frequency band. The L298N's 25kHz just barely escapes the audible range for adults (teenagers can still hear it). The TB6612 at 20-100kHz is comfortably ultrasonic for all users. For any project where noise matters — office robotics, assistive devices, quiet servos — the driver IC choice dictates audibility, and no amount of firmware can make a Darlington-based driver silent.

**Why this matters for current ripple and heating:** Higher PWM frequency means the motor inductance can smooth current more effectively, reducing ripple. Lower ripple means less heating in the motor windings and less magnetic saturation. A driver running at 25kHz produces 4x less current ripple than one at 5kHz into the same motor, at the same average current. This is a second efficiency dimension that compounds with the voltage-drop efficiency from [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]].

**Practical software implication:** Arduino's default PWM on pins 5 and 6 is ~980Hz; pins 3, 9, 10, 11 are ~490Hz. Both are far below the audible threshold and cause any motor driver to whine regardless of driver capability. Getting the TB6612's frequency advantage requires reconfiguring the timer registers to 20kHz+ using libraries like TimerOne or direct Timer1/Timer2 configuration. Using default Arduino PWM squanders the architectural advantage.

---

Source: [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]

Relevant Notes:
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — the voltage-drop efficiency dimension; frequency is the complementary second dimension
- [[74hc595-in-motor-shields-trades-gpio-savings-for-direction-change-latency-that-matters-at-high-switching-frequencies]] — shift-register latency sets ANOTHER ceiling on effective switching speed even when the driver could go faster
- [[bjt-switching-tops-out-at-600ma-in-to-92-and-the-transition-to-mosfet-is-a-hard-architecture-boundary]] — storage time is one of the physics reasons for the BJT-to-MOSFET transition
- [[hw-130-shield-consumes-both-timer0-and-timer2-leaving-only-timer1-free-for-other-libraries]] — reconfiguring timers for high PWM eats timer resources

Topics:
- [[actuators]]
- [[eda-fundamentals]]
